import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const IMAGES_DIR = path.join(DATA_DIR, 'images');
export const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
export const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails');
export const CHUNKS_DIR = path.join(DATA_DIR, 'chunks');

export function ensureStorageDirectories(): void {
  for (const dir of [DATA_DIR, IMAGES_DIR, VIDEOS_DIR, THUMBNAILS_DIR, CHUNKS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Normalizes a tenant ID to a safe filesystem key
 */
export function normalizeTenantId(tenantId?: string | null): string {
  if (!tenantId || tenantId.trim() === '' || tenantId === 'default' || tenantId === 'master' || tenantId === 'portal') {
    return 'tenant_nour';
  }
  const clean = tenantId.replace(/[^a-zA-Z0-9_-]/g, '').trim();
  return clean || 'tenant_nour';
}

/**
 * Offloads a single base64 Data URL (image, PDF, document, or video) to permanent disk storage
 * and returns its permanent `/api/images/...` or `/api/videos/stream/...` URL.
 * Uses SHA-256 content hashing so identical uploads reuse the existing file without duplication or data loss.
 */
export function offloadBase64ToDisk(dataUrl: string, prefix = 'media'): string {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  try {
    ensureStorageDirectories();
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return dataUrl;

    const header = dataUrl.slice(0, commaIdx);
    const base64Payload = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/^data:([^;]+);base64$/i);
    if (!mimeMatch || !base64Payload) return dataUrl;

    const mimeType = mimeMatch[1].toLowerCase();
    const buffer = Buffer.from(base64Payload, 'base64');
    if (buffer.length === 0) return dataUrl;

    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);

    if (mimeType.startsWith('video/')) {
      let ext = '.mp4';
      if (mimeType.includes('webm')) ext = '.webm';
      else if (mimeType.includes('quicktime') || mimeType.includes('mov')) ext = '.mov';
      else if (mimeType.includes('ogg')) ext = '.ogv';

      const videoId = `vid-${hash}`;
      const filename = `${videoId}${ext}`;
      const filePath = path.join(VIDEOS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
        fs.writeFileSync(tmpPath, buffer);
        fs.renameSync(tmpPath, filePath);
      }
      return `/api/videos/stream/${videoId}`;
    }

    let ext = '.jpg';
    if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('gif')) ext = '.gif';
    else if (mimeType.includes('svg')) ext = '.svg';
    else if (mimeType.includes('pdf')) ext = '.pdf';
    else if (mimeType.includes('word') || mimeType.includes('officedocument')) ext = '.docx';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';

    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'media';
    const filename = `${safePrefix}-${hash}${ext}`;
    const filePath = path.join(IMAGES_DIR, filename);

    if (!fs.existsSync(filePath)) {
      const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, filePath);
    }

    return `/api/images/${filename}`;
  } catch (err) {
    console.error('[StorageEngine] Failed to offload base64 media to disk:', err);
    return dataUrl;
  }
}

/**
 * Recursively traverses any JSON payload (objects/arrays) and offloads all embedded `data:` strings
 * into permanent disk files under `/data/images` or `/data/videos`.
 */
export function offloadEmbeddedMediaDeep<T>(input: T, keyHint = 'media'): T {
  if (!input) return input;

  if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      return offloadBase64ToDisk(input, keyHint) as unknown as T;
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item, idx) => offloadEmbeddedMediaDeep(item, `${keyHint}_${idx}`)) as unknown as T;
  }

  if (typeof input === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input as Record<string, any>)) {
      out[k] = offloadEmbeddedMediaDeep(v, k);
    }
    return out as T;
  }

  return input;
}

interface DiskCacheEntry<T> {
  data: T;
  mtimeMs: number;
}

const diskCacheMap = new Map<string, DiskCacheEntry<any>>();

/**
 * Reads a JSON file from disk with automatic mtime verification so in-memory cache
 * is NEVER stale if the file was modified on disk by another handler or process.
 */
export function readJsonFileSync<T>(filePath: string, fallbackFactory?: (() => T) | T): T {
  ensureStorageDirectories();
  const absPath = path.resolve(filePath);

  try {
    if (fs.existsSync(absPath)) {
      const stat = fs.statSync(absPath);
      const cached = diskCacheMap.get(absPath);
      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return cached.data as T;
      }

      const raw = fs.readFileSync(absPath, 'utf-8');
      if (raw && raw.trim()) {
        const parsed = JSON.parse(raw) as T;
        diskCacheMap.set(absPath, { data: parsed, mtimeMs: stat.mtimeMs });
        return parsed;
      }
    }
  } catch (err) {
    console.error(`[StorageEngine] Error reading ${absPath}:`, err);
    const cached = diskCacheMap.get(absPath);
    if (cached) return cached.data as T;
  }

  if (typeof fallbackFactory === 'function') {
    return (fallbackFactory as () => T)();
  }
  return fallbackFactory as T;
}

/**
 * Writes a JSON file atomically to disk (offloading any embedded base64 media first)
 * and updates the mtime-verified cache immediately.
 */
export function writeJsonFileAtomicSync<T>(filePath: string, data: T, prefixHint = 'media'): T {
  ensureStorageDirectories();
  const absPath = path.resolve(filePath);
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sanitizedData = offloadEmbeddedMediaDeep(data, prefixHint);
  const serialized = JSON.stringify(sanitizedData, null, 2);
  const tmpPath = `${absPath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;

  try {
    const fd = fs.openSync(tmpPath, 'w');
    try {
      fs.writeFileSync(fd, serialized, 'utf-8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, absPath);

    const stat = fs.statSync(absPath);
    diskCacheMap.set(absPath, { data: sanitizedData, mtimeMs: stat.mtimeMs });
    return sanitizedData;
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
    console.error(`[StorageEngine] Failed atomic write to ${absPath}:`, err);
    throw err;
  }
}

/**
 * High-capacity JSON request body reader (supports up to 150MB payloads for batch syncs/media).
 */
export function readLargeJsonBody(req: IncomingMessage, maxBytes = 150 * 1024 * 1024): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on('data', (chunk: Buffer) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        reject(new Error(`حجم البيانات المرسلة يتجاوز الحد الأقصى المسموح به (${Math.round(maxBytes / (1024 * 1024))} ميجابايت)`));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => {
      if (totalBytes === 0) {
        resolve({});
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        if (!raw.trim()) {
          resolve({});
          return;
        }
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('تنسيق البيانات المرسلة (JSON) غير صالح'));
      }
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Computes storage statistics across images, videos, thumbnails, and JSON databases.
 */
export function getStorageSystemMetrics() {
  ensureStorageDirectories();
  const countDir = (dir: string) => {
    let filesCount = 0;
    let bytes = 0;
    try {
      if (fs.existsSync(dir)) {
        for (const name of fs.readdirSync(dir)) {
          if (name.includes('.tmp.')) continue;
          const p = path.join(dir, name);
          const st = fs.statSync(p);
          if (st.isFile()) {
            filesCount++;
            bytes += st.size;
          }
        }
      }
    } catch {}
    return { filesCount, bytes };
  };

  const images = countDir(IMAGES_DIR);
  const videos = countDir(VIDEOS_DIR);
  const thumbnails = countDir(THUMBNAILS_DIR);
  const dbs = countDir(DATA_DIR);

  const totalUsedBytes = images.bytes + videos.bytes + thumbnails.bytes + dbs.bytes;
  const totalQuotaBytes = 50 * 1024 * 1024 * 1024; // 50 GB scalable storage allocation

  return {
    status: 'healthy',
    engine: 'Permanent Disk & Object Storage Engine v2',
    imagesCount: images.filesCount,
    imagesBytes: images.bytes,
    videosCount: videos.filesCount,
    videosBytes: videos.bytes,
    thumbnailsCount: thumbnails.filesCount,
    thumbnailsBytes: thumbnails.bytes,
    databasesCount: dbs.filesCount,
    databasesBytes: dbs.bytes,
    totalUsedBytes,
    totalQuotaBytes,
    maxVideoSizeMB: 2048,
    maxImageSizeMB: 100,
    timestamp: new Date().toISOString(),
  };
}

export function sendNoCacheJson(res: ServerResponse, statusCode: number, payload: any): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id, x-file-name, x-mime-type, x-video-id, x-chunk-index, x-total-chunks, x-activity-id, x-duration, x-width, x-height, x-resolution, x-thumbnail-saved');
  res.end(JSON.stringify(payload));
}
