import React, { useState, useEffect } from 'react';
import { HeartHandshake, ArrowLeft, CheckCircle2, Sparkles, ChevronLeft } from 'lucide-react';
import { DEFAULT_DONATIONS_COVER_IMAGE } from '../portalSettingsStorage';

interface DonationTeaserSectionProps {
  onOpenDonationsPage: () => void;
  customTitle?: string;
  customDescription?: string;
  coverImage?: string;
  coverOverlayOpacity?: number; // 0 to 100
}

export const DonationTeaserSection: React.FC<DonationTeaserSectionProps> = ({
  onOpenDonationsPage,
  customTitle,
  customDescription,
  coverImage,
  coverOverlayOpacity,
}) => {
  const title = customTitle || 'تبرع وشارك في مشاريع التنمية';
  const description =
    customDescription ||
    'ساهم وشارك في الخير. تبرع وساهم في دعم مشاريع الجمعيات ومبادراتها الخيرية والتنموية، وكن جزءًا من صناعة أثر إيجابي في المجتمع.';

  const targetImage = coverImage?.trim() || DEFAULT_DONATIONS_COVER_IMAGE;
  const [currentImgSrc, setCurrentImgSrc] = useState<string>(targetImage);

  // Synchronize image whenever prop updates
  useEffect(() => {
    setCurrentImgSrc(targetImage);
  }, [targetImage]);

  const opacityPercent =
    typeof coverOverlayOpacity === 'number'
      ? Math.max(0, Math.min(100, coverOverlayOpacity))
      : 80;
  const overlayAlpha = opacityPercent / 100;

  return (
    <section
      id="donations-and-projects-teaser-section"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12"
      aria-label="قسم تبرع وشارك في مشاريع التنمية"
    >
      <div
        id="donation-teaser-banner"
        onClick={onOpenDonationsPage}
        className="relative rounded-3xl overflow-hidden shadow-xl border border-emerald-900/30 bg-slate-950 text-white cursor-pointer group transition-all duration-300 hover:shadow-2xl hover:border-emerald-500/50 min-h-[380px] lg:min-h-[420px] flex flex-col justify-center"
      >
        {/* Ambient Background Image with Configurable Dark Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={currentImgSrc}
            alt="التبرع والمساهمة في مشاريع الجمعيات التنموية"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center scale-100 group-hover:scale-105 transition-transform duration-700"
          />
          {/* Dark Gradient Overlay for Maximum Text Contrast and Visual Clarity */}
          <div
            className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
            style={{
              background: `linear-gradient(to right, rgba(2, 44, 34, ${Math.min(0.98, overlayAlpha * 1.05)}), rgba(4, 47, 46, ${overlayAlpha * 0.85}), rgba(2, 6, 23, ${overlayAlpha * 0.65}))`,
            }}
          />
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -top-20 w-80 h-80 bg-teal-400/15 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Content Container - Optimized for Responsive Balance on Desktop, Tablet & Mobile */}
        <div className="relative z-10 p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6 lg:gap-10">
          <div className="max-w-3xl space-y-4">
            {/* Category / Initiative Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black shadow-sm backdrop-blur-md">
              <HeartHandshake className="w-4 h-4 text-emerald-300" />
              <span>مبادرات النفع العام • حملات التبرع والمشاريع التنموية</span>
            </div>

            {/* Section Title */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
              {title}
            </h2>

            {/* Section Description */}
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl font-medium">
              {description}
            </p>

            {/* Key Quality Assurances */}
            <div className="pt-2 flex items-center flex-wrap gap-4 sm:gap-6 text-xs sm:text-sm text-emerald-200">
              <div className="flex items-center gap-2 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/20 backdrop-blur-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تحويل مباشر لحسابات ومشاريع الجمعيات</span>
              </div>
              <div className="flex items-center gap-2 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/20 backdrop-blur-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>شفافية رقمية وتوثيق ميداني معتمد</span>
              </div>
              <div className="flex items-center gap-2 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/20 backdrop-blur-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>فرز ذكي حسب دولتك ومدينتك</span>
              </div>
            </div>
          </div>

          {/* Call-to-action Button Box */}
          <div className="w-full md:w-auto shrink-0 flex flex-col items-stretch md:items-center gap-3">
            <button
              type="button"
              id="btn-explore-donations-page"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDonationsPage();
              }}
              className="p-1.5 sm:p-2 bg-[#009b3a] hover:bg-[#008833] rounded-full shadow-xl shadow-black/40 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group/btn cursor-pointer active:scale-95"
            >
              <div className="px-6 sm:px-8 py-3.5 sm:py-4 bg-[#ff6b00] hover:bg-[#f06400] rounded-full flex items-center justify-center gap-3 text-white text-sm sm:text-base font-black transition-all">
                <span>استكشف الجمعيات وتبرع الآن</span>
                <ArrowLeft className="w-5 h-5 text-white group-hover/btn:-translate-x-1.5 transition-transform" />
              </div>
            </button>
            <span className="text-[11px] text-slate-300 text-center font-medium">
              انقر للانتقال إلى واجهة الجمعيات والمشاريع التنموية
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DonationTeaserSection;
