import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Sparkles,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { Language } from '../types';

export interface GalleryImageItem {
  url: string;
  title?: string;
  description?: string;
}

interface ActivityImageGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: (string | GalleryImageItem)[];
  initialIndex?: number;
  activityTitle?: string;
  activityDescription?: string;
  lang?: Language;
}

export const ActivityImageGalleryModal: React.FC<ActivityImageGalleryModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  activityTitle = 'توثيق النشاط الميداني',
  activityDescription,
  lang = 'ar',
}) => {
  // Normalize images array to uniform objects
  const normalizedImages = React.useMemo(() => {
    return images
      .filter(Boolean)
      .map((item, idx) => {
        if (typeof item === 'string') {
          return {
            url: item,
            title: `${activityTitle} - صورة ${idx + 1}`,
            description: activityDescription,
          };
        }
        return {
          url: item.url,
          title: item.title || `${activityTitle} - صورة ${idx + 1}`,
          description: item.description || activityDescription,
        };
      })
      .filter((img) => img.url && img.url.trim().length > 0);
  }, [images, activityTitle, activityDescription]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialIndex >= 0 && initialIndex < images.length) {
      return initialIndex;
    }
    return 0;
  });

  const [direction, setDirection] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false);

  // Sync index if initialIndex or image list changes
  useEffect(() => {
    if (isOpen) {
      const validIndex = Math.min(Math.max(0, initialIndex), Math.max(0, normalizedImages.length - 1));
      setCurrentIndex(validIndex);
      setDirection(0);
      setZoomLevel(1);
      setRotation(0);
      setIsImageLoaded(false);
    }
  }, [isOpen, initialIndex, normalizedImages.length]);

  // Reset zoom & rotation when current index changes
  useEffect(() => {
    setZoomLevel(1);
    setRotation(0);
    setIsImageLoaded(false);
  }, [currentIndex]);

  const total = normalizedImages.length;
  const currentImage = normalizedImages[currentIndex] || null;

  // Navigation handlers
  // Note: in RTL: Next image is logical forward (index + 1).
  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const handleGoToIndex = useCallback((idx: number) => {
    if (idx === currentIndex) return;
    setDirection(idx > currentIndex ? 1 : -1);
    setCurrentIndex(idx);
  }, [currentIndex]);

  // Touch Swipe Gesture Management
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const touchEndYRef = useRef<number | null>(null);

  const minSwipeDistance = 45; // minimum horizontal pixels required for a swipe

  const handleTouchStart = (e: React.TouchEvent) => {
    // If zoomed in, allow standard panning instead of swipe navigation
    if (zoomLevel > 1) return;
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchEndXRef.current = touch.clientX;
    touchEndYRef.current = touch.clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (zoomLevel > 1 || touchStartXRef.current === null) return;
    const touch = e.touches[0];
    touchEndXRef.current = touch.clientX;
    touchEndYRef.current = touch.clientY;
  };

  const handleTouchEnd = () => {
    if (zoomLevel > 1 || touchStartXRef.current === null || touchEndXRef.current === null) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      touchEndXRef.current = null;
      touchEndYRef.current = null;
      return;
    }

    const deltaX = touchEndXRef.current - touchStartXRef.current;
    const deltaY = (touchEndYRef.current || 0) - (touchStartYRef.current || 0);

    // Only trigger if horizontal swipe is significantly stronger than vertical scroll
    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      // Swipe Left (deltaX < 0): Next image
      // Swipe Right (deltaX > 0): Previous image
      // Note: User prompt requirement:
      // "السحب من اليمين إلى اليسار -> الصورة الموالية (Swipe Left = Next)"
      // "السحب من اليسار إلى اليمين -> الصورة السابقة (Swipe Right = Previous)"
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }

    // Reset touch coordinates
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchEndXRef.current = null;
    touchEndYRef.current = null;
  };

  // Keyboard navigation & Esc to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        // In Arabic RTL layout, ArrowRight or ArrowLeft can be intuitive:
        // ArrowRight: next in LTR, but in Arabic RTL we also provide standard navigation
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Lock body scroll when gallery modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Preload adjacent images for ultra-smooth transitions without UI freezing
  useEffect(() => {
    if (total <= 1) return;
    const nextIdx = (currentIndex + 1) % total;
    const prevIdx = (currentIndex - 1 + total) % total;

    if (normalizedImages[nextIdx]?.url) {
      const imgNext = new Image();
      imgNext.src = normalizedImages[nextIdx].url;
    }
    if (normalizedImages[prevIdx]?.url) {
      const imgPrev = new Image();
      imgPrev.src = normalizedImages[prevIdx].url;
    }
  }, [currentIndex, normalizedImages, total]);

  if (!isOpen || total === 0 || !currentImage) return null;

  const isRTL = lang === 'ar';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl text-white select-none overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
      id="activity-image-gallery-modal"
    >
      {/* 1. Header Toolbar */}
      <header className="relative z-20 flex items-center justify-between px-3 sm:px-6 py-3 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md">
        {/* Left/Start: Title and Counter Badge */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-white truncate max-w-[200px] sm:max-w-md">
                {activityTitle}
              </h3>
              {/* Image Counter (e.g. 3 / 12) */}
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold shrink-0">
                {currentIndex + 1} / {total}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[220px] sm:max-w-lg hidden xs:block">
              {currentImage.title || (isRTL ? 'معرض توثيق الأنشطة الميدانية' : 'Field Activity Photo Gallery')}
            </p>
          </div>
        </div>

        {/* Right/End: Controls & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Zoom controls */}
          <button
            type="button"
            onClick={() => setZoomLevel((z) => (z >= 2.5 ? 1 : z + 0.5))}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={zoomLevel > 1 ? (isRTL ? 'إعادة ضبط الحجم' : 'Reset Zoom') : (isRTL ? 'تكبير الصورة' : 'Zoom In')}
          >
            {zoomLevel > 1 ? <ZoomOut className="w-4 h-4 text-emerald-400" /> : <ZoomIn className="w-4 h-4" />}
          </button>

          {/* Rotate control */}
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer hidden sm:flex"
            title={isRTL ? 'تدوير الصورة' : 'Rotate'}
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Download Original */}
          <a
            href={currentImage.url}
            download={`activity_image_${currentIndex + 1}.jpg`}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
            title={isRTL ? 'تحميل الصورة الأصلية' : 'Download Photo'}
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">{isRTL ? 'تحميل' : 'Download'}</span>
          </a>

          {/* Open in new tab */}
          <a
            href={currentImage.url}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer hidden sm:flex"
            title={isRTL ? 'فتح الصورة في نافذة جديدة' : 'Open in New Tab'}
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Close button (Explicit & prominent) */}
          <button
            type="button"
            id="close-activity-image-gallery"
            onClick={onClose}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer ml-1 rtl:ml-0 rtl:mr-1"
            title={isRTL ? 'إغلاق عارض الصور (Esc)' : 'Close Gallery (Esc)'}
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">{isRTL ? 'إغلاق' : 'Close'}</span>
          </button>
        </div>
      </header>

      {/* 2. Main Stage (Viewport + Touch Swipe Area + Navigation Arrows) */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden bg-black/60 p-2 sm:p-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation Arrow: Previous Image */}
        {total > 1 && (
          <button
            type="button"
            id="gallery-prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute z-30 start-3 sm:start-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-emerald-600 border border-white/20 hover:border-emerald-500 text-white flex items-center justify-center transition-all shadow-xl backdrop-blur-md cursor-pointer active:scale-95 group focus:outline-hidden"
            aria-label={isRTL ? 'الصورة السابقة' : 'Previous image'}
            title={isRTL ? 'الصورة السابقة (السهم الأيمن)' : 'Previous photo'}
          >
            {isRTL ? (
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" />
            ) : (
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" />
            )}
          </button>
        )}

        {/* Navigation Arrow: Next Image */}
        {total > 1 && (
          <button
            type="button"
            id="gallery-next-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute z-30 end-3 sm:end-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-emerald-600 border border-white/20 hover:border-emerald-500 text-white flex items-center justify-center transition-all shadow-xl backdrop-blur-md cursor-pointer active:scale-95 group focus:outline-hidden"
            aria-label={isRTL ? 'الصورة الموالية' : 'Next image'}
            title={isRTL ? 'الصورة الموالية (السهم الأيسر)' : 'Next photo'}
          >
            {isRTL ? (
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" />
            ) : (
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" />
            )}
          </button>
        )}

        {/* Animated Image Container */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={currentIndex}
              initial={{
                opacity: 0,
                x: direction > 0 ? (isRTL ? -40 : 40) : direction < 0 ? (isRTL ? 40 : -40) : 0,
                scale: 0.98,
              }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                x: direction > 0 ? (isRTL ? 40 : -40) : direction < 0 ? (isRTL ? -40 : 40) : 0,
                scale: 0.98,
              }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative max-w-full max-h-full flex items-center justify-center"
            >
              {/* Spinner while loading */}
              {!isImageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              )}

              <img
                src={currentImage.url}
                alt={currentImage.title || `Photo ${currentIndex + 1}`}
                onLoad={() => setIsImageLoaded(true)}
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transition: 'transform 0.25s ease-out',
                }}
                className={`max-w-[92vw] max-h-[72vh] sm:max-h-[75vh] object-contain rounded-xl shadow-2xl transition-opacity duration-300 ${
                  isImageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onError={(e) => {
                  setIsImageLoaded(true);
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80';
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile Swipe Hint Pill (Fade out or unobtrusive) */}
        {total > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none sm:hidden">
            <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] text-slate-300 border border-white/10 shadow-md flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{isRTL ? 'مرر بإصبعك للتنقل بين الصور' : 'Swipe to navigate photos'}</span>
            </span>
          </div>
        )}
      </div>

      {/* 3. Bottom Thumbnail Strip & Indicator */}
      {total > 1 && (
        <footer className="relative z-20 px-4 py-2.5 bg-slate-900/95 border-t border-slate-800/80 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Scannable Thumbnails Strip */}
          <div className="w-full sm:max-w-2xl overflow-x-auto flex items-center justify-center sm:justify-start gap-2 py-1 scrollbar-thin scrollbar-thumb-slate-700">
            {normalizedImages.map((img, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleGoToIndex(idx)}
                  className={`relative shrink-0 w-12 h-10 sm:w-14 sm:h-11 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/40 scale-105 shadow-md'
                      : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                  }`}
                  title={`${isRTL ? 'صورة' : 'Photo'} ${idx + 1}`}
                >
                  <img
                    src={img.url}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-0.5 right-0.5 text-[9px] font-mono font-bold bg-black/75 text-white px-1 rounded-xs">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Direct indicator e.g. 2 ← 3 → 4 */}
          <div className="flex items-center gap-3 text-xs font-mono font-bold text-slate-400 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
              {currentIndex > 0 ? `${currentIndex}` : `${total}`}
              {' ← '}
              <span className="text-emerald-400 font-bold underline decoration-emerald-500 underline-offset-4">
                {currentIndex + 1}
              </span>
              {' → '}
              {currentIndex + 2 <= total ? `${currentIndex + 2}` : '1'}
            </span>
          </div>
        </footer>
      )}
    </div>
  );
};
