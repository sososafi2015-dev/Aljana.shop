import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  Monitor, 
  Sparkles, 
  HelpCircle, 
  Eye,
  Camera,
  Layers,
  Building,
  Sliders,
  Minus,
  Plus,
  Sun,
  Moon,
  Contrast,
  ShieldCheck
} from 'lucide-react';
import { AssociationSettings, Language } from '../types';
import { translations } from '../translations';
import { initialSettings } from '../initialData';
import { ensurePermanentImageUrl } from '../api/imageApi';

interface ManageBrandingProps {
  settings: AssociationSettings;
  onUpdateSettings: (settings: AssociationSettings) => Promise<boolean | void> | boolean | void;
  lang: Language;
  onLogAudit: (action: 'update' | 'delete', description: string) => void;
  onOpenMediaModal?: (media: { title: string; url: string; type: 'image' | 'video' | 'document'; description?: string }) => void;
}

/**
 * Resizes and compresses an image client-side to ensure:
 * 1. Safe localStorage persistence (keeps file under 300KB Base64)
 * 2. Instant phone upload & preview support across iPhone/Android/Desktop
 * 3. Prevention of browser memory bloat while preserving sharp visual quality
 */
const compressImageFile = (
  file: File, 
  maxWidth: number, 
  maxHeight: number, 
  quality: number = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return reject(new Error('الملف المختار ليس صورة صالحة (JPG, PNG, WebP)'));
    }

    // Validate raw file size (under 15MB before compression)
    if (file.size > 15 * 1024 * 1024) {
      return reject(new Error('حجم ملف الصورة كبير جدًا (أقصى حد مسموح 15 ميجابايت)'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserved dimensions
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
          return reject(new Error('تعذر معالجة بيانات الصورة على هذا الجهاز'));
        }

        // High quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to webp or jpeg
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

export const ManageBranding: React.FC<ManageBrandingProps> = ({
  settings,
  onUpdateSettings,
  lang,
  onLogAudit,
  onOpenMediaModal,
}) => {
  const t = translations[lang];

  // Working state for branding images
  const [currentLogo, setCurrentLogo] = useState<string>(settings.logoUrl || '');
  const [currentBanner, setCurrentBanner] = useState<string>(settings.bannerImageUrl || '');

  // Banner dark overlay state (0 to 100 percentage)
  const [bannerDarkness, setBannerDarkness] = useState<number>(
    settings.bannerDarknessOverlay !== undefined ? settings.bannerDarknessOverlay : 40
  );

  // Previews / dirty state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  useEffect(() => {
    setCurrentLogo(settings.logoUrl || '');
    setCurrentBanner(settings.bannerImageUrl || '');
    setBannerDarkness(settings.bannerDarknessOverlay !== undefined ? settings.bannerDarknessOverlay : 40);
  }, [settings.logoUrl, settings.bannerImageUrl, settings.bannerDarknessOverlay]);

  // Status & Feedback
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [isProcessingBanner, setIsProcessingBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Hidden file inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const displayLogo = logoPreview !== null ? logoPreview : currentLogo;
  const displayBanner = bannerPreview !== null ? bannerPreview : currentBanner;

  const hasUnsavedChanges = 
    (logoPreview !== null && logoPreview !== (settings.logoUrl || '')) ||
    (bannerPreview !== null && bannerPreview !== (settings.bannerImageUrl || '')) ||
    (bannerDarkness !== (settings.bannerDarknessOverlay !== undefined ? settings.bannerDarknessOverlay : 40));

  // Handler for uploading new Logo
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsProcessingLogo(true);

    try {
      // Compress logo to max 500x500 square / clean asset
      const compressedData = await compressImageFile(file, 500, 500, 0.85);
      // Immediately convert to permanent Firebase Storage / server image URL
      const permanentUrl = await ensurePermanentImageUrl(compressedData, {
        category: 'logos',
        fileName: file.name || 'logo.jpg',
      });
      setLogoPreview(permanentUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء معالجة صورة الشعار');
    } finally {
      setIsProcessingLogo(false);
      // Reset input value so same file can be re-selected if desired
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  // Handler for uploading new Banner
  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsProcessingBanner(true);

    try {
      // Compress banner to max 1400x700 landscape banner
      const compressedData = await compressImageFile(file, 1400, 700, 0.82);
      // Immediately convert to permanent Firebase Storage / server image URL
      const permanentUrl = await ensurePermanentImageUrl(compressedData, {
        category: 'banners',
        fileName: file.name || 'banner.jpg',
      });
      setBannerPreview(permanentUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء معالجة صورة البانر');
    } finally {
      setIsProcessingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  // Delete / Remove logo
  const handleDeleteLogo = () => {
    setLogoPreview('');
  };

  // Delete / Remove banner
  const handleDeleteBanner = () => {
    setBannerPreview('');
  };

  // Reset to initial default template images
  const handleResetDefaultLogo = () => {
    setLogoPreview(initialSettings.logoUrl || '');
  };

  const handleResetDefaultBanner = () => {
    setBannerPreview(initialSettings.bannerImageUrl || '');
    setBannerDarkness(initialSettings.bannerDarknessOverlay ?? 40);
  };

  // Helper description & status for banner darkness tiers
  const getDarknessTier = (val: number) => {
    if (val === 0) return { label: '0% (بدون لون داكن)', badge: 'bg-slate-100 text-slate-800 border-slate-300', desc: 'الصورة الأصلية طبيعية بالكامل بدون أي طبقة تعتيم' };
    if (val <= 25) return { label: `${val}% (تعتيم خفيف)`, badge: 'bg-sky-50 text-sky-800 border-sky-300', desc: 'تعتيم رقيق يحافظ على إشراق ألوان الصورة مع تباين جيد' };
    if (val <= 50) return { label: `${val}% (تعتيم متوسط موصى به)`, badge: 'bg-emerald-50 text-emerald-800 border-emerald-300', desc: 'توازن مثالي بين وضوح معالم الصورة وسهولة قراءة النصوص والأزرار' };
    if (val <= 75) return { label: `${val}% (تعتيم قوي)`, badge: 'bg-indigo-50 text-indigo-800 border-indigo-300', desc: 'تعتيم مركز يبرز النصوص الرسمية وعناوين الجمعية بهيبة وفخامة' };
    return { label: `${val}% (تعتيم كامل)`, badge: 'bg-slate-900 text-white border-slate-700', desc: 'تعتيم عميق يعطي أقصى درجات التركيز على نصوص البانر' };
  };

  // Quick save specifically for banner darkness
  const handleQuickSaveDarkness = async () => {
    const finalLogo = logoPreview !== null ? logoPreview : currentLogo;
    const finalBanner = bannerPreview !== null ? bannerPreview : currentBanner;

    const updatedSettings: AssociationSettings = {
      ...settings,
      logoUrl: finalLogo || undefined,
      bannerImageUrl: finalBanner || undefined,
      bannerDarknessOverlay: bannerDarkness,
    };

    const ok = await onUpdateSettings(updatedSettings);
    if (ok === false) {
      setErrorMessage('تعذر حفظ التعديلات على الخادم، يرجى المحاولة مجدداً.');
      return;
    }
    onLogAudit(
      'update',
      `تحديث درجة اللون الداكن لصورة البانر إلى ${bannerDarkness}%`
    );
    setSuccessMessage(`تم حفظ وتطبيق درجة اللون الداكن لصورة البانر (${bannerDarkness}%) في واجهة المتجر بنجاح!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Save all branding changes permanently
  const handleSave = async () => {
    setErrorMessage(null);
    let finalLogo = logoPreview !== null ? logoPreview : currentLogo;
    let finalBanner = bannerPreview !== null ? bannerPreview : currentBanner;

    if (finalLogo && finalLogo.startsWith('data:')) {
      finalLogo = await ensurePermanentImageUrl(finalLogo, {
        category: 'logos',
        fileName: 'logo.jpg',
      });
    }
    if (finalBanner && finalBanner.startsWith('data:')) {
      finalBanner = await ensurePermanentImageUrl(finalBanner, {
        category: 'banners',
        fileName: 'banner.jpg',
      });
    }

    const updatedSettings: AssociationSettings = {
      ...settings,
      logoUrl: finalLogo || undefined,
      bannerImageUrl: finalBanner || undefined,
      bannerDarknessOverlay: bannerDarkness,
      heroBadgeText: '',
      heroBadgeTextFr: '',
      heroBadgeTextEn: '',
    };

    const ok = await onUpdateSettings(updatedSettings);
    if (ok === false) {
      setErrorMessage('تعذر حفظ الهوية البصرية على الخادم، يرجى المحاولة مجدداً.');
      return;
    }
    setCurrentLogo(finalLogo);
    setCurrentBanner(finalBanner);
    setLogoPreview(null);
    setBannerPreview(null);

    onLogAudit(
      'update',
      `تحديث الهوية البصرية للجمعية (شعار التطبيق، غلاف البانر، ودرجة اللون الداكن: ${bannerDarkness}%)`
    );

    setSuccessMessage(t.brandingSavedSuccess || 'تم حفظ وتحديث شعار التطبيق وصورة الغلاف بنجاح وبشكل دائم!');
    setTimeout(() => setSuccessMessage(null), 4500);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>الهوية البصرية والمظهر</span>
          </div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            {t.manageBrandingTitle || 'إدارة شعار التطبيق وصورة الغلاف الرئيسية'}
          </h3>
          <p className="text-xs text-slate-500 max-w-2xl">
            {t.manageBrandingDesc || 'رفع وتغيير شعار الجمعية وصورة غلاف البانر الرئيسية مباشرة من الهاتف مع المعاينة الفورية والحفظ الدائم.'}
          </p>
        </div>

        {/* Global Save Button */}
        <div>
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges && !successMessage}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/30 scale-102 ring-2 ring-emerald-400/50 cursor-pointer animate-pulse'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.saveBrandingChanges || 'حفظ الشعار والغلاف في النظام'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center gap-3 text-xs sm:text-sm font-bold shadow-xs"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center gap-3 text-xs sm:text-sm font-bold shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </motion.div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleLogoFileChange}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleBannerFileChange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* =========================================================================
            SECTION 1: APP LOGO MANAGEMENT
           ========================================================================= */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                  عنصر 1 من 2
                </span>
                <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-700" />
                  <span>{t.appLogoTitle || 'شعار التطبيق الرسمي'}</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {t.appLogoSubtitle || 'يظهر في القائمة العلوية، الفوتر، بطاقات العضوية، ووصولات الأداء الرسمية.'}
                </p>
              </div>

              {logoPreview !== null && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  معاينة غير محفوظة
                </span>
              )}
            </div>

            {/* Logo Preview Stage */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden group">
              {displayLogo ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white border-2 border-emerald-200 p-2 shadow-md flex items-center justify-center overflow-hidden">
                    <img
                      src={displayLogo}
                      alt="App Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">شعار الجمعية النشط</span>
                    {onOpenMediaModal && (
                      <button
                        type="button"
                        onClick={() => onOpenMediaModal({ title: 'معاينة الشعار بحجم كامل', url: displayLogo, type: 'image' })}
                        className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-bold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>تكبير</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <p className="text-xs font-bold text-slate-500">
                    {t.noImageUploaded || 'لم يتم رفع شعار مخصص بعد'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    سيتم استخدام أيقونة الجمعية الافتراضية كبديل
                  </p>
                </div>
              )}

              {isProcessingLogo && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <span className="text-xs font-bold text-emerald-800">جاري معالجة الصورة من الهاتف...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Live Context Demo: How it appears in Navbar */}
            <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5">
              <span className="text-[10px] text-slate-400 font-mono block">محاكاة الظهور في القائمة العلوية:</span>
              <div className="flex items-center gap-2.5">
                {displayLogo ? (
                  <div className="w-8 h-8 rounded-lg bg-white p-0.5 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={displayLogo} alt="Mini Logo" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    ش
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold leading-tight">{settings.name}</div>
                  <div className="text-[9px] text-emerald-400">{settings.tagline}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons for Logo */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                <Camera className="w-4 h-4" />
                <span>{displayLogo ? (t.changeImage || 'تغيير الشعار من الهاتف') : (t.uploadFromDevice || 'رفع شعار من الهاتف')}</span>
              </button>

              {displayLogo && (
                <button
                  type="button"
                  onClick={handleDeleteLogo}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t.deleteImage || 'حذف الشعار'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <button
                type="button"
                onClick={handleResetDefaultLogo}
                className="text-slate-500 hover:text-slate-800 flex items-center gap-1 underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t.resetToDefaultImage || 'استعادة الشعار الأصلي'}</span>
              </button>
              <span>PNG / JPG / WebP</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECTION 2: HOMEPAGE BANNER COVER MANAGEMENT
           ========================================================================= */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                  عنصر 2 من 2
                </span>
                <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  <span>{t.bannerImageTitle || 'غلاف البانر الرئيسي (الواجهة الرئيسية)'}</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {t.bannerImageSubtitle || 'الصورة البارزة أعلى الصفحة الرئيسية التي ترحب بالزوار والمنخرطين.'}
                </p>
              </div>

              {bannerPreview !== null && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  معاينة غير محفوظة
                </span>
              )}
            </div>

            {/* Banner Preview Stage with Live Darkness Overlay */}
            <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden group">
              {displayBanner ? (
                <div className="w-full h-48 sm:h-56 rounded-xl overflow-hidden relative shadow-sm border border-slate-200 bg-slate-900">
                  <img
                    src={displayBanner}
                    alt="Banner Cover"
                    className="w-full h-full object-cover"
                  />
                  {/* Dynamic Dark Overlay (0% - 100%) */}
                  <div 
                    className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-150"
                    style={{ opacity: bannerDarkness / 100 }}
                  />

                  {/* Real-time Text Legibility Preview over the darkened banner */}
                  <div className="absolute inset-0 p-3 sm:p-4 flex flex-col justify-end pointer-events-none z-5">
                    <div className="space-y-1 max-w-sm sm:max-w-md">
                      <h5 className="text-white font-black text-sm sm:text-base leading-tight drop-shadow-md">
                        {settings.name}
                      </h5>
                      <p className="text-[11px] text-slate-100 line-clamp-1 font-medium drop-shadow-xs">
                        {settings.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Clean floating live badge with current darkness */}
                  <div className="absolute top-2.5 right-2.5 rtl:right-auto rtl:left-2.5 flex items-center gap-1.5 z-10">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-950/85 text-white border border-white/20 shadow-xs backdrop-blur-xs flex items-center gap-1.5">
                      <span 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: bannerDarkness === 0 ? '#94a3b8' : bannerDarkness < 40 ? '#34d399' : bannerDarkness < 75 ? '#10b981' : '#059669' }}
                      />
                      <span>تعتيم البانر: {bannerDarkness}%</span>
                    </span>
                  </div>

                  {onOpenMediaModal && (
                    <button
                      type="button"
                      onClick={() => onOpenMediaModal({ title: 'معاينة صورة الغلاف كاملة', url: displayBanner, type: 'image' })}
                      className="absolute top-2.5 left-2.5 rtl:left-auto rtl:right-2.5 p-1.5 px-2.5 rounded-lg bg-black/70 hover:bg-black/85 text-white transition-colors text-xs flex items-center gap-1 font-bold shadow-xs cursor-pointer z-10"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>تكبير</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <p className="text-xs font-bold text-slate-500">
                    {t.noImageUploaded || 'لم يتم رفع صورة غلاف مخصصة بعد'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    سيتم استخدام التدرج اللوني الزمردي الأنيق بدون صورة خلفية
                  </p>
                </div>
              )}

              {isProcessingBanner && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-20">
                  <div className="text-center space-y-2">
                    <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <span className="text-xs font-bold text-emerald-800">جاري معالجة ورفع صورة الغلاف من الهاتف...</span>
                  </div>
                </div>
              )}
            </div>

            {/* =========================================================================
                BANNER DARK OVERLAY CONTROL (درجة اللون الداكن لصورة البانر)
               ========================================================================= */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Contrast className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                      <span>درجة اللون الداكن لصورة البانر</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {bannerDarkness}%
                      </span>
                    </h5>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      تحكم تدريجي دقيق في مستوى تعتيم الخلفية الداكنة (Overlay) فوق صورة البانر في واجهة المتجر.
                    </p>
                  </div>
                </div>

                {/* Status Tier Badge */}
                <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold border self-start sm:self-center shrink-0 ${getDarknessTier(bannerDarkness).badge}`}>
                  {getDarknessTier(bannerDarkness).label}
                </div>
              </div>

              {/* Slider & Step Controls */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                  <span className="flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>0% (بدون لون داكن)</span>
                  </span>
                  <span className="text-emerald-400 font-mono text-sm">{bannerDarkness}%</span>
                  <span className="flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>100% (تعتيم كامل)</span>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Step Minus Button */}
                  <button
                    type="button"
                    onClick={() => setBannerDarkness(prev => Math.max(0, prev - 5))}
                    disabled={bannerDarkness <= 0}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-white transition-all shrink-0 cursor-pointer"
                    title="خفض درجة التعتيم 5%"
                    aria-label="خفض درجة التعتيم"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  {/* Range Slider */}
                  <div className="relative flex-1 py-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={bannerDarkness}
                      onChange={(e) => setBannerDarkness(Number(e.target.value))}
                      className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-emerald-500 bg-gradient-to-r from-slate-200 via-slate-600 to-black border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      aria-label="درجة اللون الداكن لصورة البانر"
                    />
                  </div>

                  {/* Step Plus Button */}
                  <button
                    type="button"
                    onClick={() => setBannerDarkness(prev => Math.min(100, prev + 5))}
                    disabled={bannerDarkness >= 100}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-white transition-all shrink-0 cursor-pointer"
                    title="زيادة درجة التعتيم 5%"
                    aria-label="زيادة درجة التعتيم"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Level Tier Meaning */}
                <p className="text-[11px] text-slate-400">
                  💡 {getDarknessTier(bannerDarkness).desc}
                </p>
              </div>

              {/* Quick Presets Buttons (0%, 25%, 50%, 75%, 100%) */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-300 block">
                  خيارات التعتيم السريعة:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { value: 0, label: '0%', desc: 'بدون تعتيم' },
                    { value: 25, label: '25%', desc: 'تعتيم خفيف' },
                    { value: 50, label: '50%', desc: 'تعتيم متوسط' },
                    { value: 75, label: '75%', desc: 'تعتيم قوي' },
                    { value: 100, label: '100%', desc: 'تعتيم كامل' },
                  ].map((preset) => {
                    const isSelected = bannerDarkness === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setBannerDarkness(preset.value)}
                        className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-400/40 shadow-sm font-black scale-102'
                            : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700 font-medium'
                        }`}
                      >
                        <span className="text-xs block font-bold">{preset.label}</span>
                        <span className="text-[10px] block opacity-80 leading-tight">{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Save & Default Action Footer */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setBannerDarkness(40)}
                  className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>استعادة التعتيم الافتراضي الموصى به (40%)</span>
                </button>

                {bannerDarkness !== (settings.bannerDarknessOverlay !== undefined ? settings.bannerDarknessOverlay : 40) && (
                  <button
                    type="button"
                    onClick={handleQuickSaveDarkness}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>حفظ درجة التعتيم الآن</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Context Demo: Mobile view note */}
            <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs">
              <Smartphone className="w-4 h-4 text-emerald-700 flex-shrink-0" />
              <span>
                متوافق تمامًا مع شاشات الهواتف الذكية (Android / iOS) ويتم ضبط أبعاد الغلاف تلقائيًا مع الحفاظ على جودة الصورة الأصلية.
              </span>
            </div>
          </div>

          {/* Action Buttons for Banner */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                <Camera className="w-4 h-4" />
                <span>{displayBanner ? (t.changeImage || 'تغيير صورة البانر من الهاتف') : (t.uploadFromDevice || 'رفع غلاف من الهاتف')}</span>
              </button>

              {displayBanner && (
                <button
                  type="button"
                  onClick={handleDeleteBanner}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t.deleteImage || 'حذف الغلاف'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <button
                type="button"
                onClick={handleResetDefaultBanner}
                className="text-slate-500 hover:text-slate-800 flex items-center gap-1 underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t.resetToDefaultImage || 'استعادة الغلاف الأصلي'}</span>
              </button>
              <span>أبعاد مثالية: 16:9 أو 21:9</span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety & Permanent Storage Notice */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
        <HelpCircle className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900">
            تأكيد الأمان والتخزين الدائم (Persistent Offline & Cloud Readiness):
          </p>
          <p className="leading-relaxed">
            {t.imageUploadHelp || 'الصور المرفوعة يتم ضغطها ذكيًا وتخزينها بأمان في قاعدة البيانات المحلية المشفرة ونظام الإعدادات، مما يضمن بقائها محفوظة عند تحديث الصفحة أو إغلاق التطبيق أو تسجيل الخروج دون أن تختفي.'}
          </p>
        </div>
      </div>
    </div>
  );
};
