import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  PlusCircle, 
  Sparkles, 
  Image as ImageIcon, 
  MapPin, 
  Calendar, 
  Users, 
  DollarSign,
  Camera,
  Smartphone,
  UploadCloud,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Star,
  Layers,
  FileText,
  Video,
  Plus,
  Eye,
  Download,
  ExternalLink,
  RefreshCw,
  File,
  Link2,
  FileCheck2,
  Upload,
  Play,
  Film,
  Sliders,
  ShieldCheck,
  HardDrive,
  Monitor,
  PlayCircle,
  Clock,
  Zap,
  Settings
} from 'lucide-react';
import { ActivityItem, ActivityProofAttachment, ActivityVideoMetadata, ExpenseCategory, Language } from '../types';
import { translations } from '../translations';
import { parseVideoUrl, validateVideoUrl, VideoPlayer, getActivityVideoUrls } from '../utils/videoUtils';
import {
  uploadVideoToObjectStorage,
  deleteVideoFromObjectStorage,
  getStoredVideoSettings,
  saveVideoSettings,
  VideoUploadProgress,
  formatVideoDuration,
} from '../utils/videoStorageEngine';
import { CurrentAdminSession } from '../types';
import { apiAddGalleryPhotos, apiDeleteSingleGalleryPhoto, apiDeleteAllGalleryPhotos } from '../api/activitiesApi';
import { ensurePermanentImageUrl, uploadBase64ImageToServer } from '../api/imageApi';

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activity: Omit<ActivityItem, 'id'>) => Promise<boolean | void> | void;
  editingActivity?: ActivityItem | null;
  lang: Language;
  canEdit?: boolean;
  currentAdminSession?: CurrentAdminSession | null;
  activeTenantId?: string;
  onAddGalleryImages?: (activityId: string, newUrls: string[]) => Promise<boolean | void> | void;
  onDeleteGalleryImage?: (activityId: string, imageIndex: number, imageUrl?: string) => Promise<boolean> | void;
  onDeleteAllGalleryImages?: (activityId: string) => Promise<boolean> | void;
}

/**
 * Client-side Canvas Image Compression:
 * Resizes and optimizes images from mobile camera/gallery to keep file sizes lightweight (~80-150KB),
 * ultra-sharp, and permanently persisted in local storage without bloating.
 */
const compressActivityImage = (
  file: File,
  maxWidth = 1200,
  maxHeight = 800,
  quality = 0.85
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('الملف المختار ليس صورة صالحة (يرجى اختيار JPG, JPEG, PNG, WebP)'));
    }

    if (file.size > 20 * 1024 * 1024) {
      return reject(new Error('حجم ملف الصورة كبير جدًا (الحد الأقصى 20 ميجابايت)'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
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
        const dataUrl = canvas.toDataURL(outputFormat, quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('خطأ أثناء قراءة الملف من الهاتف'));
    reader.readAsDataURL(file);
  });
};

/**
 * Process proof document/invoice from phone or computer.
 * Supports:
 * - Images: JPG, JPEG, PNG, WEBP (auto-compressed for lightweight persistence)
 * - PDF: application/pdf
 * - Word documents: DOC, DOCX
 * Maximum file size: 10MB
 */
const processProofFile = async (
  file: File
): Promise<ActivityProofAttachment> => {
  const fileName = file.name || 'document';
  const lowerName = fileName.toLowerCase();

  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(lowerName);
  const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
  const isWord =
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.(doc|docx)$/i.test(lowerName);

  if (!isImage && !isPdf && !isWord) {
    throw new Error('نوع الملف غير مدعوم. يرجى اختيار صورة (JPG, PNG, WEBP) أو ملف PDF أو مستند Word (DOC, DOCX).');
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`حجم الملف كبير جدًا (${sizeMb} ميجابايت). الحد الأقصى المسموح به هو 10 ميجابايت.`);
  }

  if (isImage) {
    const compressedUrl = await compressActivityImage(file, 1400, 1000, 0.85);
    const permanentUrl = await uploadBase64ImageToServer(compressedUrl);
    return {
      name: file.name,
      size: file.size,
      type: 'image',
      mimeType: file.type || 'image/jpeg',
      url: permanentUrl,
      uploadedAt: new Date().toISOString(),
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawDataUrl = reader.result as string;
        const permanentUrl = isPdf ? await uploadBase64ImageToServer(rawDataUrl) : rawDataUrl;
        resolve({
          name: file.name,
          size: file.size,
          type: isPdf ? 'pdf' : 'word',
          mimeType: file.type || (isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          url: permanentUrl,
          uploadedAt: new Date().toISOString(),
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('حدث خطأ أثناء قراءة الملف من الجهاز'));
    reader.readAsDataURL(file);
  });
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 ك.ب';
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
};

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingActivity,
  lang,
  canEdit = true,
  currentAdminSession,
  activeTenantId,
  onAddGalleryImages,
  onDeleteGalleryImage,
  onDeleteAllGalleryImages,
}) => {
  const t = translations[lang];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('tree_planting');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('قرية الشايف');
  const [spentAmount, setSpentAmount] = useState<number | ''>('');
  const [beneficiariesCount, setBeneficiariesCount] = useState<number | ''>('');
  
  // Images state
  const [coverImage, setCoverImage] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  // Granular Gallery Deletion States
  const [imageToDelete, setImageToDelete] = useState<{ index: number; url: string } | null>(null);
  const [isConfirmingDeleteAll, setIsConfirmingDeleteAll] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  
  // Video & Documents (Multiple Video URLs + Direct Video Upload)
  const [videoUrls, setVideoUrls] = useState<string[]>(['']);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [uploadedVideoMetadata, setUploadedVideoMetadata] = useState<ActivityVideoMetadata | undefined>(undefined);
  const [isUploadingVideoFile, setIsUploadingVideoFile] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);

  const [proofDocumentUrl, setProofDocumentUrl] = useState('');
  const [proofMode, setProofMode] = useState<'upload' | 'url'>('upload');
  const [proofAttachment, setProofAttachment] = useState<ActivityProofAttachment | null>(null);
  const [isProcessingProof, setIsProcessingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);

  const [isFeatured, setIsFeatured] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File Upload State
  const [isProcessingCover, setIsProcessingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverSuccess, setCoverSuccess] = useState(false);

  const [isProcessingGallery, setIsProcessingGallery] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [gallerySuccess, setGallerySuccess] = useState(false);

  // Native input refs
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const proofFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Preset fallback options
  const presetImages = [
    { label: 'تشجير وزراعة', url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1000&q=80' },
    { label: 'دعم مدرسي وأطفال', url: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1000&q=80' },
    { label: 'تجهيزات ومعدات', url: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=1000&q=80' },
    { label: 'قفة رمضان والمساعدات', url: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1000&q=80' },
    { label: 'قافلة طبية', url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1000&q=80' },
  ];

  // Sync state on open / edit
  useEffect(() => {
    if (isOpen) {
      if (editingActivity) {
        setTitle(editingActivity.title || '');
        setDescription(editingActivity.description || '');
        setCategory(editingActivity.category || 'tree_planting');
        setDate(editingActivity.date || new Date().toISOString().slice(0, 10));
        setLocation(editingActivity.location || 'قرية الشايف');
        setSpentAmount(editingActivity.spentAmount ?? '');
        setBeneficiariesCount(editingActivity.beneficiariesCount ?? '');
        setCoverImage(editingActivity.coverImage || '');
        setGalleryImages(Array.isArray(editingActivity.galleryImages) ? editingActivity.galleryImages : []);
        
        // Video URLs initialization: extract all associated videos or fallback to single
        const extractedVideoUrls = getActivityVideoUrls(editingActivity);
        if (extractedVideoUrls.length > 0) {
          setVideoUrls(extractedVideoUrls);
        } else {
          setVideoUrls(['']);
        }
        setUploadedVideoMetadata(editingActivity.videoMetadata);
        
        // Handle proof attachment and proof document url
        if (editingActivity.proofAttachment) {
          setProofAttachment(editingActivity.proofAttachment);
          setProofDocumentUrl(editingActivity.proofAttachment.url || '');
          setProofMode('upload');
        } else if (editingActivity.proofDocumentUrl) {
          setProofDocumentUrl(editingActivity.proofDocumentUrl);
          if (editingActivity.proofDocumentUrl.startsWith('data:')) {
            const isImg = editingActivity.proofDocumentUrl.startsWith('data:image/');
            const isPdf = editingActivity.proofDocumentUrl.startsWith('data:application/pdf');
            setProofAttachment({
              name: isImg ? 'وثيقة_صورة_إثبات' : isPdf ? 'وثيقة_إثبات.pdf' : 'مستند_إثبات.docx',
              size: Math.round((editingActivity.proofDocumentUrl.length * 3) / 4),
              type: isImg ? 'image' : isPdf ? 'pdf' : 'word',
              mimeType: isImg ? 'image/jpeg' : isPdf ? 'application/pdf' : 'application/msword',
              url: editingActivity.proofDocumentUrl,
            });
            setProofMode('upload');
          } else {
            setProofMode('url');
            setProofAttachment(null);
          }
        } else {
          setProofAttachment(null);
          setProofDocumentUrl('');
          setProofMode('upload');
        }

        setIsFeatured(editingActivity.isFeatured ?? true);
        setIsActive(editingActivity.isActive ?? true);
      } else {
        setTitle('');
        setDescription('');
        setCategory('tree_planting');
        setDate(new Date().toISOString().slice(0, 10));
        setLocation('قرية الشايف');
        setSpentAmount('');
        setBeneficiariesCount('');
        setCoverImage('');
        setGalleryImages([]);
        setVideoUrls(['']);
        setUploadedVideoMetadata(undefined);
        setProofDocumentUrl('');
        setProofAttachment(null);
        setProofMode('upload');
        setIsFeatured(true);
        setIsActive(true);
      }
      setCoverError(null);
      setCoverSuccess(false);
      setGalleryError(null);
      setGallerySuccess(false);
      setProofError(null);
      setProofSuccess(false);
      setVideoError(null);
      setIsProcessingProof(false);
      setIsUploadingVideoFile(false);
      setVideoUploadProgress(0);
      setIsSubmitting(false);
    }
  }, [isOpen, editingActivity]);

  if (!isOpen) return null;

  // Handle Cover Photo Selection from Phone / Device
  const handleCoverPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingCover(true);
    setCoverError(null);
    setCoverSuccess(false);

    try {
      const optimizedUrl = await compressActivityImage(file, 1200, 800, 0.85);
      // Immediately upload and save to permanent server / Firebase Storage
      const permanentUrl = await ensurePermanentImageUrl(optimizedUrl, {
        tenantId: activeTenantId,
        category: 'activity_cover',
        recordId: editingActivity?.id,
        fileName: file.name,
      });
      setCoverImage(permanentUrl);
      setCoverSuccess(true);
      setTimeout(() => setCoverSuccess(false), 3500);
    } catch (err: any) {
      console.error('Error uploading activity cover photo:', err);
      setCoverError(err.message || t.activityPhotoError || 'حدث خطأ أثناء معالجة صورة النشاط');
    } finally {
      setIsProcessingCover(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
    }
  };

  // Handle Multiple Gallery Photos Selection from Phone / Device
  const handleGalleryPhotosSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingGallery(true);
    setGalleryError(null);
    setGallerySuccess(false);

    try {
      const newImages: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const optimized = await compressActivityImage(file, 1000, 700, 0.82);
          const permanent = await ensurePermanentImageUrl(optimized, {
            tenantId: activeTenantId,
            category: 'activity_gallery',
            recordId: editingActivity?.id,
            fileName: file.name,
          });
          if (permanent && typeof permanent === 'string' && permanent.trim().length > 0) {
            newImages.push(permanent);
          }
        }
      }

      if (newImages.length > 0) {
        setGalleryImages((prev) => {
          const merged = [...prev];
          for (const url of newImages) {
            if (!merged.includes(url)) {
              merged.push(url);
            }
          }
          return merged;
        });

        // If cover is empty, automatically set the first uploaded image as cover
        if (!coverImage && newImages.length > 0) {
          setCoverImage(newImages[0]);
        }

        // If editing an existing activity, immediately persist the newly added gallery photos
        // to Firebase Firestore, backend database, and local storage so they are never lost on refresh
        if (editingActivity?.id) {
          if (onAddGalleryImages) {
            await onAddGalleryImages(editingActivity.id, newImages);
          } else {
            await apiAddGalleryPhotos(editingActivity.id, newImages, currentAdminSession, activeTenantId);
          }
        }

        setGallerySuccess(true);
        setTimeout(() => setGallerySuccess(false), 3500);
      } else {
        setGalleryError('لم يتم العثور على صور صالحة من الملفات المحددة.');
      }
    } catch (err: any) {
      console.error('Error uploading gallery photos:', err);
      setGalleryError(err.message || t.activityPhotoError || 'حدث خطأ أثناء رفع وحفظ صور المعرض');
    } finally {
      setIsProcessingGallery(false);
      if (galleryInputRef.current) {
        galleryInputRef.current.value = '';
      }
    }
  };

  // Granular Gallery Deletion Handlers
  const handleConfirmDeleteSinglePhoto = async () => {
    if (!imageToDelete) return;
    const { index, url } = imageToDelete;

    // Security check: Only admins with canEdit can delete
    if (canEdit === false) {
      setGalleryError('تم رفض العملية أمنياً: لا تملك صلاحية تعديل أو حذف صور الأنشطة الخيرية.');
      setImageToDelete(null);
      return;
    }

    setIsDeletingImage(true);
    setGalleryError(null);

    try {
      // 1. Remove targeted image ONLY without affecting any other image or their order
      const updatedGallery = galleryImages.filter((_, i) => i !== index);
      setGalleryImages(updatedGallery);

      // If removed image was the cover, fallback to first remaining image or clear
      if (coverImage === url) {
        setCoverImage(updatedGallery.length > 0 ? updatedGallery[0] : '');
      }

      // 2. If editing an existing activity, persist directly to storage and backend API
      if (editingActivity?.id) {
        if (onDeleteGalleryImage) {
          await onDeleteGalleryImage(editingActivity.id, index, url);
        } else {
          await apiDeleteSingleGalleryPhoto(editingActivity.id, index, url, currentAdminSession);
        }
      }

      setGallerySuccess(true);
      setTimeout(() => setGallerySuccess(false), 3000);
    } catch (err: any) {
      console.error('Error deleting single gallery image:', err);
      setGalleryError(err.message || 'حدث خطأ أثناء حذف الصورة.');
    } finally {
      setIsDeletingImage(false);
      setImageToDelete(null);
    }
  };

  const handleConfirmDeleteAllPhotos = async () => {
    // Security check: Only admins with canEdit can delete
    if (canEdit === false) {
      setGalleryError('تم رفض العملية أمنياً: لا تملك صلاحية تعديل أو حذف صور الأنشطة الخيرية.');
      setIsConfirmingDeleteAll(false);
      return;
    }

    setIsDeletingImage(true);
    setGalleryError(null);

    try {
      setGalleryImages([]);

      // If editing an existing activity, persist directly to storage and backend API
      if (editingActivity?.id) {
        if (onDeleteAllGalleryImages) {
          await onDeleteAllGalleryImages(editingActivity.id);
        } else {
          await apiDeleteAllGalleryPhotos(editingActivity.id, currentAdminSession);
        }
      }

      setGallerySuccess(true);
      setTimeout(() => setGallerySuccess(false), 3000);
    } catch (err: any) {
      console.error('Error deleting all gallery images:', err);
      setGalleryError(err.message || 'حدث خطأ أثناء حذف جميع الصور.');
    } finally {
      setIsDeletingImage(false);
      setIsConfirmingDeleteAll(false);
    }
  };

  // Set gallery image as main cover
  const handleSetAsCover = (imgUrl: string) => {
    setCoverImage(imgUrl);
    setCoverSuccess(true);
    setTimeout(() => setCoverSuccess(false), 2500);
  };

  // Handle Proof Document Selection from Phone / Device / Computer
  const handleProofFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingProof(true);
    setProofError(null);
    setProofSuccess(false);

    try {
      const attachment = await processProofFile(file);
      setProofAttachment(attachment);
      setProofDocumentUrl(attachment.url);
      setProofSuccess(true);
      setTimeout(() => setProofSuccess(false), 3500);
    } catch (err: any) {
      console.error('Error uploading proof document:', err);
      setProofError(err.message || 'حدث خطأ أثناء رفع ومعالجة ملف الإثبات');
    } finally {
      setIsProcessingProof(false);
      if (proofFileInputRef.current) {
        proofFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveProofFile = () => {
    setProofAttachment(null);
    setProofDocumentUrl('');
    setProofError(null);
    setProofSuccess(false);
  };

  const handleReplaceProofFile = () => {
    proofFileInputRef.current?.click();
  };

  // Direct Video File Upload Handler from Phone or Computer
  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVideoFile(true);
    setVideoError(null);
    setVideoUploadProgress(0);

    try {
      const metadata = await uploadVideoToObjectStorage(
        file,
        editingActivity?.id,
        getStoredVideoSettings(),
        (prog: VideoUploadProgress) => {
          setVideoUploadProgress(prog.percent || 0);
        }
      );
      if (metadata.thumbnailUrl && metadata.thumbnailUrl.startsWith('data:')) {
        metadata.thumbnailUrl = await ensurePermanentImageUrl(metadata.thumbnailUrl);
      }
      setUploadedVideoMetadata(metadata);
      const streamUrl = metadata.cdnUrl || `/api/videos/stream/${metadata.id}`;
      setVideoUrls((prev) => {
        const nonEmpty = prev.map((u) => u.trim()).filter((u) => u.length > 0);
        return [streamUrl, ...nonEmpty.filter((u) => u !== streamUrl)];
      });
      if (!coverImage && metadata.thumbnailUrl) {
        setCoverImage(metadata.thumbnailUrl);
      }
    } catch (err: any) {
      console.error('Error uploading video file:', err);
      setVideoError(err.message || 'تعذر رفع ملف الفيديو إلى الخادم');
    } finally {
      setIsUploadingVideoFile(false);
      if (videoFileInputRef.current) {
        videoFileInputRef.current.value = '';
      }
    }
  };

  // Video URLs Handlers
  const handleAddVideoUrl = () => {
    setVideoUrls((prev) => [...prev, '']);
  };

  const handleUpdateVideoUrl = (index: number, val: string) => {
    setVideoUrls((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
    setVideoError(null);
  };

  const handleRemoveVideoUrl = (index: number) => {
    setVideoUrls((prev) => {
      const removedUrl = prev[index];
      if (uploadedVideoMetadata && removedUrl === uploadedVideoMetadata.cdnUrl) {
        setUploadedVideoMetadata(undefined);
      }
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [''] : next;
    });
    setVideoError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    // Clean and validate video URLs
    const cleanedVideoUrls = videoUrls
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && !u.includes('dQw4w9WgXcQ'));

    for (let i = 0; i < cleanedVideoUrls.length; i++) {
      const check = validateVideoUrl(cleanedVideoUrls[i]);
      if (!check.isValid) {
        setVideoError(`رابط الفيديو رقم ${i + 1} غير صالح. يرجى التأكد من كتابة رابط YouTube أو Vimeo أو رفع ملف فيديو صالح.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const primaryVideoUrl = cleanedVideoUrls[0] || undefined;
      let effectiveVideoMetadata: ActivityVideoMetadata | undefined = undefined;

      if (primaryVideoUrl) {
        if (
          uploadedVideoMetadata &&
          (uploadedVideoMetadata.cdnUrl === primaryVideoUrl ||
            uploadedVideoMetadata.storageKey === primaryVideoUrl ||
            primaryVideoUrl.startsWith('/api/videos/stream/'))
        ) {
          effectiveVideoMetadata = {
            ...uploadedVideoMetadata,
            cdnUrl: primaryVideoUrl,
            storageKey: primaryVideoUrl,
          };
        } else {
          const parsed = parseVideoUrl(primaryVideoUrl);
          effectiveVideoMetadata = {
            id: `ext-${Date.now()}`,
            originalName: 'فيديو توثيقي',
            mimeType: 'video/mp4',
            fileSize: 0,
            fileSizeFormatted: 'رابط خارجي',
            duration: 0,
            durationFormatted: 'فيديو توثيقي',
            width: 1280,
            height: 720,
            resolution: 'HD',
            storageKey: primaryVideoUrl,
            cdnUrl: primaryVideoUrl,
            thumbnailUrl: parsed.thumbnailUrl,
            processingStatus: 'ready',
            uploadedAt: new Date().toISOString(),
            isUploadedDirectly: primaryVideoUrl.startsWith('/api/videos/stream/'),
          };
        }
      }

      // Auto-extract thumbnail if video is present and no custom cover is uploaded
      const videoParsed = primaryVideoUrl ? parseVideoUrl(primaryVideoUrl) : null;
      const fallbackImage = effectiveVideoMetadata?.thumbnailUrl || videoParsed?.thumbnailUrl || presetImages[0].url;

      // Use coverImage or first gallery image or youtube thumbnail or fallback preset
      let effectiveCover = coverImage || (galleryImages.length > 0 ? galleryImages[0] : fallbackImage);
      let effectiveGallery = Array.isArray(galleryImages) ? [...galleryImages] : [];

      // Ensure any remaining base64 images are uploaded to permanent server URLs BEFORE saving
      if (effectiveCover && effectiveCover.startsWith('data:')) {
        effectiveCover = await ensurePermanentImageUrl(effectiveCover, {
          tenantId: activeTenantId,
          category: 'activity_cover',
          recordId: editingActivity?.id,
        });
      }

      if (effectiveGallery.length > 0) {
        effectiveGallery = await Promise.all(
          effectiveGallery.map((img) =>
            img && img.startsWith('data:')
              ? ensurePermanentImageUrl(img, {
                  tenantId: activeTenantId,
                  category: 'activity_gallery',
                  recordId: editingActivity?.id,
                })
              : Promise.resolve(img)
          )
        );
      }

      // Compute effective proof document URL and attachment
      let effectiveProofUrl = proofMode === 'upload'
        ? (proofAttachment?.url || '')
        : proofDocumentUrl.trim();

      if (effectiveProofUrl && effectiveProofUrl.startsWith('data:')) {
        effectiveProofUrl = await uploadBase64ImageToServer(effectiveProofUrl);
      }

      const effectiveProofAttachment = proofMode === 'upload' && proofAttachment
        ? { ...proofAttachment, url: effectiveProofUrl || proofAttachment.url }
        : undefined;

      const saveResult = await onSave({
        title: title.trim(),
        description: description.trim(),
        category,
        date,
        location: location.trim(),
        spentAmount: Number(spentAmount) || 0,
        beneficiariesCount: Number(beneficiariesCount) || undefined,
        coverImage: effectiveCover,
        galleryImages: effectiveGallery,
        videoUrl: primaryVideoUrl,
        videoUrls: cleanedVideoUrls,
        videoMetadata: effectiveVideoMetadata,
        proofDocumentUrl: effectiveProofUrl || undefined,
        proofAttachment: effectiveProofAttachment,
        isFeatured,
        isActive,
      });

      if (saveResult !== false) {
        onClose();
      } else {
        setGalleryError('تعذر حفظ التعديلات والصور الإضافية في قاعدة البيانات. يرجى المحاولة مرة أخرى.');
      }
    } catch (err: any) {
      console.error('Error saving activity:', err);
      setGalleryError(err?.message || 'حدث خطأ أثناء حفظ النشاط والصور الإضافية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                {editingActivity ? t.edit : t.addActivity}
              </h3>
              <p className="text-xs text-slate-400">
                توثيق الأنشطة الميدانية والصور المرفوعة من الهاتف لحفظ دائم وشفاف
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>المعلومات الأساسية للنشاط</span>
            </h4>

            {/* Title */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                عنوان النشاط أو العمل الخيري *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: حملة تشجير وغرس 150 شجرة بمركز الشايف"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
              />
            </div>

            {/* Category & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                  {t.selectCategory} *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all font-medium"
                >
                  <option value="tree_planting">{t.cat_tree_planting}</option>
                  <option value="social_aid">{t.cat_social_aid}</option>
                  <option value="equipment">{t.cat_equipment}</option>
                  <option value="education">{t.cat_education}</option>
                  <option value="health_caravan">{t.cat_health_caravan}</option>
                  <option value="maintenance">{t.cat_maintenance}</option>
                  <option value="ramadan_aid">{t.cat_ramadan_aid}</option>
                  <option value="other">{t.cat_other}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                  {t.location}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="مركز الشايف، محيط المسجد..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all pr-10 rtl:pr-10 ltr:pl-10"
                  />
                  <MapPin className="w-4 h-4 text-slate-400 absolute top-3.5 right-3 rtl:right-3 ltr:left-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Date, Cost, Beneficiaries */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                  {t.activityDate} *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                  {t.cost} (د.م)
                </label>
                <input
                  type="number"
                  min="0"
                  value={spentAmount}
                  onChange={(e) => setSpentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="2500"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono font-bold text-emerald-800 focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                  عدد المستفيدين التقريبي
                </label>
                <input
                  type="number"
                  min="0"
                  value={beneficiariesCount}
                  onChange={(e) => setBeneficiariesCount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="150"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                تفاصيل ووصف النشاط الخيري *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب وصفًا مفصلًا لأهداف النشاط، مراحله، الميزانية، والنتائج المحققة لخدمة قرية الشايف..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all leading-relaxed"
              />
            </div>
          </div>

          {/* Section 2: Primary Activity Cover Image (الصورة الرئيسية للنشاط من الهاتف) */}
          <div className="space-y-3 p-4 sm:p-5 bg-slate-50/80 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>{t.activityCoverImageLabel || 'الصورة الرئيسية للنشاط الخيري'}</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>معرض الهاتف / الكاميرا</span>
              </span>
            </div>

            {/* Hidden Native File Input for Cover Photo */}
            <input
              type="file"
              ref={coverInputRef}
              accept="image/jpeg,image/png,image/webp,image/gif,image/*"
              onChange={handleCoverPhotoSelect}
              className="hidden"
              id="activity-cover-file-input"
            />

            {/* Active Cover Preview */}
            {coverImage ? (
              <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-xs space-y-3">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-inner group">
                  <img
                    src={coverImage}
                    alt={title || 'Activity Cover'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 rtl:right-2 ltr:left-2 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[11px] font-bold flex items-center gap-1 backdrop-blur-xs">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>الصورة الرئيسية المعتمدة</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{t.coverPhotoSuccess || 'تم تجهيز الصورة الرئيسية بنجاح.'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={isProcessingCover}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{t.changeActivityCover || 'تغيير الصورة'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCoverImage('');
                        setCoverSuccess(false);
                        setCoverError(null);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.removeActivityCover || 'حذف'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Upload Action Box for Cover */
              <div
                onClick={() => !isProcessingCover && coverInputRef.current?.click()}
                className={`p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center group ${
                  isProcessingCover
                    ? 'bg-emerald-50/50 border-emerald-300 pointer-events-none'
                    : 'bg-white hover:bg-emerald-50/40 border-slate-300 hover:border-emerald-500 shadow-xs'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-2.5">
                  <div className="w-12 h-12 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isProcessingCover ? (
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6" />
                    )}
                  </div>

                  <div>
                    <h5 className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      {isProcessingCover
                        ? 'جارٍ ضغط ومعالجة الصورة من الهاتف...'
                        : t.chooseActivityCoverFromPhone || '📷 اختيار صورة من الهاتف'}
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                      {t.activityPhotoHelp || 'يدعم اختيار الصور من معرض الهاتف، الكاميرا، أو الملفات (JPG, JPEG, PNG, WebP) مع تحسين وضغط تلقائي.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      coverInputRef.current?.click();
                    }}
                    className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>{t.chooseActivityCoverFromPhone || '📷 اختيار صورة من الهاتف'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error / Success Messages */}
            {coverError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{coverError}</span>
              </div>
            )}

            {/* Presets Fallbacks */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{t.orChoosePresetActivityPhoto || 'أو اختر صورة توثيقية مقترحة:'}</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {presetImages.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCoverImage(preset.url);
                        setCoverError(null);
                        setCoverSuccess(true);
                        setTimeout(() => setCoverSuccess(false), 2500);
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] bg-white hover:bg-emerald-100 hover:text-emerald-900 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Additional Gallery Photos (معرض الصور الإضافية المتعددة من الهاتف) */}
          <div className="space-y-3 p-4 sm:p-5 bg-slate-50/80 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>{t.uploadGalleryPhotos || 'معرض الصور الإضافية (التوثيق الميداني)'}</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  يمكنك اختيار ورفع عدة صور توثيقية دفعة واحدة من معرض الهاتف.
                </p>
              </div>

              {galleryImages.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {galleryImages.length} {t.galleryPhotosCount || 'صور'}
                  </span>
                  <button
                    id="btn-delete-all-gallery-photos"
                    type="button"
                    onClick={() => setIsConfirmingDeleteAll(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-98"
                    title="حذف جميع الصور من معرض التوثيق الميداني دفعة واحدة"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>{t.deleteAllGalleryPhotos || 'حذف جميع الصور'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Hidden Native File Input for Multiple Gallery Photos */}
            <input
              type="file"
              ref={galleryInputRef}
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,image/*"
              onChange={handleGalleryPhotosSelect}
              className="hidden"
              id="activity-gallery-files-input"
            />

            {/* Gallery Thumbnails Grid */}
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                {galleryImages.map((imgUrl, index) => (
                  <div
                    key={`${imgUrl}-${index}`}
                    className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-xs flex flex-col justify-between"
                  >
                    {/* Aspect-ratio photo container */}
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                      <img
                        src={imgUrl}
                        alt={`Gallery item ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Photo sequence badge (#1, #2...) */}
                      <div className="absolute top-1.5 right-1.5 rtl:right-1.5 ltr:left-1.5 px-1.5 py-0.5 rounded-md bg-slate-900/85 text-white text-[10px] font-bold backdrop-blur-xs border border-white/10">
                        #{index + 1}
                      </div>

                      {/* Cover Photo indicator badge */}
                      {coverImage === imgUrl && (
                        <div
                          className="absolute top-1.5 left-1.5 rtl:left-1.5 ltr:right-1.5 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs"
                          title="هذه هي الصورة الرئيسية للنشاط"
                        >
                          <Star className="w-3 h-3 fill-current" />
                          <span className="hidden sm:inline">غلاف</span>
                        </div>
                      )}
                    </div>

                    {/* Clear, permanently visible controls bar on each photo */}
                    <div className="p-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-1">
                      {/* Set as Cover action */}
                      <button
                        type="button"
                        onClick={() => handleSetAsCover(imgUrl)}
                        title={t.setAsCoverPhoto || 'تعيين كصورة رئيسية'}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          coverImage === imgUrl
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <Star className={`w-3 h-3 ${coverImage === imgUrl ? 'fill-emerald-600 text-emerald-600' : 'text-amber-500'}`} />
                        <span>غلاف</span>
                      </button>

                      {/* Clear, independent Delete button on this photo */}
                      <button
                        id={`btn-delete-gallery-photo-${index}`}
                        type="button"
                        onClick={() => setImageToDelete({ index, url: imgUrl })}
                        title="حذف هذه الصورة فقط من المعرض"
                        className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600 group-hover:text-white" />
                        <span>{t.deleteSingleGalleryPhoto || 'حذف 🗑️'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Gallery Upload Action Box */}
            <div
              onClick={() => !isProcessingGallery && galleryInputRef.current?.click()}
              className={`p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center group ${
                isProcessingGallery
                  ? 'bg-emerald-50/50 border-emerald-300 pointer-events-none'
                  : 'bg-white hover:bg-emerald-50/40 border-slate-300 hover:border-emerald-500 shadow-xs'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isProcessingGallery ? (
                    <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UploadCloud className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <h5 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                    {isProcessingGallery
                      ? 'جارٍ ضغط ومعالجة الصور المحددة من الهاتف...'
                      : galleryImages.length > 0
                      ? t.addMoreGalleryPhotos || '+ إضافة المزيد من الصور من الهاتف'
                      : t.chooseGalleryPhotosFromPhone || '📷 اختيار صور متعددة من الهاتف'}
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    يمكنك تحديد عدة صور معًا من ألبوم الكاميرا أو المستندات
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    galleryInputRef.current?.click();
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.chooseGalleryPhotosFromPhone || '📷 اختيار صور من الهاتف'}</span>
                </button>
              </div>
            </div>

            {/* Error / Success Notifications for Gallery */}
            {galleryError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{galleryError}</span>
              </div>
            )}

            {gallerySuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t.galleryPhotosAddedSuccess || 'تمت معالجة وإضافة الصور إلى معرض النشاط بنجاح.'}</span>
              </div>
            )}
          </div>

          {/* Section 4: Activity Video & Invoices / Proof Document */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-emerald-600" />
                <span>فيديو النشاط ووثائق الإثبات (اختياري)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                يدعم الرفع المباشر من الهاتف والكمبيوتر
              </span>
            </h4>

            <div className="space-y-4">
              {/* Activity Video Card */}
              {/* Video Section: Multiple Video URLs */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                {/* Header with Title and Add Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Film className="w-4 h-4 text-emerald-600" />
                        <span>فيديوهات النشاط الخيري (روابط URL)</span>
                      </label>
                      {videoUrls.filter((u) => u.trim()).length > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          {videoUrls.filter((u) => u.trim()).length}{' '}
                          {videoUrls.filter((u) => u.trim()).length === 1 ? 'فيديو' : 'فيديوهات'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      أدخل روابط الفيديوهات التوثيقية من YouTube أو YouTube Shorts أو Vimeo أو الروابط المباشرة. يمكنك إضافة عدة روابط لنفس النشاط.
                    </p>
                  </div>

                  {/* Upload Direct Video or Add Another Video Link */}
                  <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                    <input
                      type="file"
                      ref={videoFileInputRef}
                      accept="video/mp4,video/webm,video/quicktime,video/*"
                      onChange={handleVideoFileSelect}
                      className="hidden"
                      id="activity-video-file-input"
                    />
                    <button
                      type="button"
                      disabled={isUploadingVideoFile}
                      onClick={() => videoFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {isUploadingVideoFile ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>جارٍ رفع الفيديو ({videoUploadProgress}%)...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>رفع فيديو من الجهاز</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleAddVideoUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة رابط فيديو</span>
                    </button>
                  </div>
                </div>

                {/* Video URLs List */}
                <div className="space-y-3 pt-1">
                  {videoUrls.map((urlItem, index) => {
                    const parsed = urlItem.trim() ? parseVideoUrl(urlItem) : null;
                    const isValid = !!(parsed && parsed.isValid);

                    return (
                      <div
                        key={`video-item-${index}`}
                        className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5 text-emerald-600" />
                            <span>فيديو رقم {index + 1} {index === 0 ? '(الرئيسي)' : ''}</span>
                          </span>

                          {/* Remove / Clear Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveVideoUrl(index)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                            title="حذف هذا الفيديو"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>

                        {/* URL Input */}
                        <div className="relative">
                          <div className="absolute inset-y-0 right-3 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto flex items-center pointer-events-none text-slate-400">
                            <Link2 className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            value={urlItem}
                            onChange={(e) => handleUpdateVideoUrl(index, e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=... أو https://youtube.com/shorts/... أو ارفع ملف فيديو"
                            className={`w-full bg-white border ${
                              urlItem.trim() && !isValid && urlItem.trim().length > 12
                                ? 'border-rose-400 focus:border-rose-600 ring-1 ring-rose-300'
                                : isValid
                                ? 'border-emerald-400 focus:border-emerald-600 ring-1 ring-emerald-300'
                                : 'border-slate-300 focus:border-emerald-600'
                            } rounded-xl py-2.5 px-10 text-xs sm:text-sm outline-hidden transition-all text-slate-800 placeholder:text-slate-400`}
                          />
                          {urlItem && (
                            <button
                              type="button"
                              onClick={() => handleUpdateVideoUrl(index, '')}
                              className="absolute inset-y-0 left-3 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                              title="مسح الرابط"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Live Preview If Valid */}
                        {isValid && (
                          <div className="rounded-xl overflow-hidden border border-slate-300 bg-slate-950 p-2 space-y-2 shadow-inner mt-2">
                            <div className="flex items-center justify-between px-1 text-xs text-white">
                              <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>معاينة فورية للفيديو ({index + 1}):</span>
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase font-mono">
                                {parsed.platform}
                              </span>
                            </div>
                            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                              <VideoPlayer
                                url={urlItem.trim()}
                                title={title || `معاينة الفيديو ${index + 1}`}
                                aspectRatio="video"
                                lazy={false}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Bottom Add Another Video Button */}
                  <button
                    type="button"
                    onClick={handleAddVideoUrl}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-emerald-400/80 hover:border-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <PlusCircle className="w-4 h-4 text-emerald-600" />
                    <span>+ إضافة رابط فيديو آخر لهذا النشاط</span>
                  </button>
                </div>

                {/* Video Error Message */}
                {videoError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">{videoError}</p>
                      <p className="text-[11px] text-rose-700">
                        يرجى التأكد من صحة رابط الفيديو (YouTube, YouTube Shorts, Vimeo, إلخ).
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Proof Documents & Invoices */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>وثائق وفواتير الإثبات (فواتير، وصولات، محاضر رسمية)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ارفع فاتورة أو وصل معتمد من هاتفك أو جهازك لتوثيق شفافية ومصداقية النشاط.
                    </p>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shrink-0 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setProofMode('upload')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        proofMode === 'upload'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع من الجهاز</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProofMode('url')}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        proofMode === 'url'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>رابط خارجي</span>
                    </button>
                  </div>
                </div>

                {/* Hidden Native File Input for Proof Document */}
                <input
                  type="file"
                  ref={proofFileInputRef}
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleProofFileSelect}
                  className="hidden"
                  id="activity-proof-file-input"
                />

                {/* Method 1: DIRECT FILE UPLOAD FROM PHONE OR COMPUTER */}
                {proofMode === 'upload' && (
                  <div className="space-y-3">
                    {!proofAttachment ? (
                      /* Empty State Upload Box */
                      <div
                        onClick={() => !isProcessingProof && proofFileInputRef.current?.click()}
                        className={`p-5 sm:p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center group ${
                          isProcessingProof
                            ? 'bg-emerald-50/50 border-emerald-300 pointer-events-none'
                            : 'bg-white hover:bg-emerald-50/40 border-slate-300 hover:border-emerald-500 shadow-xs'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center gap-2.5">
                          <div className="w-12 h-12 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                            {isProcessingProof ? (
                              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <UploadCloud className="w-6 h-6" />
                            )}
                          </div>

                          <div>
                            <h5 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                              {isProcessingProof
                                ? 'جارٍ معالجة وتشفير الملف المختار من الجهاز...'
                                : 'اضغط لاختيار ورفع وثيقة أو فاتورة إثبات'}
                            </h5>
                            <p className="text-[11px] text-slate-500 mt-1">
                              يدعم الصور عالية الوضوح، مستندات PDF المعتمدة، وملفات Word
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              proofFileInputRef.current?.click();
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>رفع وثيقة أو فاتورة إثبات</span>
                          </button>

                          {/* Supported file types and limits */}
                          <div className="flex flex-wrap items-center justify-center gap-2 pt-1.5 text-[10px] text-slate-500">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                              🖼️ صور: JPG / JPEG / PNG / WEBP
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                              📄 ملفات PDF
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                              📝 ملفات Word: DOC / DOCX
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-bold text-slate-700">
                              الحد الأقصى: 10 ميجابايت
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* File Selected Card with Metadata & Full Controls */
                      <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Icon or Image Preview */}
                            {proofAttachment.type === 'image' ? (
                              <div className="w-13 h-13 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shrink-0 shadow-xs">
                                <img
                                  src={proofAttachment.url}
                                  alt="وثيقة الإثبات"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div
                                className={`w-13 h-13 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                                  proofAttachment.type === 'pdf'
                                    ? 'bg-rose-100 text-rose-700'
                                    : proofAttachment.type === 'word'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                <FileText className="w-6 h-6" />
                              </div>
                            )}

                            {/* Metadata */}
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-bold text-slate-900 text-xs sm:text-sm truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
                                  {proofAttachment.name}
                                </h5>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    proofAttachment.type === 'pdf'
                                      ? 'bg-rose-100 text-rose-800'
                                      : proofAttachment.type === 'word'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {proofAttachment.type === 'pdf'
                                    ? 'مستند PDF'
                                    : proofAttachment.type === 'word'
                                    ? 'ملف Word'
                                    : 'صورة وثيقة'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                <span className="font-mono">الحجم: {formatFileSize(proofAttachment.size)}</span>
                                <span>•</span>
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>ملف جاهز ومحفوظ بالنشاط</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick File Action Buttons */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Preview / Open */}
                            <button
                              type="button"
                              onClick={() => {
                                const newWindow = window.open();
                                if (newWindow) {
                                  newWindow.document.write(
                                    `<html><head><title>${proofAttachment.name}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#1e293b;height:100vh;">${
                                      proofAttachment.type === 'image'
                                        ? `<img src="${proofAttachment.url}" style="max-width:100%;max-height:100%;object-fit:contain;" />`
                                        : proofAttachment.type === 'pdf'
                                        ? `<iframe src="${proofAttachment.url}" style="width:100%;height:100%;border:none;"></iframe>`
                                        : `<div style="color:white;font-family:sans-serif;text-align:center;"><p>مستند Word: ${proofAttachment.name}</p><a href="${proofAttachment.url}" download="${proofAttachment.name}" style="color:#10b981;font-weight:bold;text-decoration:none;border:1px solid #10b981;padding:8px 16px;border-radius:8px;display:inline-block;">تحميل الملف</a></div>`
                                    }</body></html>`
                                  );
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="معاينة أو فتح الوثيقة في نافذة جديدة"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>معاينة / فتح</span>
                            </button>

                            {/* Direct Download */}
                            <a
                              href={proofAttachment.url}
                              download={proofAttachment.name}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="تحميل الملف مباشرة إلى جهازك"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>تحميل</span>
                            </a>

                            {/* Replace */}
                            <button
                              type="button"
                              onClick={handleReplaceProofFile}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="استبدال الملف بملف آخر من الجهاز"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>استبدال</span>
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={handleRemoveProofFile}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="حذف هذا الملف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Method 2: EXTERNAL URL */}
                {proofMode === 'url' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      رابط خارجي للوثيقة أو الفاتورة (Google Drive، رابط سحابي، أو موقع إلكتروني)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Link2 className="w-4 h-4 text-slate-400 absolute top-3.5 right-3 rtl:right-3 ltr:left-3" />
                        <input
                          type="url"
                          value={proofDocumentUrl}
                          onChange={(e) => setProofDocumentUrl(e.target.value)}
                          placeholder="https://drive.google.com/... أو https://..."
                          className="w-full bg-white border border-slate-300 rounded-xl p-3 pr-9 rtl:pr-9 ltr:pl-9 text-xs sm:text-sm focus:border-emerald-600 outline-hidden transition-all"
                        />
                      </div>
                      {proofDocumentUrl && (
                        <a
                          href={proofDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-3 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>تجربة الرابط</span>
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      يمكنك استخدام روابط المشاركة العامة لمستندات Google Drive أو الفواتير المخزنة على الويب.
                    </p>
                  </div>
                )}

                {/* Proof Error & Success Notifications */}
                {proofError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{proofError}</span>
                  </div>
                )}

                {proofSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>تم حفظ وربط وثيقة الإثبات بالنشاط بنجاح.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: Visibility & Featured Badges */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="isActive" className="text-xs sm:text-sm font-bold text-slate-900 cursor-pointer">
                🟢 تفعيل الظهور للمستخدمين (إظهار النشاط في المنصة فور الحفظ)
              </label>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="isFeatured"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="isFeatured" className="text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer">
                ⭐ تثبيت النشاط في مقدمة الصفحة الرئيسية
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-xs sm:text-sm hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isProcessingCover || isProcessingGallery || isProcessingProof || isUploadingVideoFile || isSubmitting}
              className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{isSubmitting ? 'جارٍ الحفظ...' : t.save}</span>
            </button>
          </div>
        </form>
      </motion.div>

      {/* Confirmation Modal: Delete Single Gallery Photo */}
      {imageToDelete !== null && (
        <div className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {t.confirmDeleteSingleGalleryPhoto || 'هل أنت متأكد من حذف هذه الصورة؟'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  سيتم حذف هذه الصورة المحددة فقط (الصورة #{imageToDelete.index + 1}) من معرض التوثيق الميداني وقاعدة البيانات دون التأثير على باقي صور المعرض.
                </p>
              </div>
            </div>

            {/* Preview of the photo being deleted */}
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video max-h-44 w-full flex items-center justify-center relative">
              <img
                src={imageToDelete.url}
                alt={`معاينة الصورة #${imageToDelete.index + 1}`}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[11px] font-bold">
                الصورة #{imageToDelete.index + 1}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                id="btn-confirm-delete-single-photo"
                type="button"
                disabled={isDeletingImage}
                onClick={handleConfirmDeleteSinglePhoto}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingImage ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>تأكيد الحذف</span>
              </button>

              <button
                id="btn-cancel-delete-single-photo"
                type="button"
                disabled={isDeletingImage}
                onClick={() => setImageToDelete(null)}
                className="py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {t.cancel || 'إلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete All Gallery Photos */}
      {isConfirmingDeleteAll && (
        <div className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                  {t.confirmDeleteAllGalleryPhotos || 'هل أنت متأكد من حذف جميع صور التوثيق الميداني؟ لا يمكن التراجع عن هذا الإجراء.'}
                </h3>
                <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 font-medium leading-relaxed">
                  تنبيه: سيتم مسح وحذف كافة صور المعرض ({galleryImages.length} صور) دفعة واحدة من التوثيق الميداني وقاعدة البيانات والتخزين المرتبط بها نهائيًا.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                id="btn-confirm-delete-all-photos"
                type="button"
                disabled={isDeletingImage}
                onClick={handleConfirmDeleteAllPhotos}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingImage ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>تأكيد حذف جميع الصور</span>
              </button>

              <button
                id="btn-cancel-delete-all-photos"
                type="button"
                disabled={isDeletingImage}
                onClick={() => setIsConfirmingDeleteAll(false)}
                className="py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {t.cancel || 'إلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

