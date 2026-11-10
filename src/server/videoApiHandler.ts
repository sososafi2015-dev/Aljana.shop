import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import {
  DATA_DIR,
  VIDEOS_DIR,
  THUMBNAILS_DIR,
  CHUNKS_DIR,
  ensureStorageDirectories,
  readJsonFileSync,
  writeJsonFileAtomicSync,
  readLargeJsonBody,
} from './storageEngine';
import {
  persistFileToCloudFirestore,
  restoreFileFromCloudFirestore,
} from './firebaseServerStorage';

export interface StoredVideoRecord {
  id: string;
  activityId?: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileSizeFormatted: string;
  duration: number;
  durationFormatted: string;
  width: number;
  height: number;
  resolution: string;
  storageKey: string;
  cdnUrl: string;
  thumbnailUrl: string;
  fileName: string;
  thumbnailFileName?: string;
  processingStatus: 'uploading' | 'processing' | 'ready' | 'error';
  uploadedAt: string;
  isUploadedDirectly: boolean;
}

const REGISTRY_FILE = path.join(DATA_DIR, 'videos_registry.json');

function ensureVideoDirectories() {
  ensureStorageDirectories();
  if (!fs.existsSync(REGISTRY_FILE)) {
    writeJsonFileAtomicSync(REGISTRY_FILE, []);
  }
}

export function loadVideosRegistry(): StoredVideoRecord[] {
  ensureVideoDirectories();
  const parsed = readJsonFileSync<StoredVideoRecord[]>(REGISTRY_FILE, () => []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveVideosRegistry(records: StoredVideoRecord[]) {
  ensureVideoDirectories();
  writeJsonFileAtomicSync(REGISTRY_FILE, records, 'video_thumb');
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 بايت';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} ميجابايت`;
  const kb = bytes / 1024;
  return `${Math.round(kb)} كيلوبايت`;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getExtensionFromMime(mimeType: string, originalName: string): string {
  const lowerMime = (mimeType || '').toLowerCase();
  if (lowerMime.includes('webm')) return '.webm';
  if (lowerMime.includes('quicktime') || lowerMime.includes('mov')) return '.mov';
  if (lowerMime.includes('ogg')) return '.ogv';
  if (originalName) {
    const ext = path.extname(originalName).toLowerCase();
    if (['.mp4', '.webm', '.mov', '.m4v', '.ogv'].includes(ext)) {
      return ext;
    }
  }
  return '.mp4';
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-video-id, x-file-name, x-mime-type, x-activity-id, x-duration, x-width, x-height, x-resolution, x-thumbnail-saved, x-chunk-index, x-total-chunks, x-file-size, x-tenant-id, x-storage-category, x-storage-path, x-record-id, x-uploaded-by, x-uploaded-by-uid'
  );
  res.end(JSON.stringify(data));
}

/**
 * Resolves a video file on disk by videoId even if registry is missing the entry
 */
function findPhysicalVideoFile(videoId: string): { filePath: string; fileName: string; mimeType: string } | null {
  ensureVideoDirectories();
  const safeId = path.basename(videoId);
  for (const ext of ['.mp4', '.webm', '.mov', '.m4v', '.ogv']) {
    const candidate = `${safeId}${ext}`;
    const fullPath = path.join(VIDEOS_DIR, candidate);
    if (fs.existsSync(fullPath)) {
      const mimeType =
        ext === '.webm'
          ? 'video/webm'
          : ext === '.mov'
          ? 'video/quicktime'
          : ext === '.ogv'
          ? 'video/ogg'
          : 'video/mp4';
      return { filePath: fullPath, fileName: candidate, mimeType };
    }
  }
  return null;
}

export async function handleVideoApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  if (!url.startsWith('/api/videos')) {
    return false;
  }

  ensureVideoDirectories();

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return true;
  }

  const cleanPath = url.split('?')[0];

  // 1. POST /api/videos/thumbnail -> Upload Base64 JPEG Thumbnail to disk
  if (req.method === 'POST' && cleanPath === '/api/videos/thumbnail') {
    try {
      const parsed = await readLargeJsonBody(req, 25 * 1024 * 1024);
      const { videoId, dataUrl } = parsed;
      if (!videoId || !dataUrl) {
        sendJson(res, 400, { success: false, error: 'Missing videoId or dataUrl' });
        return true;
      }

      const safeVideoId = path.basename(String(videoId));
      const base64Match = String(dataUrl).match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      const base64Data = base64Match ? base64Match[2] : String(dataUrl).split(',')[1];

      if (!base64Data) {
        sendJson(res, 400, { success: false, error: 'Invalid base64 image data' });
        return true;
      }

      const thumbFileName = `${safeVideoId}.jpg`;
      const thumbPath = path.join(THUMBNAILS_DIR, thumbFileName);
      const tmpPath = `${thumbPath}.tmp.${process.pid}.${Date.now()}`;
      const thumbBuffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(tmpPath, thumbBuffer);
      fs.renameSync(tmpPath, thumbPath);

      const thumbnailUrl = `/api/videos/thumbnail/${safeVideoId}`;

      const records = loadVideosRegistry();
      const idx = records.findIndex((r) => r.id === safeVideoId);
      if (idx !== -1) {
        records[idx].thumbnailUrl = thumbnailUrl;
        records[idx].thumbnailFileName = thumbFileName;
        saveVideosRegistry(records);
      }

      // Persist thumbnail in Cloud Firestore for permanent availability
      persistFileToCloudFirestore(thumbBuffer, {
        filename: thumbFileName,
        originalName: thumbFileName,
        mimeType: 'image/jpeg',
        size: thumbBuffer.length,
        url: thumbnailUrl,
        category: 'video_thumbnails',
        recordId: safeVideoId,
      }).catch(() => {});

      sendJson(res, 200, {
        success: true,
        thumbnailUrl,
        thumbnailFileName: thumbFileName,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'Failed to save thumbnail' });
      return true;
    }
  }

  // 2. POST /api/videos/upload-chunk -> Chunked upload for large videos (supports up to 2GB total)
  if (req.method === 'POST' && cleanPath === '/api/videos/upload-chunk') {
    req.setTimeout(15 * 60 * 1000);
    res.setTimeout(15 * 60 * 1000);

    try {
      const rawId = String(req.headers['x-video-id'] || '').trim();
      const videoId = path.basename(rawId || `vid-${Date.now()}`);
      const chunkIndex = Number(req.headers['x-chunk-index'] ?? 0);
      const totalChunks = Number(req.headers['x-total-chunks'] ?? 1);

      if (!videoId || isNaN(chunkIndex) || chunkIndex < 0) {
        sendJson(res, 400, { success: false, error: 'بيانات جزء الفيديو غير صالحة' });
        return true;
      }

      const videoChunkDir = path.join(CHUNKS_DIR, videoId);
      if (!fs.existsSync(videoChunkDir)) {
        fs.mkdirSync(videoChunkDir, { recursive: true });
      }

      const chunkFilePath = path.join(videoChunkDir, `chunk_${String(chunkIndex).padStart(6, '0')}.part`);
      const chunks: Buffer[] = [];
      let chunkBytes = 0;
      const MAX_CHUNK_BYTES = 50 * 1024 * 1024; // 50MB max per individual chunk

      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          chunkBytes += buf.length;
          if (chunkBytes > MAX_CHUNK_BYTES) {
            reject(new Error('حجم الجزء الواحد كبير جدًا'));
            req.destroy();
            return;
          }
          chunks.push(buf);
        });
        req.on('end', () => resolve());
        req.on('error', (err) => reject(err));
      });

      const buffer = Buffer.concat(chunks);
      const tmpPart = `${chunkFilePath}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmpPart, buffer);
      fs.renameSync(tmpPart, chunkFilePath);

      sendJson(res, 200, {
        success: true,
        videoId,
        chunkIndex,
        totalChunks,
        receivedBytes: buffer.length,
      });
      return true;
    } catch (err: any) {
      console.error('[VideoStorage] Chunk upload error:', err);
      sendJson(res, 500, { success: false, error: err?.message || 'فشل رفع جزء الفيديو إلى الخادم' });
      return true;
    }
  }

  // 3. POST /api/videos/upload-complete -> Assemble chunks into permanent video file on disk
  if (req.method === 'POST' && cleanPath === '/api/videos/upload-complete') {
    req.setTimeout(30 * 60 * 1000);
    res.setTimeout(30 * 60 * 1000);

    try {
      const body = await readLargeJsonBody(req, 10 * 1024 * 1024);
      const videoId = path.basename(String(body.videoId || '').trim());
      const originalName = String(body.originalName || 'activity-video.mp4');
      const mimeType = String(body.mimeType || 'video/mp4');
      const activityId = body.activityId ? String(body.activityId) : undefined;
      const duration = Number(body.duration || 0);
      const width = Number(body.width || 1280);
      const height = Number(body.height || 720);
      const resolution = String(body.resolution || '720p HD');
      const hasThumb = Boolean(body.thumbnailSaved);
      const totalChunks = Number(body.totalChunks || 1);

      if (!videoId) {
        sendJson(res, 400, { success: false, error: 'معرف الفيديو مفقود' });
        return true;
      }

      const videoChunkDir = path.join(CHUNKS_DIR, videoId);
      if (!fs.existsSync(videoChunkDir)) {
        sendJson(res, 400, { success: false, error: 'لم يتم العثور على أجزاء الفيديو المرفوعة على الخادم' });
        return true;
      }

      const ext = getExtensionFromMime(mimeType, originalName);
      const fileName = `${videoId}${ext}`;
      const finalFilePath = path.join(VIDEOS_DIR, fileName);
      const tmpFinalPath = `${finalFilePath}.tmp.${process.pid}.${Date.now()}`;

      let totalAssembledBytes = 0;
      const writeFd = fs.openSync(tmpFinalPath, 'w');
      try {
        for (let i = 0; i < totalChunks; i++) {
          const partPath = path.join(videoChunkDir, `chunk_${String(i).padStart(6, '0')}.part`);
          if (!fs.existsSync(partPath)) {
            throw new Error(`الجزء رقم ${i + 1} من ${totalChunks} مفقود، يرجى إعادة المحاولة.`);
          }
          const partBuffer = fs.readFileSync(partPath);
          fs.writeSync(writeFd, partBuffer);
          totalAssembledBytes += partBuffer.length;
        }
        fs.fsyncSync(writeFd);
      } finally {
        fs.closeSync(writeFd);
      }

      fs.renameSync(tmpFinalPath, finalFilePath);

      // Clean up temporary chunks directory
      try {
        for (const f of fs.readdirSync(videoChunkDir)) {
          fs.unlinkSync(path.join(videoChunkDir, f));
        }
        fs.rmdirSync(videoChunkDir);
      } catch {}

      const streamUrl = `/api/videos/stream/${videoId}`;
      const thumbPath = path.join(THUMBNAILS_DIR, `${videoId}.jpg`);
      const thumbExists = hasThumb || fs.existsSync(thumbPath);
      const thumbnailUrl = thumbExists ? `/api/videos/thumbnail/${videoId}` : '';

      const record: StoredVideoRecord = {
        id: videoId,
        activityId,
        originalName,
        mimeType: mimeType.startsWith('video/') ? mimeType : 'video/mp4',
        fileSize: totalAssembledBytes,
        fileSizeFormatted: formatBytes(totalAssembledBytes),
        duration,
        durationFormatted: formatDuration(duration),
        width,
        height,
        resolution,
        storageKey: `videos/${fileName}`,
        cdnUrl: streamUrl,
        thumbnailUrl,
        fileName,
        thumbnailFileName: thumbExists ? `${videoId}.jpg` : undefined,
        processingStatus: 'ready',
        uploadedAt: new Date().toISOString(),
        isUploadedDirectly: true,
      };

      const records = loadVideosRegistry();
      const filtered = records.filter((r) => r.id !== videoId);
      filtered.unshift(record);
      saveVideosRegistry(filtered);

      // Persist video metadata & binary chunks (if <= 15MB) in Cloud Firestore
      try {
        const videoBuf =
          totalAssembledBytes <= 15 * 1024 * 1024
            ? fs.readFileSync(finalFilePath)
            : Buffer.alloc(0);
        await persistFileToCloudFirestore(videoBuf, {
          filename: fileName,
          originalName,
          mimeType: record.mimeType,
          size: totalAssembledBytes,
          url: streamUrl,
          category: 'videos',
          recordId: activityId || videoId,
        });
      } catch {}

      sendJson(res, 201, {
        success: true,
        video: record,
      });
      return true;
    } catch (err: any) {
      console.error('[VideoStorage] Complete chunked upload error:', err);
      sendJson(res, 500, { success: false, error: err?.message || 'فشل تجميع وحفظ ملف الفيديو على الخادم' });
      return true;
    }
  }

  // 4. POST /api/videos/upload -> Direct Binary Stream Upload to Disk (supports up to 2GB)
  if (req.method === 'POST' && cleanPath === '/api/videos/upload') {
    req.setTimeout(30 * 60 * 1000);
    res.setTimeout(30 * 60 * 1000);

    try {
      const rawId = String(req.headers['x-video-id'] || '').trim();
      const videoId = path.basename(rawId || `vid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
      const originalName = req.headers['x-file-name']
        ? decodeURIComponent(String(req.headers['x-file-name']))
        : 'activity-video.mp4';
      const mimeType = String(req.headers['x-mime-type'] || req.headers['content-type'] || 'video/mp4');
      const activityId = req.headers['x-activity-id'] ? String(req.headers['x-activity-id']) : undefined;
      const duration = Number(req.headers['x-duration'] || 0);
      const width = Number(req.headers['x-width'] || 1280);
      const height = Number(req.headers['x-height'] || 720);
      const resolution = String(req.headers['x-resolution'] || '720p HD');
      const hasThumb = req.headers['x-thumbnail-saved'] === 'true';

      const ext = getExtensionFromMime(mimeType, originalName);
      const fileName = `${videoId}${ext}`;
      const filePath = path.join(VIDEOS_DIR, fileName);
      const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;

      let totalBytes = 0;
      const MAX_BYTES = 2048 * 1024 * 1024; // 2 GB max video upload limit
      const writeStream = fs.createWriteStream(tmpPath);

      req.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BYTES) {
          writeStream.destroy();
          try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
          } catch {}
          sendJson(res, 413, {
            success: false,
            error: 'حجم ملف الفيديو يتجاوز الحد الأقصى المسموح به (2 جيجابايت)',
          });
          req.destroy();
        }
      });

      req.pipe(writeStream);

      writeStream.on('finish', () => {
        if (res.writableEnded) return;
        try {
          fs.renameSync(tmpPath, filePath);
        } catch (renameErr) {
          console.error('[VideoStorage] Rename error:', renameErr);
        }

        const streamUrl = `/api/videos/stream/${videoId}`;
        const thumbPath = path.join(THUMBNAILS_DIR, `${videoId}.jpg`);
        const thumbExists = hasThumb || fs.existsSync(thumbPath);
        const thumbnailUrl = thumbExists ? `/api/videos/thumbnail/${videoId}` : '';

        const record: StoredVideoRecord = {
          id: videoId,
          activityId,
          originalName,
          mimeType: mimeType.startsWith('video/') ? mimeType : 'video/mp4',
          fileSize: totalBytes,
          fileSizeFormatted: formatBytes(totalBytes),
          duration,
          durationFormatted: formatDuration(duration),
          width,
          height,
          resolution,
          storageKey: `videos/${fileName}`,
          cdnUrl: streamUrl,
          thumbnailUrl,
          fileName,
          thumbnailFileName: thumbExists ? `${videoId}.jpg` : undefined,
          processingStatus: 'ready',
          uploadedAt: new Date().toISOString(),
          isUploadedDirectly: true,
        };

        const records = loadVideosRegistry();
        const filtered = records.filter((r) => r.id !== videoId);
        filtered.unshift(record);
        saveVideosRegistry(filtered);

        // Persist video metadata & binary chunks (if <= 15MB) in Cloud Firestore
        const finalizeCloud = async () => {
          try {
            const videoBuf =
              totalBytes <= 15 * 1024 * 1024 && fs.existsSync(filePath)
                ? fs.readFileSync(filePath)
                : Buffer.alloc(0);
            await persistFileToCloudFirestore(videoBuf, {
              filename: fileName,
              originalName,
              mimeType: record.mimeType,
              size: totalBytes,
              url: streamUrl,
              category: 'videos',
              recordId: activityId || videoId,
            });
          } catch {}
        };
        finalizeCloud().finally(() => {
          sendJson(res, 201, {
            success: true,
            video: record,
          });
        });
      });

      writeStream.on('error', (err) => {
        console.error('[VideoStorage] Write stream error:', err);
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch {}
        if (!res.writableEnded) {
          sendJson(res, 500, { success: false, error: 'فشل حفظ ملف الفيديو على الخادم' });
        }
      });

      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ أثناء رفع الفيديو' });
      return true;
    }
  }

  // 5. GET /api/videos/stream/:id -> HTTP 206 Partial Content Range Video Streaming
  if (req.method === 'GET' && cleanPath.startsWith('/api/videos/stream/')) {
    const videoId = decodeURIComponent(cleanPath.replace('/api/videos/stream/', '')).trim();
    const records = loadVideosRegistry();
    const record = records.find((r) => r.id === videoId);

    let filePath = record ? path.join(VIDEOS_DIR, record.fileName) : '';
    let contentType = record?.mimeType || 'video/mp4';

    if (!filePath || !fs.existsSync(filePath)) {
      let physical = findPhysicalVideoFile(videoId);
      if (!physical) {
        // Attempt self-healing from Cloud Firestore
        const candidateName = record?.fileName || `${ path.basename(videoId) }.mp4`;
        await restoreFileFromCloudFirestore(candidateName, VIDEOS_DIR);
        physical = findPhysicalVideoFile(videoId);
      }
      if (physical) {
        filePath = physical.filePath;
        contentType = physical.mimeType;
      } else {
        res.statusCode = 404;
        res.end('Video file not found');
        return true;
      }
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || isNaN(start) || isNaN(end)) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        res.end();
        return true;
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);
      fileStream.pipe(res);
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Length', fileSize);
      fs.createReadStream(filePath).pipe(res);
    }
    return true;
  }

  // 6. GET /api/videos/thumbnail/:id -> Serve Thumbnail Image
  if (req.method === 'GET' && cleanPath.startsWith('/api/videos/thumbnail/')) {
    const videoId = path.basename(decodeURIComponent(cleanPath.replace('/api/videos/thumbnail/', '')).trim());
    const thumbFileName = `${videoId}.jpg`;
    const thumbPath = path.join(THUMBNAILS_DIR, thumbFileName);

    if (!fs.existsSync(thumbPath)) {
      await restoreFileFromCloudFirestore(thumbFileName, THUMBNAILS_DIR);
    }

    if (!fs.existsSync(thumbPath)) {
      res.statusCode = 404;
      res.end('Thumbnail not found');
      return true;
    }

    const stat = fs.statSync(thumbPath);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    fs.createReadStream(thumbPath).pipe(res);
    return true;
  }

  // 7. GET /api/videos/:id/meta -> Single Video Metadata
  if (req.method === 'GET' && cleanPath.endsWith('/meta')) {
    const videoId = decodeURIComponent(
      cleanPath.replace('/api/videos/', '').replace('/meta', '')
    ).trim();
    const records = loadVideosRegistry();
    const record = records.find((r) => r.id === videoId);
    if (!record) {
      const physical = findPhysicalVideoFile(videoId);
      if (physical) {
        const st = fs.statSync(physical.filePath);
        sendJson(res, 200, {
          success: true,
          video: {
            id: videoId,
            originalName: physical.fileName,
            mimeType: physical.mimeType,
            fileSize: st.size,
            fileSizeFormatted: formatBytes(st.size),
            duration: 0,
            durationFormatted: '00:00',
            width: 1280,
            height: 720,
            resolution: 'HD',
            storageKey: `videos/${physical.fileName}`,
            cdnUrl: `/api/videos/stream/${videoId}`,
            thumbnailUrl: fs.existsSync(path.join(THUMBNAILS_DIR, `${videoId}.jpg`))
              ? `/api/videos/thumbnail/${videoId}`
              : '',
            fileName: physical.fileName,
            processingStatus: 'ready',
            uploadedAt: st.mtime.toISOString(),
            isUploadedDirectly: true,
          },
        });
        return true;
      }
      sendJson(res, 404, { success: false, error: 'Video not found' });
      return true;
    }
    sendJson(res, 200, { success: true, video: record });
    return true;
  }

  // 8. GET /api/videos -> List all videos & storage metrics
  if (req.method === 'GET' && cleanPath === '/api/videos') {
    const records = loadVideosRegistry();
    const totalBytes = records.reduce((acc, item) => acc + (item.fileSize || 0), 0);
    sendJson(res, 200, {
      success: true,
      videos: records,
      totalCount: records.length,
      totalBytes,
      totalFormatted: formatBytes(totalBytes),
      maxFileSizeMB: 2048,
      totalStorageQuotaGB: 50,
    });
    return true;
  }

  // 9. DELETE /api/videos/:id -> Delete video from disk & registry when explicitly requested
  if (req.method === 'DELETE' && cleanPath.startsWith('/api/videos/')) {
    const videoId = path.basename(decodeURIComponent(cleanPath.replace('/api/videos/', '')).trim());
    const records = loadVideosRegistry();
    const target = records.find((r) => r.id === videoId);

    if (target) {
      const videoFilePath = path.join(VIDEOS_DIR, target.fileName);
      if (fs.existsSync(videoFilePath)) {
        try {
          fs.unlinkSync(videoFilePath);
        } catch {}
      }
      if (target.thumbnailFileName) {
        const thumbFilePath = path.join(THUMBNAILS_DIR, target.thumbnailFileName);
        if (fs.existsSync(thumbFilePath)) {
          try {
            fs.unlinkSync(thumbFilePath);
          } catch {}
        }
      }
    }

    const updated = records.filter((r) => r.id !== videoId);
    saveVideosRegistry(updated);

    sendJson(res, 200, {
      success: true,
      deletedId: videoId,
      remainingCount: updated.length,
    });
    return true;
  }

  return false;
}
