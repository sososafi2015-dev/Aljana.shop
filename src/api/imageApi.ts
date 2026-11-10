/**
 * Client-side API for permanent image & document storage
 * Connects directly to Firebase Cloud Storage (`gen-lang-client-0919287105.firebasestorage.app`)
 * using `uploadBytesResumable` with structured tenant paths and Firestore metadata indexing,
 * plus resilient fallback to permanent server disk storage.
 */

import {
  uploadToFirebaseStorage,
  FirebaseStorageUploadOptions,
  db,
  resolveCurrentTenantId,
  resolveCurrentUserIdentifier,
  buildStructuredStoragePath,
  firebaseConfig,
} from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.readAsDataURL(file);
  });
}

async function indexFallbackMediaInFirestore(params: {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
  options?: FirebaseStorageUploadOptions;
}): Promise<void> {
  try {
    const tenantId = resolveCurrentTenantId(params.options?.tenantId);
    const userInfo = resolveCurrentUserIdentifier();
    const category = params.options?.category || 'images';
    const storagePath = buildStructuredStoragePath({
      fileName: params.fileName,
      tenantId,
      category,
      userId: userInfo.uid,
    });
    const cleanDocId = `mf_${storagePath.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
    await setDoc(
      doc(db, 'media_files', cleanDocId),
      {
        id: cleanDocId,
        fileName: params.fileName,
        storagePath,
        bucket: firebaseConfig.storageBucket,
        url: params.url,
        contentType: params.contentType,
        size: params.size,
        tenantId,
        category,
        recordId: params.options?.recordId || null,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userInfo.email,
        uploadedByUid: userInfo.uid,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[imageApi] Firestore media_files fallback index notice:', err);
  }
}

/**
 * Upload an image or document file directly to permanent storage (Firebase Cloud Storage with server disk fallback)
 */
export async function uploadImageToServer(
  file: File,
  options?: FirebaseStorageUploadOptions
): Promise<string> {
  // Validate file size (max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('حجم الملف كبير جداً (الحد الأقصى المسموح به هو 50 ميجابايت).');
  }

  // 1. Try Firebase Cloud Storage first via uploadBytesResumable
  try {
    const cleanName = (file.name || 'image.jpg').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const category = options?.category || 'images';
    const firebaseUrl = await uploadToFirebaseStorage(file, category, {
      ...options,
      fileName: cleanName,
      contentType: file.type || 'image/jpeg',
    });
    if (firebaseUrl && (firebaseUrl.startsWith('http') || firebaseUrl.startsWith('/api/'))) {
      return firebaseUrl;
    }
  } catch (fbErr) {
    console.warn('[imageApi] Firebase Storage direct upload notice, falling back to server disk storage:', fbErr);
  }

  // 2. Fallback to permanent server endpoint
  try {
    options?.onProgress?.(35, Math.round(file.size * 0.35), file.size);
    const res = await fetch('/api/images/upload', {
      method: 'POST',
      headers: {
        'x-image-filename': encodeURIComponent(file.name || 'thumbnail.jpg'),
        'x-image-mimetype': file.type || 'image/jpeg',
      },
      body: file,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        options?.onProgress?.(100, file.size, file.size);
        await indexFallbackMediaInFirestore({
          url: data.url,
          fileName: file.name || 'thumbnail.jpg',
          contentType: file.type || 'image/jpeg',
          size: file.size,
          options,
        });
        return data.url;
      }
    }
  } catch (err) {
    console.warn('[imageApi] Direct binary upload failed, falling back to base64 upload:', err);
  }

  // 3. Fallback: convert File to base64 and store permanently via /api/images/base64
  const dataUrl = await fileToDataUrl(file);
  if (dataUrl) {
    const permanentUrl = await uploadBase64ImageToServer(dataUrl, file.name || 'thumbnail.jpg', options);
    if (permanentUrl && !permanentUrl.startsWith('data:')) {
      return permanentUrl;
    }
  }

  throw new Error('فشل رفع الصورة إلى الخادم الدائم');
}

/**
 * Convert a base64 Data URL to a permanent URL in Firebase Cloud Storage (with server disk fallback)
 */
export async function uploadBase64ImageToServer(
  dataUrl: string,
  filename?: string,
  options?: FirebaseStorageUploadOptions
): Promise<string> {
  // If already a permanent URL or external URL, return as-is
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  const cleanName = (filename || options?.fileName || 'image.jpg').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const category = options?.category || 'images';

  // 1. Try Firebase Cloud Storage first via uploadBytesResumable
  try {
    const firebaseUrl = await uploadToFirebaseStorage(dataUrl, category, {
      ...options,
      fileName: cleanName,
    });
    if (firebaseUrl && (firebaseUrl.startsWith('http') || firebaseUrl.startsWith('/api/'))) {
      return firebaseUrl;
    }
  } catch (fbErr) {
    console.warn('[imageApi] Firebase Storage base64 upload notice, falling back to server disk storage:', fbErr);
  }

  // 2. Fallback to permanent server endpoint
  try {
    const res = await fetch('/api/images/base64', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dataUrl, filename: cleanName }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        const approxSize = Math.round(((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 3) / 4);
        options?.onProgress?.(100, approxSize, approxSize);
        await indexFallbackMediaInFirestore({
          url: data.url,
          fileName: cleanName,
          contentType: data.mimeType || 'image/jpeg',
          size: data.size || approxSize,
          options,
        });
        return data.url;
      }
    }
  } catch (err) {
    console.warn('[imageApi] Base64 upload failed, using original data:', err);
  }

  return dataUrl;
}

/**
 * Convert any image or document (data URL, blob URL, or File) to a permanent Firebase Storage / server URL
 */
export async function ensurePermanentImageUrl(
  input: string | File,
  optionsOrCategory?: FirebaseStorageUploadOptions | string
): Promise<string> {
  if (!input) return '';

  const options: FirebaseStorageUploadOptions | undefined =
    typeof optionsOrCategory === 'string'
      ? { category: optionsOrCategory, fileName: `${optionsOrCategory}.jpg` }
      : optionsOrCategory;

  if (input instanceof File) {
    return await uploadImageToServer(input, options);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:')) {
      return await uploadBase64ImageToServer(
        trimmed,
        options?.fileName || 'cover-thumbnail.jpg',
        options
      );
    }
    if (trimmed.startsWith('blob:')) {
      try {
        const blob = await fetch(trimmed).then((r) => r.blob());
        const file = new File([blob], options?.fileName || 'cover-thumbnail.jpg', {
          type: blob.type || 'image/jpeg',
        });
        return await uploadImageToServer(file, options);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  return input;
}


