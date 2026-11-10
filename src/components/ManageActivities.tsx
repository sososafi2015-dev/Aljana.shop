import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HeartHandshake, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff, 
  Search, 
  Filter, 
  Calendar, 
  MapPin, 
  Users, 
  Coins, 
  Play, 
  Image as ImageIcon, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  Info,
  Layers,
  LayoutGrid,
  List,
  Star,
  RotateCcw,
  Video,
  X,
  ShieldCheck,
  RefreshCw,
  Radio,
  Check
} from 'lucide-react';
import { ActivityItem, ExpenseCategory, Language, AssociationSettings } from '../types';
import { translations } from '../translations';
import { parseVideoUrl, getActivityVideoUrls } from '../utils/videoUtils';
import { getCurrentReferenceVersion, ReferenceVersionMeta } from '../utils/referenceContentVersioning';
import { ensurePermanentImageUrl } from '../api/imageApi';
import { apiAddGalleryPhotos } from '../api/activitiesApi';

interface ManageActivitiesProps {
  activities: ActivityItem[];
  settings?: AssociationSettings;
  featuredActivityId?: string;
  onSetFeaturedActivity?: (activityId: string | null) => void;
  onUpdateSettings?: (settings: AssociationSettings) => void;
  onLogAudit?: (action: 'create' | 'update' | 'delete' | 'export' | 'backup', description: string) => void;
  onOpenAddActivity: () => void;
  onEditActivity: (activity: ActivityItem) => void;
  onDeleteActivity: (id: string) => Promise<boolean> | void;
  onToggleActivityStatus: (id: string) => void;
  onAddGalleryImages?: (activityId: string, newUrls: string[]) => Promise<boolean | void> | void;
  onDeleteGalleryImage?: (activityId: string, imageIndex: number, imageUrl?: string) => Promise<boolean> | void;
  onDeleteAllGalleryImages?: (activityId: string) => Promise<boolean> | void;
  onOpenMediaModal: (media: { title: string; url: string; type: 'image' | 'video' | 'document'; description?: string }) => void;
  lang: Language;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  isMasterTemplate?: boolean;
  activeTenantId?: string;
  onPublishReferenceActivities?: () => Promise<void> | void;
  onSyncReferenceActivities?: () => Promise<void> | void;
}

export const ManageActivities: React.FC<ManageActivitiesProps> = ({
  activities,
  settings,
  featuredActivityId,
  onSetFeaturedActivity,
  onUpdateSettings,
  onLogAudit,
  onOpenAddActivity,
  onEditActivity,
  onDeleteActivity,
  onToggleActivityStatus,
  onAddGalleryImages,
  onDeleteGalleryImage,
  onDeleteAllGalleryImages,
  onOpenMediaModal,
  lang,
  canAdd = true,
  canEdit = true,
  canDelete = false,
  isMasterTemplate = false,
  activeTenantId,
  onPublishReferenceActivities,
  onSyncReferenceActivities,
}) => {
  const t = translations[lang];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [activityToDelete, setActivityToDelete] = useState<ActivityItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [featuredUpdateFeedback, setFeaturedUpdateFeedback] = useState<string | null>(null);

  // Reference Content Versioning State
  const [referenceMeta, setReferenceMeta] = useState<ReferenceVersionMeta>(() => getCurrentReferenceVersion());
  const [isPublishingRef, setIsPublishingRef] = useState(false);
  const [isSyncingRef, setIsSyncingRef] = useState(false);
  const [refActionFeedback, setRefActionFeedback] = useState<string | null>(null);

  React.useEffect(() => {
    const handleRefUpdate = () => {
      setReferenceMeta(getCurrentReferenceVersion());
    };
    window.addEventListener('chayef-reference-activities-updated', handleRefUpdate);
    window.addEventListener('storage', handleRefUpdate);
    return () => {
      window.removeEventListener('chayef-reference-activities-updated', handleRefUpdate);
      window.removeEventListener('storage', handleRefUpdate);
    };
  }, []);

  const handlePublishMasterReference = async () => {
    setIsPublishingRef(true);
    setRefActionFeedback(null);
    try {
      if (onPublishReferenceActivities) {
        await onPublishReferenceActivities();
      }
      setReferenceMeta(getCurrentReferenceVersion());
      setRefActionFeedback('تم اعتماد ونشر أحدث نسخة مرجعية لصور وفيديوهات جمعية النور لجميع المنصات الحالية والمستقبلية بنجاح! 🚀');
    } catch (e: any) {
      setRefActionFeedback('حدث خطأ أثناء النشر، تم الحفظ محلياً.');
    } finally {
      setIsPublishingRef(false);
      setTimeout(() => setRefActionFeedback(null), 6000);
    }
  };

  const handleSyncChildReference = async () => {
    setIsSyncingRef(true);
    setRefActionFeedback(null);
    try {
      if (onSyncReferenceActivities) {
        await onSyncReferenceActivities();
      }
      setReferenceMeta(getCurrentReferenceVersion());
      setRefActionFeedback('تمت مزامنة أحدث الصور والفيديوهات من النموذج المعتمد لجمعية النور بنجاح! ✨');
    } catch (e: any) {
      setRefActionFeedback('حدث خطأ أثناء المزامنة.');
    } finally {
      setIsSyncingRef(false);
      setTimeout(() => setRefActionFeedback(null), 6000);
    }
  };

  // Gallery management states
  const [selectedGalleryActivity, setSelectedGalleryActivity] = useState<ActivityItem | null>(null);
  const [galleryImageToDelete, setGalleryImageToDelete] = useState<{ activityId: string; index: number; url: string } | null>(null);
  const [isConfirmingDeleteAllGallery, setIsConfirmingDeleteAllGallery] = useState<string | null>(null);
  const [isDeletingGalleryPhoto, setIsDeletingGalleryPhoto] = useState(false);
  const [isUploadingGalleryModalPhotos, setIsUploadingGalleryModalPhotos] = useState(false);
  const [galleryModalFeedback, setGalleryModalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const galleryModalFileInputRef = React.useRef<HTMLInputElement>(null);

  // Keep selectedGalleryActivity synchronized when parent activities prop updates
  React.useEffect(() => {
    if (selectedGalleryActivity) {
      const fresh = activities.find((a) => a.id === selectedGalleryActivity.id);
      if (fresh) {
        setSelectedGalleryActivity(fresh);
      }
    }
  }, [activities]);

  const compressGalleryModalImage = (file: File, maxWidth = 1000, maxHeight = 700, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        return reject(new Error('الملف المختار ليس صورة صالحة'));
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
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
          if (!ctx) return reject(new Error('تعذر معالجة بيانات الصورة'));
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(outputFormat, quality));
        };
        img.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
        img.src = ev.target?.result as string;
      };
      reader.onerror = () => reject(new Error('خطأ أثناء قراءة الملف'));
      reader.readAsDataURL(file);
    });
  };

  const handleGalleryModalPhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedGalleryActivity) return;

    setIsUploadingGalleryModalPhotos(true);
    setGalleryModalFeedback(null);

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const compressed = await compressGalleryModalImage(file);
          const permanentUrl = await ensurePermanentImageUrl(compressed, {
            tenantId: activeTenantId,
            category: 'activity_gallery',
            recordId: selectedGalleryActivity.id,
            fileName: file.name,
          });
          if (permanentUrl && typeof permanentUrl === 'string' && permanentUrl.trim().length > 0) {
            uploadedUrls.push(permanentUrl);
          }
        }
      }

      if (uploadedUrls.length === 0) {
        setGalleryModalFeedback({ type: 'error', message: 'لم يتم العثور على صور صالحة للرفع.' });
        return;
      }

      if (onAddGalleryImages) {
        await onAddGalleryImages(selectedGalleryActivity.id, uploadedUrls);
      } else {
        await apiAddGalleryPhotos(selectedGalleryActivity.id, uploadedUrls, undefined, activeTenantId);
      }

      const existing = Array.isArray(selectedGalleryActivity.galleryImages)
        ? [...selectedGalleryActivity.galleryImages]
        : [];
      const merged = [...existing];
      for (const u of uploadedUrls) {
        if (!merged.includes(u)) merged.push(u);
      }

      setSelectedGalleryActivity({
        ...selectedGalleryActivity,
        coverImage: selectedGalleryActivity.coverImage || merged[0] || '',
        galleryImages: merged,
      });

      setGalleryModalFeedback({
        type: 'success',
        message: `تم رفع وحفظ ${uploadedUrls.length} صورة إضافية بنجاح في قاعدة البيانات والتخزين الدائم.`,
      });
      setTimeout(() => setGalleryModalFeedback(null), 4500);
    } catch (err: any) {
      console.error('Failed to upload gallery photos from modal:', err);
      setGalleryModalFeedback({
        type: 'error',
        message: err?.message || 'حدث خطأ أثناء رفع وحفظ الصور الإضافية.',
      });
    } finally {
      setIsUploadingGalleryModalPhotos(false);
      if (galleryModalFileInputRef.current) {
        galleryModalFileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmDeleteSingleGalleryPhoto = async () => {
    if (!galleryImageToDelete) return;
    setIsDeletingGalleryPhoto(true);
    try {
      if (onDeleteGalleryImage) {
        await onDeleteGalleryImage(galleryImageToDelete.activityId, galleryImageToDelete.index, galleryImageToDelete.url);
      }
      if (selectedGalleryActivity && selectedGalleryActivity.id === galleryImageToDelete.activityId) {
        const updatedImages = (selectedGalleryActivity.galleryImages || []).filter((_, i) => i !== galleryImageToDelete.index);
        setSelectedGalleryActivity({
          ...selectedGalleryActivity,
          galleryImages: updatedImages,
        });
      }
      setGalleryImageToDelete(null);
    } catch (err) {
      console.error('Failed to delete gallery image:', err);
    } finally {
      setIsDeletingGalleryPhoto(false);
    }
  };

  const handleConfirmDeleteAllGalleryPhotos = async () => {
    if (!isConfirmingDeleteAllGallery) return;
    setIsDeletingGalleryPhoto(true);
    try {
      if (onDeleteAllGalleryImages) {
        await onDeleteAllGalleryImages(isConfirmingDeleteAllGallery);
      }
      if (selectedGalleryActivity && selectedGalleryActivity.id === isConfirmingDeleteAllGallery) {
        setSelectedGalleryActivity({
          ...selectedGalleryActivity,
          galleryImages: [],
        });
      }
      setIsConfirmingDeleteAllGallery(null);
    } catch (err) {
      console.error('Failed to delete all gallery images:', err);
    } finally {
      setIsDeletingGalleryPhoto(false);
    }
  };

  // Active activities
  const activeActivities = activities.filter((a) => a.isActive !== false);

  // Sort active activities by newest date or insertion order (newest first)
  const sortedActiveActivities = [...activeActivities].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeB !== timeA) {
      return timeB - timeA;
    }
    return 0; // preserve insertion order
  });

  // Latest active activity (used in Automatic Display mode)
  const autoFeaturedActivity = sortedActiveActivities[0] || null;

  // Custom featured activity selected manually by admin (only if it exists and is active)
  const customFeatured = featuredActivityId
    ? activeActivities.find((a) => a.id === featuredActivityId) || null
    : null;

  // Actual activity currently displayed in the store interface
  const displayedActivityInStore = customFeatured || autoFeaturedActivity;
  const isCustomMode = !!customFeatured;

  const handleSelectFeatured = (activityId: string | null) => {
    if (onSetFeaturedActivity) {
      onSetFeaturedActivity(activityId);
      if (activityId) {
        localStorage.setItem('achayef_featured_manually_selected', 'true');
        const act = activities.find((a) => a.id === activityId);
        setFeaturedUpdateFeedback(`تم تفعيل العرض المخصص: تم اعتماد «${act?.title || 'النشاط'}» ليكون النشاط المعروض في واجهة المتجر.`);
        if (onLogAudit) {
          onLogAudit('update', `تحديد عرض مخصص للنشاط «${act?.title || activityId}» في واجهة المتجر الرئيسية`);
        }
      } else {
        localStorage.removeItem('achayef_featured_manually_selected');
        setFeaturedUpdateFeedback('تم تفعيل العرض التلقائي: سيظهر أحدث نشاط خيري منجز وصورته تلقائيًا في واجهة المتجر دون الحاجة لتحديد يدوي.');
        if (onLogAudit) {
          onLogAudit('update', 'إعادة تفعيل العرض التلقائي لأحدث الأنشطة الخيرية في واجهة المتجر');
        }
      }
      setTimeout(() => setFeaturedUpdateFeedback(null), 4500);
    }
  };

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    const isActive = act.isActive !== false;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && isActive) ||
      (statusFilter === 'inactive' && !isActive);

    const matchesCategory = selectedCategory === 'all' || act.category === selectedCategory;

    const matchesSearch =
      act.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.location.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesCategory && matchesSearch;
  });

  // Calculate Metrics
  const totalActivities = activities.length;
  const activeActivitiesCount = activities.filter((a) => a.isActive !== false).length;
  const inactiveActivitiesCount = activities.filter((a) => a.isActive === false).length;
  const totalSpent = activities.reduce((sum, a) => sum + (Number(a.spentAmount) || 0), 0);
  const totalBeneficiaries = activities.reduce((sum, a) => sum + (Number(a.beneficiariesCount) || 0), 0);

  const getCategoryLabel = (cat: ExpenseCategory) => {
    const map: Record<string, string> = {
      tree_planting: t.cat_tree_planting,
      social_aid: t.cat_social_aid,
      equipment: t.cat_equipment,
      education: t.cat_education,
      health_caravan: t.cat_health_caravan,
      maintenance: t.cat_maintenance,
      ramadan_aid: t.cat_ramadan_aid,
      other: t.cat_other,
    };
    return map[cat] || cat;
  };

  const handleConfirmDelete = async () => {
    if (!canDelete || !activityToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await onDeleteActivity(activityToDelete.id);
      if (res === false) {
        setDeleteError('تعذر إتمام عملية الحذف من قاعدة البيانات.');
      } else {
        setActivityToDelete(null);
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'حدث خطأ أثناء تنفيذ الحذف من قاعدة البيانات.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Title Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-800 shrink-0">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg sm:text-xl text-slate-900">
                {t.manageFeaturedActivitiesTitle || 'أبرز الأعمال والأنشطة الخيرية المنجزة'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                {activities.length}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {t.manageFeaturedActivitiesDesc || 'إدارة وتفعيل وتعديل وحذف الأنشطة والأعمال الخيرية المعروضة للمستخدمين في واجهة التطبيق'}
            </p>
          </div>
        </div>

        {canAdd && (
          <button
            onClick={onOpenAddActivity}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-colors whitespace-nowrap self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addActivity}</span>
          </button>
        )}
      </div>

      {/* Reference Model Engine Banner */}
      <div className={`p-5 rounded-2xl border transition-all ${
        isMasterTemplate 
          ? 'bg-gradient-to-l from-emerald-950 via-teal-950 to-slate-900 border-emerald-500/40 text-white shadow-lg shadow-emerald-950/20'
          : 'bg-gradient-to-l from-blue-950 via-slate-900 to-indigo-950 border-blue-500/30 text-white shadow-md'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                isMasterTemplate 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              }`}>
                <ShieldCheck className="w-4 h-4" />
                <span>{isMasterTemplate ? 'النموذج المعتمد المرجعي للمنصة' : 'محتوى مرجعي متزامن مع النموذج المعتمد'}</span>
              </span>

              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-white border border-white/15 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>الإصدار المعتمد: {referenceMeta.versionId || `v${referenceMeta.version}`}</span>
              </span>

              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/5 text-slate-300 border border-white/10">
                آخر تحديث: {new Date(referenceMeta.publishedAt).toLocaleDateString('ar-MA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <h4 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>
                {isMasterTemplate 
                  ? 'جمعية النور للتنمية والتضامن: المصدر المرجعي الحصري للأعمال والأنشطة الخيرية'
                  : 'أبرز الأعمال والأنشطة مستمدة من النموذج المعتمد لجمعية النور للتنمية والتضامن'}
              </span>
            </h4>

            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              {isMasterTemplate 
                ? 'أي نشاط خيري أو صورة ميدانية أو فيديو يتم اعتماده هنا، يُسجل تلقائيًا كأحدث مرجع رسمي لقسم «أبرز الأعمال والأنشطة الخيرية المنجزة» لجميع المنصات الإلكترونية للجمعيات المنشأة، مع حظر عرض أي وسائط قديمة أو منتهية، وضمان الاستقلالية المالية لكل جمعية.'
                : 'يتم تزويد منصتكم بأحدث الصور والفيديوهات المعتمدة من النموذج المرجعي لجمعية النور، مع الحفاظ التام على استقلالية سجلاتكم المحاسبية وعملياتكم المالية الخاصة دون أدنى تداخل.'}
            </p>

            {refActionFeedback && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{refActionFeedback}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {isMasterTemplate ? (
              <button
                onClick={handlePublishMasterReference}
                disabled={isPublishingRef}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                title="اعتماد وتحديث النسخة المرجعية لجميع المنصات الحالية والمستقبلية"
              >
                {isPublishingRef ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <Radio className="w-4 h-4 text-slate-950" />
                )}
                <span>اعتماد ونشر كأحدث نسخة مرجعية</span>
              </button>
            ) : (
              <button
                onClick={handleSyncChildReference}
                disabled={isSyncingRef}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                title="مزامنة أحدث الصور والفيديوهات من جمعية النور"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingRef ? 'animate-spin' : ''}`} />
                <span>مزامنة أحدث الصور والفيديوهات المعتمدة</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">إجمالي الأنشطة</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{totalActivities}</p>
          <span className="text-[11px] text-slate-400">مسجلة بالنظام</span>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-emerald-800 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {t.activeActivitiesCount || 'أنشطة نشطة'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono">{activeActivitiesCount}</p>
          <span className="text-[11px] text-emerald-600 font-medium">ظاهرة للمستخدمين</span>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-rose-800 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              {t.inactiveActivitiesCount || 'أنشطة مخفية'}
            </span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-rose-700 font-mono">{inactiveActivitiesCount}</p>
          <span className="text-[11px] text-rose-600 font-medium">معطلة / غير ظاهرة</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">{t.totalSpentOnActivities || 'المبالغ المنفذة'}</span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
            {totalSpent.toLocaleString('ar-MA')} <span className="text-xs text-slate-500 font-normal">{t.currencyShort}</span>
          </p>
          <span className="text-[11px] text-slate-400">تكلفة المشاريع</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">{t.totalBeneficiariesCount || 'المستفيدون'}</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
            +{totalBeneficiaries.toLocaleString('ar-MA')}
          </p>
          <span className="text-[11px] text-slate-400">مستفيد تقديري</span>
        </div>
      </div>

      {/* 3. Homepage Featured Activity Selector (نظام العرض التلقائي والمخصص لأبرز الأعمال والأنشطة) */}
      <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-teal-950 p-5 sm:p-6 rounded-2xl text-white shadow-md border border-emerald-700/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-400 text-slate-950 shrink-0 shadow-sm">
              <Star className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-bold text-base sm:text-lg text-white">
                  نظام عرض أبرز الأعمال والأنشطة في واجهة المتجر
                </h4>
                {isCustomMode ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950 shadow-xs">
                    ★ عرض مخصص (محدد يدويًا)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-300" />
                    <span>العرض التلقائي نشط (الوضع الافتراضي)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100/80 mt-1 max-w-2xl leading-relaxed">
                الوضع الافتراضي للنظام هو **العرض التلقائي** لأحدث نشاط خيري مضاف مع صورته في واجهة المتجر. إذا قمت باختيار نشاط معيّن من القائمة، يتم اعتماده كـ **عرض مخصص** بديل.
              </p>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {featuredUpdateFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{featuredUpdateFeedback}</span>
          </motion.div>
        )}

        {/* Selection Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
          <div className="lg:col-span-7 space-y-2">
            <label className="text-xs text-emerald-200 font-semibold block">
              تحديد نمط العرض للواجهة الرئيسية:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={featuredActivityId || ''}
                onChange={(e) => handleSelectFeatured(e.target.value || null)}
                className="flex-1 bg-slate-800/90 border border-emerald-600/50 hover:border-emerald-400 text-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-400 transition-all"
              >
                <option value="">
                  ⚡ العرض التلقائي: أحدث نشاط مضاف {autoFeaturedActivity ? `(حاليًا: ${autoFeaturedActivity.title} - ${autoFeaturedActivity.date})` : ''} - افتراضي
                </option>
                {activeActivities.map((act) => (
                  <option key={act.id} value={act.id}>
                    ★ تخصيص: {act.title} ({act.date} - {getCategoryLabel(act.category)})
                  </option>
                ))}
              </select>

              {featuredActivityId && (
                <button
                  type="button"
                  onClick={() => handleSelectFeatured(null)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-700/60 hover:bg-emerald-600 text-emerald-100 hover:text-white border border-emerald-500/50 text-xs font-bold transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer"
                  title="الرجوع إلى نمط العرض التلقائي لأحدث الأنشطة"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>الرجوع للتلقائي</span>
                </button>
              )}
            </div>
          </div>

          {/* Current Displayed in Store Preview Card */}
          <div className="lg:col-span-5 bg-slate-800/60 p-3.5 rounded-xl border border-emerald-600/30 flex items-center gap-3">
            {displayedActivityInStore ? (
              <>
                <img
                  src={displayedActivityInStore.coverImage}
                  alt={displayedActivityInStore.title}
                  className="w-14 h-14 rounded-lg object-cover border border-emerald-500/40 shrink-0"
                />
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isCustomMode ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current text-amber-300" />
                        <span>عرض مخصص بالواجهة</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>عرض تلقائي (أحدث نشاط)</span>
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">{displayedActivityInStore.date}</span>
                  </div>
                  <h5 className="font-bold text-xs text-white truncate">{displayedActivityInStore.title}</h5>
                  <p className="text-[11px] text-emerald-200/70 truncate">
                    {getCategoryLabel(displayedActivityInStore.category)} • {displayedActivityInStore.spentAmount?.toLocaleString()} د.م
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center w-full py-1 text-slate-400 text-xs space-y-0.5">
                <p className="font-medium text-slate-300">لا توجد أنشطة نشطة حاليًا</p>
                <p className="text-[11px] text-slate-500">أضف نشاطًا خيريًا جديدًا وسيظهر تلقائيًا في واجهة المتجر</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Info Notice */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800">
            {t.activityVisibilityNotice || 'تنبيه: يمكنك إلغاء تفعيل أي نشاط لإخفائه مؤقتًا عن واجهة المستخدمين دون حذفه من قاعدة البيانات، مع إمكانية إعادة تفعيله لاحقًا في أي وقت.'}
          </p>
          <p className="text-slate-500 text-[11px]">
            جميع التعديلات والحذف وتغييرات التفعيل واختيار النشاط المميز تُحفظ بشكل دائم وفوري، وتنعكس مباشرة في الواجهة الرئيسية وصفحة الأنشطة.
          </p>
        </div>
      </div>

      {/* 4. Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute top-3.5 right-3.5 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="البحث باسم النشاط، الوصف، أو المكان..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-10 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute top-3.5 left-3.5 rtl:left-3.5 rtl:right-auto ltr:right-3.5 ltr:left-auto text-xs text-slate-400 hover:text-slate-600"
              >
                مسح
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
          >
            <option value="all">جميع المجالات والتصنيفات</option>
            <option value="tree_planting">{t.cat_tree_planting}</option>
            <option value="social_aid">{t.cat_social_aid}</option>
            <option value="equipment">{t.cat_equipment}</option>
            <option value="education">{t.cat_education}</option>
            <option value="health_caravan">{t.cat_health_caravan}</option>
            <option value="maintenance">{t.cat_maintenance}</option>
            <option value="ramadan_aid">{t.cat_ramadan_aid}</option>
            <option value="other">{t.cat_other}</option>
          </select>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({activities.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>نشط ({activeActivitiesCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'inactive'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>مخفي ({inactiveActivitiesCount})</span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
              }`}
              title="عرض بطاقات"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
              }`}
              title="عرض جدول تفصيلي"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Activities Content (Grid or Table) */}
      {filteredActivities.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <HeartHandshake className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-800 text-base">{t.noActivitiesFound}</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            لم يتم العثور على أي نشاط يطابق معايير البحث والفلترة المحددة. يمكنك إعادة تعيين الفلاتر أو إضافة نشاط جديد.
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setStatusFilter('all');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              إعادة تعيين الفلاتر
            </button>
            <button
              onClick={onOpenAddActivity}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              + {t.addActivity}
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredActivities.map((act) => {
            const isActive = act.isActive !== false;
            return (
              <motion.div
                key={act.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={`bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                  isActive ? 'border-slate-200' : 'border-rose-200/80 bg-rose-50/20'
                }`}
              >
                <div>
                  {/* Image & Quick Badges */}
                  {(() => {
                    const videoList = getActivityVideoUrls(act);
                    const effectiveVideoUrl = videoList[0] || act.videoMetadata?.cdnUrl || act.videoUrl;
                    const cardVideo = effectiveVideoUrl ? parseVideoUrl(effectiveVideoUrl) : null;
                    const hasVideo = videoList.length > 0 || !!(
                      effectiveVideoUrl &&
                      (act.videoMetadata?.processingStatus === 'ready' || (cardVideo && cardVideo.isValid))
                    );
                    const displayCover = act.coverImage || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80';

                    return (
                      <div className="relative aspect-video bg-slate-900 overflow-hidden">
                        <img
                          src={displayCover}
                          alt={act.title}
                          className={`w-full h-full object-cover transition-transform duration-300 hover:scale-105 ${
                            !isActive ? 'grayscale-50 opacity-80' : ''
                          }`}
                        />

                        {/* Status Pill on Image */}
                        <div className="absolute top-2 right-2 rtl:right-2 rtl:left-auto ltr:left-2 ltr:right-auto">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md backdrop-blur-xs ${
                              isActive
                                ? 'bg-emerald-600/95 text-white border border-emerald-400/40'
                                : 'bg-rose-600/95 text-white border border-rose-400/40'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-white'}`}></span>
                            <span>{isActive ? (t.activityStatusActive || '🟢 نشط / ظاهر') : (t.activityStatusInactive || '🔴 غير نشط / مخفي')}</span>
                          </span>
                        </div>

                        {/* Date & Video Platform Badge */}
                        <div className="absolute top-2 left-2 rtl:left-2 rtl:right-auto ltr:right-2 ltr:left-auto flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950/80 text-white backdrop-blur-xs font-mono">
                            {act.date}
                          </span>
                          {hasVideo && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-600/90 text-white backdrop-blur-xs flex items-center gap-0.5">
                              <Video className="w-2.5 h-2.5" />
                              <span>{videoList.length > 1 ? `${videoList.length} فيديوهات` : act.videoMetadata?.isUploadedDirectly ? 'مباشر' : cardVideo?.platform ? cardVideo.platform.toUpperCase() : 'فيديو'}</span>
                            </span>
                          )}
                        </div>

                        {/* Media Badges */}
                        <div className="absolute bottom-2 left-2 rtl:left-2 rtl:right-auto ltr:right-2 ltr:left-auto flex items-center gap-1.5">
                          {hasVideo && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenMediaModal({
                                  title: act.title,
                                  url: effectiveVideoUrl!,
                                  type: 'video',
                                  description: act.description,
                                })
                              }
                              className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-md transition-colors cursor-pointer"
                              title={videoList.length > 1 ? `مشاهدة الفيديوهات (${videoList.length})` : 'مشاهدة الفيديو'}
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>{videoList.length > 1 ? `${videoList.length} فيديوهات` : 'فيديو التوثيق'}</span>
                              {act.videoMetadata?.durationFormatted && (
                                <span className="text-[9px] bg-black/40 px-1 rounded font-mono">
                                  {act.videoMetadata.durationFormatted}
                                </span>
                              )}
                            </button>
                          )}
                          {act.galleryImages && act.galleryImages.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedGalleryActivity(act)}
                              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-[10px] font-bold flex items-center gap-1 shadow-md transition-colors cursor-pointer"
                              title="معاينة وإدارة معرض الصور (التوثيق الميداني)"
                            >
                              <ImageIcon className="w-3 h-3" />
                              <span>{act.galleryImages.length} صور</span>
                            </button>
                          )}
                          {(act.proofAttachment || act.proofDocumentUrl) && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenMediaModal({
                                  title: `${act.title} - وثيقة إثبات`,
                                  url: act.proofAttachment?.url || act.proofDocumentUrl!,
                                  type: act.proofAttachment?.type === 'image' ? 'image' : 'document',
                                  description: act.proofAttachment?.name ? `${act.title} - ${act.proofAttachment.name}` : act.description,
                                })
                              }
                              className="p-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold flex items-center gap-1 shadow-md transition-colors cursor-pointer"
                              title="وثيقة أو فاتورة الإثبات"
                            >
                              <FileText className="w-3 h-3" />
                              <span>فاتورة / إثبات</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Body Info */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {getCategoryLabel(act.category)}
                      </span>
                      {featuredActivityId === act.id ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                          <Star className="w-3 h-3 fill-current text-amber-600" />
                          <span>عرض مخصص بالواجهة</span>
                        </span>
                      ) : !featuredActivityId && autoFeaturedActivity?.id === act.id ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>معروض تلقائيًا (أحدث نشاط)</span>
                        </span>
                      ) : act.isFeatured ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <Sparkles className="w-3 h-3" />
                          <span>مثبت بالمعرض</span>
                        </span>
                      ) : null}
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                      {act.title}
                    </h4>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {act.description}
                    </p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">التكلفة الإجمالية</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {act.spentAmount?.toLocaleString('ar-MA')} {t.currencyShort}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block">المستفيدون</span>
                        <span className="font-bold text-teal-700 font-mono">
                          {act.beneficiariesCount ? `+${act.beneficiariesCount}` : 'عام للساكنة'}
                        </span>
                      </div>
                    </div>

                    {/* Proof Document / Invoice Status */}
                    {(act.proofAttachment || act.proofDocumentUrl) && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 text-emerald-950 font-medium">
                          <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span className="truncate">
                            {act.proofAttachment?.name || 'وثيقة / فاتورة إثبات'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenMediaModal({
                              title: `${act.title} - وثيقة إثبات`,
                              url: act.proofAttachment?.url || act.proofDocumentUrl!,
                              type: act.proofAttachment?.type === 'image' ? 'image' : 'document',
                              description: act.proofAttachment?.name ? `${act.title} - ${act.proofAttachment.name}` : act.description,
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shrink-0 transition-colors cursor-pointer"
                        >
                          معاينة الوثيقة
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{act.location}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 pt-3 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2">
                  {/* Homepage Featured Quick Selector */}
                  <button
                    type="button"
                    disabled={!isActive}
                    onClick={() => handleSelectFeatured(featuredActivityId === act.id ? null : act.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                      featuredActivityId === act.id
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                        : !featuredActivityId && autoFeaturedActivity?.id === act.id
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : isActive
                        ? 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300'
                        : 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${featuredActivityId === act.id ? 'fill-current text-slate-950' : !featuredActivityId && autoFeaturedActivity?.id === act.id ? 'fill-current text-emerald-600' : 'text-amber-500'}`} />
                    <span>
                      {featuredActivityId === act.id
                        ? '★ عرض مخصص حالياً (اضغط للرجوع للتلقائي)'
                        : !featuredActivityId && autoFeaturedActivity?.id === act.id
                        ? '✓ معروض تلقائياً (أحدث نشاط) - اضغط للتثبيت'
                        : 'تخصيص هذا النشاط للعرض بالواجهة'}
                    </span>
                  </button>

                  {/* Status Toggle Button (Primary Feature) */}
                  <button
                    onClick={() => onToggleActivityStatus(act.id)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                      isActive
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        <span>{t.deactivateVisibility || 'إلغاء تفعيل الظهور (إخفاء عن المستخدمين)'}</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>{t.activateVisibility || 'تفعيل الظهور للمستخدمين'}</span>
                      </>
                    )}
                  </button>

                  {/* Secondary Actions (Edit & Delete) */}
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button
                        onClick={() => onEditActivity(act)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                        <span>{t.edit}</span>
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => {
                          if (!canDelete) return;
                          setDeleteError(null);
                          setActivityToDelete(act);
                        }}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.delete}</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start rtl:text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">النشاط والعمل الخيري</th>
                  <th className="p-3.5">المجال</th>
                  <th className="p-3.5">التاريخ والمكان</th>
                  <th className="p-3.5">التكلفة والمستفيدون</th>
                  <th className="p-3.5 text-center">حالة الظهور</th>
                  <th className="p-3.5 text-center">إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivities.map((act) => {
                  const isActive = act.isActive !== false;
                  return (
                    <tr
                      key={act.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !isActive ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={act.coverImage}
                            alt={act.title}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div className="space-y-0.5 max-w-xs">
                            <h5 className="font-bold text-slate-900 line-clamp-1">{act.title}</h5>
                            <p className="text-[11px] text-slate-500 line-clamp-1">{act.description}</p>
                            {featuredActivityId === act.id ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300 inline-block">
                                ★ عرض مخصص
                              </span>
                            ) : !featuredActivityId && autoFeaturedActivity?.id === act.id ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 inline-block">
                                ✓ معروض تلقائيًا
                              </span>
                            ) : act.isFeatured ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 inline-block">
                                مثبت بالمعرض
                              </span>
                            ) : null}

                            {(() => {
                              const vList = getActivityVideoUrls(act);
                              const vUrl = vList[0] || act.videoMetadata?.cdnUrl || act.videoUrl;
                              if (!vUrl) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenMediaModal({
                                      title: act.title,
                                      url: vUrl,
                                      type: 'video',
                                      description: act.description,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 transition-colors cursor-pointer mr-1 rtl:mr-0 rtl:ml-1"
                                  title={vList.length > 1 ? `معاينة الفيديوهات (${vList.length})` : 'معاينة فيديو التوثيق'}
                                >
                                  <Play className="w-3 h-3 text-rose-600 fill-current" />
                                  <span>{vList.length > 1 ? `${vList.length} فيديوهات` : `فيديو ${act.videoMetadata?.durationFormatted || 'توثيقي'}`}</span>
                                </button>
                              );
                            })()}

                            {(act.proofAttachment || act.proofDocumentUrl) && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenMediaModal({
                                    title: `${act.title} - وثيقة إثبات`,
                                    url: act.proofAttachment?.url || act.proofDocumentUrl!,
                                    type: act.proofAttachment?.type === 'image' ? 'image' : 'document',
                                    description: act.proofAttachment?.name ? `${act.title} - ${act.proofAttachment.name}` : act.description,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                                title="معاينة وثيقة أو فاتورة الإثبات المعتمدة"
                              >
                                <FileText className="w-3 h-3 text-emerald-600" />
                                <span>فاتورة إثبات</span>
                              </button>
                            )}

                            {act.galleryImages && act.galleryImages.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedGalleryActivity(act)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md border border-slate-300 transition-colors cursor-pointer mr-1 rtl:mr-0 rtl:ml-1"
                                title="معاينة وإدارة معرض الصور (التوثيق الميداني)"
                              >
                                <ImageIcon className="w-3 h-3 text-slate-600" />
                                <span>{act.galleryImages.length} صور</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {getCategoryLabel(act.category)}
                        </span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="text-slate-800 font-mono font-bold block">{act.date}</span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {act.location}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 font-mono block">
                            {act.spentAmount?.toLocaleString('ar-MA')} {t.currencyShort}
                          </span>
                          <span className="text-[11px] text-teal-700 font-medium">
                            {act.beneficiariesCount ? `+${act.beneficiariesCount} مستفيد` : 'عام'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          <span>{isActive ? '🟢 نشط / ظاهر' : '🔴 غير نشط / مخفي'}</span>
                        </span>
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Set/Unset Home Featured Activity */}
                          <button
                            type="button"
                            disabled={!isActive}
                            onClick={() => handleSelectFeatured(featuredActivityId === act.id ? null : act.id)}
                            className={`p-2 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                              featuredActivityId === act.id
                                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-400'
                                : !featuredActivityId && autoFeaturedActivity?.id === act.id
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 ring-1 ring-emerald-400'
                                : isActive
                                ? 'bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 border border-slate-200'
                                : 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                            }`}
                            title={
                              featuredActivityId === act.id
                                ? 'عرض مخصص حالياً بالواجهة (اضغط للرجوع للعرض التلقائي)'
                                : !featuredActivityId && autoFeaturedActivity?.id === act.id
                                ? 'معروض تلقائيًا بالواجهة كأحدث نشاط (اضغط للتثبيت كمخصص)'
                                : 'تخصيص هذا النشاط ليظهر في واجهة المتجر الرئيسية'
                            }
                          >
                            <Star className={`w-3.5 h-3.5 ${featuredActivityId === act.id ? 'fill-current text-slate-950' : !featuredActivityId && autoFeaturedActivity?.id === act.id ? 'fill-current text-emerald-700' : 'text-amber-500'}`} />
                          </button>

                          {canEdit && (
                            <>
                              {/* Toggle Visibility */}
                              <button
                                onClick={() => onToggleActivityStatus(act.id)}
                                className={`p-2 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                                  isActive
                                    ? 'bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 border border-slate-200'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                                title={isActive ? 'إلغاء تفعيل الظهور (إخفاء)' : 'تفعيل الظهور للمستخدمين'}
                              >
                                {isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => onEditActivity(act)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                                title="تعديل النشاط"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Delete */}
                          {canDelete && (
                            <button
                              onClick={() => {
                                if (!canDelete) return;
                                setDeleteError(null);
                                setActivityToDelete(act);
                              }}
                              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                              title="حذف النشاط نهائيًا"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {canDelete && activityToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    {t.confirmDeleteActivityTitle || 'تأكيد حذف النشاط نهائيًا'}
                  </h4>
                  <p className="text-xs text-rose-700 font-medium">إجراء لا يمكن التراجع عنه</p>
                </div>
              </div>

              {/* Details of Activity */}
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <img
                    src={activityToDelete.coverImage}
                    alt={activityToDelete.title}
                    className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900 text-xs leading-snug">
                      {activityToDelete.title}
                    </h5>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{activityToDelete.date}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-700">
                        {activityToDelete.spentAmount?.toLocaleString('ar-MA')} {t.currencyShort}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {t.confirmDeleteActivityMessage || 'هل أنت متأكد من حذف هذا النشاط الخيري نهائيًا؟ لن يتم حذفه من قاعدة البيانات إلا بعد تأكيدك.'}
                </p>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                  💡 <strong>نصيحة:</strong> إذا كنت ترغب فقط في إخفاء هذا النشاط عن الزوار دون حذفه نهائيًا، يمكنك استخدام زر «إلغاء تفعيل الظهور».
                </div>

                {deleteError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{deleteError}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!isDeleting) {
                      setActivityToDelete(null);
                      setDeleteError(null);
                    }
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جارٍ الحذف من قاعدة البيانات...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>{t.deleteActivityPermanently || 'تأكيد الحذف النهائي'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activity Field Documentation Gallery Manager Modal */}
      {selectedGalleryActivity && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-auto max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900">
                      معرض الصور الإضافية (التوثيق الميداني)
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {selectedGalleryActivity.galleryImages?.length || 0} صور
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    النشاط: <span className="font-bold text-slate-800">{selectedGalleryActivity.title}</span> ({selectedGalleryActivity.date})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {canEdit && (
                  <>
                    <input
                      ref={galleryModalFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryModalPhotosUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingGalleryModalPhotos}
                      onClick={() => galleryModalFileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                      title="إضافة صور توثيقية جديدة وحفظها مباشرة"
                    >
                      {isUploadingGalleryModalPhotos ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جارٍ الرفع والحفظ...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>إضافة صور جديدة للمعرض</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {canEdit && selectedGalleryActivity.galleryImages && selectedGalleryActivity.galleryImages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDeleteAllGallery(selectedGalleryActivity.id)}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="حذف جميع صور التوثيق الميداني لهذا النشاط"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span className="hidden sm:inline">حذف جميع الصور</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedGalleryActivity(null);
                    setGalleryModalFeedback(null);
                  }}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {galleryModalFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  galleryModalFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}
              >
                {galleryModalFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{galleryModalFeedback.message}</span>
              </div>
            )}

            {/* Gallery Grid */}
            <div className="flex-1 overflow-y-auto pr-1">
              {(!selectedGalleryActivity.galleryImages || selectedGalleryActivity.galleryImages.length === 0) ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                  <ImageIcon className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">لا توجد صور إضافية في معرض هذا النشاط حالياً</p>
                  <p className="text-xs text-slate-500">يمكنك إضافة صور توثيقية جديدة عبر الضغط على &quot;تعديل النشاط في النموذج الكامل&quot;.</p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const act = selectedGalleryActivity;
                        setSelectedGalleryActivity(null);
                        onEditActivity(act);
                      }}
                      className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تعديل النشاط وإضافة صور</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedGalleryActivity.galleryImages.map((imgUrl, idx) => {
                    const isCover = imgUrl === selectedGalleryActivity.coverImage;
                    return (
                      <div
                        key={`modal-gallery-${idx}-${imgUrl.slice(-15)}`}
                        className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm hover:shadow-md transition-all flex flex-col"
                      >
                        {/* Image Preview */}
                        <div className="relative aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                          <img
                            src={imgUrl}
                            alt={`صورة ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* Index Badge */}
                          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-xs text-white text-[11px] font-bold shadow-xs">
                            الصورة #{idx + 1}
                          </div>

                          {/* Cover Badge */}
                          {isCover && (
                            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black shadow-xs flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" />
                              <span>الغلاف الحالي</span>
                            </div>
                          )}
                        </div>

                        {/* Card Controls Footer */}
                        <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenMediaModal({
                                title: `${selectedGalleryActivity.title} - صورة #${idx + 1}`,
                                url: imgUrl,
                                type: 'image',
                                description: selectedGalleryActivity.description,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="تكبير ومعاينة الصورة"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            <span>معاينة</span>
                          </button>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                setGalleryImageToDelete({
                                  activityId: selectedGalleryActivity.id,
                                  index: idx,
                                  url: imgUrl,
                                })
                              }
                              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="حذف هذه الصورة فقط"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>حذف 🗑️</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500">
                يمكن حذف أي صورة منفردة دون التأثير على باقي صور المعرض، أو إفراغ المعرض كاملاً بحذف جميع الصور.
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      const act = selectedGalleryActivity;
                      setSelectedGalleryActivity(null);
                      onEditActivity(act);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل كامل تفاصيل النشاط</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedGalleryActivity(null)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Single Gallery Photo from ManageActivities */}
      {galleryImageToDelete !== null && (
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
                  هل أنت متأكد من حذف هذه الصورة؟
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  سيتم حذف هذه الصورة المحددة فقط (الصورة #{galleryImageToDelete.index + 1}) من معرض التوثيق الميداني وقاعدة البيانات دون التأثير على باقي صور المعرض.
                </p>
              </div>
            </div>

            {/* Preview of the photo being deleted */}
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video max-h-44 w-full flex items-center justify-center relative">
              <img
                src={galleryImageToDelete.url}
                alt={`معاينة الصورة #${galleryImageToDelete.index + 1}`}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[11px] font-bold">
                الصورة #{galleryImageToDelete.index + 1}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingGalleryPhoto}
                onClick={handleConfirmDeleteSingleGalleryPhoto}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingGalleryPhoto ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>تأكيد الحذف</span>
              </button>

              <button
                type="button"
                disabled={isDeletingGalleryPhoto}
                onClick={() => setGalleryImageToDelete(null)}
                className="py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete All Gallery Photos from ManageActivities */}
      {isConfirmingDeleteAllGallery !== null && (
        <div className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                  هل أنت متأكد من حذف جميع صور التوثيق الميداني؟ لا يمكن التراجع عن هذا الإجراء.
                </h3>
                <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 font-medium leading-relaxed">
                  تنبيه: سيتم مسح وحذف كافة صور المعرض لهذا النشاط دفعة واحدة من التوثيق الميداني وقاعدة البيانات والتخزين المرتبط بها نهائيًا.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingGalleryPhoto}
                onClick={handleConfirmDeleteAllGalleryPhotos}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingGalleryPhoto ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>تأكيد حذف جميع الصور</span>
              </button>

              <button
                type="button"
                disabled={isDeletingGalleryPhoto}
                onClick={() => setIsConfirmingDeleteAllGallery(null)}
                className="py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
