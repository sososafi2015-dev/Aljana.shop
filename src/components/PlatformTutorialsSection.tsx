import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GraduationCap, 
  Plus, 
  Video, 
  Link as LinkIcon, 
  UploadCloud, 
  Edit3, 
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  X, 
  Play, 
  Pause,
  RefreshCw, 
  Clock, 
  Film, 
  ArrowUp, 
  ArrowDown, 
  ArrowRight,
  Smartphone,
  Monitor,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Image as ImageIcon,
  Save
} from 'lucide-react';
import type { TutorialVideo, AssociationTenant, WatchVideosSectionColorSettings } from '../types';
import { 
  fetchTutorialVideos, 
  createTutorialVideo, 
  updateTutorialVideo, 
  deleteTutorialVideo, 
  uploadTutorialVideoFile, 
  reorderTutorialVideos, 
  saveAllTutorialVideos,
  getCachedTutorials,
  isMainPortalWatchScope,
  PLATFORM_TUTORIALS_UPDATED_EVENT
} from '../api/tutorialsApi';
import { MAIN_PORTAL_WATCH_VIDEOS_SCOPE } from '../initialTutorials';
import { uploadImageToServer, ensurePermanentImageUrl } from '../api/imageApi';
import { getMasterAdminSession } from '../tenantStorage';
import {
  getPortalSettings,
  fetchPortalSettings,
  saveWatchVideosSectionColors,
  PORTAL_SETTINGS_EVENT,
  DEFAULT_WATCH_VIDEOS_COLORS,
} from '../portalSettingsStorage';
import { WatchVideosColorSettingsPanel } from './WatchVideosColorSettingsPanel';

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#022c22').replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 44;
    const b = parseInt(clean[2] + clean[2], 16) || 34;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 44;
  const b = parseInt(clean.substring(4, 6), 16) || 34;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface PlatformTutorialsSectionProps {
  activeTenantId?: string;
  tenant?: AssociationTenant;
  lang?: string;
  addToast?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  isSuperAdmin?: boolean;
  isMasterPlatformAdmin?: boolean;
  currentAdminSession?: any;
  onBack?: () => void;
  customTitle?: string;
  customSubtitle?: string;
  isMainPortalSection?: boolean;
}

function getYouTubeEmbedUrl(url: string, isShorts: boolean = false): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1&playsinline=1`;
}

function getYouTubeThumbnailUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  if (!match) return null;
  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
}

function getVideoCoverImageUrl(video: TutorialVideo): string {
  if (video.thumbnailUrl && video.thumbnailUrl.trim() !== '') {
    return video.thumbnailUrl.trim();
  }
  const ytThumb = getYouTubeThumbnailUrl(video.videoUrl);
  if (ytThumb) {
    return ytThumb;
  }
  return 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1000&q=80';
}

function getVimeoEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[3]}?badge=0&autopause=0` : null;
}

function isUrlYouTubeShorts(url: string): boolean {
  if (!url) return false;
  return /youtube\.com\/shorts\//i.test(url) || /youtu\.be\/shorts\//i.test(url);
}

function formatDurationSeconds(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ==================== INTERACTIVE DIRECT HTML5 VIDEO PLAYER ====================
interface DirectVideoPlayerProps {
  src: string;
  title: string;
  poster?: string;
  autoPlay?: boolean;
  isPortrait: boolean;
  onOpenShortsModal?: () => void;
  onToggleOrientation?: () => void;
  isInsideShortsModal?: boolean;
}

const DirectVideoPlayer: React.FC<DirectVideoPlayerProps> = ({
  src,
  title,
  poster,
  autoPlay = false,
  isPortrait,
  onOpenShortsModal,
  onToggleOrientation,
  isInsideShortsModal = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleTimeUpdate = () => setCurrentTime(v.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(v.duration || 0);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    v.addEventListener('timeupdate', handleTimeUpdate);
    v.addEventListener('loadedmetadata', handleLoadedMetadata);
    v.addEventListener('play', handlePlay);
    v.addEventListener('pause', handlePause);
    v.addEventListener('ended', handleEnded);

    if (autoPlay) {
      v.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {});
    }

    return () => {
      v.removeEventListener('timeupdate', handleTimeUpdate);
      v.removeEventListener('loadedmetadata', handleLoadedMetadata);
      v.removeEventListener('play', handlePlay);
      v.removeEventListener('pause', handlePause);
      v.removeEventListener('ended', handleEnded);
    };
  }, [src, autoPlay]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !v.muted;
    v.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && v.volume === 0) {
      v.volume = 0.8;
      setVolume(0.8);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const v = videoRef.current;
    if (v) {
      v.volume = val;
      const muted = val === 0;
      v.muted = muted;
      setIsMuted(muted);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    const v = videoRef.current;
    if (v) {
      v.currentTime = val;
    }
  };

  const toggleFullscreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
      onClick={togglePlay}
      className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden select-none cursor-pointer group"
    >
      {/* Ambient background blur for vertical portrait videos to avoid stark letterboxes */}
      {isPortrait && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center filter blur-xl opacity-30 scale-110 pointer-events-none"
          style={{ backgroundImage: `url(${poster || src})` }}
        />
      )}

      {/* Main Crisp Video Element - 100% Quality, Object Contain to guarantee no distortion or clipping */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        className="relative z-10 w-full h-full object-contain pointer-events-none"
      >
        متصفحك لا يدعم تشغيل هذا الفيديو مباشرة.
      </video>

      {/* Center Big Play/Pause Indicator (visible when paused or briefly on tap) */}
      <AnimatePresence>
        {(!isPlaying || showControls) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          >
            {!isPlaying && (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl backdrop-blur-md transform transition-transform group-hover:scale-110 border border-white/20">
                <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white translate-x-1" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 sm:p-4 transition-opacity duration-300 flex flex-col gap-2 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrub Bar / Progress Bar */}
        <div className="relative w-full flex items-center group/slider">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/25 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none transition-all group-hover/slider:h-2.5"
            style={{
              background: `linear-gradient(to right, #6366f1 ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)`
            }}
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white text-xs gap-2">
          {/* Left: Play/Pause, Volume, Time */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <div className="flex items-center gap-1.5 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-12 sm:w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-indigo-400 hidden sm:block"
                title="مستوى الصوت"
              />
            </div>

            <span className="text-[11px] font-mono text-slate-300 font-bold whitespace-nowrap">
              {formatDurationSeconds(currentTime)} / {formatDurationSeconds(duration)}
            </span>
          </div>

          {/* Right: Orientation indicator, Shorts Mode, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {onToggleOrientation && !isInsideShortsModal && (
              <button
                type="button"
                onClick={onToggleOrientation}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-slate-200 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                title={isPortrait ? 'التحويل إلى وضع شاشة عريضة 16:9' : 'التحويل إلى نمط Shorts عمودي 9:16'}
              >
                {isPortrait ? (
                  <>
                    <Monitor className="w-3 h-3 text-indigo-300" />
                    <span className="hidden sm:inline">تحويل لأفقي</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3 h-3 text-amber-300" />
                    <span className="hidden sm:inline">تحويل لـ Shorts</span>
                  </>
                )}
              </button>
            )}

            {onOpenShortsModal && !isInsideShortsModal && isPortrait && (
              <button
                type="button"
                onClick={onOpenShortsModal}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer"
                title="مشاهدة بملء الشاشة بنمط Shorts عمودي (9:16)"
              >
                <Smartphone className="w-3 h-3 text-white" />
                <span>ملء الشاشة Shorts</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title="ملء الشاشة"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== FULLSCREEN SHORTS VIEWER MODAL (9:16 VERTICAL EXPERIENCE) ====================
interface ShortsViewerModalProps {
  video: TutorialVideo;
  allVideos: TutorialVideo[];
  onClose: () => void;
  onSelectVideo: (v: TutorialVideo) => void;
}

const ShortsViewerModal: React.FC<ShortsViewerModalProps> = ({
  video,
  allVideos,
  onClose,
  onSelectVideo,
}) => {
  const currentIndex = allVideos.findIndex((v) => v.id === video.id);
  const prevVideo = currentIndex > 0 ? allVideos[currentIndex - 1] : null;
  const nextVideo = currentIndex < allVideos.length - 1 ? allVideos[currentIndex + 1] : null;

  const [showFullDesc, setShowFullDesc] = useState(false);

  const youtubeEmbed = getYouTubeEmbedUrl(video.videoUrl, true);
  const vimeoEmbed = getVimeoEmbedUrl(video.videoUrl);

  // Close on Escape key, navigate on arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp' && prevVideo) onSelectVideo(prevVideo);
      if (e.key === 'ArrowDown' && nextVideo) onSelectVideo(nextVideo);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevVideo, nextVideo, onClose, onSelectVideo]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-hidden select-none">
      {/* Container: Fullscreen on mobile, centered 9:16 container on tablet/desktop */}
      <div className="relative w-full h-full max-w-[460px] sm:h-[92vh] sm:rounded-3xl bg-black border border-white/10 shadow-2xl overflow-hidden flex flex-col justify-between">
        
        {/* Top Floating Controls Bar */}
        <div className="absolute top-0 inset-x-0 z-40 bg-gradient-to-b from-black/85 via-black/40 to-transparent p-4 flex items-center justify-between text-white pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-600 text-white shadow-sm flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              <span>Shorts 9:16</span>
            </span>
            <span className="text-xs text-white/80 font-bold">
              {currentIndex + 1} من {allVideos.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer shadow-lg active:scale-95"
            title="إغلاق نمط Shorts"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Area (True 9:16 Vertical Ratio) */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
          {youtubeEmbed ? (
            <iframe
              src={`${youtubeEmbed}&autoplay=1`}
              title={video.title}
              className="w-full h-full border-0 object-cover"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : vimeoEmbed ? (
            <iframe
              src={`${vimeoEmbed}&autoplay=1`}
              title={video.title}
              className="w-full h-full border-0 object-cover"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <DirectVideoPlayer
              src={video.videoUrl}
              title={video.title}
              isPortrait={true}
              isInsideShortsModal={true}
            />
          )}

          {/* Right Floating Quick Actions (Shorts & TikTok style) */}
          <div className="absolute right-3.5 bottom-28 z-40 flex flex-col items-center gap-3 text-white pointer-events-auto">
            {prevVideo && (
              <button
                type="button"
                onClick={() => onSelectVideo(prevVideo)}
                className="w-11 h-11 rounded-full bg-black/60 hover:bg-indigo-600 backdrop-blur-md text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
                title={`الفيديو السابق: ${prevVideo.title}`}
              >
                <ChevronRight className="w-5 h-5 rotate-90" />
              </button>
            )}

            {nextVideo && (
              <button
                type="button"
                onClick={() => onSelectVideo(nextVideo)}
                className="w-11 h-11 rounded-full bg-black/60 hover:bg-indigo-600 backdrop-blur-md text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
                title={`الفيديو التالي: ${nextVideo.title}`}
              >
                <ChevronLeft className="w-5 h-5 -rotate-90" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Metadata & Caption Area */}
        <div className="absolute bottom-0 inset-x-0 z-40 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-4 sm:p-5 text-white pointer-events-auto space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] text-indigo-300 font-bold">
            <span>{video.addedBy || 'الإدارة العامة للمنصة'}</span>
            <span>•</span>
            <span>{video.duration || 'فيديو تعليمي'}</span>
          </div>

          <h3 className="text-sm sm:text-base font-black leading-snug line-clamp-2">
            {video.title}
          </h3>

          {video.description && (
            <div className="text-xs text-slate-300">
              <p className={showFullDesc ? 'leading-relaxed' : 'line-clamp-2 leading-relaxed'}>
                {video.description}
              </p>
              {video.description.length > 80 && (
                <button
                  type="button"
                  onClick={() => setShowFullDesc(!showFullDesc)}
                  className="text-indigo-400 font-bold text-[11px] mt-0.5 hover:underline cursor-pointer"
                >
                  {showFullDesc ? 'عرض أقل' : 'عرض المزيد'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN PLATFORM TUTORIALS SECTION ====================
export const PlatformTutorialsSection: React.FC<PlatformTutorialsSectionProps> = ({
  activeTenantId = 'tenant_nour',
  tenant,
  lang = 'ar',
  addToast,
  isSuperAdmin = false,
  isMasterPlatformAdmin = false,
  currentAdminSession,
  onBack,
  customTitle,
  customSubtitle,
  isMainPortalSection = false,
}) => {
  const [tutorials, setTutorials] = useState<TutorialVideo[]>(() => getCachedTutorials(activeTenantId));
  const [isLoading, setIsLoading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dynamic per-video orientation override (portrait vs landscape)
  const [videoOrientations, setVideoOrientations] = useState<Record<string, 'portrait' | 'landscape'>>({});

  // Track which videos have been clicked to start playing (when a custom cover thumbnail is set)
  const [playingVideoIds, setPlayingVideoIds] = useState<Record<string, boolean>>({});

  // Active Shorts Fullscreen Viewer Video
  const [activeShortsVideo, setActiveShortsVideo] = useState<TutorialVideo | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<TutorialVideo | null>(null);
  const [deletingTutorial, setDeletingTutorial] = useState<TutorialVideo | null>(null);

  // Inline Quick-Add Form states (for direct adding via link + title + cover image + save)
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineVideoUrl, setInlineVideoUrl] = useState('');
  const [inlineThumbnailUrl, setInlineThumbnailUrl] = useState('');
  const [inlineThumbnailPreview, setInlineThumbnailPreview] = useState('');
  const [inlineThumbnailFilename, setInlineThumbnailFilename] = useState('');
  const [isUploadingInlineThumbnail, setIsUploadingInlineThumbnail] = useState(false);
  const [inlineFormOpen, setInlineFormOpen] = useState<boolean>(true);
  const [uploadingCardThumbnailId, setUploadingCardThumbnailId] = useState<string | null>(null);

  // Modal Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSourceType, setFormSourceType] = useState<'url' | 'upload'>('url');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formOriginalFilename, setFormOriginalFilename] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formAspectRatio, setFormAspectRatio] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [detectedNotice, setDetectedNotice] = useState<string | null>(null);

  // Thumbnail (Cover Image) states for Modal
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailFilename, setThumbnailFilename] = useState('');
  
  // Uploading & Saving states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Section-wide "حفظ التعديلات" state & verification banners
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [hasPendingColorChanges, setHasPendingColorChanges] = useState(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);
  const [saveErrorBanner, setSaveErrorBanner] = useState<string | null>(null);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);

  // Watch Videos Section dynamic color settings (synced with portal_settings database)
  const [watchColors, setWatchColors] = useState<WatchVideosSectionColorSettings>(() => ({
    ...DEFAULT_WATCH_VIDEOS_COLORS,
    ...(getPortalSettings().watchVideosColors || {}),
  }));
  const latestWatchColorsRef = useRef<WatchVideosSectionColorSettings>(watchColors);
  const hasPendingColorChangesRef = useRef<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const inlineThumbnailInputRef = useRef<HTMLInputElement>(null);
  const cardThumbnailInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const tenantName = tenant?.name || 'جمعية النور للتنمية والتضامن';

  // Permissions: Master Platform Super Admin in Admin Dashboard (public main portal view is viewer-only)
  const activeMasterSession = currentAdminSession || getMasterAdminSession();
  const isMasterSuperAdmin =
    !isMainPortalSection &&
    (isMasterPlatformAdmin === true ||
      isSuperAdmin === true ||
      (!!activeMasterSession &&
        (activeMasterSession.isMaster === true ||
          activeMasterSession.isMasterPlatformAdmin === true ||
          activeMasterSession.type === 'master_super_admin' ||
          activeMasterSession.role === 'super_admin')));
  const canManageVideos = isMasterSuperAdmin;

  // Synchronize watchVideosColors with backend database and live events
  useEffect(() => {
    let mounted = true;
    fetchPortalSettings()
      .then((fresh) => {
        if (mounted && fresh?.watchVideosColors && !hasPendingColorChangesRef.current) {
          const merged = {
            ...DEFAULT_WATCH_VIDEOS_COLORS,
            ...fresh.watchVideosColors,
          };
          latestWatchColorsRef.current = merged;
          setWatchColors(merged);
        }
      })
      .catch(() => {});

    const handlePortalSettingsUpdated = (e: any) => {
      if (!mounted || hasPendingColorChangesRef.current) return;
      const updated = e?.detail || getPortalSettings();
      if (updated?.watchVideosColors) {
        const merged = {
          ...DEFAULT_WATCH_VIDEOS_COLORS,
          ...updated.watchVideosColors,
        };
        latestWatchColorsRef.current = merged;
        setWatchColors(merged);
      }
    };

    window.addEventListener(PORTAL_SETTINGS_EVENT, handlePortalSettingsUpdated);
    return () => {
      mounted = false;
      window.removeEventListener(PORTAL_SETTINGS_EVENT, handlePortalSettingsUpdated);
    };
  }, []);

  // Load tutorials on mount & listen for cross-component updates within the exact same scope ONLY
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setTutorials(getCachedTutorials(activeTenantId));
    fetchTutorialVideos(activeTenantId)
      .then((data) => {
        if (isMounted) {
          setTutorials(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed fetching tutorials:', err);
        if (isMounted) setIsLoading(false);
      });

    const myScope = isMainPortalWatchScope(activeTenantId)
      ? MAIN_PORTAL_WATCH_VIDEOS_SCOPE
      : 'association_tutorials';

    const handleTutorialsUpdated = (e: any) => {
      if (!isMounted || !e?.detail) return;
      if (e.detail.scope && Array.isArray(e.detail.tutorials)) {
        if (e.detail.scope === myScope) {
          setTutorials(e.detail.tutorials);
        }
      }
    };

    window.addEventListener(PLATFORM_TUTORIALS_UPDATED_EVENT, handleTutorialsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener(PLATFORM_TUTORIALS_UPDATED_EVENT, handleTutorialsUpdated);
    };
  }, [activeTenantId]);

  // Handle inline cover image upload (native file picker without camera capture)
  const handleInlineThumbnailSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      const errMsg = 'يرجى اختيار ملف صورة صالح لغلاف الفيديو (JPG, JPEG, PNG, WebP).';
      setSaveErrorBanner(errMsg);
      if (addToast) addToast('error', errMsg);
      return;
    }

    setSaveErrorBanner(null);
    setInlineThumbnailFilename(file.name);
    const localPreview = URL.createObjectURL(file);
    setInlineThumbnailPreview(localPreview);
    setIsUploadingInlineThumbnail(true);

    try {
      const permanentUrl = await uploadImageToServer(file);
      setInlineThumbnailUrl(permanentUrl);
      setInlineThumbnailPreview(permanentUrl);
      if (addToast) {
        addToast('success', 'تم رفع صورة غلاف الفيديو ومعاينتها بنجاح.');
      }
    } catch (err) {
      try {
        const fallbackUrl = await ensurePermanentImageUrl(file);
        setInlineThumbnailUrl(fallbackUrl);
        setInlineThumbnailPreview(fallbackUrl);
      } catch (fallbackErr: any) {
        const msg = fallbackErr?.message || 'فشل رفع صورة غلاف الفيديو، يرجى المحاولة مرة أخرى.';
        setSaveErrorBanner(msg);
        if (addToast) addToast('error', msg);
      }
    } finally {
      setIsUploadingInlineThumbnail(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Handle uploading/changing cover image directly on an existing video card
  const handleCardThumbnailSelected = async (videoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      const errMsg = 'يرجى اختيار ملف صورة صالح لغلاف الفيديو (JPG, JPEG, PNG, WebP).';
      setSaveErrorBanner(errMsg);
      if (addToast) addToast('error', errMsg);
      return;
    }

    setSaveErrorBanner(null);
    setUploadingCardThumbnailId(videoId);

    try {
      let permanentUrl = '';
      try {
        permanentUrl = await uploadImageToServer(file);
      } catch {
        permanentUrl = await ensurePermanentImageUrl(file);
      }

      setTutorials((prev) =>
        prev.map((t) => (t.id === videoId ? { ...t, thumbnailUrl: permanentUrl } : t))
      );
      setPlayingVideoIds((prev) => ({ ...prev, [videoId]: false }));
      setHasPendingChanges(true);

      if (addToast) {
        addToast('success', 'تم تحديث صورة غلاف الفيديو. اضغط «حفظ التعديلات» لحفظها بشكل دائم.');
      }
    } catch (err: any) {
      const msg = err?.message || 'فشل رفع صورة غلاف الفيديو.';
      setSaveErrorBanner(msg);
      if (addToast) addToast('error', msg);
    } finally {
      setUploadingCardThumbnailId(null);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Handle inline editing of title or videoUrl on an existing video card
  const handleInlineCardFieldChange = (
    videoId: string,
    field: 'title' | 'videoUrl' | 'description' | 'thumbnailUrl',
    value: string
  ) => {
    setTutorials((prev) =>
      prev.map((t) => (t.id === videoId ? { ...t, [field]: value } : t))
    );
    setHasPendingChanges(true);
  };

  // Handle adding a new video from the inline quick-add form
  const handleInlineAddVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canManageVideos) return;

    if (isUploadingInlineThumbnail) {
      const waitMsg = 'يرجى الانتظار حتى يكتمل رفع صورة الغلاف أولاً.';
      setSaveErrorBanner(waitMsg);
      if (addToast) addToast('warning', waitMsg);
      return;
    }

    const cleanTitle = inlineTitle.trim();
    const cleanUrl = inlineVideoUrl.trim();

    if (!cleanTitle) {
      const msg = 'يرجى إدخال عنوان الفيديو.';
      setSaveErrorBanner(msg);
      if (addToast) addToast('error', msg);
      return;
    }

    if (!cleanUrl) {
      const msg = 'يرجى إدخال رابط الفيديو.';
      setSaveErrorBanner(msg);
      if (addToast) addToast('error', msg);
      return;
    }

    setIsSavingAll(true);
    setSaveErrorBanner(null);
    setSaveSuccessBanner(null);

    try {
      let resolvedThumb = inlineThumbnailUrl.trim() || undefined;
      if (resolvedThumb && (resolvedThumb.startsWith('data:') || resolvedThumb.startsWith('blob:'))) {
        resolvedThumb = await ensurePermanentImageUrl(resolvedThumb);
      }

      const created = await createTutorialVideo(
        {
          title: cleanTitle,
          description: '',
          sourceType: 'url',
          videoUrl: cleanUrl,
          thumbnailUrl: resolvedThumb,
          addedBy: activeMasterSession?.fullName || 'الإدارة العامة للمنصة',
          aspectRatio: isUrlYouTubeShorts(cleanUrl) ? 'portrait' : 'landscape',
        },
        activeTenantId,
        activeMasterSession
      );

      const nextTutorials = [created, ...tutorials.filter((t) => t.id !== created.id)].map((t, idx) => ({
        ...t,
        order: idx + 1,
      }));

      const result = await saveAllTutorialVideos(nextTutorials, activeTenantId, activeMasterSession);
      setTutorials(result.tutorials);
      setPlayingVideoIds((prev) => ({ ...prev, [created.id]: false }));
      setInlineTitle('');
      setInlineVideoUrl('');
      setInlineThumbnailUrl('');
      setInlineThumbnailPreview('');
      setInlineThumbnailFilename('');
      setHasPendingChanges(false);
      setLastVerifiedAt(result.lastUpdated);
      setSaveSuccessBanner('تم إضافة الفيديو وحفظ التعديلات في قاعدة البيانات بنجاح');

      if (addToast) {
        addToast('success', 'تم إضافة الفيديو وحفظ التعديلات بنجاح');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'حدث خطأ أثناء إضافة وحفظ الفيديو.';
      setSaveErrorBanner(errMsg);
      if (addToast) addToast('error', errMsg);
    } finally {
      setIsSavingAll(false);
    }
  };

  // Save & verify all modifications in database (Server DB + Cloud Firestore + Read-after-write verification)
  const handleSaveAllModifications = async () => {
    if (!canManageVideos) {
      if (addToast) addToast('error', 'صلاحية حفظ التعديلات محصورة بأدمن المنصة الرئيسية فقط.');
      return;
    }

    if (isUploading || isUploadingThumbnail || isUploadingInlineThumbnail || uploadingCardThumbnailId) {
      const waitMsg = 'يرجى الانتظار حتى يكتمل رفع الملفات الحالية إلى التخزين الدائم أولاً.';
      setSaveErrorBanner(waitMsg);
      if (addToast) addToast('warning', waitMsg);
      return;
    }

    // Check if the user partially filled the inline add form and clicked «حفظ التعديلات»
    const pendingInlineTitle = inlineTitle.trim();
    const pendingInlineUrl = inlineVideoUrl.trim();
    if ((pendingInlineTitle && !pendingInlineUrl) || (!pendingInlineTitle && pendingInlineUrl)) {
      const msg = !pendingInlineTitle
        ? 'يرجى إدخال عنوان الفيديو الجديد قبل حفظ التعديلات.'
        : 'يرجى إدخال رابط الفيديو الجديد قبل حفظ التعديلات.';
      setSaveErrorBanner(msg);
      if (addToast) addToast('error', msg);
      return;
    }

    setIsSavingAll(true);
    setSaveErrorBanner(null);
    setSaveSuccessBanner(null);

    try {
      // Also persist any color changes for the Watch Videos section permanently
      if (isMainPortalWatchScope(activeTenantId)) {
        window.dispatchEvent(new CustomEvent('save-watch-videos-colors-now'));
        const savedSettings = await saveWatchVideosSectionColors(latestWatchColorsRef.current);
        if (savedSettings?.watchVideosColors) {
          const verifiedColors = {
            ...DEFAULT_WATCH_VIDEOS_COLORS,
            ...savedSettings.watchVideosColors,
          };
          latestWatchColorsRef.current = verifiedColors;
          setWatchColors(verifiedColors);
        }
        hasPendingColorChangesRef.current = false;
        setHasPendingColorChanges(false);
      }

      let workingList = [...tutorials];

      // If the user filled in a new video in the inline fields and directly clicked «حفظ التعديلات», include it automatically!
      if (pendingInlineTitle && pendingInlineUrl) {
        let resolvedThumb = inlineThumbnailUrl.trim() || undefined;
        if (resolvedThumb && (resolvedThumb.startsWith('data:') || resolvedThumb.startsWith('blob:'))) {
          resolvedThumb = await ensurePermanentImageUrl(resolvedThumb);
        }

        const created = await createTutorialVideo(
          {
            title: pendingInlineTitle,
            description: '',
            sourceType: 'url',
            videoUrl: pendingInlineUrl,
            thumbnailUrl: resolvedThumb,
            addedBy: activeMasterSession?.fullName || 'الإدارة العامة للمنصة',
            aspectRatio: isUrlYouTubeShorts(pendingInlineUrl) ? 'portrait' : 'landscape',
          },
          activeTenantId,
          activeMasterSession
        );

        workingList = [created, ...workingList.filter((t) => t.id !== created.id)];
        setInlineTitle('');
        setInlineVideoUrl('');
        setInlineThumbnailUrl('');
        setInlineThumbnailPreview('');
        setInlineThumbnailFilename('');
      }

      // Validate that all videos in workingList have non-empty titles and URLs
      for (const item of workingList) {
        if (!item.title || !item.title.trim()) {
          throw new Error('لا يمكن ترك عنوان الفيديو فارغاً. يرجى إدخال عنوان لكل فيديو.');
        }
        if (!item.videoUrl || !item.videoUrl.trim()) {
          throw new Error(`يرجى إدخال رابط صالح للفيديو «${item.title}».`);
        }
      }

      // Merge any runtime orientation toggles into the tutorials list before saving
      const mergedTutorials = workingList.map((tut, idx) => ({
        ...tut,
        title: tut.title.trim(),
        videoUrl: tut.videoUrl.trim(),
        aspectRatio: videoOrientations[tut.id] || tut.aspectRatio || (isUrlYouTubeShorts(tut.videoUrl) ? 'portrait' : 'landscape'),
        order: idx + 1,
      }));

      const result = await saveAllTutorialVideos(mergedTutorials, activeTenantId, activeMasterSession);
      setTutorials(result.tutorials);
      setHasPendingChanges(false);
      setLastVerifiedAt(result.lastUpdated);
      setSaveSuccessBanner('تم حفظ جميع التعديلات وإعدادات الألوان بنجاح في قاعدة البيانات الدائمة');

      if (addToast) {
        addToast('success', 'تم حفظ التعديلات بنجاح');
      }

      setTimeout(() => {
        setSaveSuccessBanner((prev) =>
          prev === 'تم حفظ جميع التعديلات وإعدادات الألوان بنجاح في قاعدة البيانات الدائمة' ? null : prev
        );
      }, 6000);
    } catch (err: any) {
      console.error('Failed saving all tutorial modifications:', err);
      const errMsg = err?.message || 'حدث خطأ أثناء حفظ التعديلات في قاعدة البيانات. يرجى المحاولة مرة أخرى.';
      setSaveErrorBanner(errMsg);
      if (addToast) {
        addToast('error', errMsg);
      }
    } finally {
      setIsSavingAll(false);
    }
  };

  // Listen for top-bar save trigger from parent container if clicked there
  useEffect(() => {
    const onTriggerSave = () => {
      handleSaveAllModifications();
    };
    window.addEventListener('trigger-save-all-tutorials', onTriggerSave);
    return () => window.removeEventListener('trigger-save-all-tutorials', onTriggerSave);
  });

  // Determine orientation for a specific video
  const getVideoOrientation = (video: TutorialVideo): 'portrait' | 'landscape' => {
    if (videoOrientations[video.id]) {
      return videoOrientations[video.id];
    }
    if (video.aspectRatio === 'portrait') return 'portrait';
    if (video.aspectRatio === 'landscape') return 'landscape';
    if (isUrlYouTubeShorts(video.videoUrl)) return 'portrait';
    return 'landscape';
  };

  const toggleVideoOrientation = (videoId: string, current: 'portrait' | 'landscape') => {
    const next = current === 'portrait' ? 'landscape' : 'portrait';
    setVideoOrientations((prev) => ({
      ...prev,
      [videoId]: next,
    }));
    setTutorials((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, aspectRatio: next } : v))
    );
    if (canManageVideos) {
      setHasPendingChanges(true);
      updateTutorialVideo(videoId, { aspectRatio: next }, activeTenantId, activeMasterSession).catch(() => {});
    }
    if (addToast) {
      addToast(
        'info',
        next === 'portrait'
          ? 'تم التحويل إلى نمط Shorts عمودي (9:16). اضغط «حفظ التعديلات» لتثبيت الإعداد.'
          : 'تم التحويل إلى نمط شاشة عريضة أفقي (16:9). اضغط «حفظ التعديلات» لتثبيت الإعداد.'
      );
    }
  };

  const openAddModal = () => {
    if (!canManageVideos) {
      if (addToast) addToast('error', 'صلاحية إضافة الفيديوهات محصورة بأدمن المنصة الرئيسية فقط.');
      return;
    }
    setEditingTutorial(null);
    setFormTitle('');
    setFormDescription('');
    setFormSourceType('url');
    setFormVideoUrl('');
    setFormOriginalFilename('');
    setFormDuration('');
    setFormAspectRatio('auto');
    setDetectedNotice(null);
    setFormThumbnailUrl('');
    setThumbnailPreviewUrl('');
    setIsUploadingThumbnail(false);
    setThumbnailFile(null);
    setThumbnailFilename('');
    setUploadedFile(null);
    setUploadProgress(0);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (tut: TutorialVideo) => {
    if (!canManageVideos) {
      if (addToast) addToast('error', 'صلاحية تعديل الفيديوهات محصورة بأدمن المنصة الرئيسية فقط.');
      return;
    }
    setEditingTutorial(tut);
    setFormTitle(tut.title);
    setFormDescription(tut.description || '');
    setFormSourceType(tut.sourceType);
    setFormVideoUrl(tut.videoUrl);
    setFormOriginalFilename(tut.originalFilename || '');
    setFormDuration(tut.duration || '');
    setFormAspectRatio(tut.aspectRatio || (isUrlYouTubeShorts(tut.videoUrl) ? 'portrait' : 'landscape'));
    setDetectedNotice(null);
    setFormThumbnailUrl(tut.thumbnailUrl || '');
    setThumbnailPreviewUrl(tut.thumbnailUrl || '');
    setIsUploadingThumbnail(false);
    setThumbnailFile(null);
    setThumbnailFilename(tut.thumbnailUrl ? tut.thumbnailUrl.split('/').pop() || 'thumbnail.jpg' : '');
    setUploadedFile(null);
    setUploadProgress(0);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Handle selecting a video cover image (Thumbnail) from device
  const handleThumbnailSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('يرجى اختيار ملف صورة صالح لغلاف الفيديو (PNG, JPG, WEBP...).');
      return;
    }

    setFormError(null);
    setThumbnailFile(file);
    setThumbnailFilename(file.name);

    // Show immediate preview before saving
    const localPreview = URL.createObjectURL(file);
    setThumbnailPreviewUrl(localPreview);
    setIsUploadingThumbnail(true);

    try {
      const permanentUrl = await uploadImageToServer(file);
      setFormThumbnailUrl(permanentUrl);
      setThumbnailPreviewUrl(permanentUrl);
      if (addToast) {
        addToast('success', 'تم رفع صورة غلاف الفيديو ومعاينتها بنجاح.');
      }
    } catch (err: any) {
      console.error('Thumbnail upload failed, trying fallback:', err);
      try {
        const fallbackUrl = await ensurePermanentImageUrl(file);
        setFormThumbnailUrl(fallbackUrl);
        setThumbnailPreviewUrl(fallbackUrl);
      } catch (fallbackErr: any) {
        setFormError(fallbackErr?.message || 'فشل رفع صورة غلاف الفيديو، يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsUploadingThumbnail(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleRemoveThumbnail = () => {
    setFormThumbnailUrl('');
    setThumbnailPreviewUrl('');
    setThumbnailFile(null);
    setThumbnailFilename('');
    if (thumbnailInputRef.current) {
      thumbnailInputRef.current.value = '';
    }
  };

  // Inspect file on client to auto-detect portrait dimensions
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setFormOriginalFilename(file.name);
    setFormError(null);
    setIsUploading(true);
    setUploadProgress(0);

    // Client-side aspect ratio probe
    try {
      const tempVideo = document.createElement('video');
      tempVideo.src = URL.createObjectURL(file);
      tempVideo.onloadedmetadata = () => {
        if (tempVideo.videoHeight > tempVideo.videoWidth) {
          setFormAspectRatio('portrait');
          setDetectedNotice('✨ تم اكتشاف فيديو مصور بالهاتف عمودياً (Portrait) - سيتم تفعيل نمط Shorts 9:16 تلقائياً.');
        } else {
          setFormAspectRatio('landscape');
          setDetectedNotice('✨ تم اكتشاف فيديو أفقي عريض (Landscape 16:9).');
        }
        URL.revokeObjectURL(tempVideo.src);
      };
    } catch {
      // Ignored if probe fails
    }

    try {
      const res = await uploadTutorialVideoFile(file, (percent) => {
        setUploadProgress(percent);
      });

      setFormVideoUrl(res.streamUrl);
      if (!formTitle.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setFormTitle(cleanName);
      }
      if (addToast) {
        addToast('success', 'تم رفع ملف الفيديو بنجاح وجاهز للحفظ الدائم.');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setFormError(err?.message || 'فشل رفع ملف الفيديو، يرجى المحاولة مرة أخرى.');
      if (addToast) {
        addToast('error', err?.message || 'فشل رفع ملف الفيديو.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Confirm Add or Edit inside modal, persist to database, and highlight «حفظ التعديلات» in section UI
  const handleSaveTutorial = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (isUploading || isUploadingThumbnail) {
      const msg = 'يرجى الانتظار حتى يكتمل رفع ملف الفيديو أو الغلاف إلى خدمة التخزين الدائم.';
      setFormError(msg);
      if (addToast) addToast('warning', msg);
      return;
    }

    const cleanTitle = formTitle.trim();
    if (!cleanTitle) {
      const msg = 'حقل عنوان الفيديو إلزامي ولا يمكن تركه فارغاً.';
      setFormError(msg);
      if (addToast) addToast('error', msg);
      return;
    }

    const cleanUrl = formVideoUrl.trim();
    if (!cleanUrl) {
      const msg =
        formSourceType === 'url'
          ? 'يرجى إدخال رابط الفيديو (يوتيوب أو رابط مباشر).'
          : 'يرجى رفع ملف الفيديو من المعرض أولاً.';
      setFormError(msg);
      if (addToast) addToast('error', msg);
      return;
    }

    // Determine final aspect ratio
    let resolvedRatio: 'portrait' | 'landscape' | 'auto' = formAspectRatio;
    if (resolvedRatio === 'auto') {
      if (isUrlYouTubeShorts(cleanUrl)) {
        resolvedRatio = 'portrait';
      } else {
        resolvedRatio = 'landscape';
      }
    }

    setIsSaving(true);
    try {
      let finalThumbnailUrl = formThumbnailUrl.trim();
      if (thumbnailFile && (!finalThumbnailUrl || finalThumbnailUrl.startsWith('blob:') || finalThumbnailUrl.startsWith('data:'))) {
        finalThumbnailUrl = await ensurePermanentImageUrl(thumbnailFile);
      } else if (
        finalThumbnailUrl &&
        (finalThumbnailUrl.startsWith('data:') || finalThumbnailUrl.startsWith('blob:'))
      ) {
        finalThumbnailUrl = await ensurePermanentImageUrl(finalThumbnailUrl);
      }

      if (editingTutorial) {
        const updated = await updateTutorialVideo(
          editingTutorial.id,
          {
            title: cleanTitle,
            description: formDescription.trim(),
            sourceType: formSourceType,
            videoUrl: cleanUrl,
            originalFilename: formOriginalFilename || undefined,
            duration: formDuration.trim() || undefined,
            thumbnailUrl: finalThumbnailUrl,
            aspectRatio: resolvedRatio,
          },
          activeTenantId,
          activeMasterSession
        );

        // Strictly update in-place without creating a duplicate
        setTutorials((prev) => {
          const mapped = prev.map((t) => (t.id === editingTutorial.id || t.id === updated.id ? updated : t));
          const seen = new Set<string>();
          return mapped.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        });
        setPlayingVideoIds((prev) => ({ ...prev, [updated.id]: false }));
        setIsAddModalOpen(false);
        setEditingTutorial(null);
        setHasPendingChanges(true);
        if (addToast) {
          addToast('info', 'تم تأكيد تعديل الفيديو. اضغط الآن على زر «حفظ التعديلات» لتثبيت جميع التغييرات نهائياً.');
        }
      } else {
        const created = await createTutorialVideo(
          {
            title: cleanTitle,
            description: formDescription.trim(),
            sourceType: formSourceType,
            videoUrl: cleanUrl,
            originalFilename: formOriginalFilename || undefined,
            duration: formDuration.trim() || undefined,
            thumbnailUrl: finalThumbnailUrl || undefined,
            fileSize: uploadedFile?.size,
            addedBy: activeMasterSession?.fullName || (isSuperAdmin ? 'الأدمن الرئيسي' : 'إدارة الجمعية'),
            aspectRatio: resolvedRatio,
          },
          activeTenantId,
          activeMasterSession
        );

        setTutorials((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
        setPlayingVideoIds((prev) => ({ ...prev, [created.id]: false }));
        setIsAddModalOpen(false);
        setHasPendingChanges(true);
        if (addToast) {
          addToast('info', 'تم تأكيد إضافة الفيديو. اضغط الآن على زر «حفظ التعديلات» لتثبيت جميع التغييرات نهائياً.');
        }
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      const errorMsg = err?.message || 'حدث خطأ أثناء حفظ الفيديو في قاعدة البيانات.';
      setFormError(errorMsg);
      if (addToast) {
        addToast('error', errorMsg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const confirmDeleteTutorial = async () => {
    if (!deletingTutorial) return;
    try {
      await deleteTutorialVideo(deletingTutorial.id, activeTenantId, activeMasterSession);
      setTutorials((prev) => prev.filter((t) => t.id !== deletingTutorial.id));
      setHasPendingChanges(true);
      if (addToast) {
        addToast('success', `تم حذف فيديو «${deletingTutorial.title}». اضغط «حفظ التعديلات» لتأكيد حفظ القائمة.`);
      }
    } catch (err: any) {
      console.error('Delete failed:', err);
      if (addToast) {
        addToast('error', err?.message || 'فشل حذف الفيديو من الخادم.');
      }
    } finally {
      setDeletingTutorial(null);
    }
  };

  // Reorder tutorial videos up or down
  const handleMoveVideo = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tutorials.length) return;

    const updated = [...tutorials];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setTutorials(updated);
    setHasPendingChanges(true);

    try {
      setIsReordering(true);
      const orderedIds = updated.map((t) => t.id);
      await reorderTutorialVideos(orderedIds, activeTenantId, activeMasterSession);
      if (addToast) {
        addToast('info', 'تم تغيير ترتيب الفيديو. اضغط «حفظ التعديلات» لتثبيت الترتيب الجديد.');
      }
    } catch (err: any) {
      console.error('Reorder failed:', err);
      if (addToast) {
        addToast('error', 'فشل حفظ الترتيب الجديد على الخادم.');
      }
    } finally {
      setIsReordering(false);
    }
  };

  // Filtered list
  const filteredTutorials = tutorials.filter((tut) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      tut.title.toLowerCase().includes(q) ||
      (tut.description && tut.description.toLowerCase().includes(q))
    );
  });

  const isWatchVideosSection = isMainPortalWatchScope(activeTenantId) || isMainPortalSection;
  const displayTitle =
    customTitle ||
    (isWatchVideosSection ? 'شاهد شرح بالفيديو كيفية استخدام المنصة' : 'تعلم كيفية استخدام المنصة');

  return (
    <div
      id="platform-tutorials-section-root"
      className={isMainPortalSection ? 'space-y-6 p-3 sm:p-5 rounded-3xl transition-colors duration-300' : 'space-y-6 pb-20'}
      style={
        isMainPortalSection && isWatchVideosSection
          ? { backgroundColor: watchColors.outerSectionBgColor || '#f8fafc' }
          : undefined
      }
    >
      {/* Top Header Card */}
      <div
        className={
          isWatchVideosSection
            ? 'text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden transition-all duration-300'
            : 'bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-indigo-500/30 relative overflow-hidden'
        }
        style={
          isWatchVideosSection
            ? {
                background: `linear-gradient(135deg, ${watchColors.cardBgColor || '#022c22'} 0%, ${watchColors.cardSecondaryBgColor || '#042f2e'} 100%)`,
                border: `2px solid ${watchColors.cardBorderColor || '#10b981'}`,
              }
            : undefined
        }
      >
        {isWatchVideosSection && watchColors.coverImageUrl && watchColors.coverImageUrl.trim() !== '' && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src={watchColors.coverImageUrl}
              alt="غلاف شاهد شرح بالفيديو"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, ${hexToRgba(
                  watchColors.cardBgColor || '#022c22',
                  Math.min(0.98, ((watchColors.coverOverlayOpacity ?? 80) + 12) / 100)
                )} 0%, ${hexToRgba(
                  watchColors.cardSecondaryBgColor || '#042f2e',
                  (watchColors.coverOverlayOpacity ?? 80) / 100
                )} 55%, ${hexToRgba(
                  watchColors.cardBgColor || '#022c22',
                  Math.max(0.25, ((watchColors.coverOverlayOpacity ?? 80) - 15) / 100)
                )} 100%)`,
              }}
            />
          </div>
        )}

        {!isWatchVideosSection && (
          <>
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          </>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              {onBack && (
                <button
                  type="button"
                  id="back-to-sections-list-btn"
                  onClick={onBack}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>{isMainPortalSection ? 'إغلاق والرجوع' : 'العودة لقائمة الأقسام'}</span>
                </button>
              )}
              <div
                className={
                  isWatchVideosSection
                    ? 'inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold transition-colors'
                    : 'inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs font-bold'
                }
                style={
                  isWatchVideosSection
                    ? {
                        backgroundColor: watchColors.badgeBgColor || '#064e3b',
                        color: watchColors.badgeTextColor || '#a7f3d0',
                        border: `1px solid ${watchColors.cardBorderColor || '#10b981'}`,
                      }
                    : undefined
                }
              >
                <GraduationCap
                  className={isWatchVideosSection ? 'w-4 h-4' : 'w-4 h-4 text-indigo-400'}
                  style={isWatchVideosSection ? { color: watchColors.interactiveAccentColor || '#ff6b00' } : undefined}
                />
                <span>فيديوهات الشرح والتدريب المباشر</span>
              </div>
            </div>
            <h2
              className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3 flex-wrap keep-white"
              style={
                isWatchVideosSection
                  ? {
                      color: watchColors.mainTitleColor || '#ffffff',
                    }
                  : { color: '#ffffff' }
              }
            >
              <span
                style={
                  isWatchVideosSection &&
                  watchColors.titleBgColor &&
                  watchColors.titleBgColor !== 'transparent'
                    ? {
                        backgroundColor: watchColors.titleBgColor,
                        color: watchColors.mainTitleColor || '#ffffff',
                        padding: '0.2rem 0.75rem',
                        borderRadius: '0.75rem',
                      }
                    : { color: isWatchVideosSection ? watchColors.mainTitleColor || '#ffffff' : '#ffffff' }
                }
              >
                {displayTitle}
              </span>
              <span
                className={
                  isWatchVideosSection
                    ? 'text-xs font-black px-3 py-1 rounded-full shadow-sm'
                    : 'text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200'
                }
                style={
                  isWatchVideosSection
                    ? {
                        backgroundColor: watchColors.interactiveAccentColor || '#ff6b00',
                        color: '#ffffff',
                        border: `1px solid ${watchColors.interactiveAccentColor || '#ff6b00'}`,
                      }
                    : undefined
                }
              >
                {tutorials.length} فيديو
              </span>
            </h2>
            <p
              className={isWatchVideosSection ? 'text-sm leading-relaxed' : 'text-sm text-slate-300 leading-relaxed'}
              style={isWatchVideosSection ? { color: watchColors.subtitleColor || '#ecfdf5' } : undefined}
            >
              {customSubtitle ||
                (canManageVideos
                  ? 'دليل مرئي شامل وفيديوهات مسجلة لشرح جميع وظائف وأقسام المنصة خطوة بخطوة. يمكنك إضافة الفيديوهات عبر الروابط، إدخال عنوان كل فيديو، ورفع صورة غلاف مخصصة لكل فيديو مع حفظ التعديلات بشكل دائم.'
                  : 'دليل مرئي شامل وفيديوهات مسجلة لشرح جميع وظائف وأقسام المنصة خطوة بخطوة، بنمط Shorts عمودي على الهواتف الذكية وجودة بث أصلية.')}
            </p>
            <div
              className={`text-xs ${
                isWatchVideosSection ? '' : 'text-indigo-200/80'
              } font-medium flex items-center gap-2 pt-1`}
              style={isWatchVideosSection ? { color: watchColors.helperTextColor || '#a7f3d0' } : undefined}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  canManageVideos
                    ? 'bg-emerald-400 animate-pulse'
                    : isWatchVideosSection
                    ? ''
                    : 'bg-blue-400'
                }`}
                style={
                  !canManageVideos && isWatchVideosSection
                    ? { backgroundColor: watchColors.interactiveAccentColor || '#ff6b00' }
                    : undefined
                }
              />
              <span>
                {canManageVideos
                  ? 'نطاق الإدارة: الإدارة العامة للمنصة (حفظ دائم في قاعدة البيانات والواجهة الرئيسية)'
                  : `شروحات رسمية معتمدة من الإدارة العامة للمنصة 🛡️ • ${tenantName}`}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              id="refresh-tutorials-btn"
              onClick={() => {
                setIsLoading(true);
                fetchTutorialVideos(activeTenantId).then((data) => {
                  setTutorials(data);
                  setIsLoading(false);
                  if (addToast) addToast('info', 'تم تحديث قائمة الفيديوهات من قاعدة البيانات.');
                });
              }}
              disabled={isLoading || isSavingAll}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>

            {canManageVideos ? (
              <>
                <button
                  type="button"
                  id="add-new-tutorial-video-btn"
                  onClick={openAddModal}
                  disabled={isSavingAll}
                  className={
                    isWatchVideosSection
                      ? 'px-5 py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer'
                      : 'px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all transform hover:-translate-y-0.5 cursor-pointer'
                  }
                  style={
                    isWatchVideosSection
                      ? {
                          backgroundColor: watchColors.interactiveAccentColor || '#ff6b00',
                          color: '#ffffff',
                        }
                      : undefined
                  }
                >
                  <Plus className="w-5 h-5" />
                  <span>إضافة فيديو جديد</span>
                </button>

                <button
                  type="button"
                  id="save-all-tutorials-modifications-btn"
                  onClick={handleSaveAllModifications}
                  disabled={isSavingAll || isLoading}
                  className={`px-6 py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2.5 shadow-xl transition-all transform hover:-translate-y-0.5 cursor-pointer ${
                    hasPendingChanges || hasPendingColorChanges || (inlineTitle.trim() && inlineVideoUrl.trim())
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white ring-2 ring-emerald-300 shadow-emerald-500/40 animate-pulse'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/40 shadow-emerald-600/30'
                  }`}
                >
                  {isSavingAll ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>جاري حفظ التعديلات...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>حفظ التعديلات</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <div
                className="px-4 py-2.5 rounded-2xl bg-white/10 border border-white/15 text-xs font-bold flex items-center gap-2"
                style={
                  isWatchVideosSection
                    ? {
                        backgroundColor: watchColors.badgeBgColor || '#064e3b',
                        color: watchColors.badgeTextColor || '#a7f3d0',
                        borderColor: watchColors.cardBorderColor || '#10b981',
                      }
                    : { color: '#e2e8f0' }
                }
              >
                <Video
                  className="w-4 h-4"
                  style={{ color: isWatchVideosSection ? watchColors.interactiveAccentColor || '#ff6b00' : '#a5b4fc' }}
                />
                <span>محتوى معتمد للمشاهدة والتدريب</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Success / Error / Pending Verification Banners */}
      {saveSuccessBanner && (
        <div
          id="tutorials-save-success-banner"
          className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-sm sm:text-base text-emerald-950">
                {saveSuccessBanner}
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                تمت كتابة جميع التعديلات في قاعدة البيانات الدائمة وإعادة قراءتها للتحقق من حفظ أحدث نسخة بنجاح.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessBanner(null)}
            className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold cursor-pointer self-end sm:self-center"
          >
            إغلاق
          </button>
        </div>
      )}

      {saveErrorBanner && (
        <div
          id="tutorials-save-error-banner"
          className="p-4 sm:p-5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-sm sm:text-base text-rose-950">
                تنبيه أثناء الحفظ
              </h4>
              <p className="text-xs text-rose-800 mt-0.5">{saveErrorBanner}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleSaveAllModifications}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
            >
              إعادة المحاولة
            </button>
            <button
              type="button"
              onClick={() => setSaveErrorBanner(null)}
              className="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ================= COLOR SETTINGS & LIVE PREVIEW PANEL (ADMIN ONLY - شاهد شرح بالفيديو كيفية استخدام المنصة) ================= */}
      {canManageVideos && isMainPortalWatchScope(activeTenantId) && (
        <WatchVideosColorSettingsPanel
          addToast={addToast}
          onPendingChangesChange={(pending) => {
            hasPendingColorChangesRef.current = pending;
            setHasPendingColorChanges(pending);
          }}
          onColorsChange={(newColors) => {
            latestWatchColorsRef.current = newColors;
            setWatchColors(newColors);
          }}
        />
      )}

      {/* ================= DIRECT INLINE VIDEO ADDITION & COVER UPLOAD PANEL ================= */}
      {canManageVideos && (
        <div
          id="inline-video-tutorial-manager-card"
          className="bg-white rounded-3xl border border-indigo-200/90 shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/60 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  إضافة فيديو شرح جديد عبر الرابط وتخصيص الغلاف
                </h3>
                <p className="text-[11px] text-slate-500">
                  أدخل رابط الفيديو وعنوانه وارفع صورة الغلاف ثم اضغط «حفظ التعديلات» لحفظ البيانات بشكل دائم في قاعدة البيانات
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInlineFormOpen((prev) => !prev)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer"
            >
              {inlineFormOpen ? 'طي النموذج السريع' : 'فتح نموذج الإضافة السريعة'}
            </button>
          </div>

          {inlineFormOpen && (
            <form onSubmit={handleInlineAddVideo} className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. حقل لإدخال عنوان كل فيديو */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="inline-tutorial-title-input"
                    className="block text-xs font-black text-slate-800 flex items-center gap-1.5"
                  >
                    <Film className="w-3.5 h-3.5 text-indigo-600" />
                    <span>عنوان الفيديو <span className="text-rose-600">*</span></span>
                  </label>
                  <input
                    id="inline-tutorial-title-input"
                    type="text"
                    value={inlineTitle}
                    onChange={(e) => setInlineTitle(e.target.value)}
                    placeholder="أدخل عنوان الفيديو الشرحي (مثال: شرح طريقة التسجيل واستخدام المنصة)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm font-bold text-slate-900 transition-all"
                  />
                </div>

                {/* 2. إمكانية إضافة الفيديوهات عبر الروابط */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="inline-tutorial-url-input"
                    className="block text-xs font-black text-slate-800 flex items-center gap-1.5"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>رابط الفيديو (YouTube / Shorts / Vimeo / MP4) <span className="text-rose-600">*</span></span>
                  </label>
                  <input
                    id="inline-tutorial-url-input"
                    type="url"
                    value={inlineVideoUrl}
                    onChange={(e) => setInlineVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... أو رابط الفيديو المباشر"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm font-mono text-slate-800 ltr transition-all"
                  />
                </div>
              </div>

              {/* 3. إمكانية رفع صورة غلاف لكل فيديو + زر حفظ التعديلات */}
              <div className="pt-1 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Native file picker without capture */}
                  <input
                    ref={inlineThumbnailInputRef}
                    id="inline-tutorial-cover-file-input"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/*"
                    onChange={handleInlineThumbnailSelected}
                    className="hidden"
                  />

                  <button
                    type="button"
                    id="inline-upload-cover-btn"
                    disabled={isUploadingInlineThumbnail}
                    onClick={() => inlineThumbnailInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isUploadingInlineThumbnail ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>جاري رفع صورة الغلاف...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        <span>رفع صورة غلاف للفيديو</span>
                      </>
                    )}
                  </button>

                  {(inlineThumbnailPreview || inlineThumbnailUrl) && (
                    <div className="flex items-center gap-2.5 bg-emerald-50/80 border border-emerald-200 px-3 py-1.5 rounded-xl">
                      <img
                        src={inlineThumbnailPreview || inlineThumbnailUrl}
                        alt="معاينة صورة الغلاف"
                        className="w-12 h-8 rounded-lg object-cover border border-emerald-300 shrink-0"
                      />
                      <span className="text-[11px] font-bold text-emerald-900 max-w-[160px] truncate">
                        {inlineThumbnailFilename || 'تم تجهيز صورة الغلاف ✓'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setInlineThumbnailUrl('');
                          setInlineThumbnailPreview('');
                          setInlineThumbnailFilename('');
                        }}
                        className="p-1 rounded-lg hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                        title="إزالة صورة الغلاف"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Buttons: إضافة الفيديو + حفظ التعديلات */}
                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="submit"
                    id="inline-add-tutorial-submit-btn"
                    disabled={isSavingAll || isUploadingInlineThumbnail}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة الفيديو</span>
                  </button>

                  <button
                    type="button"
                    id="inline-save-all-tutorials-btn"
                    onClick={handleSaveAllModifications}
                    disabled={isSavingAll || isLoading || isUploadingInlineThumbnail}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingAll ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري حفظ التعديلات...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>حفظ التعديلات</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Search Bar, Filter Controls & Direct Save Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            id="tutorials-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في عناوين الفيديوهات أو الشروحات..."
            className={`w-full pl-4 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 ${
              isWatchVideosSection ? 'focus:ring-emerald-600' : 'focus:ring-indigo-500'
            } focus:border-transparent transition-all`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 w-full lg:w-auto text-xs text-slate-500 font-medium">
          <span
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold ${
              isWatchVideosSection
                ? 'bg-emerald-50 border border-emerald-200/70 text-emerald-900'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            <Film className={isWatchVideosSection ? 'w-3.5 h-3.5 text-[#ff6b00]' : 'w-3.5 h-3.5 text-indigo-600'} />
            <span>المعروض: {filteredTutorials.length} من {tutorials.length}</span>
          </span>

          {canManageVideos && (
            <button
              type="button"
              id="tutorials-toolbar-save-all-btn"
              onClick={handleSaveAllModifications}
              disabled={isSavingAll || isLoading}
              className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                hasPendingChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isSavingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري حفظ التعديلات...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Videos List Grid */}
      {isLoading && tutorials.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">جاري تحميل فيديوهات الشرح والتعليم...</p>
        </div>
      ) : filteredTutorials.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Video className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900">
              {searchQuery ? 'لم يتم العثور على أي فيديو يطابق بحثك' : 'لا توجد فيديوهات مضافة حالياً'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? 'جرب البحث بكلمات أخرى أو قم بإلغاء التصفية لعرض جميع الفيديوهات المتاحة.'
                : 'يمكنك البدء الآن بإضافة أول فيديو تعليمي لشرح وظائف المنصة عبر إدخال الرابط والعنوان أو الضغط على «إضافة فيديو جديد».'}
            </p>
          </div>
          {!searchQuery && canManageVideos && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول فيديو تعليمي</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {filteredTutorials.map((video, index) => {
            const orientation = getVideoOrientation(video);
            const isPortrait = orientation === 'portrait';
            const youtubeEmbed = getYouTubeEmbedUrl(video.videoUrl, isPortrait);
            const vimeoEmbed = getVimeoEmbedUrl(video.videoUrl);
            const hasCustomThumbnail = Boolean(video.thumbnailUrl && video.thumbnailUrl.trim());
            const coverImageUrl = getVideoCoverImageUrl(video);
            const isVideoPlaying = Boolean(playingVideoIds[video.id]);
            const isUploadingThisCardThumb = uploadingCardThumbnailId === video.id;

            return (
              <div
                key={video.id}
                id={`tutorial-card-${video.id}`}
                className={`bg-white rounded-3xl border ${
                  isWatchVideosSection ? '' : 'border-slate-200/90'
                } shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group ${
                  isPortrait
                    ? isWatchVideosSection
                      ? 'md:col-span-1'
                      : 'md:col-span-1 ring-1 ring-indigo-500/20'
                    : ''
                }`}
                style={
                  isWatchVideosSection
                    ? {
                        borderColor: watchColors.cardBorderColor || '#10b981',
                        borderWidth: '2px',
                      }
                    : undefined
                }
              >
                {/* Video Cover / Player Container: Never mounts or plays the player until the user clicks on the video */}
                <div
                  className={`relative w-full overflow-hidden ${
                    isPortrait
                      ? 'aspect-[9/16] max-h-[76vh] sm:max-h-[580px] flex items-center justify-center'
                      : 'aspect-video'
                  }`}
                  style={{
                    backgroundColor: isWatchVideosSection
                      ? watchColors.cardBgColor || '#022c22'
                      : '#022c22',
                  }}
                >
                  {!isVideoPlaying ? (
                    <div
                      id={`tutorial-thumbnail-cover-${video.id}`}
                      onClick={() => setPlayingVideoIds((prev) => ({ ...prev, [video.id]: true }))}
                      className="relative w-full h-full flex items-center justify-center overflow-hidden select-none cursor-pointer group/cover"
                      style={{
                        background: isWatchVideosSection
                          ? `linear-gradient(135deg, ${watchColors.cardBgColor || '#022c22'} 0%, ${watchColors.cardSecondaryBgColor || '#042f2e'} 100%)`
                          : '#022c22',
                      }}
                      title={`اضغط لتشغيل الفيديو: ${video.title}`}
                    >
                      {/* Ambient background blur for portrait or non-filling covers */}
                      <div
                        className="absolute inset-0 z-0 bg-cover bg-center filter blur-xl opacity-40 scale-110 pointer-events-none"
                        style={{ backgroundImage: `url(${coverImageUrl})` }}
                      />

                      {/* Video Cover Image */}
                      <img
                        id={`tutorial-thumbnail-img-${video.id}`}
                        src={coverImageUrl}
                        alt={`غلاف الفيديو: ${video.title}`}
                        className={`relative z-10 w-full h-full ${
                          isPortrait ? 'object-contain sm:object-cover' : 'object-cover'
                        } group-hover/cover:scale-105 transition-transform duration-500`}
                      />

                      {/* Dark Overlay & Play Button */}
                      <div
                        className="absolute inset-0 z-20 transition-colors flex flex-col items-center justify-center gap-3 p-4 text-center"
                        style={{
                          background: isWatchVideosSection
                            ? `linear-gradient(to top, ${hexToRgba(watchColors.cardBgColor || '#022c22', 0.85)} 0%, ${hexToRgba(watchColors.cardSecondaryBgColor || '#042f2e', 0.35)} 55%, rgba(0,0,0,0.35) 100%)`
                            : 'linear-gradient(to top, rgba(2,44,34,0.85), rgba(0,0,0,0.3), rgba(0,0,0,0.35))',
                        }}
                      >
                        <div
                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${
                            isWatchVideosSection
                              ? ''
                              : 'bg-indigo-600/95 group-hover/cover:bg-indigo-500 text-white'
                          } flex items-center justify-center shadow-2xl backdrop-blur-md transform transition-all duration-300 group-hover/cover:scale-110 border-2 border-white/30`}
                          style={
                            isWatchVideosSection
                              ? {
                                  backgroundColor: watchColors.interactiveAccentColor || '#ff6b00',
                                  color: '#ffffff',
                                  boxShadow: `0 0 0 4px ${hexToRgba(watchColors.buttonFrameBgColor || '#065f46', 0.65)}`,
                                }
                              : undefined
                          }
                        >
                          <Play
                            className="w-8 h-8 sm:w-10 sm:h-10 translate-x-0.5"
                            style={{
                              fill: '#ffffff',
                              color: '#ffffff',
                            }}
                          />
                        </div>
                        <span
                          className="px-4 py-1.5 rounded-full backdrop-blur-md text-xs font-bold border shadow-md"
                          style={
                            isWatchVideosSection
                              ? {
                                  backgroundColor: hexToRgba(watchColors.badgeBgColor || '#064e3b', 0.9),
                                  color: watchColors.badgeTextColor || '#a7f3d0',
                                  borderColor: watchColors.cardBorderColor || '#10b981',
                                }
                              : {
                                  backgroundColor: 'rgba(2,44,34,0.85)',
                                  color: '#d1fae5',
                                  borderColor: 'rgba(52,211,153,0.3)',
                                }
                          }
                        >
                          اضغط لتشغيل الفيديو
                        </span>
                      </div>
                    </div>
                  ) : youtubeEmbed ? (
                    <iframe
                      src={`${youtubeEmbed}&autoplay=1`}
                      title={video.title}
                      className="w-full h-full border-0 object-contain"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : vimeoEmbed ? (
                    <iframe
                      src={`${vimeoEmbed}&autoplay=1`}
                      title={video.title}
                      className="w-full h-full border-0 object-contain"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <DirectVideoPlayer
                      src={video.videoUrl}
                      title={video.title}
                      poster={coverImageUrl}
                      autoPlay={true}
                      isPortrait={isPortrait}
                      onOpenShortsModal={() => setActiveShortsVideo(video)}
                      onToggleOrientation={() => toggleVideoOrientation(video.id, orientation)}
                    />
                  )}

                  {/* Top Badges Overlay */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 pointer-events-none">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                        isWatchVideosSection
                          ? ''
                          : 'bg-indigo-600/90 border-indigo-400/40 text-white'
                      } backdrop-blur-md border shadow-sm flex items-center gap-1`}
                      style={
                        isWatchVideosSection
                          ? {
                              backgroundColor: watchColors.interactiveAccentColor || '#ff6b00',
                              color: '#ffffff',
                              borderColor: watchColors.interactiveAccentColor || '#ff6b00',
                            }
                          : undefined
                      }
                    >
                      <span>#{index + 1}</span>
                    </span>

                    {/* Orientation Badge: Shorts 9:16 vs Landscape */}
                    {isPortrait ? (
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-black backdrop-blur-md border shadow-sm flex items-center gap-1"
                        style={
                          isWatchVideosSection
                            ? {
                                backgroundColor: hexToRgba(watchColors.badgeBgColor || '#064e3b', 0.92),
                                color: watchColors.badgeTextColor || '#a7f3d0',
                                borderColor: watchColors.cardBorderColor || '#10b981',
                              }
                            : {
                                backgroundColor: 'rgba(5,150,105,0.9)',
                                color: '#ffffff',
                                borderColor: 'rgba(52,211,153,0.4)',
                              }
                        }
                      >
                        <Smartphone className="w-3 h-3" style={{ color: isWatchVideosSection ? watchColors.interactiveAccentColor || '#ff6b00' : '#a7f3d0' }} />
                        <span>Shorts 9:16</span>
                      </span>
                    ) : (
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-black backdrop-blur-md border shadow-sm flex items-center gap-1"
                        style={
                          isWatchVideosSection
                            ? {
                                backgroundColor: hexToRgba(watchColors.badgeBgColor || '#064e3b', 0.92),
                                color: watchColors.badgeTextColor || '#a7f3d0',
                                borderColor: watchColors.cardBorderColor || '#10b981',
                              }
                            : {
                                backgroundColor: 'rgba(2,44,34,0.9)',
                                color: '#d1fae5',
                                borderColor: 'rgba(16,185,129,0.3)',
                              }
                        }
                      >
                        <Monitor className="w-3 h-3" style={{ color: isWatchVideosSection ? watchColors.interactiveAccentColor || '#ff6b00' : '#6ee7b7' }} />
                        <span>شاشة عريضة 16:9</span>
                      </span>
                    )}

                    {video.duration && (
                      <span
                        className="px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-md border flex items-center gap-1"
                        style={
                          isWatchVideosSection
                            ? {
                                backgroundColor: hexToRgba(watchColors.cardBgColor || '#022c22', 0.88),
                                color: watchColors.badgeTextColor || '#a7f3d0',
                                borderColor: watchColors.cardBorderColor || '#10b981',
                              }
                            : {
                                backgroundColor: 'rgba(2,44,34,0.85)',
                                color: '#d1fae5',
                                borderColor: 'rgba(16,185,129,0.2)',
                              }
                        }
                      >
                        <Clock className="w-3 h-3" style={{ color: isWatchVideosSection ? watchColors.interactiveAccentColor || '#ff6b00' : '#ff6b00' }} />
                        <span>{video.duration}</span>
                      </span>
                    )}
                  </div>

                  {/* Quick Toggle Button (Top Left) */}
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleVideoOrientation(video.id, orientation)}
                      className="px-2.5 py-1 rounded-xl text-white backdrop-blur-md border text-[10px] font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      style={
                        isWatchVideosSection
                          ? {
                              backgroundColor: hexToRgba(watchColors.cardBgColor || '#022c22', 0.88),
                              color: watchColors.mainTitleColor || '#ffffff',
                              borderColor: watchColors.cardBorderColor || '#10b981',
                            }
                          : {
                              backgroundColor: 'rgba(2,44,34,0.85)',
                              borderColor: 'rgba(16,185,129,0.3)',
                            }
                      }
                      title={isPortrait ? 'تبديل لعرض أفقي 16:9' : 'تبديل لنمط Shorts عمودي 9:16'}
                    >
                      <RotateCcw className="w-3 h-3" style={{ color: isWatchVideosSection ? watchColors.interactiveAccentColor || '#ff6b00' : '#34d399' }} />
                      <span>{isPortrait ? 'عرض أفقي' : 'نمط Shorts'}</span>
                    </button>

                    {isPortrait && (
                      <button
                        type="button"
                        onClick={() => setActiveShortsVideo(video)}
                        className="p-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white backdrop-blur-md border border-emerald-400/40 shadow-sm transition-all cursor-pointer"
                        title="مشاهدة بملء الشاشة بنمط Shorts"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Video Content & Controls */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        onClick={() => setPlayingVideoIds((prev) => ({ ...prev, [video.id]: true }))}
                        className={`font-black text-base leading-snug ${
                          isWatchVideosSection
                            ? 'px-3 py-1.5 rounded-xl transition-all cursor-pointer keep-white'
                            : 'text-slate-900 group-hover:text-indigo-600 transition-colors cursor-pointer'
                        }`}
                        style={
                          isWatchVideosSection
                            ? {
                                backgroundColor:
                                  watchColors.titleBgColor && watchColors.titleBgColor !== 'transparent'
                                    ? watchColors.titleBgColor
                                    : watchColors.cardBgColor || '#022c22',
                                color: watchColors.mainTitleColor || '#ffffff',
                              }
                            : undefined
                        }
                        title={`اضغط لتشغيل الفيديو: ${video.title}`}
                      >
                        {video.title}
                      </h3>
                      {isPortrait && (
                        <button
                          type="button"
                          onClick={() => setActiveShortsVideo(video)}
                          className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 flex items-center gap-1 shrink-0 cursor-pointer transition-all"
                          title="فتح في مشغل Shorts العمودي"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Shorts</span>
                        </button>
                      )}
                    </div>

                    {video.description ? (
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {video.description}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">شرح مرئي لكيفية استخدام المنصة ووظائفها.</p>
                    )}

                    {/* Direct Inline Edit Fields on Card for Admin Management */}
                    {canManageVideos && (
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-600">
                            عنوان الفيديو:
                          </label>
                          <input
                            type="text"
                            value={video.title}
                            onChange={(e) => handleInlineCardFieldChange(video.id, 'title', e.target.value)}
                            placeholder="عنوان الفيديو..."
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold text-slate-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-600">
                            رابط الفيديو:
                          </label>
                          <input
                            type="url"
                            value={video.videoUrl}
                            onChange={(e) => handleInlineCardFieldChange(video.id, 'videoUrl', e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono text-slate-800 ltr"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/*"
                            ref={(el) => {
                              cardThumbnailInputRefs.current[video.id] = el;
                            }}
                            onChange={(e) => handleCardThumbnailSelected(video.id, e)}
                            className="hidden"
                          />

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              disabled={isUploadingThisCardThumb}
                              onClick={() => cardThumbnailInputRefs.current[video.id]?.click()}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              {isUploadingThisCardThumb ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                  <span>جاري رفع الغلاف...</span>
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>{hasCustomThumbnail ? 'تغيير صورة الغلاف' : 'رفع صورة غلاف'}</span>
                                </>
                              )}
                            </button>

                            {hasCustomThumbnail && (
                              <button
                                type="button"
                                onClick={() => handleInlineCardFieldChange(video.id, 'thumbnailUrl', '')}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition-colors cursor-pointer"
                                title="إزالة صورة الغلاف"
                              >
                                إزالة الغلاف
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={handleSaveAllModifications}
                            disabled={isSavingAll}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                          >
                            <Save className="w-3 h-3" />
                            <span>حفظ التعديلات</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata & Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                      <span>{new Date(video.createdAt).toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      {video.addedBy && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500 font-bold">{video.addedBy}</span>
                        </>
                      )}
                    </div>

                    {canManageVideos ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          id={`move-up-tutorial-btn-${video.id}`}
                          disabled={index === 0 || isReordering}
                          onClick={() => handleMoveVideo(index, 'up')}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-700 transition-all cursor-pointer"
                          title="تحريك لأعلى في الترتيب"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          id={`move-down-tutorial-btn-${video.id}`}
                          disabled={index === tutorials.length - 1 || isReordering}
                          onClick={() => handleMoveVideo(index, 'down')}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-700 transition-all cursor-pointer"
                          title="تحريك لأسفل في الترتيب"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          id={`edit-tutorial-btn-${video.id}`}
                          onClick={() => openEditModal(video)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          title="تعديل الفيديو"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل الفيديو</span>
                        </button>

                        <button
                          type="button"
                          id={`delete-tutorial-btn-${video.id}`}
                          onClick={() => setDeletingTutorial(video)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          title="حذف الفيديو"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id={`play-tutorial-btn-${video.id}`}
                          onClick={() =>
                            setPlayingVideoIds((prev) => ({
                              ...prev,
                              [video.id]: !prev[video.id],
                            }))
                          }
                          className={`px-3.5 py-1.5 rounded-xl ${
                            isWatchVideosSection
                              ? 'bg-[#ff6b00] hover:bg-[#f06400] text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          } font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer`}
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>{isVideoPlaying ? 'إيقاف الفيديو' : 'تشغيل الفيديو'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen Vertical Shorts Viewer Modal */}
      <AnimatePresence>
        {activeShortsVideo && (
          <ShortsViewerModal
            video={activeShortsVideo}
            allVideos={filteredTutorials}
            onClose={() => setActiveShortsVideo(null)}
            onSelectVideo={(nextVid) => setActiveShortsVideo(nextVid)}
          />
        )}
      </AnimatePresence>

      {/* Modal: Add or Edit Video */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-white w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-white">
                      {editingTutorial ? 'تعديل الفيديو' : 'إضافة فيديو جديد'}
                    </h3>
                    <p className="text-xs text-indigo-200/80 mt-0.5">
                      {editingTutorial
                        ? 'عدّل بيانات الفيديو ثم اضغط «تأكيد التعديل» وبعدها «حفظ التعديلات»'
                        : 'أدخل بيانات الفيديو ثم اضغط «تأكيد التعديل» وبعدها «حفظ التعديلات»'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="header-save-tutorial-btn"
                    onClick={() => handleSaveTutorial()}
                    disabled={isSaving || isUploading || isUploadingThumbnail}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSaving || isUploadingThumbnail ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>تأكيد التعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="إغلاق"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Form Body + Sticky Footer */}
              <form onSubmit={handleSaveTutorial} className="flex-1 flex flex-col overflow-hidden">
                <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
                  {formError && (
                    <div
                      id="tutorial-form-error-alert"
                      className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* 1. حقل إلزامي: عنوان الفيديو */}
                  <div className="space-y-1.5">
                    <label className="block text-xs sm:text-sm font-black text-slate-800 flex items-center justify-between">
                      <span>
                        عنوان الفيديو <span className="text-rose-600 font-black">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">حقل إلزامي</span>
                    </label>
                    <input
                      type="text"
                      id="tutorial-form-title-input"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="مثال: شرح كيفية إضافة منخرط جديد واستخراج بطاقة الانخراط"
                      required
                      className="w-full px-4 py-3 rounded-2xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs sm:text-sm font-bold text-slate-900 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  {/* 2. طريقة إضافة الفيديو: رابط أو رفع من المعرض */}
                  <div className="space-y-2">
                    <label className="block text-xs sm:text-sm font-black text-slate-800">
                      طريقة إضافة الفيديو <span className="text-rose-600 font-black">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormSourceType('url')}
                        className={`p-3.5 rounded-2xl border-2 font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                          formSourceType === 'url'
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-xs'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        <LinkIcon className={`w-5 h-5 ${formSourceType === 'url' ? 'text-indigo-600' : 'text-slate-500'}`} />
                        <span>عبر رابط الفيديو (يوتيوب أو رابط مباشر)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormSourceType('upload')}
                        className={`p-3.5 rounded-2xl border-2 font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                          formSourceType === 'upload'
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-xs'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        <UploadCloud className={`w-5 h-5 ${formSourceType === 'upload' ? 'text-indigo-600' : 'text-slate-500'}`} />
                        <span>رفع من معرض الهاتف أو الجهاز</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. محتوى المصدر المختار */}
                  {formSourceType === 'url' ? (
                    <div className="space-y-1.5 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100">
                      <label className="block text-xs font-bold text-slate-700">
                        رابط الفيديو (URL) <span className="text-rose-600 font-black">*</span>
                      </label>
                      <input
                        type="url"
                        id="tutorial-form-url-input"
                        value={formVideoUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVideoUrl(val);
                          if (isUrlYouTubeShorts(val)) {
                            setFormAspectRatio('portrait');
                            setDetectedNotice('✨ تم اكتشاف رابط YouTube Shorts عمودي (Shorts 9:16).');
                          }
                        }}
                        placeholder="https://www.youtube.com/shorts/... أو https://www.youtube.com/watch?v=... أو رابط مباشر .mp4"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono text-slate-800 ltr"
                      />
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        يدعم روابط يوتيوب (YouTube)، شورتس (Shorts 9:16)، فيميو (Vimeo)، أو أي رابط فيديو مباشر بصيغة MP4/WebM.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100">
                      <label className="block text-xs font-bold text-slate-700">
                        ملف الفيديو من الهاتف أو الجهاز <span className="text-rose-600 font-black">*</span>
                      </label>
                      
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="video/*"
                        onChange={handleFileSelected}
                        className="hidden"
                      />

                      <div
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        className={`p-6 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 cursor-pointer text-center ${
                          isUploading
                            ? 'border-indigo-400 bg-indigo-50/80 cursor-wait'
                            : formVideoUrl
                            ? 'border-emerald-400 bg-emerald-50/40'
                            : 'border-slate-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/20'
                        }`}
                      >
                        {isUploading ? (
                          <div className="w-full space-y-2">
                            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                            <p className="text-xs font-bold text-indigo-900">
                              جاري رفع الفيديو إلى التخزين الدائم... ({uploadProgress}%)
                            </p>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden max-w-xs mx-auto">
                              <div
                                className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        ) : formVideoUrl ? (
                          <div className="space-y-1">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                            <p className="text-xs font-bold text-emerald-900">
                              تم تجهيز الفيديو بنجاح!
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {formOriginalFilename || 'video-file.mp4'}
                            </p>
                            <span className="text-[10px] text-indigo-600 font-bold underline block pt-1">
                              اضغط لتغيير الملف أو اختيار فيديو آخر
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <UploadCloud className="w-8 h-8 text-indigo-600 mx-auto" />
                            <p className="text-xs font-bold text-slate-800">
                              اضغط هنا لاختيار فيديو من معرض هاتفك أو حاسوبك
                            </p>
                            <p className="text-[11px] text-slate-400">
                              يدعم الفيديوهات المصورة عمودياً بالهاتف (Shorts 9:16) أو الأفقية (16:9) بصيغ MP4, MOV, WebM
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3b. حقل صورة غلاف الفيديو (رفع ملف أو إدخال رابط) */}
                  <div className="space-y-2.5 p-4 rounded-2xl bg-indigo-50/30 border border-indigo-200/80">
                    <label className="block text-xs sm:text-sm font-black text-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        <span>صورة غلاف الفيديو (رفع صورة أو رابط غلاف)</span>
                      </span>
                      <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100/80 px-2 py-0.5 rounded-full">
                        {thumbnailPreviewUrl || formThumbnailUrl ? 'تم تحديد صورة غلاف مخصصة ✓' : 'اختياري (يُستخدم الغلاف الافتراضي عند الترك)'}
                      </span>
                    </label>

                    <input
                      type="file"
                      id="tutorial-form-thumbnail-input"
                      ref={thumbnailInputRef}
                      accept="image/*"
                      onChange={handleThumbnailSelected}
                      className="hidden"
                    />

                    {/* Direct URL input for cover image */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600">
                        رابط صورة الغلاف (اختياري - أو ارفع صورة من جهازك أدناه):
                      </label>
                      <input
                        type="text"
                        id="tutorial-form-thumbnail-url-input"
                        value={formThumbnailUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormThumbnailUrl(val);
                          setThumbnailPreviewUrl(val);
                        }}
                        placeholder="/api/images/... أو https://..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono text-slate-800 ltr"
                      />
                    </div>

                    {thumbnailPreviewUrl || formThumbnailUrl ? (
                      <div className="space-y-3 bg-white p-3.5 rounded-2xl border border-indigo-200 shadow-xs">
                        <div className="relative w-full aspect-video max-h-48 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center group/thumb">
                          <img
                            id="tutorial-form-thumbnail-preview"
                            src={thumbnailPreviewUrl || formThumbnailUrl}
                            alt="معاينة صورة غلاف الفيديو"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />
                          <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-emerald-600/95 text-white text-[10px] font-black flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>معاينة غلاف الفيديو قبل الحفظ</span>
                          </div>
                          {isUploadingThumbnail && (
                            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                              <span className="text-xs font-bold">جاري حفظ صورة الغلاف بشكل دائم...</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="text-[11px] text-slate-600 font-medium truncate max-w-[220px]">
                            {thumbnailFilename ? (
                              <span className="font-mono text-slate-700">{thumbnailFilename}</span>
                            ) : (
                              <span>صورة غلاف مرفوعة ومعتمدة</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              id="change-tutorial-thumbnail-btn"
                              disabled={isUploadingThumbnail}
                              onClick={() => thumbnailInputRef.current?.click()}
                              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>تغيير / استبدال الغلاف</span>
                            </button>

                            <button
                              type="button"
                              id="remove-tutorial-thumbnail-btn"
                              disabled={isUploadingThumbnail}
                              onClick={handleRemoveThumbnail}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>إزالة الغلاف</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        id="tutorial-form-thumbnail-dropzone"
                        onClick={() => !isUploadingThumbnail && thumbnailInputRef.current?.click()}
                        className={`p-4 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center ${
                          isUploadingThumbnail
                            ? 'border-indigo-400 bg-indigo-50/80 cursor-wait'
                            : 'border-indigo-200 hover:border-indigo-500 bg-white hover:bg-indigo-50/40'
                        }`}
                      >
                        {isUploadingThumbnail ? (
                          <div className="space-y-1.5">
                            <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
                            <p className="text-xs font-bold text-indigo-900">جاري رفع ومعاينة صورة الغلاف...</p>
                          </div>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-800">
                                اضغط هنا لاختيار صورة غلاف الفيديو من جهازك ومعاينتها قبل الحفظ
                              </p>
                              <p className="text-[11px] text-slate-500">
                                تظهر هذه الصورة كغلاف للفيديو قبل تشغيله (يدعم PNG, JPG, WEBP).
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4. تنسيق وأبعاد العرض (Orientation & Aspect Ratio) */}
                  <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-black text-slate-800 flex items-center justify-between">
                      <span>تنسيق وأبعاد العرض على الشاشات</span>
                      <span className="text-[10px] text-slate-500">مخصص للهواتف والحواسيب</span>
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setFormAspectRatio('auto')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          formAspectRatio === 'auto'
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>تلقائي (اكتشاف ذكي)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormAspectRatio('portrait')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          formAspectRatio === 'portrait'
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>عمودي للهاتف (Shorts 9:16)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormAspectRatio('landscape')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          formAspectRatio === 'landscape'
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>شاشة عريضة (16:9)</span>
                      </button>
                    </div>

                    {detectedNotice && (
                      <p className="text-[11px] text-emerald-700 font-bold pt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{detectedNotice}</span>
                      </p>
                    )}
                  </div>

                  {/* 5. وصف أو ملاحظات الفيديو (اختياري) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      وصف الفيديو ومحاوره (اختياري)
                    </label>
                    <textarea
                      id="tutorial-form-description-input"
                      rows={3}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="اكتب نبذة موجزة عما يتضمنه هذا الفيديو التعليمي لمساعدة المشاهدين..."
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm text-slate-900 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  {/* 6. مدة الفيديو التقريبية (اختياري) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      مدة الفيديو التقريبية (اختياري)
                    </label>
                    <input
                      type="text"
                      id="tutorial-form-duration-input"
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                      placeholder="مثال: 01:30"
                      className="w-full max-w-xs px-4 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono text-slate-800"
                    />
                  </div>
                </div>

                {/* Sticky Modal Footer Actions */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                  <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                    بعد الضغط على «تأكيد التعديل»، اضغط على زر «حفظ التعديلات» في واجهة القسم لتأكيد الحفظ النهائي
                  </div>
                  <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      disabled={isSaving || isUploading || isUploadingThumbnail}
                      className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      id="save-tutorial-submit-btn"
                      disabled={isSaving || isUploading || isUploadingThumbnail}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSaving || isUploadingThumbnail ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>تأكيد التعديل</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingTutorial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-900">
                  تأكيد حذف فيديو الشرح
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف فيديو «<span className="font-bold text-slate-900">{deletingTutorial.title}</span>» بشكل نهائي؟
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingTutorial(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  id="confirm-delete-tutorial-btn"
                  onClick={confirmDeleteTutorial}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تأكيد الحذف النهائي</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Save Bar for Mobile & Desktop */}
      {canManageVideos && (
        <div
          id="sticky-bottom-save-tutorials-bar"
          className={
            isMainPortalSection
              ? 'w-full bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-indigo-500/40 flex flex-col sm:flex-row items-center justify-between gap-3'
              : 'fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-3xl z-40 bg-slate-900/95 backdrop-blur-md text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-indigo-500/40 flex flex-col sm:flex-row items-center justify-between gap-3'
          }
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-center sm:text-right">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                hasPendingChanges ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
              }`}
            />
            <span>
              {hasPendingChanges
                ? 'لديك تعديلات مؤكدة جاهزة للحفظ النهائي في قاعدة البيانات'
                : lastVerifiedAt
                ? 'جميع تعديلات وفيديوهات القسم محفوظة ومؤكدة في قاعدة البيانات ✓'
                : 'إدارة وتخصيص الفيديوهات — اضغط «حفظ التعديلات» لحفظ كافة التغييرات بشكل دائم'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <button
              type="button"
              id="sticky-bottom-save-tutorials-btn"
              onClick={handleSaveAllModifications}
              disabled={isSavingAll || isLoading}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                hasPendingChanges
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white ring-2 ring-emerald-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isSavingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري حفظ التعديلات...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
