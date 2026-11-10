import { ensurePermanentImageUrl } from '../api/imageApi';

/**
 * Document & Invoice Optimization Utility for Association Operations
 * - Optimizes photos of invoices/receipts (compressing phone camera images while keeping numbers & text razor sharp)
 * - Processes PDF documents & images
 * - Automatically uploads files to the permanent server storage (/api/images/...) so URLs are lightweight and permanent
 */

export interface OptimizedProofFile {
  dataUrl: string;
  name: string;
  size: number; // optimized size in bytes
  originalSize: number; // original size in bytes
  type: 'image' | 'pdf';
  mimeType: string;
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 بايت';
  const k = 1024;
  const sizes = ['بايت', 'كيلوبايت', 'ميجابايت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i] || 'ميجابايت'}`;
};

/**
 * Optimizes an image invoice/receipt and uploads it to permanent server storage:
 * Preserves high resolution (up to 1920px max dimension) and 0.88 quality
 * to keep numbers, stamps, dates, and handwriting 100% legible.
 */
export const optimizeInvoiceImage = (file: File): Promise<OptimizedProofFile> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('الملف المختار ليس صورة صالحة (JPG, PNG, WebP)'));
    }

    // Limit raw upload to 50MB
    if (file.size > 50 * 1024 * 1024) {
      return reject(new Error('حجم ملف الصورة كبير جدًا (الحد الأقصى 50 ميجابايت)'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 1920; // 1920px ensures fine text on receipts remains sharp
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('تعذر معالجة بيانات الصورة'));
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = 0.88;
          const rawDataUrl = canvas.toDataURL(outputFormat, quality);

          const base64Length = rawDataUrl.length - (rawDataUrl.indexOf(',') + 1);
          const approxBytes = Math.round((base64Length * 3) / 4);

          const permanentUrl = await ensurePermanentImageUrl(rawDataUrl, {
            category: 'documents',
            fileName: file.name || 'invoice.jpg',
            contentType: outputFormat,
          });

          resolve({
            dataUrl: permanentUrl,
            name: file.name,
            size: approxBytes,
            originalSize: file.size,
            type: 'image',
            mimeType: outputFormat,
          });
        } catch (err: any) {
          reject(new Error(err?.message || 'تعذر حفظ صورة الوثيقة على الخادم الدائم'));
        }
      };

      img.onerror = () => reject(new Error('تعذر تحميل الصورة ومعالجتها'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('فشل قراءة الملف من الجهاز'));
    reader.readAsDataURL(file);
  });
};

/**
 * Processes a PDF document or invoice image and uploads to permanent server storage
 */
export const processInvoiceDocument = (file: File): Promise<OptimizedProofFile> => {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('image/')) {
      return optimizeInvoiceImage(file).then(resolve).catch(reject);
    }

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      if (file.size > 50 * 1024 * 1024) {
        return reject(new Error('حجم ملف PDF كبير جدًا (الحد الأقصى 50 ميجابايت)'));
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const rawDataUrl = e.target?.result as string;
          const permanentUrl = await ensurePermanentImageUrl(rawDataUrl, {
            category: 'documents',
            fileName: file.name || 'document.pdf',
            contentType: 'application/pdf',
          });
          resolve({
            dataUrl: permanentUrl,
            name: file.name,
            size: file.size,
            originalSize: file.size,
            type: 'pdf',
            mimeType: 'application/pdf',
          });
        } catch (err: any) {
          reject(new Error(err?.message || 'فشل رفع ملف PDF إلى الخادم الدائم'));
        }
      };
      reader.onerror = () => reject(new Error('فشل قراءة ملف PDF من الجهاز'));
      reader.readAsDataURL(file);
      return;
    }

    reject(new Error('نوع الملف غير مدعوم. يرجى اختيار صورة (JPG, PNG, WebP) أو مستند PDF'));
  });
};
