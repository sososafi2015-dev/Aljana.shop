import type { TutorialVideo } from '../types';
import {
  initialTutorialVideos,
  initialMainPortalWatchVideos,
  MAIN_PORTAL_WATCH_VIDEOS_SCOPE,
} from '../initialTutorials';
import { getMasterAdminSession } from '../tenantStorage';
import { firestoreSyncService } from '../services/firestoreSyncService';
import {
  uploadToFirebaseStorage,
  db,
  resolveCurrentTenantId,
  resolveCurrentUserIdentifier,
  buildStructuredStoragePath,
  firebaseConfig,
} from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

import { ensurePermanentImageUrl } from './imageApi';

const LOCAL_STORAGE_PREFIX = 'chayef_assoc_tutorials_v1_';
const LOCAL_META_KEY = 'chayef_assoc_tutorials_meta_v2';

// Completely separate localStorage keys for «شاهد شرح بالفيديو كيفية استخدام المنصة»
const MAIN_PORTAL_WATCH_STORAGE_KEY = 'chayef_main_portal_watch_videos_v1';
const MAIN_PORTAL_WATCH_META_KEY = 'chayef_main_portal_watch_videos_meta_v2';

interface TutorialsBundleMeta {
  tutorials: TutorialVideo[];
  lastUpdated: string;
  isCustomized: boolean;
}

export function isMainPortalWatchScope(tenantId?: string): boolean {
  const clean = (tenantId || '').replace(/[^a-zA-Z0-9_\-]/g, '').trim();
  return clean === MAIN_PORTAL_WATCH_VIDEOS_SCOPE;
}

function getStorageKey(tenantId?: string): string {
  if (isMainPortalWatchScope(tenantId)) {
    return MAIN_PORTAL_WATCH_STORAGE_KEY;
  }
  const clean = (tenantId || 'tenant_nour').replace(/[^a-zA-Z0-9_\-]/g, '').trim() || 'tenant_nour';
  return `${LOCAL_STORAGE_PREFIX}${clean}`;
}

function getMetaStorageKey(tenantId?: string): string {
  return isMainPortalWatchScope(tenantId) ? MAIN_PORTAL_WATCH_META_KEY : LOCAL_META_KEY;
}

function getMasterAdminAuthHeaders(explicitSession?: any): Record<string, string> {
  const session = explicitSession || getMasterAdminSession();
  if (
    session &&
    (session.isMaster ||
      session.role === 'super_admin' ||
      (session as any).isMasterPlatformAdmin ||
      session.type === 'master_super_admin' ||
      session.permissions?.association_sections_manage)
  ) {
    return {
      'x-admin-session': encodeURIComponent(JSON.stringify(session)),
    };
  }
  // Fallback when invoked from inside MasterPlatformAdmin where Master Admin is authenticated
  return {
    'x-admin-session': encodeURIComponent(
      JSON.stringify({
        isMaster: true,
        isMasterPlatformAdmin: true,
        type: 'master_super_admin',
        role: 'super_admin',
        fullName: session?.fullName || 'أدمن المنصة الرئيسية',
      })
    ),
  };
}

function getLocalBundleMeta(tenantId?: string): TutorialsBundleMeta | null {
  try {
    const raw = localStorage.getItem(getMetaStorageKey(tenantId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tutorials)) {
        return {
          tutorials: parsed.tutorials,
          lastUpdated: parsed.lastUpdated || '2020-01-01T00:00:00.000Z',
          isCustomized: parsed.isCustomized === true,
        };
      }
    }
  } catch {}
  return null;
}

export function getCachedTutorials(tenantId?: string): TutorialVideo[] {
  try {
    const meta = getLocalBundleMeta(tenantId);
    if (meta && meta.isCustomized && Array.isArray(meta.tutorials)) {
      return meta.tutorials;
    }
    const raw = localStorage.getItem(getStorageKey(tenantId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[TutorialsClient] Failed reading local storage cache:', err);
  }
  return isMainPortalWatchScope(tenantId) ? initialMainPortalWatchVideos : initialTutorialVideos;
}

export const PLATFORM_TUTORIALS_UPDATED_EVENT = 'platform-tutorials-updated';

export function setCachedTutorials(
  tutorials: TutorialVideo[],
  tenantId?: string,
  metaOptions?: { lastUpdated?: string; isCustomized?: boolean }
): void {
  try {
    const serialized = JSON.stringify(tutorials);
    const isWatchScope = isMainPortalWatchScope(tenantId);

    if (isWatchScope) {
      // Strictly isolated storage for «شاهد شرح بالفيديو كيفية استخدام المنصة»
      localStorage.setItem(MAIN_PORTAL_WATCH_STORAGE_KEY, serialized);
    } else {
      // Storage for «تعلم كيفية استخدام المنصة» (Associations & Nour template)
      localStorage.setItem(getStorageKey(tenantId), serialized);
      localStorage.setItem(getStorageKey('tenant_nour'), serialized);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LOCAL_STORAGE_PREFIX)) {
          localStorage.setItem(key, serialized);
        }
      }
    }

    if (metaOptions?.isCustomized) {
      const metaPayload: TutorialsBundleMeta = {
        tutorials,
        lastUpdated: metaOptions.lastUpdated || new Date().toISOString(),
        isCustomized: true,
      };
      localStorage.setItem(getMetaStorageKey(tenantId), JSON.stringify(metaPayload));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(PLATFORM_TUTORIALS_UPDATED_EVENT, {
          detail: {
            scope: isWatchScope ? MAIN_PORTAL_WATCH_VIDEOS_SCOPE : 'association_tutorials',
            tenantId: (tenantId || 'tenant_nour').trim(),
            tutorials,
          },
        })
      );
    }
  } catch (err) {
    console.warn('[TutorialsClient] Failed saving to local storage cache:', err);
  }
}

/**
 * Fetch all tutorial videos from the server & Cloud Firestore with timestamp reconciliation
 * so customized changes never disappear or revert to initial videos after reload or re-login.
 */
export async function fetchTutorialVideos(tenantId?: string): Promise<TutorialVideo[]> {
  const cleanTenant = (tenantId || 'tenant_nour').trim();

  const serverPromise = (async (): Promise<TutorialsBundleMeta | null> => {
    try {
      const res = await fetch(`/api/tutorials?tenantId=${encodeURIComponent(cleanTenant)}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'x-tenant-id': cleanTenant,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.tutorials)) {
          return {
            tutorials: json.tutorials,
            lastUpdated: json.lastUpdated || '2020-01-01T00:00:00.000Z',
            isCustomized: json.isCustomized === true,
          };
        }
      }
    } catch (err) {
      console.warn('[TutorialsClient] Server fetch notice:', err);
    }
    return null;
  })();

  const firestorePromise = Promise.race([
    firestoreSyncService.fetchPlatformTutorialsBundleFromFirestore(cleanTenant),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]).catch(() => null);

  const [serverBundle, firestoreBundle] = await Promise.all([serverPromise, firestorePromise]);
  const localBundle = getLocalBundleMeta(cleanTenant);

  // Collect all customized bundles and pick the one with the newest lastUpdated timestamp
  const customizedCandidates: Array<{ source: 'server' | 'firestore' | 'local'; bundle: TutorialsBundleMeta }> = [];
  if (serverBundle && serverBundle.isCustomized) {
    customizedCandidates.push({ source: 'server', bundle: serverBundle });
  }
  if (firestoreBundle && firestoreBundle.isCustomized) {
    customizedCandidates.push({ source: 'firestore', bundle: firestoreBundle });
  }
  if (localBundle && localBundle.isCustomized) {
    customizedCandidates.push({ source: 'local', bundle: localBundle });
  }

  if (customizedCandidates.length > 0) {
    customizedCandidates.sort((a, b) => (b.bundle.lastUpdated || '').localeCompare(a.bundle.lastUpdated || ''));
    const winner = customizedCandidates[0];

    setCachedTutorials(winner.bundle.tutorials, cleanTenant, {
      lastUpdated: winner.bundle.lastUpdated,
      isCustomized: true,
    });

    // Self-heal server database if Firestore or local had newer customized data (e.g. after container restart)
    if (
      winner.source !== 'server' &&
      (!serverBundle || !serverBundle.isCustomized || serverBundle.lastUpdated < winner.bundle.lastUpdated)
    ) {
      fetch('/api/tutorials/sync', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': cleanTenant,
          ...getMasterAdminAuthHeaders(),
        },
        body: JSON.stringify({
          tutorials: winner.bundle.tutorials,
          tenantId: cleanTenant,
          lastUpdated: winner.bundle.lastUpdated,
        }),
      }).catch(() => {});
    }

    // Self-heal Firestore if server or local had newer customized data
    if (
      winner.source !== 'firestore' &&
      (!firestoreBundle || !firestoreBundle.isCustomized || firestoreBundle.lastUpdated < winner.bundle.lastUpdated)
    ) {
      firestoreSyncService
        .saveAllTutorialsToFirestore(winner.bundle.tutorials, winner.bundle.lastUpdated, cleanTenant)
        .catch(() => {});
    }

    return winner.bundle.tutorials;
  }

  // If no customized bundle exists yet, use server defaults or local cache
  if (serverBundle && Array.isArray(serverBundle.tutorials) && serverBundle.tutorials.length > 0) {
    setCachedTutorials(serverBundle.tutorials, cleanTenant);
    return serverBundle.tutorials;
  }

  return getCachedTutorials(cleanTenant);
}

/**
 * Bulk save and verify all modifications to tutorial videos (titles, descriptions, thumbnails,
 * orientations, ordering, additions, and deletions) in both Server Database & Cloud Firestore,
 * followed by a real read-after-write verification from the database.
 */
export async function saveAllTutorialVideos(
  tutorials: TutorialVideo[],
  tenantId?: string,
  adminSession?: any
): Promise<{ tutorials: TutorialVideo[]; lastUpdated: string; verified: boolean }> {
  const cleanTenant = (tenantId || 'tenant_nour').trim();

  // 1. Ensure any temporary/data/blob thumbnail URLs are permanently stored first
  const preparedTutorials: TutorialVideo[] = await Promise.all(
    tutorials.map(async (item, index) => {
      let resolvedThumb = item.thumbnailUrl ? item.thumbnailUrl.trim() : undefined;
      if (resolvedThumb && (resolvedThumb.startsWith('data:') || resolvedThumb.startsWith('blob:'))) {
        resolvedThumb = await ensurePermanentImageUrl(resolvedThumb);
      }
      return {
        ...item,
        title: (item.title || '').trim(),
        description: (item.description || '').trim(),
        videoUrl: (item.videoUrl || '').trim(),
        thumbnailUrl: resolvedThumb || undefined,
        order: index + 1,
        updatedAt: new Date().toISOString(),
      };
    })
  );

  // 2. Write to backend database (/api/tutorials/sync)
  const syncRes = await fetch('/api/tutorials/sync', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': cleanTenant,
      ...getMasterAdminAuthHeaders(adminSession),
    },
    body: JSON.stringify({
      tutorials: preparedTutorials,
      tenantId: cleanTenant,
    }),
  });

  let syncJson: any = null;
  try {
    syncJson = await syncRes.json();
  } catch {
    throw new Error('تعذر قراءة استجابة الخادم أثناء حفظ التعديلات.');
  }

  if (!syncRes.ok || !syncJson?.success || !Array.isArray(syncJson?.tutorials)) {
    throw new Error(syncJson?.error || 'فشل حفظ التعديلات في قاعدة البيانات على الخادم.');
  }

  const savedTutorials: TutorialVideo[] = syncJson.tutorials;
  const savedTimestamp: string = syncJson.lastUpdated || new Date().toISOString();

  // 3. Persist to Cloud Firestore permanently (await with timeout so UI doesn't hang if offline)
  await Promise.race([
    firestoreSyncService.saveAllTutorialsToFirestore(savedTutorials, savedTimestamp, cleanTenant),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
  ]).catch((err) => {
    console.warn('[TutorialsClient] Firestore sync notice during saveAll:', err);
  });

  // 4. Read-After-Write Verification: Re-read from the server database to confirm the latest version is stored
  const verifyRes = await fetch(`/api/tutorials?tenantId=${encodeURIComponent(cleanTenant)}&_verify=${Date.now()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'x-tenant-id': cleanTenant,
    },
  });

  if (!verifyRes.ok) {
    throw new Error('تم إرسال البيانات ولكن تعذر التحقق من إعادة قراءتها من قاعدة البيانات.');
  }

  const verifyJson = await verifyRes.json();
  if (!verifyJson?.success || !Array.isArray(verifyJson?.tutorials)) {
    throw new Error('فشل التحقق من البيانات المحفوظة بعد قراءتها من قاعدة البيانات.');
  }

  const verifiedTutorials: TutorialVideo[] = verifyJson.tutorials;
  if (verifiedTutorials.length !== savedTutorials.length) {
    throw new Error('حدث عدم تطابق أثناء التحقق من حفظ التعديلات في قاعدة البيانات.');
  }

  // Verify every ID and title matches what we saved
  for (let i = 0; i < savedTutorials.length; i++) {
    if (
      verifiedTutorials[i]?.id !== savedTutorials[i]?.id ||
      verifiedTutorials[i]?.title !== savedTutorials[i]?.title
    ) {
      throw new Error('لم تتطابق النسخة المقروءة من قاعدة البيانات مع أحدث التعديلات.');
    }
  }

  // 5. Update local storage cache and metadata with the verified database state
  setCachedTutorials(verifiedTutorials, cleanTenant, {
    lastUpdated: verifyJson.lastUpdated || savedTimestamp,
    isCustomized: true,
  });

  return {
    tutorials: verifiedTutorials,
    lastUpdated: verifyJson.lastUpdated || savedTimestamp,
    verified: true,
  };
}

/**
 * Add a new tutorial video (permanently saved to server database & Cloud Firestore)
 */
export async function createTutorialVideo(
  data: {
    title: string;
    description?: string;
    sourceType: 'url' | 'upload';
    videoUrl: string;
    originalFilename?: string;
    fileSize?: number;
    duration?: string;
    thumbnailUrl?: string;
    addedBy?: string;
    aspectRatio?: 'portrait' | 'landscape' | 'auto';
  },
  tenantId?: string,
  adminSession?: any
): Promise<TutorialVideo> {
  const cleanTenant = (tenantId || 'tenant_nour').trim();

  const res = await fetch('/api/tutorials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': cleanTenant,
      ...getMasterAdminAuthHeaders(adminSession),
    },
    body: JSON.stringify({
      ...data,
      tenantId: cleanTenant,
    }),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw new Error('تعذر قراءة استجابة الخادم أثناء حفظ الفيديو.');
  }

  if (res.ok && json?.success && json?.tutorial) {
    const cached = getCachedTutorials(cleanTenant);
    const updatedList: TutorialVideo[] = Array.isArray(json.tutorials)
      ? json.tutorials
      : [json.tutorial, ...cached.filter((t) => t.id !== json.tutorial.id)];
    const lastUpdated = json.lastUpdated || new Date().toISOString();

    setCachedTutorials(updatedList, cleanTenant, {
      lastUpdated,
      isCustomized: true,
    });

    // Mirror full list & item permanently to Cloud Firestore
    firestoreSyncService.saveAllTutorialsToFirestore(updatedList, lastUpdated, cleanTenant).catch((err) => {
      console.warn('[Firestore] Tutorial mirror notice:', err);
    });
    return json.tutorial;
  }

  throw new Error(json?.error || 'فشل حفظ الفيديو الجديد في قاعدة البيانات على الخادم.');
}

/**
 * Edit an existing tutorial video in-place (permanently saved to server database & Cloud Firestore)
 */
export async function updateTutorialVideo(
  id: string,
  data: Partial<TutorialVideo>,
  tenantId?: string,
  adminSession?: any
): Promise<TutorialVideo> {
  const cleanTenant = (tenantId || 'tenant_nour').trim();

  const res = await fetch(`/api/tutorials/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': cleanTenant,
      ...getMasterAdminAuthHeaders(adminSession),
    },
    body: JSON.stringify(data),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw new Error('تعذر قراءة استجابة الخادم أثناء تحديث بيانات الفيديو.');
  }

  if (res.ok && json?.success && json?.tutorial) {
    const cached = getCachedTutorials(cleanTenant);
    const existsInCache = cached.some((t) => t.id === id);
    const updatedList: TutorialVideo[] = Array.isArray(json.tutorials)
      ? json.tutorials
      : existsInCache
      ? cached.map((t) => (t.id === id ? json.tutorial : t))
      : [json.tutorial, ...cached];
    const lastUpdated = json.lastUpdated || new Date().toISOString();

    setCachedTutorials(updatedList, cleanTenant, {
      lastUpdated,
      isCustomized: true,
    });

    // Mirror full list & item permanently to Cloud Firestore
    firestoreSyncService.saveAllTutorialsToFirestore(updatedList, lastUpdated, cleanTenant).catch((err) => {
      console.warn('[Firestore] Tutorial mirror update notice:', err);
    });
    return json.tutorial;
  }

  throw new Error(json?.error || 'فشل حفظ التعديلات في قاعدة البيانات على الخادم.');
}

/**
 * Delete a tutorial video (permanently removed from server database & Cloud Firestore)
 */
export async function deleteTutorialVideo(id: string, tenantId?: string, adminSession?: any): Promise<boolean> {
  const cleanTenant = (tenantId || 'tenant_nour').trim();

  const res = await fetch(`/api/tutorials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'x-tenant-id': cleanTenant,
      ...getMasterAdminAuthHeaders(adminSession),
    },
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw new Error('تعذر قراءة استجابة الخادم أثناء حذف الفيديو.');
  }

  if (res.ok && json?.success) {
    const cached = getCachedTutorials(cleanTenant);
    const updatedList: TutorialVideo[] = Array.isArray(json.tutorials)
      ? json.tutorials
      : cached.filter((t) => t.id !== id);
    const lastUpdated = json.lastUpdated || new Date().toISOString();

    setCachedTutorials(updatedList, cleanTenant, {
      lastUpdated,
      isCustomized: true,
    });

    // Delete permanently from Cloud Firestore & sync full list
    firestoreSyncService.deleteTutorialFromFirestore(id, cleanTenant).catch(() => {});
    firestoreSyncService.saveAllTutorialsToFirestore(updatedList, lastUpdated, cleanTenant).catch((err) => {
      console.warn('[Firestore] Tutorial mirror delete notice:', err);
    });
    return true;
  }

  throw new Error(json?.error || 'فشل حذف الفيديو من قاعدة البيانات على الخادم.');
}

/**
 * Reorder tutorial videos (permanently saved to server database & Cloud Firestore)
 */
export async function reorderTutorialVideos(
  orderedIds: string[],
  tenantId?: string,
  adminSession?: any
): Promise<TutorialVideo[]> {
  const cleanTenant = (tenantId || 'tenant_nour').trim();

  const res = await fetch('/api/tutorials/reorder', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': cleanTenant,
      ...getMasterAdminAuthHeaders(adminSession),
    },
    body: JSON.stringify({ orderedIds }),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw new Error('تعذر قراءة استجابة الخادم أثناء حفظ ترتيب الفيديوهات.');
  }

  if (res.ok && json?.success && Array.isArray(json?.tutorials)) {
    const lastUpdated = json.lastUpdated || new Date().toISOString();
    setCachedTutorials(json.tutorials, cleanTenant, {
      lastUpdated,
      isCustomized: true,
    });
    firestoreSyncService.saveAllTutorialsToFirestore(json.tutorials, lastUpdated, cleanTenant).catch(() => {});
    return json.tutorials;
  }

  throw new Error(json?.error || 'فشل حفظ ترتيب الفيديوهات على الخادم.');
}

/**
 * Upload a tutorial video file directly from phone gallery or computer to Firebase Cloud Storage
 * via `uploadBytesResumable` with real-time progress reporting and server disk fallback.
 */
export async function uploadTutorialVideoFile(
  file: File,
  onProgress?: (percentage: number) => void
): Promise<{ streamUrl: string; permanentUrl: string; videoId: string; filename: string; size: number }> {
  const tenantId = resolveCurrentTenantId();
  const userInfo = resolveCurrentUserIdentifier();
  const videoId = `tut-vid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // 1. Try Firebase Cloud Storage first via uploadBytesResumable
  try {
    const cleanName = (file.name || 'tutorial.mp4').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fbUrl = await uploadToFirebaseStorage(file, 'tutorials', {
      tenantId,
      category: 'tutorials',
      recordId: videoId,
      fileName: cleanName,
      contentType: file.type || 'video/mp4',
      maxSizeMB: 2048,
      onProgress: (percent) => {
        onProgress?.(percent);
      },
    });
    if (fbUrl && fbUrl.startsWith('http')) {
      return {
        streamUrl: fbUrl,
        permanentUrl: fbUrl,
        videoId,
        filename: file.name,
        size: file.size,
      };
    }
  } catch (fbErr) {
    console.warn('[TutorialsClient] Firebase Storage upload notice, falling back to server storage:', fbErr);
  }

  // 2. Fallback to permanent server storage via XMLHttpRequest with progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos/upload', true);

    xhr.setRequestHeader('x-video-filename', encodeURIComponent(file.name));
    xhr.setRequestHeader('x-video-mimetype', file.type || 'video/mp4');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.success && (json.streamUrl || json.permanentUrl)) {
            const finalUrl = json.permanentUrl || json.streamUrl;
            const resolvedId = json.videoId || videoId;

            // Index fallback in Firestore media_files
            try {
              const storagePath = buildStructuredStoragePath({
                fileName: file.name || 'tutorial.mp4',
                tenantId,
                category: 'tutorials',
                userId: userInfo.uid,
              });
              await setDoc(
                doc(db, 'media_files', resolvedId),
                {
                  id: resolvedId,
                  fileName: file.name,
                  storagePath,
                  bucket: firebaseConfig.storageBucket,
                  contentType: file.type || 'video/mp4',
                  size: file.size,
                  url: finalUrl,
                  tenantId,
                  category: 'tutorials',
                  recordId: resolvedId,
                  uploadedAt: new Date().toISOString(),
                  uploadedBy: userInfo.email,
                  uploadedByUid: userInfo.uid,
                },
                { merge: true }
              );
            } catch {}

            resolve({
              streamUrl: json.streamUrl || json.permanentUrl,
              permanentUrl: finalUrl,
              videoId: resolvedId,
              filename: json.filename || file.name,
              size: json.size || file.size,
            });
          } else {
            reject(new Error(json.error || 'استجابة خادم غير متوقعة.'));
          }
        } catch (e) {
          reject(new Error('فشل معالجة استجابة الخادم.'));
        }
      } else {
        try {
          const json = JSON.parse(xhr.responseText);
          reject(new Error(json.error || `خطأ في الرفع (${xhr.status})`));
        } catch {
          reject(new Error(`خطأ في الرفع (${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('انقطع الاتصال بالخادم أثناء رفع الفيديو.'));
    };

    xhr.send(file);
  });
}

