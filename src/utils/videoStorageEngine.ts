import { ActivityVideoMetadata, VideoStorageSettings } from '../types';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  storage,
  db,
  auth,
  resolveCurrentTenantId,
  resolveCurrentUserIdentifier,
  buildStructuredStoragePath,
  uploadToFirebaseStorage,
  isDirectBucketUploadAvailable,
  markDirectBucketRestricted,
  firebaseConfig,
} from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const VIDEO_SETTINGS_KEY = 'chayef_video_storage_settings_v1';

export const DEFAULT_VIDEO_SETTINGS: VideoStorageSettings = {
  maxFileSizeMB: 2048,
  maxDurationMinutes: 120,
  preferredResolution: '1080p',
  autoCompress: true,
  storageProvider: 'Cloudflare R2 / AWS S3 Object Storage',
  cdnDomain: '/api/videos/stream',
  totalStorageQuotaGB: 50,
};

export function getStoredVideoSettings(): VideoStorageSettings {
  try {
    const raw = localStorage.getItem(VIDEO_SETTINGS_KEY);
    if (!raw) return DEFAULT_VIDEO_SETTINGS;
    const parsed = JSON.parse(raw);
    const merged: VideoStorageSettings = { ...DEFAULT_VIDEO_SETTINGS, ...parsed };
    // Ensure old restrictive limits are automatically upgraded to the expanded capacity
    if (!merged.maxFileSizeMB || merged.maxFileSizeMB < 500) {
      merged.maxFileSizeMB = 2048;
    }
    if (!merged.maxDurationMinutes || merged.maxDurationMinutes < 60) {
      merged.maxDurationMinutes = 120;
    }
    if (!merged.totalStorageQuotaGB || merged.totalStorageQuotaGB < 50) {
      merged.totalStorageQuotaGB = 50;
    }
    return merged;
  } catch {
    return DEFAULT_VIDEO_SETTINGS;
  }
}

export function saveVideoSettings(settings: VideoStorageSettings): void {
  try {
    localStorage.setItem(VIDEO_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save video settings:', err);
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 بايت';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} جيجابايت`;
  if (mb >= 1) return `${mb.toFixed(1)} ميجابايت`;
  const kb = bytes / 1024;
  return `${Math.round(kb)} كيلوبايت`;
}

export function formatVideoDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export interface VideoInspectionResult {
  duration: number;
  width: number;
  height: number;
  resolutionLabel: string;
  thumbnailDataUrl: string;
}

/**
 * Inspects a video file in the browser using HTML5 Video + Canvas
 * Extracts duration, dimensions, and captures a sharp JPEG thumbnail frame
 */
export function inspectAndExtractVideoThumbnail(file: File): Promise<VideoInspectionResult> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const finalize = (res: VideoInspectionResult) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve(res);
    };

    const timeout = setTimeout(() => {
      finalize({
        duration: 0,
        width: 1280,
        height: 720,
        resolutionLabel: '720p HD',
        thumbnailDataUrl: '',
      });
    }, 10000);

    video.onloadedmetadata = () => {
      const duration = video.duration && isFinite(video.duration) ? video.duration : 0;
      const seekTime = duration > 2 ? 1.2 : duration > 0 ? duration * 0.3 : 0.1;
      try {
        video.currentTime = seekTime;
      } catch {
        clearTimeout(timeout);
        finalize({
          duration,
          width: video.videoWidth || 1280,
          height: video.videoHeight || 720,
          resolutionLabel: (video.videoHeight || 720) >= 1080 ? '1080p Full HD' : '720p HD',
          thumbnailDataUrl: '',
        });
      }
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        const maxThumbWidth = 960;
        const scale = width > maxThumbWidth ? maxThumbWidth / width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);

        const ctx = canvas.getContext('2d');
        let thumbnailDataUrl = '';
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }

        let resolutionLabel = '720p HD';
        const shortSide = Math.min(width, height);
        if (shortSide >= 1080) resolutionLabel = '1080p Full HD';
        else if (shortSide >= 720) resolutionLabel = '720p HD';
        else resolutionLabel = '480p SD';

        finalize({
          duration: video.duration && isFinite(video.duration) ? video.duration : 0,
          width,
          height,
          resolutionLabel,
          thumbnailDataUrl,
        });
      } catch {
        finalize({
          duration: video.duration || 0,
          width: 1280,
          height: 720,
          resolutionLabel: '720p HD',
          thumbnailDataUrl: '',
        });
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      finalize({
        duration: 0,
        width: 1280,
        height: 720,
        resolutionLabel: '720p HD',
        thumbnailDataUrl: '',
      });
    };

    video.src = objectUrl;
  });
}

export interface VideoUploadProgress {
  phase: 'validating' | 'extracting_thumbnail' | 'compressing' | 'uploading' | 'ready';
  percent: number;
  statusText: string;
}

/**
 * Helper to upload a single chunk with automatic retry
 */
async function uploadSingleChunkWithRetry(
  videoId: string,
  chunkBlob: Blob,
  chunkIndex: number,
  totalChunks: number,
  onChunkByteProgress: (loadedBytesInChunk: number) => void,
  maxRetries = 3
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/videos/upload-chunk', true);
        xhr.timeout = 10 * 60 * 1000; // 10 minutes per chunk
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader('x-video-id', videoId);
        xhr.setRequestHeader('x-chunk-index', String(chunkIndex));
        xhr.setRequestHeader('x-total-chunks', String(totalChunks));

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onChunkByteProgress(event.loaded);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            let errMsg = `فشل رفع الجزء ${chunkIndex + 1} (${xhr.status})`;
            try {
              const parsed = JSON.parse(xhr.responseText);
              if (parsed.error) errMsg = parsed.error;
            } catch {}
            reject(new Error(errMsg));
          }
        };

        xhr.onerror = () => reject(new Error('انقطع الاتصال بالخادم أثناء رفع جزء الفيديو'));
        xhr.ontimeout = () => reject(new Error('انتهت المهلة الزمنية لرفع جزء الفيديو'));
        xhr.send(chunkBlob);
      });
      return;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
  }

  throw lastError || new Error('تعذر رفع الفيديو بعد عدة محاولات. يرجى التحقق من الاتصال وإعادة المحاولة.');
}

/**
 * Uploads a video file to the backend Object Storage (`/api/videos/...`)
 * Uses progressive chunked uploading (2MB chunks with automatic retry) so large videos
 * upload smoothly with accurate real-time progress and never fail due to request size limits.
 */
export async function uploadVideoToObjectStorage(
  file: File,
  activityId: string | undefined,
  settings: VideoStorageSettings = getStoredVideoSettings(),
  onProgress?: (progress: VideoUploadProgress) => void
): Promise<ActivityVideoMetadata> {
  // 1. Validate format
  const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/ogg'];
  const isVideoExt = /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name);
  if (!file.type.startsWith('video/') && !validTypes.includes(file.type) && !isVideoExt) {
    throw new Error('صيغة الملف غير مدعومة. يرجى اختيار ملف فيديو صالح (MP4, WebM, MOV).');
  }

  onProgress?.({
    phase: 'validating',
    percent: 4,
    statusText: 'جارٍ التحقق من حجم وجودة ملف الفيديو...',
  });

  // 2. Validate file size against expanded limit (up to 2048 MB)
  const effectiveMaxMB = Math.max(settings.maxFileSizeMB || 2048, 500);
  const maxBytes = effectiveMaxMB * 1024 * 1024;
  if (file.size > maxBytes) {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `حجم ملف الفيديو (${fileSizeMB} ميجابايت) يتجاوز الحد الأقصى المسموح به (${effectiveMaxMB} ميجابايت).`
    );
  }

  // 3. Extract metadata & thumbnail frame in browser
  onProgress?.({
    phase: 'extracting_thumbnail',
    percent: 10,
    statusText: 'جارٍ استخراج الصورة المصغرة التلقائية وأبعاد الفيديو...',
  });

  const inspection = await inspectAndExtractVideoThumbnail(file);

  // 4. Validate duration if available
  const effectiveMaxDurationMins = Math.max(settings.maxDurationMinutes || 120, 60);
  const maxDurationSeconds = effectiveMaxDurationMins * 60;
  if (inspection.duration > maxDurationSeconds && maxDurationSeconds > 0) {
    const actualMins = (inspection.duration / 60).toFixed(1);
    throw new Error(
      `مدة الفيديو (${actualMins} دقيقة) تتجاوز الحد الأقصى المسموح به (${effectiveMaxDurationMins} دقيقة).`
    );
  }

  const videoId = `vid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const activeTenantId = resolveCurrentTenantId();
  const userInfo = resolveCurrentUserIdentifier();

  // 5. Upload extracted JPEG thumbnail to Firebase Storage and backend disk
  let thumbnailSaved = false;
  let finalThumbnailUrl = inspection.thumbnailDataUrl || '';

  if (inspection.thumbnailDataUrl) {
    try {
      const fbThumbUrl = await uploadToFirebaseStorage(
        inspection.thumbnailDataUrl,
        'video_thumbnails',
        {
          tenantId: activeTenantId,
          category: 'video_thumbnails',
          recordId: activityId || videoId,
          fileName: `${videoId}_thumb.jpg`,
          contentType: 'image/jpeg',
        }
      );
      if (fbThumbUrl && (fbThumbUrl.startsWith('http') || fbThumbUrl.startsWith('/api/'))) {
        thumbnailSaved = true;
        finalThumbnailUrl = fbThumbUrl;
      }
    } catch {
      // Fallback to server thumbnail endpoint below
    }

    try {
      const thumbRes = await fetch('/api/videos/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          dataUrl: inspection.thumbnailDataUrl,
        }),
      });
      if (thumbRes.ok && !thumbnailSaved) {
        thumbnailSaved = true;
        finalThumbnailUrl = `/api/videos/thumbnail/${videoId}`;
      }
    } catch (e) {
      console.warn('Could not pre-upload thumbnail to server:', e);
    }
  }

  // 6. Attempt Direct Firebase Cloud Storage upload first when authenticated bucket access is available
  let firebaseUrl: string | null = null;
  const cleanName = (file.name || 'video.mp4').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const storagePath = buildStructuredStoragePath({
    fileName: cleanName,
    tenantId: activeTenantId,
    category: 'videos',
    userId: userInfo.uid,
  });

  if (isDirectBucketUploadAvailable()) {
    try {
      onProgress?.({
        phase: 'uploading',
        percent: 15,
        statusText: 'جارٍ رفع الفيديو مباشرة إلى Firebase Cloud Storage...',
      });

      const videoStorageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(videoStorageRef, file, {
        contentType: file.type || 'video/mp4',
        customMetadata: {
          tenantId: activeTenantId,
          role: userInfo.role,
          videoId,
          activityId: activityId || '',
          uploadedBy: userInfo.email,
          uploadedByUid: userInfo.uid,
        },
      });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              const ratio = snapshot.bytesTransferred / snapshot.totalBytes;
              const calculatedPercent = Math.min(95, Math.round(15 + ratio * 80));
              onProgress?.({
                phase: 'uploading',
                percent: calculatedPercent,
                statusText: `جارٍ رفع الفيديو إلى Firebase Storage (${calculatedPercent}%) — ${formatBytes(snapshot.bytesTransferred)} من ${formatBytes(snapshot.totalBytes)}`,
              });
            }
          },
          (error) => {
            reject(error);
          },
          async () => {
            try {
              firebaseUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            } catch (urlErr) {
              reject(urlErr);
            }
          }
        );
      });
    } catch (fbErr: any) {
      const code = String(fbErr?.code || '');
      if (code === 'storage/unauthorized' || code === 'permission-denied') {
        markDirectBucketRestricted();
      }
      firebaseUrl = null;
    }
  }

  // If Firebase Storage upload succeeded, record in Firestore and return metadata
  if (firebaseUrl) {
    onProgress?.({
      phase: 'uploading',
      percent: 98,
      statusText: 'جارٍ توثيق بيانات الفيديو في Cloud Firestore...',
    });

    const fbMetadata: ActivityVideoMetadata = {
      id: videoId,
      originalName: file.name,
      mimeType: file.type || 'video/mp4',
      fileSize: file.size,
      fileSizeFormatted: formatBytes(file.size),
      duration: inspection.duration,
      durationFormatted: formatVideoDuration(inspection.duration),
      width: inspection.width,
      height: inspection.height,
      resolution: inspection.resolutionLabel,
      storageKey: firebaseUrl,
      cdnUrl: firebaseUrl,
      thumbnailUrl: finalThumbnailUrl,
      processingStatus: 'ready',
      uploadedAt: new Date().toISOString(),
      isUploadedDirectly: true,
    };

    try {
      await setDoc(doc(db, 'media_files', videoId), {
        id: videoId,
        fileName: file.name,
        storagePath,
        bucket: firebaseConfig.storageBucket,
        contentType: file.type || 'video/mp4',
        size: file.size,
        url: firebaseUrl,
        thumbnailUrl: finalThumbnailUrl,
        tenantId: activeTenantId,
        category: 'videos',
        recordId: activityId || videoId,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userInfo.email,
        uploadedByUid: userInfo.uid,
        activityId: activityId || null,
        duration: inspection.duration,
        resolution: inspection.resolutionLabel,
      }, { merge: true });
    } catch (dbErr) {
      console.warn('[videoStorageEngine] Could not register in Firestore media_files:', dbErr);
    }

    onProgress?.({
      phase: 'ready',
      percent: 100,
      statusText: 'اكتمل رفع الفيديو بنجاح في Firebase Storage (100%)',
    });

    return fbMetadata;
  }

  // 7. Fallback: Progressive Chunked Upload to Backend Disk
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB per chunk
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  onProgress?.({
    phase: 'uploading',
    percent: 15,
    statusText:
      totalChunks > 1
        ? `جارٍ رفع الفيديو تدريجياً إلى الخادم السحابي (0% - ${totalChunks} أجزاء)...`
        : 'جارٍ رفع الفيديو وحفظه في الخادم السحابي (15%)...',
  });

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunkBlob = file.slice(start, end);

    await uploadSingleChunkWithRetry(
      videoId,
      chunkBlob,
      chunkIndex,
      totalChunks,
      (loadedInChunk) => {
        const totalUploadedSoFar = start + loadedInChunk;
        const ratio = file.size > 0 ? Math.min(1, totalUploadedSoFar / file.size) : 1;
        const calculatedPercent = Math.min(95, Math.round(15 + ratio * 80));
        onProgress?.({
          phase: 'uploading',
          percent: calculatedPercent,
          statusText: `جارٍ رفع الفيديو تدريجياً (${calculatedPercent}%) — ${formatBytes(totalUploadedSoFar)} من ${formatBytes(file.size)}`,
        });
      }
    );
  }

  // 8. Complete chunk assembly on backend and register in permanent video database
  onProgress?.({
    phase: 'uploading',
    percent: 97,
    statusText: 'جارٍ تثبيت ملف الفيديو في قاعدة البيانات الدائمة...',
  });

  const completeRes = await fetch('/api/videos/upload-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoId,
      originalName: file.name,
      mimeType: file.type || 'video/mp4',
      activityId: activityId || undefined,
      duration: inspection.duration || 0,
      width: inspection.width || 1280,
      height: inspection.height || 720,
      resolution: inspection.resolutionLabel || '720p HD',
      thumbnailSaved,
      totalChunks,
    }),
  });

  const completeJson = await completeRes.json().catch(() => null);
  if (!completeRes.ok || !completeJson || !completeJson.success || !completeJson.video) {
    throw new Error(completeJson?.error || 'فشل تثبيت ملف الفيديو على الخادم الدائم. يرجى إعادة المحاولة.');
  }

  const serverVideo = completeJson.video;
  const metadata: ActivityVideoMetadata = {
    id: serverVideo.id,
    originalName: serverVideo.originalName,
    mimeType: serverVideo.mimeType,
    fileSize: serverVideo.fileSize,
    fileSizeFormatted: serverVideo.fileSizeFormatted,
    duration: serverVideo.duration,
    durationFormatted: serverVideo.durationFormatted,
    width: serverVideo.width,
    height: serverVideo.height,
    resolution: serverVideo.resolution,
    storageKey: serverVideo.storageKey,
    cdnUrl: serverVideo.cdnUrl,
    thumbnailUrl: serverVideo.thumbnailUrl || finalThumbnailUrl || inspection.thumbnailDataUrl || '',
    processingStatus: 'ready',
    uploadedAt: serverVideo.uploadedAt,
    isUploadedDirectly: true,
  };

  // Record in Firestore media_files
  try {
    await setDoc(doc(db, 'media_files', serverVideo.id), {
      id: serverVideo.id,
      fileName: serverVideo.originalName,
      storagePath,
      bucket: firebaseConfig.storageBucket,
      contentType: serverVideo.mimeType,
      size: serverVideo.fileSize,
      url: serverVideo.cdnUrl,
      thumbnailUrl: metadata.thumbnailUrl,
      tenantId: activeTenantId,
      category: 'videos',
      recordId: activityId || serverVideo.id,
      uploadedAt: serverVideo.uploadedAt,
      uploadedBy: userInfo.email,
      uploadedByUid: userInfo.uid,
      activityId: activityId || null,
      duration: serverVideo.duration,
      resolution: serverVideo.resolution,
    }, { merge: true });
  } catch (e) {
    console.warn('[videoStorageEngine] Could not register fallback in Firestore:', e);
  }

  onProgress?.({
    phase: 'ready',
    percent: 100,
    statusText: 'اكتمل رفع الفيديو وحفظه بنجاح في التخزين الدائم (100%)',
  });

  return metadata;
}

/**
 * Resolves a stored video into a playable HTTP streaming URL
 */
export async function resolvePlayableVideoUrl(
  videoIdOrUrl: string
): Promise<{ url: string; thumbnailUrl?: string } | null> {
  if (!videoIdOrUrl) return null;

  if (videoIdOrUrl.startsWith('/api/videos/stream/')) {
    const id = videoIdOrUrl.replace('/api/videos/stream/', '').split('?')[0];
    return {
      url: videoIdOrUrl,
      thumbnailUrl: `/api/videos/thumbnail/${id}`,
    };
  }

  const videoId = videoIdOrUrl.startsWith('r2://')
    ? videoIdOrUrl.replace('r2://', '')
    : videoIdOrUrl;

  if (videoId.startsWith('vid-')) {
    return {
      url: `/api/videos/stream/${videoId}`,
      thumbnailUrl: `/api/videos/thumbnail/${videoId}`,
    };
  }

  return null;
}

/**
 * Deletes a video from persistent backend disk storage
 */
export async function deleteVideoFromObjectStorage(videoIdOrUrl: string): Promise<void> {
  if (!videoIdOrUrl) return;
  let videoId = videoIdOrUrl;
  if (videoIdOrUrl.startsWith('r2://')) {
    videoId = videoIdOrUrl.replace('r2://', '');
  } else if (videoIdOrUrl.startsWith('/api/videos/stream/')) {
    videoId = videoIdOrUrl.replace('/api/videos/stream/', '').split('?')[0];
  }

  if (!videoId.startsWith('vid-')) return;

  try {
    await fetch(`/api/videos/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Error deleting video from server storage:', err);
  }
}

/**
 * Calculates total storage usage from backend server
 */
export async function getObjectStorageUsageStats(): Promise<{
  videosCount: number;
  totalBytes: number;
  totalFormatted: string;
  quotaGB: number;
  usagePercent: number;
}> {
  const settings = getStoredVideoSettings();
  try {
    const res = await fetch('/api/videos', {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      const totalBytes = Number(data.totalBytes || 0);
      const videosCount = Number(data.totalCount || 0);
      const quotaBytes = settings.totalStorageQuotaGB * 1024 * 1024 * 1024;
      const usagePercent = Math.min(100, (totalBytes / quotaBytes) * 100);
      return {
        videosCount,
        totalBytes,
        totalFormatted: formatBytes(totalBytes),
        quotaGB: settings.totalStorageQuotaGB,
        usagePercent,
      };
    }
  } catch (err) {
    console.warn('Failed to fetch storage usage stats from backend:', err);
  }

  return {
    videosCount: 0,
    totalBytes: 0,
    totalFormatted: '0 بايت',
    quotaGB: settings.totalStorageQuotaGB,
    usagePercent: 0,
  };
}

/**
 * Resolves any video URL or storageKey to an absolute permanent streaming URL
 */
export function resolveVideoStreamUrl(url?: string, storageKey?: string): string {
  if (!url) return '';
  if (url.startsWith('/api/videos/stream/') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('objstore://video/')) {
    const vidId = url.replace('objstore://video/', '').trim();
    return `/api/videos/stream/${vidId}`;
  }
  if (storageKey) {
    const vidId = storageKey.replace('objstore://video/', '').trim();
    return `/api/videos/stream/${vidId}`;
  }
  return url;
}

/**
 * Ensures any activity with legacy video storage references (e.g. objstore://video/vid-... or blob:...)
 * is normalized to permanent backend streaming URLs (/api/videos/stream/vid-...).
 * Returns the exact input array reference if no modifications are needed.
 */
export async function rescueLegacyVideos<T extends { id?: string; videoUrl?: string; videoMetadata?: ActivityVideoMetadata }>(
  activities: T[]
): Promise<T[]> {
  if (!Array.isArray(activities) || activities.length === 0) {
    return activities;
  }

  let changed = false;
  const updated = activities.map((act) => {
    const metaKey = act.videoMetadata?.storageKey;
    const resolvedStreamUrl = resolveVideoStreamUrl(act.videoUrl, metaKey);
    if (resolvedStreamUrl && act.videoUrl && act.videoUrl !== resolvedStreamUrl && (act.videoUrl.startsWith('blob:') || act.videoUrl.startsWith('objstore://'))) {
      changed = true;
      return {
        ...act,
        videoUrl: resolvedStreamUrl,
      };
    }
    return act;
  });

  return changed ? updated : activities;
}

