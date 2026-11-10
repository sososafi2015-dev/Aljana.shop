import React, { useState } from 'react';
import { Play, ExternalLink, AlertCircle, Video, Film, CheckCircle2 } from 'lucide-react';

export type VideoPlatform = 'youtube' | 'vimeo' | 'direct' | 'other' | 'none';

export interface ParsedVideoInfo {
  isValid: boolean;
  platform: VideoPlatform;
  embedUrl?: string;
  directUrl?: string;
  videoId?: string;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Parses any video URL (YouTube standard, YouTube Shorts, youtu.be, Vimeo, direct MP4/WebM/OGG)
 * and returns clean embed info, video ID, and poster thumbnail.
 */
export function parseVideoUrl(rawUrl?: string): ParsedVideoInfo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, platform: 'none' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isValid: false, platform: 'none' };
  }

  // 1. YouTube Shorts: https://www.youtube.com/shorts/VIDEO_ID or https://youtu.be/shorts/VIDEO_ID
  const youtubeShortsRegex = /(?:youtube\.com\/shorts\/|youtu\.be\/shorts\/)([a-zA-Z0-9_-]{11})/i;
  const shortsMatch = trimmed.match(youtubeShortsRegex);
  if (shortsMatch && shortsMatch[1]) {
    const videoId = shortsMatch[1];
    return {
      isValid: true,
      platform: 'youtube',
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  // 2. YouTube Standard: watch?v=VIDEO_ID
  const youtubeWatchRegex = /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/i;
  const watchMatch = trimmed.match(youtubeWatchRegex);
  if (watchMatch && watchMatch[1]) {
    const videoId = watchMatch[1];
    return {
      isValid: true,
      platform: 'youtube',
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  // 3. YouTube Short Link: https://youtu.be/VIDEO_ID
  const youtubeYoutuBeRegex = /youtu\.be\/([a-zA-Z0-9_-]{11})/i;
  const youtuBeMatch = trimmed.match(youtubeYoutuBeRegex);
  if (youtuBeMatch && youtuBeMatch[1]) {
    const videoId = youtuBeMatch[1];
    return {
      isValid: true,
      platform: 'youtube',
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  // 4. YouTube Embed Link: https://www.youtube.com/embed/VIDEO_ID
  const youtubeEmbedRegex = /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i;
  const embedMatch = trimmed.match(youtubeEmbedRegex);
  if (embedMatch && embedMatch[1]) {
    const videoId = embedMatch[1];
    return {
      isValid: true,
      platform: 'youtube',
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  // 5. YouTube Live Link: https://www.youtube.com/live/VIDEO_ID
  const youtubeLiveRegex = /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i;
  const liveMatch = trimmed.match(youtubeLiveRegex);
  if (liveMatch && liveMatch[1]) {
    const videoId = liveMatch[1];
    return {
      isValid: true,
      platform: 'youtube',
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  // 6. Vimeo: https://vimeo.com/VIDEO_ID or player.vimeo.com/video/VIDEO_ID
  const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i;
  const vimeoMatch = trimmed.match(vimeoRegex);
  if (vimeoMatch && vimeoMatch[1]) {
    const videoId = vimeoMatch[1];
    return {
      isValid: true,
      platform: 'vimeo',
      videoId,
      embedUrl: `https://player.vimeo.com/video/${videoId}?badge=0&autopause=0&player_id=0`,
    };
  }

  // 7. Direct video file (.mp4, .webm, .ogg, .mov, data:video/, server /api/videos/ routes)
  const isDirectVideo =
    /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(trimmed) ||
    /^data:video\//i.test(trimmed) ||
    /^blob:/i.test(trimmed) ||
    trimmed.startsWith('/api/videos/') ||
    trimmed.startsWith('/uploads/videos/') ||
    trimmed.includes('/api/videos/stream/') ||
    trimmed.includes('/api/videos/');

  if (isDirectVideo) {
    // Generate permanent thumbnail URL if it's a server stream endpoint
    let thumbUrl: string | undefined = undefined;
    if (trimmed.includes('/api/videos/stream/')) {
      thumbUrl = trimmed.replace('/api/videos/stream/', '/api/videos/thumbnail/');
    }

    return {
      isValid: true,
      platform: 'direct',
      directUrl: trimmed,
      embedUrl: trimmed,
      thumbnailUrl: thumbUrl,
    };
  }

  // 8. General URL check (could be other embeds or custom video hosting)
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return {
        isValid: true,
        platform: 'other',
        embedUrl: trimmed,
      };
    }
  } catch {
    // Not a valid URL
  }

  return {
    isValid: false,
    platform: 'none',
    error: 'رابط الفيديو غير صالح أو غير مدعوم',
  };
}

/**
 * Validates a video URL for form submission
 */
export function validateVideoUrl(url?: string): { isValid: boolean; error?: string; platform?: VideoPlatform } {
  if (!url || !url.trim()) {
    return { isValid: true, platform: 'none' }; // Empty is allowed because video is optional
  }
  const info = parseVideoUrl(url);
  if (!info.isValid) {
    return {
      isValid: false,
      error: 'يرجى إدخال رابط فيديو صالح (YouTube, YouTube Shorts, Vimeo, أو ملف MP4 مباشر)',
      platform: 'none',
    };
  }
  return {
    isValid: true,
    platform: info.platform,
  };
}

export interface VideoPlayerProps {
  url?: string;
  title?: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  aspectRatio?: 'video' | 'square' | 'auto';
  showPlatformBadge?: boolean;
  lazy?: boolean; // When true, shows thumbnail + play button first, streams only on user click!
  durationFormatted?: string;
  fileSizeFormatted?: string;
  resolution?: string;
}

/**
 * High-performance, responsive video player component supporting YouTube, Shorts, Vimeo, and Direct Video
 * With Lazy Loading and CDN streaming support to ensure 0 lag and bandwidth savings.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  title = 'فيديو النشاط الخيري',
  poster,
  className = '',
  autoPlay = false,
  muted = false,
  aspectRatio = 'video',
  showPlatformBadge = true,
  lazy = false,
  durationFormatted,
  fileSizeFormatted,
  resolution,
}) => {
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(!lazy);
  const info = parseVideoUrl(url);

  if (!url || !info.isValid) {
    return null;
  }

  const aspectClass =
    aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : '';

  const getPlatformLabel = () => {
    if (info.platform === 'youtube') return 'YouTube';
    if (info.platform === 'vimeo') return 'Vimeo';
    if (info.platform === 'direct') return 'فيديو مباشر';
    return 'فيديو';
  };

  const displayPoster = poster || info.thumbnailUrl;

  if (loadError) {
    return (
      <div
        className={`w-full ${aspectClass} rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-6 text-center text-white ${className}`}
      >
        <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
        <p className="text-xs sm:text-sm font-bold">تعذر تشغيل الفيديو في الوقت الحالي</p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
          قد يكون هناك انقطاع مؤقت في الاتصال أو أن تنسيق البث يحتاج لإعادة المحاولة
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => {
              setLoadError(false);
              setRetryCount((prev) => prev + 1);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <span>🔄 إعادة المحاولة</span>
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>مشاهدة في تبويب جديد</span>
          </a>
        </div>
      </div>
    );
  }

  // Lazy Thumbnail Mode - User must click to start streaming!
  if (lazy && !isPlaying) {
    return (
      <div
        className={`relative w-full ${aspectClass} overflow-hidden rounded-xl bg-slate-950 group cursor-pointer ${className}`}
        onClick={() => setIsPlaying(true)}
      >
        {displayPoster ? (
          <img
            src={displayPoster}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-black flex items-center justify-center">
            <Film className="w-12 h-12 text-slate-700" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40 group-hover:bg-black/50 transition-colors" />

        {/* Center Play Button with ripple */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-600 group-hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-900/40 group-hover:scale-110 transition-all duration-300">
            <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current translate-x-0.5" />
          </div>
          <div className="space-y-1">
            <span className="text-xs sm:text-sm font-bold text-white drop-shadow-md">
              اضغط لتشغيل الفيديو
            </span>
            {(durationFormatted || fileSizeFormatted || resolution) && (
              <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] text-slate-300">
                {durationFormatted && (
                  <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs">
                    ⏱️ {durationFormatted}
                  </span>
                )}
                {fileSizeFormatted && (
                  <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs">
                    📦 {fileSizeFormatted}
                  </span>
                )}
                {resolution && (
                  <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs font-mono">
                    {resolution}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Platform badge */}
        {showPlatformBadge && (
          <div className="absolute top-2.5 right-2.5 rtl:right-auto rtl:left-2.5 z-10 pointer-events-none">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/75 text-white backdrop-blur-xs flex items-center gap-1 shadow-xs">
              {info.platform === 'youtube' && <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />}
              {info.platform === 'vimeo' && <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />}
              {info.platform === 'direct' && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />}
              <span>{getPlatformLabel()}</span>
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-full ${aspectClass} overflow-hidden rounded-xl bg-black group ${className}`}>
      {/* Platform badge */}
      {showPlatformBadge && (
        <div className="absolute top-2.5 right-2.5 rtl:right-auto rtl:left-2.5 z-10 pointer-events-none">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/75 text-white backdrop-blur-xs flex items-center gap-1 shadow-xs">
            {info.platform === 'youtube' && <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />}
            {info.platform === 'vimeo' && <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />}
            {info.platform === 'direct' && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />}
            <span>{getPlatformLabel()}</span>
          </span>
        </div>
      )}

      {/* Direct Video File (HTML5 video) */}
      {info.platform === 'direct' && info.directUrl ? (
        <video
          key={`vid-player-${info.directUrl}-${retryCount}`}
          controls
          playsInline
          preload="metadata"
          autoPlay={autoPlay}
          muted={muted}
          poster={poster || info.thumbnailUrl}
          className="w-full h-full object-cover"
          onError={() => setLoadError(true)}
        >
          <source src={info.directUrl} />
          متصفحك لا يدعم تشغيل هذا الفيديو مباشرة.
        </video>
      ) : info.embedUrl ? (
        /* YouTube / Vimeo / Iframe Embed */
        <iframe
          src={`${info.embedUrl}${autoPlay ? (info.embedUrl.includes('?') ? '&autoplay=1' : '?autoplay=1') : ''}`}
          title={title}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          onError={() => setLoadError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>مشاهدة الفيديو</span>
          </a>
        </div>
      )}
    </div>
  );
};

/**
 * Extracts and unifies all valid video URLs from an activity item
 */
export function getActivityVideoUrls(activity?: { videoUrl?: string; videoUrls?: string[]; videoMetadata?: { cdnUrl?: string } } | null): string[] {
  if (!activity) return [];
  const urls: string[] = [];
  if (Array.isArray(activity.videoUrls)) {
    for (const u of activity.videoUrls) {
      if (typeof u === 'string' && u.trim() && !urls.includes(u.trim()) && !u.includes('dQw4w9WgXcQ')) {
        urls.push(u.trim());
      }
    }
  }
  if (activity.videoUrl && typeof activity.videoUrl === 'string' && activity.videoUrl.trim()) {
    const trimmed = activity.videoUrl.trim();
    if (!urls.includes(trimmed) && !trimmed.includes('dQw4w9WgXcQ')) {
      urls.unshift(trimmed);
    }
  }
  if (activity.videoMetadata?.cdnUrl && typeof activity.videoMetadata.cdnUrl === 'string' && activity.videoMetadata.cdnUrl.trim()) {
    const trimmed = activity.videoMetadata.cdnUrl.trim();
    if (!urls.includes(trimmed) && !trimmed.includes('dQw4w9WgXcQ')) {
      urls.push(trimmed);
    }
  }
  return urls;
}
