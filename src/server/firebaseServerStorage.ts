import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, setLogLevel, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { IMAGES_DIR, VIDEOS_DIR, ensureStorageDirectories } from './storageEngine';

try {
  setLogLevel('silent');
} catch {}

const serverFirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfigData);

export const serverDb = getFirestore(
  serverFirebaseApp,
  firebaseConfigData.firestoreDatabaseId
);

// 600KB binary per chunk -> ~800KB base64 (safely below Firestore's 1 MiB document limit)
const CHUNK_BYTE_SIZE = 600 * 1024;
// Maximum binary size to mirror as chunks in Firestore (15 MB)
const MAX_CLOUD_CHUNK_FILE_BYTES = 15 * 1024 * 1024;

export interface CloudMediaMetadata {
  filename: string;
  originalName?: string;
  mimeType: string;
  size: number;
  url: string;
  storagePath?: string;
  tenantId?: string;
  category?: string;
  recordId?: string;
  uploadedBy?: string;
  uploadedByUid?: string;
}

function toSafeDocId(filename: string): string {
  const clean = path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `media_${clean}`;
}

/**
 * Persists a file's metadata to `media_files` and its binary chunks to `storage_chunks`
 * in Cloud Firestore so files are permanently backed up in Firebase and linked to the database.
 */
export async function persistFileToCloudFirestore(
  buffer: Buffer,
  meta: CloudMediaMetadata
): Promise<boolean> {
  try {
    const docId = toSafeDocId(meta.filename);
    const tenantId = meta.tenantId || 'tenant_nour';
    const category = meta.category || 'images';
    const uploadedBy = meta.uploadedBy || 'system';
    const uploadedByUid = meta.uploadedByUid || 'system_user';
    const storagePath =
      meta.storagePath ||
      `tenants/${tenantId}/${category}/${uploadedByUid}_${meta.filename}`;

    const canStoreChunks =
      buffer.length > 0 && buffer.length <= MAX_CLOUD_CHUNK_FILE_BYTES;
    const totalChunks = canStoreChunks
      ? Math.ceil(buffer.length / CHUNK_BYTE_SIZE)
      : 0;

    if (canStoreChunks && totalChunks > 0) {
      const BATCH_SIZE = 5;
      for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
        const batchPromises: Promise<void>[] = [];
        for (let i = batchStart; i < Math.min(batchStart + BATCH_SIZE, totalChunks); i++) {
          const start = i * CHUNK_BYTE_SIZE;
          const end = Math.min(start + CHUNK_BYTE_SIZE, buffer.length);
          const sliceBase64 = buffer.subarray(start, end).toString('base64');
          const chunkDocId = `${docId}_chunk_${i}`;
          batchPromises.push(
            setDoc(
              doc(serverDb, 'storage_chunks', chunkDocId),
              {
                id: chunkDocId,
                fileId: meta.filename,
                mediaDocId: docId,
                chunkIndex: i,
                totalChunks,
                byteLength: end - start,
                data: sliceBase64,
                tenantId,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            )
          );
        }
        await Promise.all(batchPromises);
      }
    }

    await setDoc(
      doc(serverDb, 'media_files', docId),
      {
        id: docId,
        fileName: meta.originalName || meta.filename,
        storedFileName: meta.filename,
        storagePath,
        bucket: firebaseConfigData.storageBucket,
        url: meta.url,
        contentType: meta.mimeType,
        size: meta.size,
        chunkCount: totalChunks,
        tenantId,
        category,
        recordId: meta.recordId || null,
        uploadedBy,
        uploadedByUid,
        uploadedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return true;
  } catch (err) {
    console.warn('[FirebaseServerStorage] Cloud persistence notice:', err);
    return false;
  }
}

/**
 * Restores a file from Cloud Firestore (`media_files` + `storage_chunks`) if it is ever
 * missing from local disk (`/data/images` or `/data/videos`), writing it atomically to disk.
 */
export async function restoreFileFromCloudFirestore(
  filename: string,
  targetDir = IMAGES_DIR
): Promise<Buffer | null> {
  try {
    ensureStorageDirectories();
    const safeFilename = path.basename(filename);
    const docId = toSafeDocId(safeFilename);
    const metaSnap = await getDoc(doc(serverDb, 'media_files', docId));

    if (!metaSnap.exists()) {
      return null;
    }

    const meta = metaSnap.data() as any;
    const totalChunks = Number(meta?.chunkCount || 0);
    if (totalChunks <= 0) {
      return null;
    }

    const buffers: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkDocId = `${docId}_chunk_${i}`;
      const chunkSnap = await getDoc(doc(serverDb, 'storage_chunks', chunkDocId));
      if (!chunkSnap.exists()) {
        return null;
      }
      const chunkData = chunkSnap.data() as any;
      if (!chunkData?.data || typeof chunkData.data !== 'string') {
        return null;
      }
      buffers.push(Buffer.from(chunkData.data, 'base64'));
    }

    const fullBuffer = Buffer.concat(buffers);
    if (fullBuffer.length === 0) {
      return null;
    }

    const filePath = path.join(targetDir, safeFilename);
    const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpPath, fullBuffer);
    fs.renameSync(tmpPath, filePath);

    return fullBuffer;
  } catch (err) {
    console.warn('[FirebaseServerStorage] Cloud restore notice:', err);
    return null;
  }
}

function inferMimeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.docx')
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mov') return 'video/quicktime';
  return 'image/jpeg';
}

/**
 * Background synchronization that ensures all existing files in `/data/images`
 * and small videos in `/data/videos` are backed up in Cloud Firestore (`media_files` & `storage_chunks`).
 */
let syncStarted = false;
export function syncLocalMediaToCloudInBackground(): void {
  if (syncStarted) return;
  syncStarted = true;

  setTimeout(async () => {
    try {
      ensureStorageDirectories();
      if (fs.existsSync(IMAGES_DIR)) {
        const files = fs.readdirSync(IMAGES_DIR).filter((f) => !f.includes('.tmp.'));
        for (const filename of files) {
          try {
            const filePath = path.join(IMAGES_DIR, filename);
            const stat = fs.statSync(filePath);
            if (!stat.isFile() || stat.size === 0 || stat.size > MAX_CLOUD_CHUNK_FILE_BYTES) {
              continue;
            }
            const docId = toSafeDocId(filename);
            const existing = await getDoc(doc(serverDb, 'media_files', docId));
            if (existing.exists() && Number(existing.data()?.chunkCount || 0) > 0) {
              continue;
            }
            const buffer = fs.readFileSync(filePath);
            await persistFileToCloudFirestore(buffer, {
              filename,
              originalName: filename,
              mimeType: inferMimeFromFilename(filename),
              size: buffer.length,
              url: `/api/images/${filename}`,
              tenantId: 'tenant_nour',
              category: 'images',
            });
          } catch {}
        }
      }

      if (fs.existsSync(VIDEOS_DIR)) {
        const vFiles = fs.readdirSync(VIDEOS_DIR).filter((f) => !f.includes('.tmp.'));
        for (const filename of vFiles) {
          try {
            const filePath = path.join(VIDEOS_DIR, filename);
            const stat = fs.statSync(filePath);
            if (!stat.isFile() || stat.size === 0 || stat.size > MAX_CLOUD_CHUNK_FILE_BYTES) {
              continue;
            }
            const docId = toSafeDocId(filename);
            const existing = await getDoc(doc(serverDb, 'media_files', docId));
            if (existing.exists() && Number(existing.data()?.chunkCount || 0) > 0) {
              continue;
            }
            const videoId = path.basename(filename, path.extname(filename));
            const buffer = fs.readFileSync(filePath);
            await persistFileToCloudFirestore(buffer, {
              filename,
              originalName: filename,
              mimeType: inferMimeFromFilename(filename),
              size: buffer.length,
              url: `/api/videos/stream/${videoId}`,
              tenantId: 'tenant_nour',
              category: 'videos',
            });
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[FirebaseServerStorage] Background sync notice:', err);
    }
  }, 2500);
}

export async function saveDocToFirebaseServer(
  collectionName: string,
  docId: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    await setDoc(doc(serverDb, collectionName, docId), data, { merge: true });
    return true;
  } catch (err) {
    console.warn(`[FirebaseServerStorage] saveDoc (${collectionName}/${docId}) notice:`, err);
    return false;
  }
}

export async function getDocFromFirebaseServer<T = any>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  try {
    const snap = await getDoc(doc(serverDb, collectionName, docId));
    if (snap.exists()) {
      return snap.data() as T;
    }
    return null;
  } catch (err) {
    console.warn(`[FirebaseServerStorage] getDoc (${collectionName}/${docId}) notice:`, err);
    return null;
  }
}

export async function listCollectionFromFirebaseServer<T = any>(
  collectionName: string
): Promise<T[]> {
  try {
    const snap = await getDocs(collection(serverDb, collectionName));
    const list: T[] = [];
    snap.forEach((d) => {
      list.push(d.data() as T);
    });
    return list;
  } catch (err) {
    console.warn(`[FirebaseServerStorage] listCollection (${collectionName}) notice:`, err);
    return [];
  }
}

export async function deleteDocFromFirebaseServer(
  collectionName: string,
  docId: string
): Promise<boolean> {
  try {
    await deleteDoc(doc(serverDb, collectionName, docId));
    return true;
  } catch (err) {
    console.warn(`[FirebaseServerStorage] deleteDoc (${collectionName}/${docId}) notice:`, err);
    return false;
  }
}

export async function syncTenantCollectionToFirebaseServer(
  collectionName: string,
  tenantId: string,
  items: any[],
  removedItemIds: string[] = []
): Promise<void> {
  try {
    const cleanTenant = tenantId || 'tenant_nour';
    const promises: Promise<any>[] = [];

    for (const item of items || []) {
      if (!item || !item.id) continue;
      const docId = `${cleanTenant}_${item.id}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
      promises.push(
        setDoc(
          doc(serverDb, collectionName, docId),
          {
            ...item,
            tenantId: item.tenantId || cleanTenant,
            associationId: item.associationId || cleanTenant,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      );
    }

    for (const remId of removedItemIds || []) {
      if (!remId) continue;
      const docId = `${cleanTenant}_${remId}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
      promises.push(deleteDoc(doc(serverDb, collectionName, docId)).catch(() => {}));
    }

    await Promise.all(promises);
  } catch (err) {
    console.warn(`[FirebaseServerStorage] syncTenantCollection (${collectionName}) notice:`, err);
  }
}


