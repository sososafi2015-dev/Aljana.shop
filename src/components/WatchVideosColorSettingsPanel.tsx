import React, { useState, useEffect, useRef } from 'react';
import {
  Palette,
  Save,
  RotateCcw,
  Video,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Monitor,
  Smartphone,
  Image as ImageIcon,
  UploadCloud,
  Sparkles,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { WatchVideosSectionColorSettings } from '../types';
import {
  DEFAULT_WATCH_VIDEOS_COLORS,
  getPortalSettings,
  fetchPortalSettings,
  saveWatchVideosSectionColors,
  resetWatchVideosSectionColors,
  PORTAL_SETTINGS_EVENT,
} from '../portalSettingsStorage';
import { uploadImageToServer, ensurePermanentImageUrl } from '../api/imageApi';

/**
 * Converts a 6-digit or 3-digit HEX color to an rgba() string safely.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '').replace('#', '').trim();
  let r = 2;
  let g = 44;
  let b = 34;

  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  }

  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha.toFixed(2)})`;
}

/**
 * Normalizes a hex string for `<input type="color">` which requires strict `#rrggbb`.
 */
function normalizeHexForPicker(value: string, fallback: string): string {
  const clean = (value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean.toLowerCase()}`;
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`.toLowerCase();
  }
  return fallback;
}

interface ColorFieldControlProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  defaultValue: string;
  onChange: (newHex: string) => void;
}

const ColorFieldControl: React.FC<ColorFieldControlProps> = ({
  id,
  label,
  description,
  value,
  defaultValue,
  onChange,
}) => {
  const [textValue, setTextValue] = useState(value || defaultValue);

  useEffect(() => {
    setTextValue(value || defaultValue);
  }, [value, defaultValue]);

  const handleManualHexChange = (raw: string) => {
    let formatted = raw.trim();
    if (formatted && !formatted.startsWith('#')) {
      formatted = `#${formatted}`;
    }
    setTextValue(formatted);

    if (/^#[0-9a-fA-F]{6}$/.test(formatted)) {
      onChange(formatted.toLowerCase());
    } else if (/^#[0-9a-fA-F]{3}$/.test(formatted)) {
      const expanded = `#${formatted[1]}${formatted[1]}${formatted[2]}${formatted[2]}${formatted[3]}${formatted[3]}`.toLowerCase();
      onChange(expanded);
    }
  };

  const handleBlur = () => {
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(textValue.trim())) {
      setTextValue(value || defaultValue);
    }
  };

  const pickerVal = normalizeHexForPicker(value, defaultValue);
  const isModified = pickerVal.toLowerCase() !== defaultValue.toLowerCase();

  return (
    <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/90 hover:border-emerald-300 transition-all space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <label htmlFor={id} className="block text-xs sm:text-sm font-black text-slate-800">
            {label}
          </label>
          {description && (
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">{description}</p>
          )}
        </div>
        {isModified && (
          <button
            type="button"
            onClick={() => {
              onChange(defaultValue);
              setTextValue(defaultValue);
            }}
            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer shrink-0"
            title="استعادة اللون الافتراضي لهذا العنصر"
          >
            افتراضي
          </button>
        )}
      </div>

      <div className="flex items-center gap-2.5 pt-1">
        {/* Visual Color Picker */}
        <label
          htmlFor={`${id}-picker`}
          className="relative w-11 h-10 rounded-xl border-2 border-white shadow-md cursor-pointer overflow-hidden shrink-0 ring-1 ring-slate-300 hover:ring-emerald-500 transition-all"
          style={{ backgroundColor: pickerVal }}
          title="اختر اللون من لوحة الألوان"
        >
          <input
            id={`${id}-picker`}
            type="color"
            value={pickerVal}
            onChange={(e) => {
              const newColor = e.target.value.toLowerCase();
              setTextValue(newColor);
              onChange(newColor);
            }}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          />
        </label>

        {/* Manual HEX Input */}
        <div className="relative flex-1">
          <input
            id={id}
            type="text"
            dir="ltr"
            maxLength={7}
            value={textValue}
            onChange={(e) => handleManualHexChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={defaultValue}
            aria-label={`رمز اللون HEX لـ ${label}`}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-xs sm:text-sm font-mono font-bold text-slate-800 uppercase tracking-wider outline-none transition-all"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
            HEX
          </span>
        </div>
      </div>
    </div>
  );
};

interface WatchVideosColorSettingsPanelProps {
  addToast?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  onPendingChangesChange?: (hasPending: boolean) => void;
  onColorsChange?: (colors: WatchVideosSectionColorSettings) => void;
}

export const WatchVideosColorSettingsPanel: React.FC<WatchVideosColorSettingsPanelProps> = ({
  addToast,
  onPendingChangesChange,
  onColorsChange,
}) => {
  const [colors, setColors] = useState<WatchVideosSectionColorSettings>(() => {
    const initial = getPortalSettings();
    return {
      ...DEFAULT_WATCH_VIDEOS_COLORS,
      ...(initial.watchVideosColors || {}),
    };
  });

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isUploadingCover, setIsUploadingCover] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const latestColorsRef = useRef<WatchVideosSectionColorSettings>(colors);
  const hasUnsavedChangesRef = useRef<boolean>(false);
  const isSavingRef = useRef<boolean>(false);

  // Sync with database on mount and when portal settings update externally (only when not actively editing)
  useEffect(() => {
    let mounted = true;
    fetchPortalSettings()
      .then((fresh) => {
        if (mounted && fresh.watchVideosColors && !hasUnsavedChangesRef.current && !isSavingRef.current) {
          const next = {
            ...DEFAULT_WATCH_VIDEOS_COLORS,
            ...fresh.watchVideosColors,
          };
          latestColorsRef.current = next;
          setColors(next);
          onColorsChange?.(next);
        }
      })
      .catch(console.warn);

    const handleSettingsEvent = (e: any) => {
      if (!mounted || hasUnsavedChangesRef.current || isSavingRef.current) return;
      const updated = e?.detail;
      if (updated && updated.watchVideosColors) {
        const next = {
          ...DEFAULT_WATCH_VIDEOS_COLORS,
          ...updated.watchVideosColors,
        };
        latestColorsRef.current = next;
        setColors(next);
        onColorsChange?.(next);
      }
    };

    window.addEventListener(PORTAL_SETTINGS_EVENT, handleSettingsEvent);
    return () => {
      mounted = false;
      window.removeEventListener(PORTAL_SETTINGS_EVENT, handleSettingsEvent);
    };
  }, []);

  const updateColorField = <K extends keyof WatchVideosSectionColorSettings>(
    key: K,
    value: WatchVideosSectionColorSettings[K]
  ) => {
    const next: WatchVideosSectionColorSettings = {
      ...latestColorsRef.current,
      [key]: value,
    };
    latestColorsRef.current = next;
    setColors(next);
    hasUnsavedChangesRef.current = true;
    setHasUnsavedChanges(true);
    setStatusMessage(null);
    onPendingChangesChange?.(true);
    onColorsChange?.(next);
  };

  // Handle uploading cover image from device file manager
  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      const msg = 'يرجى اختيار ملف صورة صالح لغلاف القسم (JPG, PNG, WebP).';
      setStatusMessage({ type: 'error', text: msg });
      if (addToast) addToast('error', msg);
      return;
    }

    setIsUploadingCover(true);
    setStatusMessage(null);
    try {
      let uploadedUrl = '';
      try {
        uploadedUrl = await uploadImageToServer(file);
      } catch {
        uploadedUrl = await ensurePermanentImageUrl(file, {
          category: 'portal_watch_videos_covers',
        });
      }
      updateColorField('coverImageUrl', uploadedUrl);
      if (addToast) {
        addToast('success', 'تم رفع صورة غلاف القسم بنجاح. اضغط «حفظ التغييرات» لتثبيتها.');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'فشل رفع صورة الغلاف، يرجى المحاولة مجدداً.';
      setStatusMessage({ type: 'error', text: errMsg });
      if (addToast) addToast('error', errMsg);
    } finally {
      setIsUploadingCover(false);
      if (e.target) e.target.value = '';
    }
  };

  // Save changes permanently to backend database & Firestore
  const handleSaveColors = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const toSave = {
        ...DEFAULT_WATCH_VIDEOS_COLORS,
        ...latestColorsRef.current,
      };
      const verified = await saveWatchVideosSectionColors(toSave);
      const savedColors = {
        ...DEFAULT_WATCH_VIDEOS_COLORS,
        ...(verified.watchVideosColors || toSave),
      };
      latestColorsRef.current = savedColors;
      hasUnsavedChangesRef.current = false;
      setColors(savedColors);
      setHasUnsavedChanges(false);
      onPendingChangesChange?.(false);
      onColorsChange?.(savedColors);

      const successMsg =
        'تم حفظ ألوان وإعدادات قسم «شاهد شرح بالفيديو كيفية استخدام المنصة» في قاعدة البيانات الدائمة وتطبيقها على الواجهة الرئيسية بنجاح.';
      setStatusMessage({ type: 'success', text: successMsg });
      if (addToast) addToast('success', successMsg);
    } catch (err: any) {
      const errMsg = err?.message || 'تعذر حفظ إعدادات الألوان في قاعدة البيانات.';
      setStatusMessage({ type: 'error', text: errMsg });
      if (addToast) addToast('error', errMsg);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  // Also listen to section-wide save triggers so clicking ANY "حفظ التعديلات" button in the section saves colors too
  useEffect(() => {
    const handleExternalSaveTrigger = () => {
      if (hasUnsavedChangesRef.current && !isSavingRef.current) {
        handleSaveColors();
      }
    };
    const handleForceSaveColors = () => {
      if (!isSavingRef.current) {
        handleSaveColors();
      }
    };
    window.addEventListener('trigger-save-all-tutorials', handleExternalSaveTrigger);
    window.addEventListener('save-watch-videos-colors-now', handleForceSaveColors);
    return () => {
      window.removeEventListener('trigger-save-all-tutorials', handleExternalSaveTrigger);
      window.removeEventListener('save-watch-videos-colors-now', handleForceSaveColors);
    };
  }, []);

  // Restore default colors and save permanently to database
  const handleResetDefaultColors = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsResetting(true);
    setStatusMessage(null);
    try {
      const defaults = { ...DEFAULT_WATCH_VIDEOS_COLORS };
      latestColorsRef.current = defaults;
      setColors(defaults);
      const verified = await resetWatchVideosSectionColors();
      const resetColors = {
        ...DEFAULT_WATCH_VIDEOS_COLORS,
        ...(verified.watchVideosColors || defaults),
      };
      latestColorsRef.current = resetColors;
      hasUnsavedChangesRef.current = false;
      setColors(resetColors);
      setHasUnsavedChanges(false);
      onPendingChangesChange?.(false);
      onColorsChange?.(resetColors);

      const resetMsg =
        'تمت استعادة الألوان الافتراضية المعتمدة لقسم «شاهد شرح بالفيديو كيفية استخدام المنصة» وحفظها في قاعدة البيانات الدائمة.';
      setStatusMessage({ type: 'success', text: resetMsg });
      if (addToast) addToast('info', resetMsg);
    } catch (err: any) {
      const errMsg = err?.message || 'تعذر استعادة الألوان الافتراضية.';
      setStatusMessage({ type: 'error', text: errMsg });
      if (addToast) addToast('error', errMsg);
    } finally {
      isSavingRef.current = false;
      setIsResetting(false);
    }
  };

  const overlayAlpha = Math.max(0, Math.min(100, Number(colors.coverOverlayOpacity ?? 88))) / 100;

  return (
    <div
      id="watch-videos-color-settings-panel"
      className="bg-white rounded-3xl border-2 border-emerald-200/90 shadow-md overflow-hidden"
    >
      {/* Top Panel Header */}
      <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-[#022c22] via-emerald-900 to-[#064e3b] text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#ff6b00] text-white flex items-center justify-center shadow-lg shrink-0">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white">
                إعدادات ألوان ومظهر قسم «شاهد شرح بالفيديو كيفية استخدام المنصة»
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-300/30 text-emerald-100 text-[11px] font-bold">
                مرتبط بقاعدة البيانات الدائمة
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              تحكم كامل في ألوان عنوان القسم، بطاقة العرض، صورة الغلاف، النصوص، وزر «مشاهدة الفيديوهات» في الواجهة الرئيسية للمنصة مع معاينة مباشرة.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            id="btn-reset-watch-videos-colors-top"
            onClick={handleResetDefaultColors}
            disabled={isSaving || isResetting}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            <span>استعادة الألوان الافتراضية</span>
          </button>

          <button
            type="button"
            id="btn-save-watch-videos-colors-top"
            onClick={handleSaveColors}
            disabled={isSaving || isResetting}
            className={`px-4 py-2 rounded-xl text-white text-xs font-black flex items-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
              hasUnsavedChanges
                ? 'bg-[#ff6b00] hover:bg-[#e66000] ring-2 ring-orange-200 animate-pulse'
                : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التغييرات</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title={isExpanded ? 'طي لوحة إعدادات الألوان' : 'فتح لوحة إعدادات الألوان'}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`mx-5 mt-4 p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-black px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="p-5 sm:p-6 space-y-8">
          {/* ================= 1. LIVE INTERACTIVE PREVIEW (معاينة مباشرة) ================= */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm sm:text-base font-black text-slate-900">
                  معاينة مباشرة للقسم بالألوان المختارة قبل الحفظ
                </h4>
                {hasUnsavedChanges && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-black">
                    تعديلات غير محفوظة بعد
                  </span>
                )}
              </div>

              {/* Device Viewport Switcher (Desktop vs Mobile) */}
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    previewDevice === 'desktop'
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>معاينة الكمبيوتر</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    previewDevice === 'mobile'
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>معاينة الهاتف</span>
                </button>
              </div>
            </div>

            {/* Live Preview Container representing the surrounding outer section area */}
            <div
              id="watch-videos-live-preview-wrapper"
              className="rounded-3xl p-4 sm:p-6 border border-slate-200/80 transition-colors duration-300"
              style={{ backgroundColor: colors.outerSectionBgColor }}
            >
              <div
                className={`mx-auto transition-all duration-300 ${
                  previewDevice === 'mobile' ? 'max-w-[380px]' : 'w-full'
                }`}
              >
                <div
                  className="relative rounded-3xl overflow-hidden shadow-xl transition-all duration-300 min-h-[240px] flex flex-col justify-center"
                  style={{
                    backgroundColor: colors.cardBgColor,
                    borderColor: colors.cardBorderColor,
                    borderWidth: '2px',
                    borderStyle: 'solid',
                  }}
                >
                  {/* Cover Image + Dynamic Color Overlay */}
                  <div className="absolute inset-0 z-0">
                    {colors.coverImageUrl && (
                      <img
                        src={colors.coverImageUrl}
                        alt="معاينة غلاف القسم"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-center opacity-35"
                      />
                    )}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `linear-gradient(to right, ${hexToRgba(
                          colors.cardBgColor,
                          Math.min(1, overlayAlpha + 0.06)
                        )}, ${hexToRgba(
                          colors.cardSecondaryBgColor,
                          overlayAlpha
                        )}, ${hexToRgba(
                          colors.cardBgColor,
                          Math.max(0.4, overlayAlpha - 0.06)
                        )})`,
                      }}
                    />
                  </div>

                  {/* Preview Content */}
                  <div
                    className={`relative z-10 p-5 sm:p-8 flex ${
                      previewDevice === 'mobile'
                        ? 'flex-col items-stretch gap-5'
                        : 'flex-col md:flex-row md:items-center justify-between gap-6'
                    }`}
                  >
                    <div
                      className={`flex ${
                        previewDevice === 'mobile'
                          ? 'flex-col items-start gap-4'
                          : 'flex-col sm:flex-row items-start sm:items-center gap-5'
                      } max-w-3xl`}
                    >
                      {/* Video Icon Box */}
                      <div
                        className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl border border-white/25"
                        style={{
                          backgroundColor: colors.iconBoxBgColor,
                          color: colors.iconColor,
                        }}
                      >
                        <Video
                          className="w-8 h-8 sm:w-10 sm:h-10"
                          style={{ color: colors.iconColor }}
                        />
                        <span
                          className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-md"
                          style={{
                            backgroundColor: colors.interactiveAccentColor,
                            borderColor: colors.cardBgColor,
                          }}
                        >
                          <Play
                            className="w-3 h-3 translate-x-0.5"
                            style={{
                              fill: colors.buttonTextColor,
                              color: colors.buttonTextColor,
                            }}
                          />
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {/* Subtitle Kicker / Badge */}
                        <div
                          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/15 text-xs font-black backdrop-blur-md"
                          style={{
                            backgroundColor: colors.badgeBgColor,
                            color: colors.badgeTextColor,
                          }}
                        >
                          <Play
                            className="w-3.5 h-3.5"
                            style={{
                              fill: colors.interactiveAccentColor,
                              color: colors.interactiveAccentColor,
                            }}
                          />
                          <span>دليل الاستخدام المرئي خطوة بخطوة</span>
                        </div>

                        {/* Section Main Title with Configurable Title Background Color */}
                        <div>
                          <h2
                            className={`${
                              previewDevice === 'mobile'
                                ? 'text-xl'
                                : 'text-2xl sm:text-3xl'
                            } font-black tracking-tight leading-tight inline-block px-3.5 py-1.5 rounded-2xl transition-colors`}
                            style={{
                              backgroundColor: colors.titleBgColor,
                              color: colors.mainTitleColor,
                            }}
                          >
                            شاهد شرح بالفيديو كيفية استخدام المنصة
                          </h2>
                        </div>

                        {/* Section Description / Subtitle */}
                        <p
                          className="text-xs sm:text-sm leading-relaxed max-w-2xl font-medium"
                          style={{ color: colors.subtitleColor }}
                        >
                          استعرض الفيديوهات التوضيحية المصورة التي تشرح طريقة استخدام المنصة وإنشاء حساب جمعيتك والاستفادة من جميع خدماتها الرقمية بسهولة.
                        </p>
                      </div>
                    </div>

                    {/* Watch Videos Button */}
                    <div
                      className={`${
                        previewDevice === 'mobile' ? 'w-full' : 'w-full md:w-auto'
                      } shrink-0 flex flex-col items-stretch md:items-center gap-2`}
                    >
                      <div
                        className="keep-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-full shadow-xl shadow-red-950/40 flex items-center justify-center gap-2.5 text-sm sm:text-base font-black border-2 border-white/25 transition-all"
                        style={{
                          backgroundColor: colors.buttonBgColor || '#dc2626',
                          color: colors.buttonTextColor || '#ffffff',
                        }}
                      >
                        <Play
                          className="w-5 h-5"
                          style={{
                            fill: colors.buttonTextColor || '#ffffff',
                            color: colors.buttonTextColor || '#ffffff',
                          }}
                        />
                        <span className="keep-white" style={{ color: colors.buttonTextColor || '#ffffff' }}>
                          مشاهدة الفيديوهات
                        </span>
                      </div>
                      <span
                        className="text-[11px] text-center font-medium"
                        style={{ color: colors.helperTextColor }}
                      >
                        اضغط لفتح قائمة الفيديوهات ومشاهدتها
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= 2. COLOR PICKER & HEX CONTROLS GROUPS ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Group 1: لون خلفية عنوان القسم والشارة العلوية */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                  1
                </span>
                <div>
                  <h5 className="text-sm font-black text-slate-900">
                    خلفية عنوان القسم والشارة التعريفية
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    التحكم في لون خلفية عنوان القسم الرئيسي وشارة التعريف العلوية
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <ColorFieldControl
                  id="color-title-bg"
                  label="لون خلفية عنوان القسم"
                  description="اللون الخلفي المحيط بعنوان «شاهد شرح بالفيديو...»"
                  value={colors.titleBgColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.titleBgColor}
                  onChange={(hex) => updateColorField('titleBgColor', hex)}
                />

                <ColorFieldControl
                  id="color-badge-bg"
                  label="لون خلفية الشارة العلوية"
                  description="خلفية شارة «دليل الاستخدام المرئي خطوة بخطوة»"
                  value={colors.badgeBgColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.badgeBgColor}
                  onChange={(hex) => updateColorField('badgeBgColor', hex)}
                />

                <div className="sm:col-span-2">
                  <ColorFieldControl
                    id="color-badge-text"
                    label="لون نص الشارة العلوية"
                    description="لون النص داخل الشارة التعريفية أعلى العنوان"
                    value={colors.badgeTextColor}
                    defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.badgeTextColor}
                    onChange={(hex) => updateColorField('badgeTextColor', hex)}
                  />
                </div>
              </div>
            </div>

            {/* Group 2: ألوان العناوين الرئيسية والفرعية والنصوص داخل القسم */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                  2
                </span>
                <div>
                  <h5 className="text-sm font-black text-slate-900">
                    ألوان العناوين الرئيسية والفرعية والنصوص
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    التحكم في ألوان العنوان الرئيسي والوصف الفرعي والنص الإرشادي
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <ColorFieldControl
                  id="color-main-title"
                  label="لون العنوان الرئيسي للقسم"
                  description="لون نص «شاهد شرح بالفيديو كيفية استخدام المنصة»"
                  value={colors.mainTitleColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.mainTitleColor}
                  onChange={(hex) => updateColorField('mainTitleColor', hex)}
                />

                <ColorFieldControl
                  id="color-subtitle"
                  label="لون العنوان الفرعي والوصف"
                  description="لون النص التوضيحي أسفل العنوان الرئيسي"
                  value={colors.subtitleColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.subtitleColor}
                  onChange={(hex) => updateColorField('subtitleColor', hex)}
                />

                <div className="sm:col-span-2">
                  <ColorFieldControl
                    id="color-helper-text"
                    label="لون النص الإرشادي أسفل الزر"
                    description="لون عبارة «اضغط لفتح قائمة الفيديوهات ومشاهدتها»"
                    value={colors.helperTextColor}
                    defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.helperTextColor}
                    onChange={(hex) => updateColorField('helperTextColor', hex)}
                  />
                </div>
              </div>
            </div>

            {/* Group 3: لون خلفية بطاقة القسم وصورة الغلاف والمنطقة المحيطة بها */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                  3
                </span>
                <div>
                  <h5 className="text-sm font-black text-slate-900">
                    خلفية بطاقة القسم وصورة الغلاف والمنطقة المحيطة
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    التحكم في لون بطاقة القسم، التدرج الخلفي، المنطقة المحيطة، وصورة الغلاف
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <ColorFieldControl
                  id="color-card-bg"
                  label="لون خلفية بطاقة القسم الأساسي"
                  description="اللون الأساسي لخلفية بطاقة القسم"
                  value={colors.cardBgColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.cardBgColor}
                  onChange={(hex) => updateColorField('cardBgColor', hex)}
                />

                <ColorFieldControl
                  id="color-card-secondary-bg"
                  label="لون التدرج الثانوي لبطاقة القسم"
                  description="اللون المتدرج فوق صورة الغلاف داخل البطاقة"
                  value={colors.cardSecondaryBgColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.cardSecondaryBgColor}
                  onChange={(hex) => updateColorField('cardSecondaryBgColor', hex)}
                />

                <ColorFieldControl
                  id="color-outer-section-bg"
                  label="لون المنطقة الخلفية المحيطة بالقسم"
                  description="لون الخلفية المحيطة ببطاقة القسم في الصفحة الرئيسية"
                  value={colors.outerSectionBgColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.outerSectionBgColor}
                  onChange={(hex) => updateColorField('outerSectionBgColor', hex)}
                />

                <ColorFieldControl
                  id="color-card-border"
                  label="لون إطار وحدود بطاقة القسم"
                  description="لون الحد الخارجي المحيط ببطاقة القسم"
                  value={colors.cardBorderColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.cardBorderColor}
                  onChange={(hex) => updateColorField('cardBorderColor', hex)}
                />
              </div>

              {/* Cover Image URL / File Upload & Overlay Opacity */}
              <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="watch-videos-cover-url-input"
                    className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>صورة الغلاف الخلفية لبطاقة القسم</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updateColorField(
                        'coverImageUrl',
                        DEFAULT_WATCH_VIDEOS_COLORS.coverImageUrl
                      )
                    }
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg cursor-pointer"
                  >
                    استعادة الصورة الافتراضية
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="watch-videos-cover-url-input"
                    type="url"
                    dir="ltr"
                    value={colors.coverImageUrl || ''}
                    onChange={(e) => updateColorField('coverImageUrl', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-emerald-600 text-xs font-mono text-slate-800 outline-none"
                  />

                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={handleCoverFileUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => coverFileInputRef.current?.click()}
                    disabled={isUploadingCover}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingCover ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري الرفع...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>رفع صورة غلاف</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>درجة كثافة اللون الخلفي فوق صورة الغلاف</span>
                    <span className="font-mono text-emerald-700">
                      {colors.coverOverlayOpacity ?? 88}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    value={colors.coverOverlayOpacity ?? 88}
                    onChange={(e) =>
                      updateColorField('coverOverlayOpacity', Number(e.target.value))
                    }
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Group 4: ألوان زر «مشاهدة الفيديوهات» وأيقونة الفيديو والعناصر التفاعلية */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                  4
                </span>
                <div>
                  <h5 className="text-sm font-black text-slate-900">
                    زر «مشاهدة الفيديوهات» وأيقونة الفيديو والعناصر التفاعلية
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    التحكم في ألوان زر المشاهدة وخلفيته وأيقونة الفيديو وشارات التشغيل
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <ColorFieldControl
                  id="color-button-bg"
                  label="لون خلفية زر «مشاهدة الفيديوهات»"
                  description="اللون الأساسي لزر «مشاهدة الفيديوهات»"
                  value={colors.buttonBgColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.buttonBgColor}
                  onChange={(hex) => updateColorField('buttonBgColor', hex)}
                />

                <ColorFieldControl
                  id="color-button-frame-bg"
                  label="لون الإطار الخلفي المحيط بالزر"
                  description="لون الحلقة الخلفية المحيطة بزر «مشاهدة الفيديوهات»"
                  value={colors.buttonFrameBgColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.buttonFrameBgColor}
                  onChange={(hex) => updateColorField('buttonFrameBgColor', hex)}
                />

                <ColorFieldControl
                  id="color-button-text"
                  label="لون نص وأيقونة زر «مشاهدة الفيديوهات»"
                  description="لون النص ومثلث التشغيل داخل الزر"
                  value={colors.buttonTextColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.buttonTextColor}
                  onChange={(hex) => updateColorField('buttonTextColor', hex)}
                />

                <ColorFieldControl
                  id="color-icon-box-bg"
                  label="لون خلفية صندوق أيقونة الفيديو"
                  description="لون المربع الحاضن لأيقونة الكاميرا/الفيديو"
                  value={colors.iconBoxBgColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.iconBoxBgColor}
                  onChange={(hex) => updateColorField('iconBoxBgColor', hex)}
                />

                <ColorFieldControl
                  id="color-icon-fg"
                  label="لون أيقونة الفيديو"
                  description="لون رمز الكاميرا داخل الصندوق"
                  value={colors.iconColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.iconColor}
                  onChange={(hex) => updateColorField('iconColor', hex)}
                />

                <ColorFieldControl
                  id="color-interactive-accent"
                  label="لون العناصر التفاعلية وشارة التشغيل"
                  description="لون دائرة التشغيل الصغيرة والرموز التفاعلية"
                  value={colors.interactiveAccentColor}
                  defaultValue={DEFAULT_WATCH_VIDEOS_COLORS.interactiveAccentColor}
                  onChange={(hex) => updateColorField('interactiveAccentColor', hex)}
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                تُحفظ جميع الألوان في قاعدة البيانات الدائمة للمنصة وتُطبّق تلقائياً على قسم «شاهد شرح بالفيديو كيفية استخدام المنصة» فقط دون المساس بأي قسم آخر.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                id="btn-reset-watch-videos-colors"
                onClick={handleResetDefaultColors}
                disabled={isSaving || isResetting}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
                <span>استعادة الألوان الافتراضية</span>
              </button>

              <button
                type="button"
                id="btn-save-watch-videos-colors"
                onClick={handleSaveColors}
                disabled={isSaving || isResetting}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ التغييرات...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ التغييرات</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
