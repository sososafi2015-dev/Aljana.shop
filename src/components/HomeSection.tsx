import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Building, 
  TrendingUp, 
  Users, 
  HeartHandshake, 
  ShieldCheck, 
  Sparkles, 
  Star,
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Play, 
  FileSpreadsheet, 
  FileCheck, 
  Coins,
  MapPin,
  Calendar,
  Layers,
  Award,
  Vote,
  FileText,
  Video,
  Image as ImageIcon,
  Maximize2,
  Eye
} from 'lucide-react';
import { ActivityItem, Member, FinancialOperation, AssociationSettings, Language, UserRole, UIElementConfig, Poll, PollVote, BoardMember, DonationCampaign, CurrentAdminSession } from '../types';
import { translations } from '../translations';
import { MemberVotingSection } from './MemberVotingSection';
import { VideoPlayer, parseVideoUrl } from '../utils/videoUtils';
import { CampaignsSection } from './CampaignsSection';
import { isSectionVisibleForUser, isProofPreviewVisibleForUser } from '../utils/visibilityRules';
import { DynamicUIElementsSection } from './DynamicUIElements';

interface HomeSectionProps {
  settings: AssociationSettings;
  members: Member[];
  boardMembers?: BoardMember[];
  activities: ActivityItem[];
  operations: FinancialOperation[];
  campaigns?: DonationCampaign[];
  uiElements: UIElementConfig[];
  lang: Language;
  role: UserRole;
  polls?: Poll[];
  loggedInMember?: Member | null;
  currentAdminSession?: CurrentAdminSession | null;
  activeTenantId?: string;
  onRequestMemberLogin?: () => void;
  onRequestRegisterMember?: () => void;
  onVote?: (pollId: string, vote: PollVote) => void;
  setActiveTab: (tab: string) => void;
  onSelectActivity?: (activityId: string) => void;
  onOpenMediaModal: (media: { title: string; url: string; type: 'image' | 'video' | 'document'; description?: string }) => void;
  onOpenReportModal: () => void;
  onOpenDonationModal?: (campaign: DonationCampaign) => void;
}

export const HomeSection: React.FC<HomeSectionProps> = ({
  settings,
  members,
  boardMembers = [],
  activities,
  operations,
  campaigns = [],
  uiElements,
  lang,
  role,
  polls = [],
  loggedInMember,
  currentAdminSession = null,
  activeTenantId = 'tenant_nour',
  onRequestMemberLogin,
  onRequestRegisterMember,
  onVote,
  setActiveTab,
  onSelectActivity,
  onOpenMediaModal,
  onOpenReportModal,
  onOpenDonationModal,
}) => {
  const t = translations[lang] as any;
  const activeActivities = activities.filter((a) => a.isActive !== false && (a as any).isActive !== 'false');
  
  // Sort active activities by newest date or insertion order (newest first)
  const sortedActiveActivities = [...activeActivities].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeB !== timeA) {
      return timeB - timeA;
    }
    return 0; // preserve insertion order
  });

  // Check if admin manually chose an active activity from settings (Custom display mode)
  const customFeaturedActivity = settings.featuredActivityId
    ? activeActivities.find((a) => a.id === settings.featuredActivityId) || null
    : null;

  // If custom is chosen by admin, use it. Otherwise, default to AUTOMATIC DISPLAY of latest activity!
  const isCustomMode = !!customFeaturedActivity;
  const homeFeaturedActivity = customFeaturedActivity || sortedActiveActivities[0] || null;

  // Video and Media evaluation for featured activity
  const effectiveVideoUrl = homeFeaturedActivity?.videoMetadata?.cdnUrl || homeFeaturedActivity?.videoUrl;
  const videoInfo = effectiveVideoUrl ? parseVideoUrl(effectiveVideoUrl) : null;
  const hasValidVideo = !!(
    effectiveVideoUrl &&
    (homeFeaturedActivity?.videoMetadata?.processingStatus === 'ready' || (videoInfo && videoInfo.isValid))
  );

  const isVisible = (id: string) => {
    return isSectionVisibleForUser(id, {
      isAdmin: role === 'admin',
      isMember: !!loggedInMember,
      uiElements: uiElements || [],
    });
  };

  const canViewProof = isProofPreviewVisibleForUser({
    isAdmin: role === 'admin',
    isMember: !!loggedInMember,
    uiElements: uiElements || [],
  });

  const getElementTitle = (id: string, fallback: string): string => {
    const el = uiElements?.find((e) => e.id === id);
    if (!el) return fallback;
    const name = lang === 'ar' ? el.nameAr : lang === 'fr' ? (el.nameFr || el.nameAr) : (el.nameEn || el.nameAr);
    return name?.trim() || fallback;
  };

  const getElementDesc = (id: string, fallback: string): string => {
    const el = uiElements?.find((e) => e.id === id);
    if (!el) return fallback;
    const desc = lang === 'ar' ? el.descriptionAr : lang === 'fr' ? (el.descriptionFr || el.descriptionAr) : (el.descriptionEn || el.descriptionAr);
    return desc?.trim() || fallback;
  };

  return (
    <div className="space-y-10">
      {/* 0. Top Announcements & Urgent Ticker */}
      {isVisible('announcements_banner') && (
        <DynamicUIElementsSection
          category="banners_and_media"
          uiElements={uiElements.filter((e) => e.id === 'announcements_banner')}
          settings={settings}
          lang={lang}
          onOpenDonationModal={() => campaigns.length > 0 && onOpenDonationModal && onOpenDonationModal(campaigns[0])}
          onRequestMemberLogin={onRequestMemberLogin}
          onOpenReportModal={onOpenReportModal}
          setActiveTab={setActiveTab}
          isMember={!!loggedInMember}
          isAdmin={role === 'admin'}
        />
      )}

      {/* 1. Hero Presentation Section (Clean, inspiring, no ticker metrics) */}
      {isVisible('hero_banner') && (
        <div 
          className="relative rounded-3xl overflow-hidden text-white p-6 sm:p-10 md:p-12 border border-slate-700/40 shadow-xl store-hero-gradient transition-all duration-300"
          style={{
            background: !settings.bannerImageUrl 
              ? `linear-gradient(135deg, ${settings.themeColors?.secondaryColor || '#0f172a'} 0%, ${settings.themeColors?.primaryColor || '#047857'} 50%, ${settings.themeColors?.secondaryColor || '#0f172a'} 100%)` 
              : undefined,
          }}
        >
          {/* Custom Banner Image Background if set */}
          {settings.bannerImageUrl && (
            <div className="absolute inset-0 z-0">
              <img
                src={settings.bannerImageUrl}
                alt="Banner Background"
                className="w-full h-full object-cover"
              />
              {/* Dynamic Dark Overlay Layer (0% to 100%) */}
              <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                style={{ 
                  backgroundColor: settings.themeColors?.bannerOverlayColor || '#000000',
                  opacity: Math.min(1, Math.max(0, (settings.bannerDarknessOverlay !== undefined ? settings.bannerDarknessOverlay : 40) / 100)) 
                }}
              />
            </div>
          )}

          {!settings.bannerImageUrl && (
            <>
              <div className="absolute -right-20 -top-20 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
            </>
          )}

          <div className="relative z-10 max-w-3xl space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white drop-shadow-md keep-white">
              {lang === 'ar' ? settings.name : lang === 'fr' ? settings.nameFr : settings.nameEn}
            </h1>

            <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed max-w-2xl drop-shadow-sm">
              {lang === 'ar' ? settings.tagline : lang === 'fr' ? settings.taglineFr : settings.taglineEn}. 
              إطار جمعوي مدني تطوعي يسعى إلى تعزيز روح التعاون والتضامن المجتمعي، وإنجاز مشاريع تنموية وثقافية وبيئية تخدم الصالح العام وفق أعلى معايير الحكامة.
            </p>
          </div>
        </div>
      )}

      {/* 1.5. Quick Actions & Interaction Bar */}
      {isVisible('quick_actions') && (
        <DynamicUIElementsSection
          category="home_sections"
          uiElements={uiElements.filter((e) => e.id === 'quick_actions')}
          settings={settings}
          lang={lang}
          onOpenDonationModal={() => campaigns.length > 0 && onOpenDonationModal && onOpenDonationModal(campaigns[0])}
          onRequestMemberLogin={onRequestMemberLogin}
          onRequestRegisterMember={onRequestRegisterMember}
          onOpenReportModal={onOpenReportModal}
          setActiveTab={setActiveTab}
          isMember={!!loggedInMember}
          isAdmin={role === 'admin'}
        />
      )}

      {/* 2. Featured Charitable Works & Activities (الأعمال الميدانية) */}
      {isVisible('featured_activities') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartHandshake className="w-5 h-5" style={{ color: settings.themeColors?.primaryColor || '#047857' }} />
              <h2 className="text-xl font-bold store-heading">
                {getElementTitle('featured_activities', 'أبرز الأعمال والأنشطة الخيرية المنجزة')}
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('activities')}
              style={{ color: settings.themeColors?.linkColor || settings.themeColors?.primaryColor || '#047857' }}
              className="text-xs sm:text-sm font-bold flex items-center gap-1 transition-colors group cursor-pointer store-link"
            >
              <span>{t.viewAllActivities || 'الإطلاع على جميع الأنشطة'} ({activeActivities.length})</span>
              {lang === 'ar' ? (
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              ) : (
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              )}
            </button>
          </div>

          {homeFeaturedActivity ? (
            <motion.div
              whileHover={{ y: -2 }}
              onClick={() => setActiveTab('activities')}
              className="bg-white rounded-2xl border border-emerald-100/80 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer group"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                {/* Media Container: Main Image ⬇️ Additional Images + Video */}
                {(() => {
                  const mainImage =
                    homeFeaturedActivity.coverImage ||
                    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=80';
                  const additionalImages = (homeFeaturedActivity.galleryImages || []).filter(
                    (img) => img && img.trim() !== '' && img !== homeFeaturedActivity.coverImage
                  );
                  const hasAdditionalImages = additionalImages.length > 0;
                  const hasVideo = hasValidVideo;

                  return (
                    <div className="lg:col-span-5 bg-slate-950 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-l lg:border-slate-100">
                      {/* 1. [ الصورة الرئيسية ] - Always the Primary Visual Element, NEVER replaced by video */}
                      <div 
                        className="relative w-full aspect-[16/10] sm:aspect-video bg-slate-900 overflow-hidden group cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('activities');
                        }}
                        title="انقر للانتقال مباشرة إلى صفحة جميع الأنشطة والأعمال الخيرية المنجزة"
                      >
                        <img
                          src={mainImage}
                          alt={homeFeaturedActivity.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=80';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 pointer-events-none" />

                        {/* Top Badges */}
                        <div className="absolute top-3 right-3 rtl:right-auto rtl:left-3 flex items-center gap-2 pointer-events-none">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/95 text-slate-900 backdrop-blur-xs shadow-xs flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{homeFeaturedActivity.date}</span>
                          </span>
                        </div>

                        {/* Featured / Automatic Mode Badge */}
                        <div className="absolute top-3 left-3 rtl:left-auto rtl:right-3 flex items-center gap-1.5 pointer-events-none">
                          {isCustomMode ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950 shadow-xs flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" />
                              <span>عرض مخصص بالواجهة</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600/95 text-white backdrop-blur-xs shadow-xs flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-300" />
                              <span>أحدث نشاط منجز (عرض تلقائي)</span>
                            </span>
                          )}
                        </div>

                        {/* Main Image Label */}
                        <div className="absolute bottom-3 right-3 rtl:right-3 rtl:left-auto flex items-center gap-1.5 pointer-events-none">
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-black/70 text-white backdrop-blur-xs flex items-center gap-1 border border-white/10 shadow-xs">
                            <ImageIcon className="w-3 h-3 text-emerald-400" />
                            <span>الصورة الرئيسية للنشاط</span>
                          </span>
                        </div>

                        {/* 🎥 Video Badge / Play Button on Main Image */}
                        {hasVideo && (
                          <div className="absolute top-12 sm:top-14 right-3 rtl:right-auto rtl:left-3 z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenMediaModal({
                                  title: homeFeaturedActivity.title,
                                  url: effectiveVideoUrl!,
                                  type: 'video',
                                  description: homeFeaturedActivity.description,
                                });
                              }}
                              className="px-3 py-1.5 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg flex items-center gap-1.5 backdrop-blur-xs transition-all hover:scale-105 cursor-pointer border border-rose-400/40"
                              title="تشغيل فيديو التوثيق الميداني المعتمد"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>فيديو توثيقي</span>
                              {homeFeaturedActivity.videoMetadata?.durationFormatted && (
                                <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded-sm font-mono">
                                  {homeFeaturedActivity.videoMetadata.durationFormatted}
                                </span>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Entry point indicator to All Activities */}
                        <div className="absolute bottom-3 left-3 rtl:left-3 rtl:right-auto">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-700/85 hover:bg-emerald-700 text-white text-[11px] font-bold backdrop-blur-xs flex items-center gap-1 border border-emerald-400/30 shadow-xs transition-transform group-hover:scale-105">
                            <HeartHandshake className="w-3 h-3 text-emerald-200" />
                            <span>جميع الأنشطة</span>
                            {lang === 'ar' ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                          </span>
                        </div>

                        {/* Hover overlay hint */}
                        <div className="absolute inset-0 bg-emerald-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="px-3.5 py-2 rounded-xl bg-emerald-700/95 text-white text-xs font-bold shadow-lg flex items-center gap-2 backdrop-blur-xs">
                            <HeartHandshake className="w-4 h-4 text-emerald-200" />
                            <span>الانتقال إلى صفحة جميع الأنشطة</span>
                          </span>
                        </div>
                      </div>

                      {/* 2. [ الصور الإضافية + الفيديو ] - Displayed below the main image */}
                      {/* Case C: Additional Images + Video */}
                      {hasAdditionalImages && hasVideo && (
                        <div className="bg-slate-900 border-t border-slate-800">
                          <div className="px-3.5 py-2 flex items-center justify-between text-xs border-b border-slate-800/80">
                            <div className="flex items-center gap-1.5 font-bold text-slate-200">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span>معرض الوسائط الإضافية والفيديو:</span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {additionalImages.length} صور + 1 فيديو
                            </span>
                          </div>

                          <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {/* Additional Images: [ صورة إضافية 1 ] [ صورة إضافية 2 ] */}
                            {additionalImages.map((img, idx) => (
                              <div
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenMediaModal({
                                    title: `${homeFeaturedActivity.title} - صورة إضافية ${idx + 1}`,
                                    url: img,
                                    type: 'image',
                                    description: homeFeaturedActivity.description,
                                  });
                                }}
                                className="aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-700 hover:border-emerald-400 cursor-pointer group relative shadow-xs transition-all"
                                title={`صورة إضافية ${idx + 1}`}
                              >
                                <img
                                  src={img}
                                  alt={`صورة إضافية ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="absolute bottom-0.5 right-0.5 px-1 rounded-sm bg-black/70 text-[9px] font-bold text-slate-200">
                                  {idx + 1}
                                </span>
                              </div>
                            ))}

                            {/* The Video Item: [ 🎥 الفيديو ] alongside additional images */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenMediaModal({
                                  title: homeFeaturedActivity.title,
                                  url: effectiveVideoUrl!,
                                  type: 'video',
                                  description: homeFeaturedActivity.description,
                                });
                              }}
                              className="aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-rose-950 via-slate-900 to-black border border-rose-500/70 hover:border-rose-400 cursor-pointer group relative flex flex-col items-center justify-center p-1 text-center shadow-md transition-all hover:scale-102"
                              title="مشاهدة فيديو التوثيق الميداني"
                            >
                              <div className="w-7 h-7 rounded-full bg-rose-600 group-hover:bg-rose-500 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5 rtl:ml-0 rtl:mr-0.5" />
                              </div>
                              <span className="text-[10px] font-bold text-rose-200 mt-1 line-clamp-1">
                                🎥 فيديو التوثيق
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Case B: Additional Images Only (No Video) */}
                      {hasAdditionalImages && !hasVideo && (
                        <div className="bg-slate-900 border-t border-slate-800">
                          <div className="px-3.5 py-2 flex items-center justify-between text-xs border-b border-slate-800/80">
                            <div className="flex items-center gap-1.5 font-bold text-slate-200">
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                              <span>الصور الإضافية للنشاط:</span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {additionalImages.length} صور
                            </span>
                          </div>

                          <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {additionalImages.map((img, idx) => (
                              <div
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenMediaModal({
                                    title: `${homeFeaturedActivity.title} - صورة إضافية ${idx + 1}`,
                                    url: img,
                                    type: 'image',
                                    description: homeFeaturedActivity.description,
                                  });
                                }}
                                className="aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-700 hover:border-emerald-400 cursor-pointer group relative shadow-xs transition-all"
                                title={`صورة إضافية ${idx + 1}`}
                              >
                                <img
                                  src={img}
                                  alt={`صورة إضافية ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Eye className="w-3.5 h-3.5 text-white" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Case D (Case 5 in prompt): No Additional Images + Has Video */}
                      {!hasAdditionalImages && hasVideo && (
                        <div className="p-3.5 bg-slate-900 border-t border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>🎥 فيديو التوثيق الميداني ({videoInfo?.platform ? videoInfo.platform.toUpperCase() : 'مباشر'})</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenMediaModal({
                                  title: homeFeaturedActivity.title,
                                  url: effectiveVideoUrl!,
                                  type: 'video',
                                  description: homeFeaturedActivity.description,
                                });
                              }}
                              className="text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                              title="تكبير المشغل"
                            >
                              <Maximize2 className="w-3 h-3" />
                              <span>تكبير</span>
                            </button>
                          </div>

                          {/* Embedded Video Player right below the main image with Lazy Loading */}
                          <div
                            className="aspect-video rounded-xl overflow-hidden bg-black border border-rose-500/40 shadow-inner"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <VideoPlayer
                              url={effectiveVideoUrl!}
                              poster={homeFeaturedActivity.videoMetadata?.thumbnailUrl}
                              title={homeFeaturedActivity.title}
                              aspectRatio="video"
                              lazy={true}
                              durationFormatted={homeFeaturedActivity.videoMetadata?.durationFormatted}
                              fileSizeFormatted={homeFeaturedActivity.videoMetadata?.fileSizeFormatted}
                              resolution={homeFeaturedActivity.videoMetadata?.resolution}
                              className="w-full h-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Content & Action Details */}
                <div className="lg:col-span-7 p-5 sm:p-7 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                        <HeartHandshake className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          {homeFeaturedActivity.category === 'tree_planting' ? 'تشجير وبيئة' :
                           homeFeaturedActivity.category === 'social_aid' ? 'مساعدات اجتماعية' :
                           homeFeaturedActivity.category === 'equipment' ? 'تجهيزات ومعدات' :
                           homeFeaturedActivity.category === 'education' ? 'تعليم ودعم مدرسي' :
                           (homeFeaturedActivity.category as string) === 'health' || homeFeaturedActivity.category === 'health_caravan' ? 'صحة وقوافل طبية' : 'نشاط ميداني'}
                        </span>
                      </span>

                      {homeFeaturedActivity.location && (
                        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span className="line-clamp-1">{homeFeaturedActivity.location}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-emerald-800 transition-colors leading-snug">
                      {homeFeaturedActivity.title}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {homeFeaturedActivity.description}
                    </p>

                    {/* Stats Highlights */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                      {homeFeaturedActivity.spentAmount !== undefined && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[11px] text-slate-500 block">المبلغ المنفق الموثق</span>
                          <span className="font-bold text-slate-900 text-sm font-mono text-emerald-700">
                            {homeFeaturedActivity.spentAmount.toLocaleString()} {settings.currency || 'د.م'}
                          </span>
                        </div>
                      )}

                      {homeFeaturedActivity.beneficiariesCount !== undefined && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[11px] text-slate-500 block">عدد المستفيدين</span>
                          <span className="font-bold text-slate-900 text-sm font-mono">
                            {homeFeaturedActivity.beneficiariesCount.toLocaleString()} مستفيد
                          </span>
                        </div>
                      )}

                      {homeFeaturedActivity.galleryImages && homeFeaturedActivity.galleryImages.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hidden sm:block">
                          <span className="text-[11px] text-slate-500 block">معرض الصور</span>
                          <span className="font-bold text-slate-900 text-sm font-mono">
                            {homeFeaturedActivity.galleryImages.length + 1} صور ميدانية
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer CTAs */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>نشاط موثق ومطابق للسجل المالي</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {hasValidVideo && (
                        <button
                          type="button"
                          id="btn-play-featured-video"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenMediaModal({
                              title: homeFeaturedActivity.title,
                              url: effectiveVideoUrl!,
                              type: 'video',
                              description: homeFeaturedActivity.description,
                            });
                          }}
                          className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs hover:shadow-md transition-all cursor-pointer"
                          title="مشاهدة توثيق الفيديو الميداني لهذا النشاط"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>مشاهدة الفيديو الميداني</span>
                        </button>
                      )}

                      {(homeFeaturedActivity.proofAttachment || homeFeaturedActivity.proofDocumentUrl) && canViewProof && (
                        <button
                          type="button"
                          id="btn-view-proof-from-featured"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenMediaModal({
                              title: `وثيقة وفاتورة إثبات: ${homeFeaturedActivity.title}`,
                              url: homeFeaturedActivity.proofAttachment?.url || homeFeaturedActivity.proofDocumentUrl!,
                              type: homeFeaturedActivity.proofAttachment?.type === 'image' ? 'image' : 'document',
                              description: homeFeaturedActivity.proofAttachment?.name
                                ? `${homeFeaturedActivity.title} - ${homeFeaturedActivity.proofAttachment.name}`
                                : homeFeaturedActivity.description,
                            });
                          }}
                          className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          title="معاينة وثيقة أو فاتورة الإثبات المعتمدة لهذا النشاط"
                        >
                          <FileText className="w-4 h-4 text-emerald-700" />
                          <span>معاينة وثيقة وفاتورة الإثبات</span>
                        </button>
                      )}

                      <button
                        type="button"
                        id="btn-view-all-activities-from-featured"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('activities');
                        }}
                        style={{ backgroundColor: settings.themeColors?.buttonColor || settings.themeColors?.primaryColor || '#059669' }}
                        className="px-4 sm:px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer btn-store-primary"
                      >
                        <HeartHandshake className="w-4 h-4 text-emerald-200" />
                        <span>{t.viewAllActivities || 'الإطلاع على جميع الأنشطة'}</span>
                        {lang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Empty state if no active activities exist */
            <div className="p-8 rounded-2xl bg-white border border-dashed border-slate-200 text-center space-y-3 store-card" style={{ backgroundColor: settings.themeColors?.cardColor || '#ffffff' }}>
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base store-heading">
                لا توجد أعمال أو أنشطة خيرية مسجلة حاليًا
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                عند إضافة أنشطة خيرية جديدة إلى النظام ستظهر تلقائيًا هنا في واجهة المتجر مع كامل تفاصيلها وصورها الميدانية.
              </p>
              <button
                onClick={() => setActiveTab('activities')}
                style={{ backgroundColor: settings.themeColors?.buttonColor || settings.themeColors?.primaryColor || '#059669' }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer btn-store-primary"
              >
                <HeartHandshake className="w-4 h-4 text-emerald-200" />
                <span>{t.viewAllActivities || 'الإطلاع على جميع الأنشطة'}</span>
                {lang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2.5. Association Goals & Focus Pillars */}
      {isVisible('association_goals') && (
        <DynamicUIElementsSection
          category="home_sections"
          uiElements={uiElements.filter((e) => e.id === 'association_goals')}
          settings={settings}
          lang={lang}
          setActiveTab={setActiveTab}
          isMember={!!loggedInMember}
          isAdmin={role === 'admin'}
        />
      )}

      {/* 3.5. Donation Campaigns Section (حملة تبرع للمشاريع الخيرية) */}
      {isVisible('campaigns_section') && (
        <CampaignsSection
          campaigns={campaigns}
          settings={settings}
          lang={lang}
          customTitle={getElementTitle('campaigns_section', 'حملات التبرع والمشاريع الخيرية المستهدفة')}
          customDescription={getElementDesc('campaigns_section', 'ساهموا معنا في تمويل مشاريعنا الخيرية المستهدفة بشفافية تامة، ومتابعة حية لنسب الإنجاز والمبالغ المحصلة يوماً بيوم.')}
          onOpenDonateModal={(campaign) => {
            if (onOpenDonationModal) {
              onOpenDonationModal(campaign);
            }
          }}
          onDonate={(campaign) => {
            if (onOpenDonationModal) {
              onOpenDonationModal(campaign);
            }
          }}
        />
      )}

      {/* 3.8. Join Association CTA Banner */}
      {isVisible('join_cta_banner') && (
        <DynamicUIElementsSection
          category="banners_and_media"
          uiElements={uiElements.filter((e) => e.id === 'join_cta_banner')}
          settings={settings}
          lang={lang}
          onRequestMemberLogin={onRequestMemberLogin}
          setActiveTab={setActiveTab}
          isMember={!!loggedInMember}
          isAdmin={role === 'admin'}
        />
      )}

      {/* 4. Official Association Pledge Card */}
      {isVisible('transparency_pledge') && (
        <div 
          className="p-6 rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-4 transition-all"
          style={{
            background: `linear-gradient(135deg, ${settings.themeColors?.secondaryColor || '#0f172a'} 0%, ${settings.themeColors?.primaryColor || '#047857'} 100%)`
          }}
        >
          <div className="space-y-1 text-center sm:text-start rtl:sm:text-right">
            <h4 className="font-bold text-sm sm:text-base text-white">
              {getElementTitle('transparency_pledge', 'ميثاق الشفافية والمسؤولية المجتمعية')}
            </h4>
            <p className="text-xs text-slate-200 max-w-2xl leading-relaxed">
              {getElementDesc('transparency_pledge', t.transparencyPledge)}
            </p>
          </div>
          {isVisible('bottom_records_section') && (
            <a
              href="#bottom-records-section"
              className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-colors flex-shrink-0 shadow-md"
            >
              الانتقال إلى القسم السفلي للسجلات
            </a>
          )}
        </div>
      )}

      {/* 5. DEDICATED BOTTOM SECTION (القسم الموجود أسفل واجهة المتجر) */}
      {/* Strictly contains the full access gateways to: Live Transparency Ledger, Members Directory, and Board Members */}
      {isVisible('bottom_records_section') && (isVisible('gateway_ledger') || isVisible('gateway_members') || isVisible('board_members')) && (
        <div id="bottom-records-section" className="pt-4 border-t-2 border-slate-200/80 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div 
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold mb-1"
                style={{
                  backgroundColor: `${settings.themeColors?.primaryColor || '#059669'}1a`,
                  color: settings.themeColors?.primaryColor || '#047857'
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>القسم السفلي المخصص للسجلات الرسمية</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 store-heading">
                {getElementTitle('bottom_records_section', 'بوابة السجلات والحسابات الرسمية')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                {getElementDesc('bottom_records_section', 'يمكنك من خلال هذا القسم السفلي الوصول إلى السجلات التفصيلية، والشفافية المالية، وسجل المنخرطين.')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gateway 1: سجل الشفافية المباشر */}
            {isVisible('gateway_ledger') && (
              <div 
                className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group store-card"
                style={{ backgroundColor: settings.themeColors?.cardColor || '#ffffff' }}
              >
                <div className="space-y-3">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: `${settings.themeColors?.primaryColor || '#059669'}20`,
                      color: settings.themeColors?.primaryColor || '#047857'
                    }}
                  >
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors store-heading">
                      {getElementTitle('gateway_ledger', 'سجل الشفافية المباشر')}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {getElementDesc('gateway_ledger', 'الاطلاع على جميع العمليات المالية والمداخيل والمصاريف الموثقة مع سندات الأداء والوصولات المعتمدة.')}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100">
                  <button
                    onClick={() => setActiveTab('ledger')}
                    style={{ backgroundColor: settings.themeColors?.buttonColor || settings.themeColors?.primaryColor || '#059669' }}
                    className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs btn-store-primary"
                  >
                    <span>الدخول إلى سجل الشفافية المباشر</span>
                    {lang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Gateway 3: سجل المنخرطين والمشتركين */}
            {isVisible('gateway_members') && (
              <div 
                className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group store-card"
                style={{ backgroundColor: settings.themeColors?.cardColor || '#ffffff' }}
              >
                <div className="space-y-3">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: `${settings.themeColors?.primaryColor || '#059669'}20`,
                      color: settings.themeColors?.primaryColor || '#047857'
                    }}
                  >
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-700 transition-colors store-heading">
                      {getElementTitle('gateway_members', 'سجل المنخرطين والمشتركين')}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {getElementDesc('gateway_members', 'استعراض قاعدة بيانات المنخرطين والمشتركين، أرقام العضوية، بطاقات الانخراط، وحالة تسوية الاشتراكات.')}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100">
                  <button
                    onClick={() => setActiveTab('members')}
                    style={{ backgroundColor: settings.themeColors?.buttonColor || settings.themeColors?.primaryColor || '#4338ca' }}
                    className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs btn-store-primary"
                  >
                    <span>الدخول إلى سجل المنخرطين</span>
                    {lang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Gateway 4: الهيئة التنفيذية والتدبيرية – أعضاء مكتب الجمعية */}
            {isVisible('board_members') && (
              <div 
                className="p-6 rounded-2xl text-white border shadow-md hover:shadow-lg transition-all flex flex-col justify-between group relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${settings.themeColors?.secondaryColor || '#0f172a'} 0%, ${settings.themeColors?.primaryColor || '#047857'} 100%)`,
                  borderColor: `${settings.themeColors?.primaryColor || '#059669'}50`
                }}
              >
                <div className="space-y-3 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Award className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-mono font-bold border border-white/20">
                      {boardMembers.length} أعضاء
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-emerald-200 transition-colors keep-white">
                      {getElementTitle('board_members', 'الهيئة التنفيذية والتدبيرية – أعضاء مكتب الجمعية')}
                    </h3>
                    <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                      {getElementDesc('board_members', 'الاطلاع على تشكيلة وأعضاء المكتب المسير للجمعية وتوزيع المهام والمسؤوليات الإدارية المنوطة بكل عضو.')}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/10 relative z-10">
                  <button
                    onClick={() => setActiveTab('board-members')}
                    id="open-board-members-page-btn"
                    style={{ backgroundColor: settings.themeColors?.buttonColor || settings.themeColors?.primaryColor || '#059669' }}
                    className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer btn-store-primary"
                  >
                    <Award className="w-4 h-4 text-emerald-200" />
                    <span>الدخول إلى صفحة أعضاء مكتب الجمعية</span>
                    {lang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Members Voting & Resolutions Section (Directly below official records gateways) */}
          {onVote && isVisible('members_voting_section') && (
            <div className="pt-2">
              <MemberVotingSection
                polls={polls}
                members={members}
                boardMembers={boardMembers}
                loggedInMember={loggedInMember}
                role={role}
                currentAdminSession={currentAdminSession}
                activeTenantId={activeTenantId}
                onVote={onVote}
                onRequestMemberLogin={onRequestMemberLogin}
                onRequestRegisterMember={onRequestRegisterMember}
                lang={lang}
                customTitle={getElementTitle('members_voting_section', 'التصويت على القرارات')}
                customDescription={getElementDesc('members_voting_section', 'صوتك أمانة ومسؤولية! شارك برأيك وموقفك المباشر (مع أو ضد) على قرارات ومشاريع الجمعية المعروضة للمصادقة.')}
              />
            </div>
          )}
        </div>
      )}

      {/* Fallback if bottom_records_section is hidden but voting is enabled */}
      {!isVisible('bottom_records_section') && onVote && isVisible('members_voting_section') && (
        <div className="pt-4 border-t-2 border-slate-200/80">
          <MemberVotingSection
            polls={polls}
            members={members}
            boardMembers={boardMembers}
            loggedInMember={loggedInMember}
            role={role}
            currentAdminSession={currentAdminSession}
            activeTenantId={activeTenantId}
            onVote={onVote}
            onRequestMemberLogin={onRequestMemberLogin}
            onRequestRegisterMember={onRequestRegisterMember}
            lang={lang}
            customTitle={getElementTitle('members_voting_section', 'التصويت على القرارات')}
            customDescription={getElementDesc('members_voting_section', 'صوتك أمانة ومسؤولية! شارك برأيك وموقفك المباشر (مع أو ضد) على قرارات ومشاريع الجمعية المعروضة للمصادقة.')}
          />
        </div>
      )}

      {/* 5.5. Recent Operations Preview */}
      {isVisible('recent_operations_preview') && (
        <DynamicUIElementsSection
          category="records_and_ledgers"
          uiElements={uiElements.filter((e) => e.id === 'recent_operations_preview')}
          settings={settings}
          lang={lang}
          operations={operations}
          onOpenReportModal={onOpenReportModal}
          setActiveTab={setActiveTab}
          isMember={!!loggedInMember}
          isAdmin={role === 'admin'}
        />
      )}

      {/* 6. Contact & Headquarters Information Card */}
      {isVisible('contact_card') && (
        <DynamicUIElementsSection
          category="footer_and_contact"
          uiElements={uiElements.filter((e) => e.id === 'contact_card')}
          settings={settings}
          lang={lang}
          setActiveTab={setActiveTab}
          isMember={!!loggedInMember}
          isAdmin={role === 'admin'}
        />
      )}

      {/* 7. Any Custom Dynamic UI Blocks Added by Admin */}
      <DynamicUIElementsSection
        uiElements={uiElements.filter((e) => e.isCustom && !['announcements_banner', 'quick_actions', 'association_goals', 'join_cta_banner', 'recent_operations_preview', 'contact_card'].includes(e.id))}
        settings={settings}
        lang={lang}
        operations={operations}
        onOpenDonationModal={() => campaigns.length > 0 && onOpenDonationModal && onOpenDonationModal(campaigns[0])}
        onRequestMemberLogin={onRequestMemberLogin}
        onOpenReportModal={onOpenReportModal}
        setActiveTab={setActiveTab}
        isMember={!!loggedInMember}
        isAdmin={role === 'admin'}
      />
    </div>
  );
};
