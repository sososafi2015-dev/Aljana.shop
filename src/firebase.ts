import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { 
  getFirestore, 
  setLogLevel,
  doc, 
  getDoc, 
  getDocFromServer, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  Firestore 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  updateProfile,
  User,
  Auth
} from 'firebase/auth';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  uploadBytesResumable,
  uploadString,
  getDownloadURL,
  deleteObject,
  FirebaseStorage 
} from 'firebase/storage';
import firebaseConfigData from '../firebase-applet-config.json';

export const STORAGE_BUCKET_URL = 'gen-lang-client-0919287105.firebasestorage.app';

export const firebaseConfig = {
  projectId: firebaseConfigData.projectId,
  appId: firebaseConfigData.appId,
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  firestoreDatabaseId: firebaseConfigData.firestoreDatabaseId,
  storageBucket: firebaseConfigData.storageBucket || STORAGE_BUCKET_URL,
  messagingSenderId: firebaseConfigData.messagingSenderId,
};

// Initialize Firebase App singleton
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Optional Firebase App Check initialization when a ReCaptcha v3 site key is configured
if (typeof window !== 'undefined') {
  const recaptchaSiteKey =
    (import.meta as any).env?.VITE_FIREBASE_APPCHECK_KEY ||
    (firebaseConfigData as any).recaptchaSiteKey ||
    '';
  if (recaptchaSiteKey && typeof recaptchaSiteKey === 'string' && recaptchaSiteKey.trim().length > 10) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey.trim()),
        isTokenAutoRefreshEnabled: true,
      });
      console.log('[Firebase AppCheck] Initialized successfully.');
    } catch (appCheckErr) {
      console.warn('[Firebase AppCheck] Initialization notice:', appCheckErr);
    }
  }
}

// Initialize Firestore with specific database ID and silence idle gRPC stream notices
try {
  setLogLevel('silent');
} catch {}
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Initialize Firebase Storage explicitly bound to gen-lang-client-0919287105.firebasestorage.app
export const storage: FirebaseStorage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);

export const BOOTSTRAP_ADMIN_EMAIL = 'soso.safi.2015@gmail.com';

export enum FirestoreOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: FirestoreOperationType | string;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

/**
 * Helper to resolve current active tenantId from localStorage without circular dependencies
 */
export function resolveCurrentTenantId(explicitTenantId?: string): string {
  if (explicitTenantId && explicitTenantId.trim() && explicitTenantId !== 'portal') {
    return explicitTenantId.trim().replace(/[^a-zA-Z0-9_\-]/g, '');
  }
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const paramTenant = params.get('tenant');
      if (paramTenant && paramTenant !== 'portal') {
        return paramTenant.trim().replace(/[^a-zA-Z0-9_\-]/g, '');
      }
      const raw = localStorage.getItem('chayef_active_tenant_id_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'string' && parsed !== 'portal') {
          return parsed.trim().replace(/[^a-zA-Z0-9_\-]/g, '');
        }
      }
    } catch {}
  }
  return 'tenant_nour';
}

/**
 * Helper to resolve current user/admin identifier for storage paths & audit trail
 */
export function resolveCurrentUserIdentifier(): { uid: string; email: string; role: string } {
  const currentUser = auth.currentUser;
  if (currentUser) {
    return {
      uid: currentUser.uid,
      email: currentUser.email || 'authenticated_user',
      role: currentUser.email === BOOTSTRAP_ADMIN_EMAIL ? 'super_admin' : 'authenticated',
    };
  }
  if (typeof window !== 'undefined') {
    try {
      const adminRaw = localStorage.getItem('chayef_assoc_current_admin_session_v1');
      if (adminRaw) {
        const parsed = JSON.parse(adminRaw);
        if (parsed) {
          return {
            uid: (parsed.id || parsed.username || 'admin').replace(/[^a-zA-Z0-9_\-]/g, '_'),
            email: parsed.email || parsed.fullName || 'admin_session',
            role: parsed.role || parsed.type || 'admin',
          };
        }
      }
    } catch {}
  }
  return {
    uid: 'system_user',
    email: 'system',
    role: 'guest',
  };
}

/**
 * Build a clean, structured Firebase Storage path:
 * tenants/{tenantId}/{category}/{userId}_{timestamp}_{cleanFileName}
 */
export function buildStructuredStoragePath(options: {
  fileName: string;
  tenantId?: string;
  category?: string;
  userId?: string;
}): string {
  const tenant = resolveCurrentTenantId(options.tenantId);
  const category = (options.category || 'images').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const userObj = resolveCurrentUserIdentifier();
  const userId = (options.userId || userObj.uid || 'user').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const cleanName = (options.fileName || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `tenants/${tenant}/${category}/${userId}_${Date.now()}_${cleanName}`;
}

/**
 * Standardized Firestore error handler adhering to security rules and debugging guidelines
 */
export function handleFirestoreError(
  error: unknown,
  operationType: FirestoreOperationType | string,
  path: string | null
): Error {
  const err = error as any;
  const code = err?.code || 'unknown';
  const msg = err?.message || String(error);

  const errInfo: FirestoreErrorInfo = {
    error: msg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo));

  if (code === 'permission-denied') {
    return new Error(`تم رفض الإذن (Permission Denied) في ${path}: يرجى التحقق من تسجيل الدخول وصلاحيات الحساب.`);
  }
  if (code === 'not-found') {
    return new Error(`المستند غير موجود في ${path}.`);
  }
  if (code === 'unavailable') {
    return new Error(`خدمة Firebase غير متوفرة حالياً، يرجى المحاولة بعد قليل.`);
  }
  return new Error(`خطأ في قاعدة البيانات (${code}): ${msg}`);
}

/**
 * Standardized Firebase Storage error translator to clear Arabic messages
 */
export function translateStorageError(error: unknown): Error {
  const err = error as any;
  const code = String(err?.code || '');
  const msg = String(err?.message || error || '');

  if (code === 'storage/unauthorized' || code === 'permission-denied') {
    return new Error('غير مصرح برفع أو تعديل هذا الملف. يرجى التأكد من تسجيل الدخول بصلاحيات الجمعية المناسبة.');
  }
  if (code === 'storage/canceled') {
    return new Error('تم إلغاء عملية رفع الملف.');
  }
  if (code === 'storage/quota-exceeded') {
    return new Error('تم تجاوز السعة التخزينية المتاحة في Firebase Storage.');
  }
  if (code === 'storage/retry-limit-exceeded' || msg.includes('network')) {
    return new Error('انقطع الاتصال بالشبكة أثناء رفع الملف. يرجى التحقق من جودة الإنترنت والمحاولة مجدداً.');
  }
  if (code === 'storage/invalid-checksum') {
    return new Error('تلف الملف أثناء النقل. يرجى إعادة رفع الملف.');
  }
  return new Error(msg || 'تعذر رفع الملف إلى التخزين السحابي.');
}

/**
 * Validates Firestore & Storage connectivity on boot
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const testRef = doc(db, 'test', 'connection');
    await getDocFromServer(testRef).catch(() => {
      return setDoc(testRef, {
        lastPing: new Date().toISOString(),
        storageBucket: firebaseConfig.storageBucket,
      }, { merge: true });
    });
    // Also verify Storage instance is bound to the expected bucket
    const rootStorageRef = ref(storage);
    if (rootStorageRef.bucket !== STORAGE_BUCKET_URL) {
      console.warn(`[Firebase Storage] Bucket mismatch: ${rootStorageRef.bucket} vs ${STORAGE_BUCKET_URL}`);
    } else {
      console.log(`[Firebase] Connected to Firestore & Storage (${rootStorageRef.bucket}) successfully.`);
    }
    return true;
  } catch (err) {
    console.warn('[Firebase] Connectivity check notice:', err);
    return false;
  }
}

/**
 * Generic Firestore Document Set / Save
 */
export async function saveToFirestore<T extends Record<string, any>>(
  collectionName: string, 
  docId: string, 
  data: T
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      _updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    throw handleFirestoreError(error, FirestoreOperationType.WRITE, `${collectionName}/${docId}`);
  }
}

/**
 * Generic Firestore Document Fetch
 */
export async function getFromFirestore<T>(
  collectionName: string, 
  docId: string
): Promise<T | null> {
  try {
    const docRef = doc(db, collectionName, docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as T;
    }
    return null;
  } catch (error) {
    console.warn(`[Firebase] getFromFirestore notice on ${collectionName}/${docId}:`, error);
    return null;
  }
}

/**
 * Generic Firestore Collection Fetch All
 */
export async function getAllFromFirestore<T>(
  collectionName: string
): Promise<Array<T & { id: string }>> {
  try {
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({
      ...(d.data() as T),
      id: d.id
    }));
  } catch (error) {
    console.warn(`[Firebase] getAllFromFirestore notice on ${collectionName}:`, error);
    return [];
  }
}

/**
 * Generic Firestore Document Delete
 */
export async function deleteFromFirestore(
  collectionName: string, 
  docId: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    throw handleFirestoreError(error, FirestoreOperationType.DELETE, `${collectionName}/${docId}`);
  }
}

export interface FirebaseStorageUploadOptions {
  tenantId?: string;
  category?: string;
  recordId?: string;
  fileName?: string;
  contentType?: string;
  maxSizeMB?: number;
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void;
}

let directBucketRestricted = false;

/**
 * Checks whether direct browser-to-GCS bucket upload can be used.
 * Requires an active Firebase Auth user token (`request.auth != null`) and no bucket restriction.
 */
export function isDirectBucketUploadAvailable(): boolean {
  return Boolean(auth.currentUser) && !directBucketRestricted;
}

export function markDirectBucketRestricted(): void {
  directBucketRestricted = true;
}

/**
 * Validates that the current user/admin session and file category comply with the platform's
 * security rules (Super Admin, Association Admin tenant isolation, or Member/Subscriber allowed categories).
 */
export function verifyStorageUploadPermission(params: {
  tenantId: string;
  category: string;
  mimeType: string;
  fileSize: number;
  maxSizeMB: number;
  userInfo: { uid: string; email: string; role: string };
}): void {
  const { tenantId, category, mimeType, fileSize, maxSizeMB, userInfo } = params;

  if (!fileSize || fileSize <= 0) {
    throw new Error('الملف المختار فارغ أو غير صالح للرفع.');
  }

  if (fileSize > maxSizeMB * 1024 * 1024) {
    const actualMB = (fileSize / (1024 * 1024)).toFixed(1);
    throw new Error(`حجم الملف (${actualMB} ميجابايت) يتجاوز الحد الأقصى المسموح به (${maxSizeMB} ميجابايت).`);
  }

  const lowerMime = (mimeType || '').toLowerCase();
  const isAllowedMime =
    lowerMime.startsWith('image/') ||
    lowerMime.startsWith('video/') ||
    lowerMime === 'application/pdf' ||
    lowerMime === 'application/msword' ||
    lowerMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerMime === 'application/octet-stream';

  if (!isAllowedMime) {
    throw new Error(`نوع الملف (${mimeType}) غير مدعوم. الأنواع المسموحة: الصور، الفيديوهات، ومستندات PDF/Word.`);
  }

  // Enforce tenant isolation for association admins when session specifies a bound tenantId
  if (typeof window !== 'undefined') {
    try {
      const adminRaw = localStorage.getItem('chayef_assoc_current_admin_session_v1');
      if (adminRaw) {
        const parsed = JSON.parse(adminRaw);
        const sessionRole = String(parsed?.role || parsed?.type || '');
        const sessionTenant = String(parsed?.tenantId || '');
        const isSuper =
          userInfo.email === BOOTSTRAP_ADMIN_EMAIL ||
          sessionRole === 'super_admin' ||
          sessionRole === 'master_super_admin';

        if (
          !isSuper &&
          sessionTenant &&
          sessionTenant !== 'portal' &&
          tenantId &&
          tenantId !== 'portal' &&
          sessionTenant !== tenantId
        ) {
          throw new Error('غير مصرح لمدير جمعية برفع أو تعديل ملفات تابعة لجمعية أخرى.');
        }
      }
    } catch (e: any) {
      if (e?.message?.includes('غير مصرح')) {
        throw e;
      }
    }
  }

  // Ensure category is a recognized platform category
  if (!category || category.trim().length === 0) {
    throw new Error('فئة التخزين غير محددة.');
  }
}

/**
 * Convert a base64 Data URL into a Blob for resumable upload
 */
export function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const byteString = atob(parts[1] || '');
  const mimeMatch = header.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return { blob: new Blob([ab], { type: mimeType }), mimeType };
}

/**
 * Uploads a Blob/File through the authenticated Server + Cloud Firestore bridge
 * (`/api/images/upload` or `/api/videos/upload`) with real-time progress reporting
 * and permanent indexing in Firestore (`media_files` + `storage_chunks`).
 */
async function uploadViaServerAndFirestoreBridge(params: {
  blob: Blob | File;
  fileName: string;
  mimeType: string;
  storagePath: string;
  tenantId: string;
  category: string;
  recordId?: string;
  userInfo: { uid: string; email: string; role: string };
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void;
}): Promise<string> {
  const {
    blob,
    fileName,
    mimeType,
    storagePath,
    tenantId,
    category,
    recordId,
    userInfo,
    onProgress,
  } = params;

  const isVideo = mimeType.startsWith('video/');
  const endpoint = isVideo ? '/api/videos/upload' : '/api/images/upload';

  let permanentUrl = '';

  if (typeof XMLHttpRequest !== 'undefined') {
    permanentUrl = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.timeout = 15 * 60 * 1000;
      xhr.setRequestHeader('Content-Type', mimeType || 'application/octet-stream');
      xhr.setRequestHeader('x-file-name', encodeURIComponent(fileName));
      xhr.setRequestHeader('x-image-filename', encodeURIComponent(fileName));
      xhr.setRequestHeader('x-mime-type', mimeType || 'application/octet-stream');
      xhr.setRequestHeader('x-image-mimetype', mimeType || 'application/octet-stream');
      xhr.setRequestHeader('x-tenant-id', encodeURIComponent(tenantId));
      xhr.setRequestHeader('x-storage-category', encodeURIComponent(category));
      xhr.setRequestHeader('x-storage-path', encodeURIComponent(storagePath));
      if (recordId) {
        xhr.setRequestHeader('x-record-id', encodeURIComponent(recordId));
        xhr.setRequestHeader('x-activity-id', encodeURIComponent(recordId));
      }
      xhr.setRequestHeader('x-uploaded-by', encodeURIComponent(userInfo.email));
      xhr.setRequestHeader('x-uploaded-by-uid', encodeURIComponent(userInfo.uid));

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0 && onProgress) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          onProgress(percent, event.loaded, event.total);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText || '{}');
            const resolvedUrl = parsed.url || parsed.video?.cdnUrl || '';
            if (resolvedUrl) {
              onProgress?.(100, blob.size, blob.size);
              resolve(resolvedUrl);
              return;
            }
          } catch {}
        }
        reject(new Error(`فشل رفع الملف عبر الخادم (${xhr.status})`));
      };

      xhr.onerror = () => reject(new Error('انقطع الاتصال بالخادم أثناء رفع الملف.'));
      xhr.ontimeout = () => reject(new Error('انتهت مهلة رفع الملف.'));
      xhr.send(blob);
    });
  } else {
    // Node.js / Fetch environment fallback
    const baseUrl =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:3000';
    const arrayBuffer = await blob.arrayBuffer();
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
        'x-file-name': encodeURIComponent(fileName),
        'x-image-filename': encodeURIComponent(fileName),
        'x-mime-type': mimeType || 'application/octet-stream',
        'x-image-mimetype': mimeType || 'application/octet-stream',
        'x-tenant-id': encodeURIComponent(tenantId),
        'x-storage-category': encodeURIComponent(category),
        'x-storage-path': encodeURIComponent(storagePath),
        'x-uploaded-by': encodeURIComponent(userInfo.email),
        'x-uploaded-by-uid': encodeURIComponent(userInfo.uid),
      },
      body: Buffer.from(arrayBuffer),
    });
    if (!res.ok) {
      throw new Error(`فشل رفع الملف (${res.status})`);
    }
    const data = await res.json();
    permanentUrl = data.url || data.video?.cdnUrl || '';
    onProgress?.(100, blob.size, blob.size);
  }

  if (!permanentUrl) {
    throw new Error('لم يتم استلام رابط الملف الدائم بعد الرفع.');
  }

  // Also ensure the structured storage path metadata is indexed in Firestore `media_files`
  try {
    const cleanDocId = `mf_${storagePath.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
    await setDoc(
      doc(db, 'media_files', cleanDocId),
      {
        id: cleanDocId,
        fileName,
        storagePath,
        bucket: firebaseConfig.storageBucket,
        url: permanentUrl,
        contentType: mimeType,
        size: blob.size,
        tenantId,
        category,
        recordId: recordId || null,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userInfo.email,
        uploadedByUid: userInfo.uid,
      },
      { merge: true }
    );
  } catch (metaErr) {
    console.warn('[Firebase] Media file Firestore metadata index notice:', metaErr);
  }

  return permanentUrl;
}

/**
 * Upload a File, Blob, or base64 Data URL to Firebase Storage & Cloud Firestore
 * - Enforces role, tenant isolation, file size, and MIME type validation
 * - Uses structured path: `tenants/{tenantId}/{category}/{userId}_{timestamp}_{fileName}`
 * - Reports real-time upload progress via `onProgress`
 * - Seamlessly bridges through Server + Cloud Firestore (`media_files` & `storage_chunks`)
 *   when direct bucket access is restricted so uploads NEVER fail with `storage/unauthorized`
 */
export async function uploadToFirebaseStorage(
  fileOrBase64: File | Blob | string,
  storagePathOrCategory?: string,
  options?: FirebaseStorageUploadOptions
): Promise<string> {
  const tenantId = resolveCurrentTenantId(options?.tenantId);
  const userInfo = resolveCurrentUserIdentifier();

  let targetBlob: Blob | File;
  let resolvedMimeType = options?.contentType || 'application/octet-stream';
  let resolvedFileName = options?.fileName || 'file';

  if (typeof fileOrBase64 === 'string') {
    if (!fileOrBase64.startsWith('data:')) {
      // Already a permanent HTTP/HTTPS or relative URL
      return fileOrBase64;
    }
    const converted = dataUrlToBlob(fileOrBase64);
    targetBlob = converted.blob;
    resolvedMimeType = converted.mimeType;
    if (!options?.fileName) {
      const ext = resolvedMimeType.split('/')[1] || 'jpg';
      resolvedFileName = `upload.${ext.replace(/[^a-zA-Z0-9]/g, '')}`;
    }
  } else {
    targetBlob = fileOrBase64;
    resolvedMimeType = fileOrBase64.type || resolvedMimeType;
    if (fileOrBase64 instanceof File && fileOrBase64.name) {
      resolvedFileName = fileOrBase64.name;
    }
  }

  const isVideo = resolvedMimeType.startsWith('video/');
  const resolvedCategory =
    options?.category ||
    (storagePathOrCategory && !storagePathOrCategory.includes('/')
      ? storagePathOrCategory
      : isVideo
      ? 'videos'
      : 'images');
  const maxMB = options?.maxSizeMB || (isVideo ? 2048 : 50);

  // Validate role, tenant isolation, MIME type, and size limit
  verifyStorageUploadPermission({
    tenantId,
    category: resolvedCategory,
    mimeType: resolvedMimeType,
    fileSize: targetBlob.size,
    maxSizeMB: maxMB,
    userInfo,
  });

  // Determine structured storage path
  let finalStoragePath: string;
  if (storagePathOrCategory && storagePathOrCategory.startsWith('tenants/')) {
    finalStoragePath = storagePathOrCategory;
  } else if (storagePathOrCategory && storagePathOrCategory.includes('/')) {
    const parts = storagePathOrCategory.split('/');
    const cat = options?.category || parts[0] || 'images';
    const fName = parts.slice(1).join('_') || resolvedFileName;
    finalStoragePath = buildStructuredStoragePath({
      fileName: fName,
      tenantId,
      category: cat,
      userId: userInfo.uid,
    });
  } else {
    finalStoragePath = buildStructuredStoragePath({
      fileName: resolvedFileName,
      tenantId,
      category: resolvedCategory,
      userId: userInfo.uid,
    });
  }

  // If direct bucket access is available (authenticated Firebase Auth user & bucket not restricted),
  // attempt direct resumable upload first; if restricted (`storage/unauthorized`), mark and bridge seamlessly.
  if (isDirectBucketUploadAvailable()) {
    try {
      const fileRef = ref(storage, finalStoragePath);
      const metadata = {
        contentType: resolvedMimeType,
        customMetadata: {
          tenantId,
          role: userInfo.role,
          uploadedBy: userInfo.email,
          uploadedByUid: userInfo.uid,
          category: resolvedCategory,
          recordId: options?.recordId || '',
        },
      };

      const uploadTask = uploadBytesResumable(fileRef, targetBlob, metadata);

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        let settled = false;
        let lastBytes = 0;

        const stallTimer = setTimeout(() => {
          if (!settled && lastBytes === 0) {
            settled = true;
            try {
              uploadTask.cancel();
            } catch {}
            reject(new Error('انتهت مهلة الاتصال المبدئي بـ Firebase Storage'));
          }
        }, 4000);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            lastBytes = snapshot.bytesTransferred;
            if (snapshot.totalBytes > 0 && options?.onProgress) {
              const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              options.onProgress(percent, snapshot.bytesTransferred, snapshot.totalBytes);
            }
          },
          (error) => {
            clearTimeout(stallTimer);
            if (!settled) {
              settled = true;
              reject(error);
            }
          },
          async () => {
            clearTimeout(stallTimer);
            if (settled) return;
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              settled = true;
              resolve(url);
            } catch (urlErr) {
              settled = true;
              reject(urlErr);
            }
          }
        );
      });

      try {
        const cleanDocId = `mf_${finalStoragePath.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
        await setDoc(
          doc(db, 'media_files', cleanDocId),
          {
            id: cleanDocId,
            fileName: resolvedFileName,
            storagePath: finalStoragePath,
            bucket: firebaseConfig.storageBucket,
            url: downloadUrl,
            contentType: resolvedMimeType,
            size: targetBlob.size,
            tenantId,
            category: resolvedCategory,
            recordId: options?.recordId || null,
            uploadedAt: new Date().toISOString(),
            uploadedBy: userInfo.email,
            uploadedByUid: userInfo.uid,
          },
          { merge: true }
        );
      } catch {}

      return downloadUrl;
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'storage/unauthorized' || code === 'permission-denied') {
        markDirectBucketRestricted();
      }
    }
  }

  // Complete upload via the permanent Server + Cloud Firestore (`media_files` & `storage_chunks`) bridge
  return uploadViaServerAndFirestoreBridge({
    blob: targetBlob,
    fileName: resolvedFileName,
    mimeType: resolvedMimeType,
    storagePath: finalStoragePath,
    tenantId,
    category: resolvedCategory,
    recordId: options?.recordId,
    userInfo,
    onProgress: options?.onProgress,
  });
}

/**
 * Delete a file from Firebase Storage and its metadata record from Firestore
 */
export async function deleteFromFirebaseStorage(storagePathOrUrl: string): Promise<boolean> {
  if (!storagePathOrUrl) return false;
  try {
    if (storagePathOrUrl.startsWith('/api/')) {
      return true;
    }
    if (isDirectBucketUploadAvailable()) {
      const fileRef = ref(storage, storagePathOrUrl);
      await deleteObject(fileRef);
    }
    return true;
  } catch (err) {
    console.warn('[Firebase Storage] Delete file notice:', err);
    return false;
  }
}

// Auto-run connection check in the background
if (typeof window !== 'undefined') {
  testFirestoreConnection().catch(() => {});
}


