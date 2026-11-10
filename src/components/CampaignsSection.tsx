import React, { useState } from 'react';
import {
  HeartHandshake,
  Target,
  Coins,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Award,
  Video,
  Play,
  Film,
  X,
} from 'lucide-react';
import type { DonationCampaign, AssociationSettings, Language } from '../types';
import { VideoPlayer } from '../utils/videoUtils';

interface CampaignsSectionProps {
  campaigns: DonationCampaign[];
  settings: AssociationSettings;
  lang: Language;
  onOpenDonateModal?: (campaign: DonationCampaign) => void;
  onDonate?: (campaign: DonationCampaign) => void;
  customTitle?: string;
  customDescription?: string;
}

export const CampaignsSection: React.FC<CampaignsSectionProps> = ({
  campaigns,
  settings,
  lang,
  onOpenDonateModal,
  onDonate,
  customTitle,
  customDescription,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedVideoCampaign, setSelectedVideoCampaign] = useState<DonationCampaign | null>(null);

  const handleTriggerDonate = (camp: DonationCampaign) => {
    if (typeof onOpenDonateModal === 'function') {
      onOpenDonateModal(camp);
    } else if (typeof onDonate === 'function') {
      onDonate(camp);
    }
  };

  // Only display campaigns where isVisibleOnStore is not false
  const visibleCampaigns = campaigns.filter((camp) => camp.isVisibleOnStore !== false);

  // Filter campaigns
  const filteredCampaigns = visibleCampaigns.filter((camp) => {
    if (filter === 'all') return true;
    if (filter === 'active') return camp.status === 'active';
    if (filter === 'completed') return camp.status === 'completed';
    return true;
  });

  if (visibleCampaigns.length === 0) {
    return null;
  }

  return (
    <section id="campaigns-section" className="py-12 sm:py-16 relative overflow-hidden" dir="rtl">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-100 dark:bg-emerald-950/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-50 dark:bg-amber-950/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-3 shadow-xs">
              <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>مبادرات وحملات التمويل التشاركي الخيري</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {customTitle || 'حملات التبرع والمشاريع الخيرية المستهدفة'}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
              {customDescription || 'ساهموا معنا في تمويل مشاريعنا الخيرية المستهدفة بشفافية تامة، ومتابعة حية لنسب الإنجاز والمبالغ المحصلة يوماً بيوم.'}
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              جميع الحملات ({visibleCampaigns.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('active')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filter === 'active'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              حملات نشطة ({visibleCampaigns.filter((c) => c.status === 'active').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('completed')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filter === 'completed'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              اكتمل الهدف ({visibleCampaigns.filter((c) => c.status === 'completed').length})
            </button>
          </div>
        </div>

        {/* Campaigns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredCampaigns.map((camp) => {
            const target = camp.targetAmount || 0;
            const collected = camp.collectedAmount || 0;
            const rawPct = target > 0 ? (collected / target) * 100 : 0;
            const progressPct = camp.progressPercentage ?? Math.round(rawPct * 10) / 10;
            
            // Visual progress MUST NOT exceed 100%
            const visualProgress = Math.min(100, Math.max(0, (collected / (target || 1)) * 100));
            const isCompleted = camp.status === 'completed' || collected >= target;
            const isPaused = camp.status === 'paused';
            const remaining = Math.max(0, target - collected);

            return (
              <div
                key={camp.id}
                id={`campaign-card-${camp.id}`}
                className="group flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-emerald-500/40 transition-all duration-300 overflow-hidden"
              >
                {/* Campaign Image */}
                <div className="relative h-52 sm:h-56 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={camp.coverImage || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80'}
                    alt={camp.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* Subtle Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                  {/* Status Badges */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    {isCompleted ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-600/90 backdrop-blur-md text-white text-xs font-bold shadow-md flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                        اكتمل الهدف
                      </span>
                    ) : isPaused ? (
                      <span className="px-3 py-1 rounded-full bg-slate-700/90 backdrop-blur-md text-slate-200 text-xs font-bold shadow-md">
                        متوقفة مؤقتاً
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-emerald-700/90 backdrop-blur-md text-white text-xs font-bold shadow-md flex items-center gap-1 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        حملة نشطة
                      </span>
                    )}
                  </div>

                  {/* Promotional Video Badge on Image (Only if videoUrl is defined) */}
                  {camp.videoUrl && (
                    <div className="absolute top-3 left-3 z-10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVideoCampaign(camp);
                        }}
                        className="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5 transition-all transform hover:scale-105 cursor-pointer border border-white/20"
                        title="مشاهدة الفيديو التعريفي للحملة"
                      >
                        <Play className="w-3 h-3 fill-current translate-x-0.5" />
                        <span>فيديو تعريفي</span>
                      </button>
                    </div>
                  )}

                  {/* Target Project Badge on Image */}
                  <div className="absolute bottom-3 right-3 left-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-emerald-200 border border-emerald-500/30 text-xs font-medium truncate max-w-full">
                      <Target className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="truncate">{camp.targetProject}</span>
                    </span>
                  </div>
                </div>

                {/* Campaign Body */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Title */}
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                      {camp.title}
                    </h3>

                    {/* Short Description */}
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {camp.description}
                    </p>

                    {/* Promotional Video Teaser Button (Only rendered if videoUrl is present) */}
                    {camp.videoUrl && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setSelectedVideoCampaign(camp)}
                          className="w-full py-2 px-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all flex items-center justify-between cursor-pointer group/vid shadow-2xs"
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs group-hover/vid:scale-110 transition-transform">
                              <Play className="w-3 h-3 fill-current translate-x-0.5" />
                            </span>
                            <span>مشاهدة الفيديو التعريفي للمشروع</span>
                          </span>
                          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                            <span>تشغيل</span>
                            <span className="text-xs">▶</span>
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Metrics Block matching user exact prompt specifications */}
                    <div className="mt-5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {/* 1. هدف المشروع */}
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            هدف المشروع
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                            {target.toLocaleString()} {settings.currency}
                          </span>
                        </div>

                        {/* 2. تم جمع */}
                        <div className="flex flex-col border-x border-slate-200 dark:border-slate-700/60 px-1">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            تم جمع
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {collected.toLocaleString()} {settings.currency}
                          </span>
                        </div>

                        {/* 3. نسبة الإنجاز */}
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            نسبة الإنجاز
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                            {progressPct}%
                          </span>
                        </div>
                      </div>

                      {/* Exceeded target notification if collected > target */}
                      {collected > target && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-center">
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            تم جمع {collected.toLocaleString()} {settings.currency} من أصل {target.toLocaleString()} {settings.currency} (تجاوز الهدف بنجاح 🎉)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar (Locked visually to maximum 100%) */}
                    <div className="mt-4">
                      <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
                        <span className="text-slate-500 dark:text-slate-400">
                          {isCompleted ? 'اكتمل تمويل المشروع بالكامل' : `المتبقي للوصول إلى الهدف: ${remaining.toLocaleString()} ${settings.currency}`}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {progressPct}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                        <div
                          className="bg-gradient-to-r from-emerald-600 to-teal-500 h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${visualProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Donate Button */}
                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      id={`donate-btn-${camp.id}`}
                      onClick={() => handleTriggerDonate(camp)}
                      disabled={isPaused}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group-hover:gap-3 cursor-pointer"
                    >
                      <HeartHandshake className="w-4 h-4 text-amber-300" />
                      <span>{isCompleted ? 'المساهمة الإضافية في الحملة' : 'تبرع الآن'}</span>
                      <ArrowLeft className="w-4 h-4 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================== RESPONSIVE CAMPAIGN VIDEO MODAL ===================== */}
      {selectedVideoCampaign && selectedVideoCampaign.videoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
          dir="rtl"
        >
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-rose-600/30 text-rose-300 border border-rose-500/40 flex items-center justify-center shrink-0">
                  <Play className="w-5 h-5 fill-current translate-x-0.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 truncate">
                      {selectedVideoCampaign.targetProject}
                    </span>
                    <span className="text-xs text-slate-300 hidden sm:inline">فيديو تعريفي وترويجي للمشروع</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">
                    {selectedVideoCampaign.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVideoCampaign(null)}
                className="p-2 rounded-full hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                aria-label="إغلاق الفيديو"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player Box - Responsive 16:9 on all screens */}
            <div className="bg-black p-2 sm:p-4 flex items-center justify-center overflow-y-auto">
              <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-black">
                <VideoPlayer
                  url={selectedVideoCampaign.videoUrl}
                  title={selectedVideoCampaign.title}
                  aspectRatio="video"
                  showPlatformBadge={true}
                  autoPlay={true}
                />
              </div>
            </div>

            {/* Modal Footer with Campaign Highlights & Direct Donate CTA */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-3 text-xs w-full sm:w-auto">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">الهدف المالي:</span>
                  <strong className="text-slate-900 dark:text-white">
                    {selectedVideoCampaign.targetAmount?.toLocaleString()} {settings.currency}
                  </strong>
                </div>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <span>تم جمع:</span>
                  <strong className="font-bold">
                    {selectedVideoCampaign.collectedAmount?.toLocaleString()} {settings.currency}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedVideoCampaign(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedVideoCampaign;
                    setSelectedVideoCampaign(null);
                    handleTriggerDonate(c);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <HeartHandshake className="w-4 h-4 text-amber-300" />
                  <span>تبرع لهذا المشروع الآن</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
