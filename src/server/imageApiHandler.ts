import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IMAGES_DIR, ensureStorageDirectories, offloadBase64ToDisk, readLargeJsonBody } from './storageEngine';
import {
  persistFileToCloudFirestore,
  restoreFileFromCloudFirestore,
  syncLocalMediaToCloudInBackground,
} from './firebaseServerStorage';

function ensureImagesDir() {
  ensureStorageDirectories();
  syncLocalMediaToCloudInBackground();
}

function getExtensionFromMime(mime: string, originalName?: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('gif')) return '.gif';
  if (m.includes('svg')) return '.svg';
  if (m.includes('pdf')) return '.pdf';
  if (m.includes('officedocument.wordprocessingml') || m.includes('docx')) return '.docx';
  if (m.includes('msword') || m.includes('doc')) return '.doc';
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';

  if (originalName) {
    const ext = path.extname(originalName).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.pdf', '.doc', '.docx'].includes(ext)) {
      return ext;
    }
  }
  return '.jpg';
}

function getMimeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  if (e === '.gif') return 'image/gif';
  if (e === '.svg') return 'image/svg+xml';
  if (e === '.pdf') return 'application/pdf';
  if (e === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (e === '.doc') return 'application/msword';
  return 'image/jpeg';
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-file-name, x-mime-type, x-image-filename, x-image-mimetype, x-admin-session, x-tenant-id, x-storage-category, x-storage-path, x-record-id, x-uploaded-by, x-uploaded-by-uid'
  );
  res.end(JSON.stringify(data));
}

export async function handleImageApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  if (!url.startsWith('/api/images')) {
    return false;
  }

  ensureImagesDir();

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return true;
  }

  const cleanPath = url.split('?')[0];

  // 1. POST /api/images/upload (Direct binary stream upload up to 100MB)
  if (req.method === 'POST' && cleanPath === '/api/images/upload') {
    req.setTimeout(10 * 60 * 1000);
    res.setTimeout(10 * 60 * 1000);

    try {
      const rawName = (req.headers['x-image-filename'] || req.headers['x-file-name'])
        ? decodeURIComponent(String(req.headers['x-image-filename'] || req.headers['x-file-name']))
        : 'image.jpg';
      const mimeType = String(req.headers['x-image-mimetype'] || req.headers['x-mime-type'] || req.headers['content-type'] || 'image/jpeg');
      const tenantId = req.headers['x-tenant-id'] ? decodeURIComponent(String(req.headers['x-tenant-id'])) : 'tenant_nour';
      const category = req.headers['x-storage-category'] ? decodeURIComponent(String(req.headers['x-storage-category'])) : 'images';
      const storagePath = req.headers['x-storage-path'] ? decodeURIComponent(String(req.headers['x-storage-path'])) : undefined;
      const recordId = req.headers['x-record-id'] ? decodeURIComponent(String(req.headers['x-record-id'])) : undefined;
      const uploadedBy = req.headers['x-uploaded-by'] ? decodeURIComponent(String(req.headers['x-uploaded-by'])) : 'system';
      const uploadedByUid = req.headers['x-uploaded-by-uid'] ? decodeURIComponent(String(req.headers['x-uploaded-by-uid'])) : 'system_user';
      const ext = getExtensionFromMime(mimeType, rawName);

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      const MAX_BYTES = 100 * 1024 * 1024; // 100MB max per image/document

      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buf.length;
          if (totalBytes > MAX_BYTES) {
            reject(new Error('حجم الصورة أو المستند يتجاوز الحد الأقصى المسموح به (100 ميجابايت)'));
            req.destroy();
            return;
          }
          chunks.push(buf);
        });
        req.on('end', () => resolve());
        req.on('error', (err) => reject(err));
      });

      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        sendJson(res, 400, { success: false, error: 'ملف الصورة فارغ' });
        return true;
      }

      const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
      const filename = `img-${hash}${ext}`;
      const filePath = path.join(IMAGES_DIR, filename);

      if (!fs.existsSync(filePath)) {
        const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
        fs.writeFileSync(tmpPath, buffer);
        fs.renameSync(tmpPath, filePath);
      }

      const imageUrl = `/api/images/${filename}`;
      const resolvedMime = getMimeFromExt(ext);

      // Permanently persist metadata & binary chunks in Cloud Firestore
      await persistFileToCloudFirestore(buffer, {
        filename,
        originalName: rawName,
        mimeType: resolvedMime,
        size: buffer.length,
        url: imageUrl,
        storagePath,
        tenantId,
        category,
        recordId,
        uploadedBy,
        uploadedByUid,
      });

      sendJson(res, 201, {
        success: true,
        url: imageUrl,
        filename,
        size: buffer.length,
        mimeType: resolvedMime,
      });
      return true;
    } catch (err: any) {
      console.error('[ImageStorage] Upload error:', err);
      sendJson(res, 500, { success: false, error: err?.message || 'فشل رفع وحفظ الصورة على الخادم' });
      return true;
    }
  }

  // 2. POST /api/images/base64 (Convert Base64 DataURL to permanent file on disk + Cloud Firestore)
  if (req.method === 'POST' && cleanPath === '/api/images/base64') {
    req.setTimeout(10 * 60 * 1000);
    res.setTimeout(10 * 60 * 1000);

    try {
      const parsed = await readLargeJsonBody(req, 100 * 1024 * 1024);
      const dataUrl = String(parsed.dataUrl || '');

      if (!dataUrl.startsWith('data:')) {
        sendJson(res, 200, { success: true, url: dataUrl });
        return true;
      }

      const permanentUrl = offloadBase64ToDisk(dataUrl, parsed.prefix || 'img');
      if (!permanentUrl || permanentUrl.startsWith('data:')) {
        sendJson(res, 400, { success: false, error: 'صيغة البيانات Base64 غير صالحة' });
        return true;
      }

      const filename = permanentUrl.replace('/api/images/', '');
      const filePath = path.join(IMAGES_DIR, path.basename(filename));
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filename);
        await persistFileToCloudFirestore(buffer, {
          filename: path.basename(filename),
          originalName: parsed.fileName || path.basename(filename),
          mimeType: getMimeFromExt(ext),
          size: buffer.length,
          url: permanentUrl,
          tenantId: parsed.tenantId || 'tenant_nour',
          category: parsed.category || parsed.prefix || 'images',
          recordId: parsed.recordId,
          uploadedBy: parsed.uploadedBy || 'system',
          uploadedByUid: parsed.uploadedByUid || 'system_user',
        });
      }

      sendJson(res, 201, {
        success: true,
        url: permanentUrl,
        filename,
      });
      return true;
    } catch (err: any) {
      console.error('[ImageStorage] Base64 upload error:', err);
      sendJson(res, 500, { success: false, error: err?.message || 'فشل حفظ الصورة على الخادم' });
      return true;
    }
  }

  // 3. GET /api/images/:filename (Serve stored image or document with Cloud Firestore self-healing)
  if (req.method === 'GET' && cleanPath.startsWith('/api/images/')) {
    const rawFilename = decodeURIComponent(cleanPath.replace('/api/images/', '')).trim();
    const safeFilename = path.basename(rawFilename);
    const filePath = path.join(IMAGES_DIR, safeFilename);

    if (!safeFilename) {
      res.statusCode = 404;
      res.end('Image not found');
      return true;
    }

    if (!fs.existsSync(filePath)) {
      const restored = await restoreFileFromCloudFirestore(safeFilename, IMAGES_DIR);
      if (!restored || !fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('Image not found');
        return true;
      }
    }

    try {
      const stat = fs.statSync(filePath);
      const ext = path.extname(safeFilename);
      res.statusCode = 200;
      res.setHeader('Content-Type', getMimeFromExt(ext));
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      fs.createReadStream(filePath).pipe(res);
      return true;
    } catch (err) {
      res.statusCode = 500;
      res.end('Error reading image');
      return true;
    }
  }

  return false;
}

