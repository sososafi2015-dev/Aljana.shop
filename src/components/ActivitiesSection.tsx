import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HeartHandshake, 
  PlusCircle, 
  Calendar, 
  MapPin, 
  Users, 
  Coins, 
  Play, 
  Image as ImageIcon, 
  FileText, 
  Eye, 
  Sparkles,
  Search,
  Filter,
  CheckCircle,
  CheckCircle2,
  ExternalLink,
  Edit2,
  Trash2,
  Download,
  Video,
  Maximize2,
  Home,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { ActivityItem, ExpenseCategory, Language, UserRole, UIElementConfig, Member } from '../types';
import { translations } from '../translations';
import { BackToHomeButton } from './BackToHomeButton';
import { VideoPlayer, parseVideoUrl, getActivityVideoUrls } from '../utils/videoUtils';
import { isProofPreviewVisibleForUser } from '../utils/visibilityRules';
import { ActivityImageGalleryModal } from './ActivityImageGalleryModal';

interface ActivitiesSectionProps {
  activities: ActivityItem[];
  role: UserRole;
  lang: Language;
  onOpenAddActivity: () => void;
  onEditActivity: (activity: ActivityItem) => void;
  onDeleteActivity: (id: string) => void;
  onOpenMediaModal: (media: { title: string; url: string; type: 'image' | 'video' | 'document'; description?: string }) => void;
  onBackToHome?: () => void;
  initialSelectedActivityId?: string | null;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  uiElements?: UIElementConfig[];
  loggedInMember?: Member | null;
}

export const ActivitiesSection: React.FC<ActivitiesSectionProps> = ({
  activities,
  role,
  lang,
  onOpenAddActivity,
  onEditActivity,
  onDeleteActivity,
  onOpenMediaModal,
  onBackToHome,
  initialSelectedActivityId,
  canAdd = true,
  canEdit = true,
  canDelete = false,
  uiElements = [],
  loggedInMember = null,
}) => {
  const t = translations[lang];

  const canViewProof = isProofPreviewVisibleForUser({
    isAdmin: role === 'admin',
    isMember: !!loggedInMember,
    uiElements,
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'image' | 'video'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivityForDetails, setSelectedActivityForDetails] = useState<ActivityItem | null>(() => {
    if (initialSelectedActivityId) {
      return (
        activities.find(
          (a) => a.id === initialSelectedActivityId && a.isActive !== false && (a as any).isActive !== 'false'
        ) || null
      );
    }
    return null;
  });

  // Interactive Image Gallery Lightbox State
  const [galleryState, setGalleryState] = useState<{
    isOpen: boolean;
    images: { url: string; title: string; description?: string }[];
    initialIndex: number;
    activityTitle: string;
    activityDescription?: string;
  }>({
    isOpen: false,
    images: [],
    initialIndex: 0,
    activityTitle: '',
    activityDescription: '',
  });

  // Keep in sync if initialSelectedActivityId or activities visibility changes
  React.useEffect(() => {
    if (initialSelectedActivityId) {
      const match = activities.find(
        (a) => a.id === initialSelectedActivityId && a.isActive !== false && (a as any).isActive !== 'false'
      );
      setSelectedActivityForDetails(match || null);
    } else if (selectedActivityForDetails) {
      const currentMatch = activities.find(
        (a) => a.id === selectedActivityForDetails.id && a.isActive !== false && (a as any).isActive !== 'false'
      );
      if (!currentMatch) {
        setSelectedActivityForDetails(null);
      } else {
        setSelectedActivityForDetails(currentMatch);
      }
    }
  }, [initialSelectedActivityId, activities]);

  // Filter activities: Public association interface only shows active activities (isActive !== false)
  const filteredActivities = activities.filter((act) => {
    if (act.isActive === false || (act as any).isActive === 'false') {
      return false;
    }

    const matchesCat = selectedCategory === 'all' || act.category === selectedCategory;
    const matchesSearch =
      act.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesMedia = true;
    if (selectedMediaType === 'video') {
      matchesMedia = Boolean(act.videoMetadata?.cdnUrl || act.videoUrl);
    } else if (selectedMediaType === 'image') {
      matchesMedia = Boolean(act.galleryImages && act.galleryImages.length > 0);
    }

    return matchesCat && matchesSearch && matchesMedia;
  });

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

  // ----------------------------------------------------
  // Render: Activity Details Page (صفحة تفاصيل النشاط)
  // ----------------------------------------------------
  if (selectedActivityForDetails) {
    const act = selectedActivityForDetails;
    const allActivityVideos = getActivityVideoUrls(act);
    const effectiveVideoUrl = allActivityVideos[0] || act.videoMetadata?.cdnUrl || act.videoUrl;
    const detailsVideo = effectiveVideoUrl ? parseVideoUrl(effectiveVideoUrl) : null;
    const hasDetailsVideo = allActivityVideos.length > 0 || !!(
      effectiveVideoUrl &&
      (act.videoMetadata?.processingStatus === 'ready' || (detailsVideo && detailsVideo.isValid))
    );
    const additionalImages = (act.galleryImages || []).filter(
      (img) => img && img.trim() !== '' && img !== act.coverImage
    );
    const hasAdditionalImages = additionalImages.length > 0;
    const mainImage =
      act.coverImage ||
      'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80';

    return (
      <div className="space-y-6">
        {/* Top Back and Breadcrumbs Navigation */}
        <BackToHomeButton
          onBack={() => {
            setSelectedActivityForDetails(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          customText={
            lang === 'fr'
              ? 'Retour aux activités'
              : lang === 'en'
              ? 'Back to All Activities'
              : 'الرجوع إلى صفحة جميع الأنشطة'
          }
          parentPageTitle={t.activitiesTitle || 'جميع الأنشطة والأعمال الخيرية'}
          onParentClick={() => {
            setSelectedActivityForDetails(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          currentPageTitle={act.title}
          lang={lang}
          id="back-to-activities-btn"
        />

        {/* Activity Details Card / Container */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          {/* Header Banner */}
          <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {getCategoryLabel(act.category)}
                </span>
                {act.isFeatured && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>نشاط مميز بالواجهة</span>
                  </span>
                )}
                {role === 'admin' && act.isActive === false && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    مخفي عن الزوار
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                {act.title}
              </h1>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              {role === 'admin' && canEdit && (
                <button
                  type="button"
                  onClick={() => onEditActivity(act)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title={t.edit}
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.edit}</span>
                </button>
              )}
              {role === 'admin' && canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteActivity(act.id);
                    setSelectedActivityForDetails(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 hover:text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title={t.delete}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t.delete}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedActivityForDetails(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title="الرجوع إلى صفحة جميع الأنشطة"
              >
                {lang === 'ar' ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                <span>{lang === 'ar' ? 'الرجوع إلى القائمة' : 'Back'}</span>
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-7">
            {/* 1. [ الصورة الرئيسية للنشاط ] - Primary visual element, NEVER replaced by video */}
            <div className="space-y-2">
              <div 
                className="relative aspect-[16/9] sm:aspect-[21/9] w-full rounded-2xl overflow-hidden bg-slate-900 cursor-pointer group shadow-sm border border-slate-200"
                onClick={() => {
                  const allImagesForGallery = [
                    { url: mainImage, title: `${act.title} - الصورة الرئيسية`, description: act.description },
                    ...additionalImages.map((img, i) => ({
                      url: img,
                      title: `${act.title} - صورة توثيقية ${i + 1}`,
                      description: act.description,
                    })),
                  ];
                  setGalleryState({
                    isOpen: true,
                    images: allImagesForGallery,
                    initialIndex: 0,
                    activityTitle: act.title,
                    activityDescription: act.description,
                  });
                }}
                title="انقر لتكبير الصورة الرئيسية وتصفح معرض الصور بدقة كاملة"
              >
                <img
                  src={mainImage}
                  alt={act.title}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

                {/* Top Badge: Primary Image identifier */}
                <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 pointer-events-none">
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/95 text-slate-900 shadow-sm flex items-center gap-1.5 backdrop-blur-xs">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>الصورة الرئيسية للنشاط</span>
                  </span>
                </div>

                {/* 🎥 Video indicator/play button over main image if video exists */}
                {hasDetailsVideo && (
                  <div className="absolute top-4 left-4 rtl:left-4 rtl:right-auto z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMediaModal({
                          title: act.title,
                          url: effectiveVideoUrl!,
                          type: 'video',
                          description: act.description,
                        });
                      }}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg flex items-center gap-1.5 backdrop-blur-xs transition-all hover:scale-105 cursor-pointer border border-rose-400/40"
                      title="تشغيل فيديو التوثيق الميداني المعتمد"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>فيديو توثيقي متاح</span>
                      {act.videoMetadata?.durationFormatted && (
                        <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded-sm font-mono">
                          {act.videoMetadata.durationFormatted}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {/* Bottom Overlay Button: Enlarge Image */}
                <div className="absolute bottom-4 left-4 rtl:left-4 rtl:right-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMediaModal({
                        title: `${act.title} - الصورة الرئيسية`,
                        url: mainImage,
                        type: 'image',
                        description: act.description,
                      });
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-black/75 hover:bg-black text-white text-xs font-bold backdrop-blur-xs flex items-center gap-1.5 border border-white/20 shadow-md transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>تكبير الصورة الرئيسية</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Key Information & Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-5 bg-slate-50/80 rounded-2xl border border-slate-200">
              <div className="p-3 bg-white rounded-xl border border-slate-200/70 text-center">
                <span className="text-slate-400 text-xs flex items-center justify-center gap-1 mb-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تاريخ التنفيذ</span>
                </span>
                <span className="font-bold text-slate-900 text-sm">{act.date}</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200/70 text-center">
                <span className="text-slate-400 text-xs flex items-center justify-center gap-1 mb-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>موقع النشاط</span>
                </span>
                <span className="font-bold text-slate-900 text-sm truncate block" title={act.location}>
                  {act.location}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200/70 text-center">
                <span className="text-slate-400 text-xs flex items-center justify-center gap-1 mb-1 font-medium">
                  <Coins className="w-3.5 h-3.5 text-rose-600" />
                  <span>التكلفة الإجمالية</span>
                </span>
                <span className="font-bold text-rose-700 font-mono text-sm sm:text-base">
                  {act.spentAmount ? `${act.spentAmount.toLocaleString()} ${t.currencyShort}` : 'تطوعي'}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200/70 text-center">
                <span className="text-slate-400 text-xs flex items-center justify-center gap-1 mb-1 font-medium">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>المستفيدون</span>
                </span>
                <span className="font-bold text-emerald-700 font-mono text-sm sm:text-base">
                  {act.beneficiariesCount ? `${act.beneficiariesCount} مستفيد` : 'عام للمجتمع'}
                </span>
              </div>
            </div>

            {/* Description & Narrative Story */}
            <div className="space-y-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                <span>تقرير وتفاصيل النشاط الخيري</span>
              </h3>
              <div className="p-5 sm:p-6 bg-slate-50/60 rounded-2xl border border-slate-200 text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                {act.description}
              </div>
            </div>

            {/* 2. [ الصور الإضافية + الفيديو ] - Displayed below the main image */}
            {(hasAdditionalImages || hasDetailsVideo) && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-700" />
                    <span>الوسائط الإضافية وتوثيق النشاط الميداني</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {hasAdditionalImages ? `${additionalImages.length} صور إضافية` : ''}
                    {hasAdditionalImages && hasDetailsVideo ? ' • ' : ''}
                    {hasDetailsVideo ? 'فيديو توثيقي' : ''}
                  </span>
                </div>

                {/* Additional Images Grid */}
                {hasAdditionalImages && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-emerald-600" />
                        <span>معرض الصور والوسائط الإضافية للنشاط:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const allGalleryImages = [
                            { url: mainImage, title: `${act.title} - الصورة الرئيسية`, description: act.description },
                            ...additionalImages.map((img, i) => ({
                              url: img,
                              title: `${act.title} - صورة توثيقية ${i + 1}`,
                              description: act.description,
                            })),
                          ];
                          setGalleryState({
                            isOpen: true,
                            images: allGalleryImages,
                            initialIndex: 0,
                            activityTitle: act.title,
                            activityDescription: act.description,
                          });
                        }}
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض جميع الصور في المعرض التفاعلي ({additionalImages.length + (mainImage ? 1 : 0)})</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {additionalImages.map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            // Combine main image + additional images so user can navigate the complete documentation
                            const allGalleryImages = [
                              { url: mainImage, title: `${act.title} - الصورة الرئيسية`, description: act.description },
                              ...additionalImages.map((item, i) => ({
                                url: item,
                                title: `${act.title} - صورة توثيقية ${i + 1}`,
                                description: act.description,
                              })),
                            ];
                            // idx in additionalImages corresponds to index (idx + 1) in allGalleryImages
                            setGalleryState({
                              isOpen: true,
                              images: allGalleryImages,
                              initialIndex: idx + 1,
                              activityTitle: act.title,
                              activityDescription: act.description,
                            });
                          }}
                          className="aspect-video rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:opacity-95 transition-all border border-slate-200 relative group shadow-xs hover:shadow-md"
                        >
                          <img
                            src={img}
                            alt={`صورة إضافية ${idx + 1}`}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className="w-5 h-5 text-white" />
                          </div>
                          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] font-bold text-white">
                            صورة {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Embedded Video Player & Video documentation */}
                {hasDetailsVideo && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between text-xs text-rose-700 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Video className="w-4 h-4" />
                        <span>
                          {allActivityVideos.length > 1
                            ? `فيديوهات التوثيق الميداني المعتمدة (${allActivityVideos.length} فيديوهات)`
                            : `فيديو التوثيق الميداني المعتمد (${detailsVideo?.platform ? detailsVideo.platform.toUpperCase() : 'مباشر'})`}
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allActivityVideos.map((vUrl, vIdx) => {
                        const parsed = parseVideoUrl(vUrl);
                        return (
                          <div
                            key={`act-video-${vIdx}`}
                            className="rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-md space-y-2 p-2"
                          >
                            <div className="flex items-center justify-between px-2 text-xs text-slate-300">
                              <span className="font-bold flex items-center gap-1 text-emerald-400">
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>فيديو {vIdx + 1} {vIdx === 0 ? '(الرئيسي)' : ''}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenMediaModal({
                                    title: `${act.title} - فيديو ${vIdx + 1}`,
                                    url: vUrl,
                                    type: 'video',
                                    description: act.description,
                                  })
                                }
                                className="text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                              >
                                <Maximize2 className="w-3 h-3" />
                                <span>تكبير</span>
                              </button>
                            </div>
                            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black">
                              <VideoPlayer
                                url={vUrl}
                                poster={vIdx === 0 ? act.videoMetadata?.thumbnailUrl : undefined}
                                title={`${act.title} - ${vIdx + 1}`}
                                aspectRatio="video"
                                lazy={true}
                                durationFormatted={vIdx === 0 ? act.videoMetadata?.durationFormatted : undefined}
                                fileSizeFormatted={vIdx === 0 ? act.videoMetadata?.fileSizeFormatted : undefined}
                                resolution={vIdx === 0 ? act.videoMetadata?.resolution : undefined}
                                className="w-full h-full"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Proof Attachment / Invoice Document */}
            {(act.proofAttachment || act.proofDocumentUrl) && canViewProof && (
              <div className="p-5 bg-emerald-50/90 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 text-xs text-emerald-950 font-medium">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0 shadow-xs">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold block text-emerald-950 text-sm sm:text-base">
                      {act.proofAttachment?.name || 'فاتورة ومستند إثبات المصاريف المعتمد'}
                    </span>
                    <span className="text-xs text-emerald-700 block mt-0.5">
                      {act.proofAttachment?.type === 'pdf' ? 'ملف وثيقة PDF رسمية' :
                       act.proofAttachment?.type === 'word' ? 'مستند Word (DOC/DOCX)' :
                       act.proofAttachment?.type === 'image' ? 'صورة الفاتورة / الوصل' : 'وثيقة إثبات مالي معتمدة'}
                      {act.proofAttachment?.size ? ` • ${(act.proofAttachment.size / 1024).toFixed(0)} كيلوبايت` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenMediaModal({
                        title: `وثيقة وفاتورة إثبات: ${act.title}`,
                        url: act.proofAttachment?.url || act.proofDocumentUrl!,
                        type: act.proofAttachment?.type === 'image' ? 'image' : 'document',
                        description: act.proofAttachment?.name
                          ? `${act.title} - ${act.proofAttachment.name}`
                          : act.description,
                      })
                    }
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>معاينة وثيقة الإثبات</span>
                  </button>
                  {(act.proofAttachment?.url || act.proofDocumentUrl) && (
                    <a
                      href={act.proofAttachment?.url || act.proofDocumentUrl!}
                      download={act.proofAttachment?.name || `proof_${act.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      title="تحميل الملف"
                    >
                      <Download className="w-4 h-4" />
                      <span>تحميل</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Navigation and Return Actions */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                id="btn-back-to-activities-bottom"
                onClick={() => {
                  setSelectedActivityForDetails(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {lang === 'ar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                <span>الرجوع إلى صفحة جميع الأنشطة والأعمال الخيرية</span>
              </button>

              {onBackToHome && (
                <button
                  type="button"
                  id="btn-back-to-home-bottom"
                  onClick={onBackToHome}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-emerald-900 border border-slate-300 font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Home className="w-4 h-4 text-emerald-600" />
                  <span>الرجوع إلى واجهة المتجر الرئيسية</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Interactive Image Gallery Lightbox Modal */}
        <ActivityImageGalleryModal
          isOpen={galleryState.isOpen}
          onClose={() => setGalleryState((prev) => ({ ...prev, isOpen: false }))}
          images={galleryState.images}
          initialIndex={galleryState.initialIndex}
          activityTitle={galleryState.activityTitle}
          activityDescription={galleryState.activityDescription}
          lang={lang}
        />
      </div>
    );
  }

  // ----------------------------------------------------
  // Render: All Activities List Page (صفحة جميع الأنشطة)
  // ----------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Return to Home Button */}
      {onBackToHome && (
        <BackToHomeButton
          onBack={onBackToHome}
          lang={lang}
          currentPageTitle={t.activitiesTitle || 'أبرز الأعمال والأنشطة'}
          id="back-to-home-from-activities"
        />
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{t.activitiesTitle}</h2>
            <p className="text-xs text-slate-500">{t.activitiesDesc}</p>
          </div>
        </div>

        {role === 'admin' && canAdd && (
          <button
            onClick={onOpenAddActivity}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-md shadow-emerald-700/20 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.addActivity}</span>
          </button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-3.5 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث في الأنشطة والمشاريع الخيرية..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
          </div>

          {/* Category Select */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            >
              <option value="all">{t.allCategories}</option>
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

          {/* Media Filter Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setSelectedMediaType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedMediaType === 'all'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.allMedia}
            </button>
            <button
              onClick={() => setSelectedMediaType('image')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                selectedMediaType === 'image'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{t.imagesOnly}</span>
            </button>
            <button
              onClick={() => setSelectedMediaType('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                selectedMediaType === 'video'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>{t.videosOnly}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Activities Grid */}
      {filteredActivities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredActivities.map((act) => (
            <motion.div
              key={act.id}
              whileHover={{ y: -3 }}
              onClick={() => setSelectedActivityForDetails(act)}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group cursor-pointer"
            >
              {/* Media Preview Box */}
              {(() => {
                const effectiveVideoUrl = act.videoMetadata?.cdnUrl || act.videoUrl;
                const cardVideo = effectiveVideoUrl ? parseVideoUrl(effectiveVideoUrl) : null;
                const hasCardVideo = !!(
                  effectiveVideoUrl &&
                  (act.videoMetadata?.processingStatus === 'ready' || (cardVideo && cardVideo.isValid))
                );
                // Primary image rule: Main image is ALWAYS the primary visual element, never replaced by video
                const displayCover = act.coverImage || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80';

                return (
                  <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                    <img
                      src={displayCover}
                      alt={act.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"></div>

                    {/* Category & Video Badges */}
                    <div className="absolute top-3 right-3 rtl:right-auto rtl:left-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 text-slate-900 backdrop-blur-xs shadow-xs">
                        {getCategoryLabel(act.category)}
                      </span>
                      {act.isFeatured && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                          <Sparkles className="w-3 h-3" /> مميز
                        </span>
                      )}
                    </div>

                    {/* Video Platform Indicator on Top Left */}
                    {hasCardVideo && (
                      <div className="absolute top-3 left-3 rtl:left-auto rtl:right-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-600/95 text-white flex items-center gap-1 shadow-xs backdrop-blur-xs">
                          <Video className="w-3 h-3" />
                          <span>{act.videoMetadata?.isUploadedDirectly ? 'فيديو توثيقي' : `فيديو ${cardVideo?.platform === 'youtube' ? 'YouTube' : cardVideo?.platform ? cardVideo.platform.toUpperCase() : ''}`}</span>
                        </span>
                      </div>
                    )}

                    {/* Media Badges & Action */}
                    <div className="absolute bottom-3 left-3 rtl:left-auto rtl:right-3 flex items-center gap-2">
                      {hasCardVideo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenMediaModal({
                              title: act.title,
                              url: effectiveVideoUrl!,
                              type: 'video',
                              description: act.description,
                            });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{t.watchVideo}</span>
                          {act.videoMetadata?.durationFormatted && (
                            <span className="text-[10px] bg-black/40 px-1 py-0.5 rounded font-mono">
                              {act.videoMetadata.durationFormatted}
                            </span>
                          )}
                        </button>
                      )}
                      {act.galleryImages && act.galleryImages.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const galleryList = [
                              ...(act.coverImage ? [{ url: act.coverImage, title: `${act.title} - الصورة الرئيسية`, description: act.description }] : []),
                              ...act.galleryImages.filter((img) => img !== act.coverImage).map((img, i) => ({
                                url: img,
                                title: `${act.title} - صورة توثيقية ${i + 1}`,
                                description: act.description,
                              })),
                            ];
                            setGalleryState({
                              isOpen: true,
                              images: galleryList,
                              initialIndex: 0,
                              activityTitle: act.title,
                              activityDescription: act.description,
                            });
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-emerald-700 text-white text-[11px] backdrop-blur-xs font-mono transition-colors cursor-pointer"
                          title="تصفح ألبوم صور النشاط"
                        >
                          <ImageIcon className="w-3 h-3" />
                          <span>{act.galleryImages.length} صور</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Card Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-2 leading-snug">
                    {act.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                    {act.description}
                  </p>
                </div>

                {/* Metadata Pills */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {act.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {act.location}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">{t.cost}:</span>
                      <span className="font-bold text-rose-700 font-mono text-sm">
                        {act.spentAmount ? `${act.spentAmount.toLocaleString()} ${t.currencyShort}` : 'تطوعي'}
                      </span>
                    </div>
                    {act.beneficiariesCount && (
                      <div className="text-end rtl:text-left">
                        <span className="text-slate-500 block text-[10px]">المستفيدون:</span>
                        <span className="font-bold text-emerald-700 font-mono text-sm">
                          {act.beneficiariesCount} مستفيد
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedActivityForDetails(act);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs hover:shadow-sm cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t.viewFullActivityDetails || 'الاطلاع على تفاصيل النشاط الكاملة'}</span>
                  </button>

                  {(act.proofAttachment || act.proofDocumentUrl) && canViewProof && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMediaModal({
                          title: `وثيقة وفاتورة إثبات: ${act.title}`,
                          url: act.proofAttachment?.url || act.proofDocumentUrl!,
                          type: act.proofAttachment?.type === 'image' ? 'image' : 'document',
                          description: act.proofAttachment?.name
                            ? `${act.title} - ${act.proofAttachment.name}`
                            : act.description,
                        });
                      }}
                      className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer shrink-0"
                      title="معاينة وثيقة أو فاتورة الإثبات المعتمدة"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="hidden sm:inline">وثيقة الإثبات</span>
                    </button>
                  )}

                  {role === 'admin' && (
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditActivity(act);
                          }}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                          title={t.edit}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteActivity(act.id);
                          }}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <HeartHandshake className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-800">{t.noActivitiesFound}</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            جرب تغيير معايير البحث أو اختيار مجال آخر لعرض الأنشطة الخيرية المنجزة.
          </p>
        </div>
      )}

      {/* Interactive Image Gallery Lightbox Modal */}
      <ActivityImageGalleryModal
        isOpen={galleryState.isOpen}
        onClose={() => setGalleryState((prev) => ({ ...prev, isOpen: false }))}
        images={galleryState.images}
        initialIndex={galleryState.initialIndex}
        activityTitle={galleryState.activityTitle}
        activityDescription={galleryState.activityDescription}
        lang={lang}
      />
    </div>
  );
};
