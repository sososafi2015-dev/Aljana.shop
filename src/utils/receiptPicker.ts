// Universal Native Receipt & File Manager Picker Utility
//
// Strictly uses <input type="file"> without capture or any camera invocation:
// 1. Opens the device's native File Manager (مدير الملفات) directly on:
//    - Android (smartphones & tablets)
//    - iPhone / iPad (iOS / iPadOS)
//    - Windows, macOS, and Linux computers
// 2. Prevents opening the Camera or displaying "Take Photo / أخذ صورة عبر الكاميرا" in mobile choosers:
//    - In Android Chromium's SelectFileDialog.java:
//      - ALL_TYPES = "*" + "/*"
//      - GENERIC_TYPE = "application/octet-stream"
//      - acceptsType(superType) returns true if mMimeTypes.isEmpty() || mMimeTypes.contains(ALL_TYPES) || countAcceptTypesFor(superType) > 0.
//      - shouldShowImageTypes() calls acceptsType("image").
//      - If shouldShowImageTypes() is true, SelectFileDialog requests CAMERA permission and adds
//        Intent(MediaStore.ACTION_IMAGE_CAPTURE) to extraIntents (EXTRA_INITIAL_INTENTS), which causes
//        Android to display the "أخذ صورة بالكاميرا (Camera)" option!
//      - However, when accept="application/octet-stream,application/pdf" (with NO wildcard and NO image MIME type):
//        a) mMimeTypes is ["application/octet-stream", "application/pdf"] (not empty, does NOT contain ALL_TYPES,
//           and countAcceptTypesFor("image") === 0).
//        b) Therefore shouldShowImageTypes(), shouldShowVideoTypes(), shouldShowAudioTypes(), and
//           shouldUsePhotoPicker() all evaluate to FALSE!
//        c) extraIntents is 100% EMPTY (no Camera intent is ever added or requested).
//        d) In showExternalPicker(), getContentIntent.setType(ALL_TYPES) is set, and because
//           mMimeTypes.contains(GENERIC_TYPE) ("application/octet-stream") is TRUE, Chromium skips
//           restricting EXTRA_MIME_TYPES, launching ACTION_GET_CONTENT + CATEGORY_OPENABLE directly
//           into Android's native File Manager (DocumentsUI / مدير الملفات) with all files (JPG, JPEG, PNG, WebP, PDF) selectable!
// 3. Validates selected files in JavaScript to strictly allow JPG, JPEG, PNG, WebP, and PDF up to 25MB.

export const ACCEPTED_RECEIPT_TYPES =
  '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';

export const MOBILE_DOCUMENT_PICKER_ACCEPT =
  'application/octet-stream,application/pdf';

export const MAX_RECEIPT_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export interface ReceiptValidationResult {
  valid: boolean;
  error?: string;
}

// Detects whether the current device is a mobile phone or tablet (Android, iPhone, iPad),
// including when "Desktop site" mode is enabled on mobile browsers.
export function isMobileOrTabletOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) {
    return true;
  }
  // Detect Android Chrome or iPadOS Safari in "Request Desktop Site" mode
  if (
    (/Linux|Macintosh/i.test(ua) &&
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1) ||
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches)
  ) {
    return true;
  }
  return false;
}

// Returns the optimal accept attribute for <input type="file"> for the current device:
// - On Mobile / Tablet (Android / iOS): returns "application/octet-stream,application/pdf"
//   so Android SelectFileDialog.java evaluates shouldShowImageTypes() === false (no camera option)
//   and mMimeTypes.contains(GENERIC_TYPE) === true, opening the native File Manager (DocumentsUI)
//   directly while allowing JPG/JPEG/PNG/WebP/PDF selection.
// - On Desktop (Windows / macOS / Linux): returns explicit receipt extensions and MIME types so
//   desktop file explorers filter to receipt images and PDF documents.
export function getDeviceReceiptAcceptAttribute(): string {
  return isMobileOrTabletOS() ? MOBILE_DOCUMENT_PICKER_ACCEPT : ACCEPTED_RECEIPT_TYPES;
}

// Ensures a selected file always has a clean filename with a valid extension
// (e.g. when Android DocumentsUI returns a content URI display name like "1000048291" with MIME "image/jpeg").
export function normalizeReceiptFileName(file: File): string {
  const rawName = (file.name || '').trim() || `receipt_${Date.now()}`;
  const lower = rawName.toLowerCase();
  if (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.pdf')
  ) {
    return rawName;
  }

  const mime = (file.type || '').toLowerCase();
  if (mime.includes('png')) return `${rawName}.png`;
  if (mime.includes('webp')) return `${rawName}.webp`;
  if (mime.includes('pdf')) return `${rawName}.pdf`;
  return `${rawName}.jpg`;
}

export function validateReceiptFile(file: File): ReceiptValidationResult {
  if (!file) {
    return { valid: false, error: 'لم يتم اختيار أي ملف.' };
  }

  // 1. Check file size
  if (file.size <= 0) {
    return {
      valid: false,
      error: 'الملف المختار فارغ أو غير صالح. يرجى اختيار ملف وصل صحيح من جهازك.',
    };
  }

  if (file.size > MAX_RECEIPT_FILE_SIZE) {
    return {
      valid: false,
      error: `حجم ملف الوصل كبير جداً (${formatFileSize(file.size)}). الحد الأقصى المسموح به هو 25 ميغابايت.`,
    };
  }

  // 2. Check extension & MIME type (JPG, JPEG, PNG, WebP, PDF)
  const nameLower = (file.name || '').toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const hasAllowedExt = allowedExtensions.some((ext) => nameLower.endsWith(ext));

  const mime = file.type ? file.type.toLowerCase() : '';
  const isAllowedImageMime =
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/pjpeg' ||
    mime === 'image/png' ||
    mime === 'image/x-png' ||
    mime === 'image/webp';
  const isPdfMime = mime === 'application/pdf';

  // Reject any disallowed MIME types (e.g., video, audio, text, executable) even if extension is missing
  const hasExplicitDisallowedMime =
    Boolean(mime) &&
    mime !== 'application/octet-stream' &&
    !isAllowedImageMime &&
    !isPdfMime;

  if (hasExplicitDisallowedMime || (!hasAllowedExt && !isAllowedImageMime && !isPdfMime)) {
    return {
      valid: false,
      error:
        'صيغة الملف غير مدعومة. يرجى اختيار صورة لوصل الدفع بصيغة (JPG, JPEG, PNG, WebP) أو ملف (PDF) المحفوظ في جهازك.',
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Synchronously triggers the <input type="file"> element to open the native device File Manager
// directly without invoking the camera or consuming the user gesture asynchronously.
export function openNativeReceiptPicker(
  inputElement: HTMLInputElement | null,
  _onFilePicked?: (file: File) => void
): void {
  if (!inputElement) return;

  // Strictly guarantee no camera capture attributes exist on the file input
  inputElement.removeAttribute('capture');
  inputElement.removeAttribute('webkitcapture');
  inputElement.removeAttribute('mozcapture');

  // Set device-appropriate accept attribute so Android opens DocumentsUI (مدير الملفات) directly without Camera intent
  inputElement.setAttribute('accept', getDeviceReceiptAcceptAttribute());

  // Reset value so selecting the same file again still triggers onChange
  inputElement.value = '';
  inputElement.click();
}
