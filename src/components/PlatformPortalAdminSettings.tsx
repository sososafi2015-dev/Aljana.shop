import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Eye,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Search,
  MapPin,
  Building2,
  Sparkles,
  Layers,
  ShieldCheck,
  FileText,
  ExternalLink,
  HeartHandshake,
  Image as ImageIcon,
  Upload,
  Trash2,
  RefreshCw,
  Loader2,
  Palette,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import {
  PlatformPortalSettings,
  PlatformPortalSectionsVisibility,
  PlatformPortalTextSettings,
  PlatformPortalThemeSettings
} from '../types';
import {
  getPortalSettings,
  fetchPortalSettings,
  savePortalSettings,
  resetPortalSettingsToDefaults,
  PORTAL_SETTINGS_EVENT,
  DEFAULT_PORTAL_SETTINGS,
  DEFAULT_PORTAL_THEME,
  DEFAULT_DONATIONS_COVER_IMAGE,
  DEFAULT_DONATIONS_COVER_OPACITY
} from '../portalSettingsStorage';
import { uploadImageToServer, ensurePermanentImageUrl } from '../api/imageApi';

interface PlatformPortalAdminSettingsProps {
  onShowToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onPreviewPortal?: () => void;
}

// Preset color themes for one-click styling
const THEME_PRESETS: Array<{
  id: string;
  name: string;
  theme: PlatformPortalThemeSettings;
  badgeBg: string;
}> = [
  {
    id: 'emerald',
    name: 'الزمردي الملكي (الافتراضي المعتمد)',
    badgeBg: 'bg-emerald-600',
    theme: {
      primaryColor: '#059669',
      secondaryColor: '#0f172a',
      accentColor: '#0d9488',
      backgroundColor: '#f8fafc',
      heroGradientStart: '#0f172a',
      heroGradientEnd: '#064e3b',
      cardBackground: '#ffffff',
      buttonColor: '#059669',
    },
  },
  {
    id: 'ocean',
    name: 'الأزرق السحابي (Ocean Blue)',
    badgeBg: 'bg-blue-600',
    theme: {
      primaryColor: '#2563eb',
      secondaryColor: '#0f172a',
      accentColor: '#0284c7',
      backgroundColor: '#f8fafc',
      heroGradientStart: '#0f172a',
      heroGradientEnd: '#1e3a8a',
      cardBackground: '#ffffff',
      buttonColor: '#2563eb',
    },
  },
  {
    id: 'purple',
    name: 'البنفسجي الإمبراطوري (Imperial Purple)',
    badgeBg: 'bg-purple-700',
    theme: {
      primaryColor: '#7c3aed',
      secondaryColor: '#18181b',
      accentColor: '#9333ea',
      backgroundColor: '#faf5ff',
      heroGradientStart: '#18181b',
      heroGradientEnd: '#4c1d95',
      cardBackground: '#ffffff',
      buttonColor: '#7c3aed',
    },
  },
  {
    id: 'amber',
    name: 'العنبري الذهبي (Desert Gold)',
    badgeBg: 'bg-amber-600',
    theme: {
      primaryColor: '#d97706',
      secondaryColor: '#1c1917',
      accentColor: '#b45309',
      backgroundColor: '#fffbeb',
      heroGradientStart: '#1c1917',
      heroGradientEnd: '#78350f',
      cardBackground: '#ffffff',
      buttonColor: '#d97706',
    },
  },
  {
    id: 'charcoal',
    name: 'الفحمي الحديث (Modern Charcoal)',
    badgeBg: 'bg-slate-700',
    theme: {
      primaryColor: '#334155',
      secondaryColor: '#09090b',
      accentColor: '#0284c7',
      backgroundColor: '#f8fafc',
      heroGradientStart: '#09090b',
      heroGradientEnd: '#1e293b',
      cardBackground: '#ffffff',
      buttonColor: '#334155',
    },
  },
];

export const PlatformPortalAdminSettings: React.FC<PlatformPortalAdminSettingsProps> = ({
  onShowToast,
  onPreviewPortal,
}) => {
  const [settings, setSettings] = useState<PlatformPortalSettings>(getPortalSettings);
  const [activeSubTab, setActiveSubTab] = useState<'visibility' | 'texts' | 'appearance' | 'summary'>('visibility');
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Uploading states
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingHeroBg, setIsUploadingHeroBg] = useState(false);

  // File input refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const heroBgInputRef = useRef<HTMLInputElement>(null);

  // Synchronize on mount with backend database and Firestore
  useEffect(() => {
    fetchPortalSettings()
      .then((fresh) => {
        setSettings(fresh);
      })
      .catch((err) => {
        console.warn('[PlatformPortalAdminSettings] Initial fetch notice:', err);
      });

    const handleSettingsUpdated = (e: any) => {
      const updated = e?.detail || getPortalSettings();
      if (updated?.watchVideosColors) {
        setSettings((prev) => ({
          ...prev,
          watchVideosColors: updated.watchVideosColors,
        }));
      }
    };
    window.addEventListener(PORTAL_SETTINGS_EVENT, handleSettingsUpdated);
    return () => {
      window.removeEventListener(PORTAL_SETTINGS_EVENT, handleSettingsUpdated);
    };
  }, []);

  // Manual refresh from backend database
  const handleRefreshFromServer = async () => {
    setIsRefreshing(true);
    setSaveStatusMessage(null);
    try {
      const fresh = await fetchPortalSettings();
      setSettings(fresh);
      setHasUnsavedChanges(false);
      onShowToast('تم تحديث واسترجاع أحدث الإعدادات المحفوظة من قاعدة البيانات بنجاح 🔄', 'info');
    } catch (err: any) {
      console.error(err);
      onShowToast('فشل في جلب الإعدادات من الخادم', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Update visibility toggle
  const handleToggleVisibility = (key: keyof PlatformPortalSectionsVisibility) => {
    setSettings((prev) => ({
      ...prev,
      visibility: {
        ...prev.visibility,
        [key]: !prev.visibility[key],
      },
    }));
    setHasUnsavedChanges(true);
    setSaveStatusMessage(null);
  };

  // Update text field
  const handleTextChange = (key: keyof PlatformPortalTextSettings, value: string | number) => {
    setSettings((prev) => ({
      ...prev,
      texts: {
        ...prev.texts,
        [key]: value,
      },
    }));
    setHasUnsavedChanges(true);
    setSaveStatusMessage(null);
  };

  // Update theme color field
  const handleThemeColorChange = (key: keyof PlatformPortalThemeSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      theme: {
        ...(prev.theme || DEFAULT_PORTAL_THEME),
        [key]: value,
      },
    }));
    setHasUnsavedChanges(true);
    setSaveStatusMessage(null);
  };

  // Apply predefined color theme preset
  const handleApplyThemePreset = (preset: typeof THEME_PRESETS[0]) => {
    setSettings((prev) => ({
      ...prev,
      theme: {
        ...preset.theme,
      },
    }));
    setHasUnsavedChanges(true);
    setSaveStatusMessage(null);
    onShowToast(`تم تطبيق نمط الألوان «${preset.name}»، اضغط «حفظ التعديلات» للتثبيت في قاعدة البيانات`, 'info');
  };

  // Upload Platform Logo
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('يرجى اختيار ملف صورة صالح (PNG, JPG, SVG, WebP)', 'error');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const permanentUrl = await uploadImageToServer(file, {
        category: 'portal_logos',
        fileName: file.name,
      });

      setSettings((prev) => ({
        ...prev,
        logoUrl: permanentUrl,
        texts: {
          ...prev.texts,
          platformLogoUrl: permanentUrl,
        },
      }));
      setHasUnsavedChanges(true);
      onShowToast('تم رفع وتخزين شعار المنصة بنجاح على خادم التخزين الدائم 🖼️', 'success');
    } catch (err: any) {
      console.error('[PlatformPortalAdminSettings] Logo upload error:', err);
      onShowToast(err?.message || 'فشل في رفع شعار المنصة، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({
      ...prev,
      logoUrl: '',
      texts: {
        ...prev.texts,
        platformLogoUrl: '',
      },
    }));
    setHasUnsavedChanges(true);
    onShowToast('تمت إزالة الشعار المخصص (سيتم استخدام الشعار الافتراضي)', 'info');
  };

  // Upload Donations Section Cover Image
  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)', 'error');
      return;
    }

    setIsUploadingCover(true);
    try {
      const permanentUrl = await uploadImageToServer(file, {
        category: 'portal_covers',
        fileName: file.name,
      });

      handleTextChange('donationsSectionCoverImage', permanentUrl);
      onShowToast('تم رفع صورة غلاف قسم التبرعات وتخزينها بنجاح 🖼️', 'success');
    } catch (err: any) {
      console.error('[PlatformPortalAdminSettings] Cover upload error:', err);
      onShowToast(err?.message || 'فشل في رفع صورة الغلاف', 'error');
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  // Upload Hero Background Image
  const handleHeroBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)', 'error');
      return;
    }

    setIsUploadingHeroBg(true);
    try {
      const permanentUrl = await uploadImageToServer(file, {
        category: 'portal_hero',
        fileName: file.name,
      });

      handleTextChange('heroBackgroundImage', permanentUrl);
      onShowToast('تم رفع صورة خلفية القسم الترحيبي بنجاح 🖼️', 'success');
    } catch (err: any) {
      console.error('[PlatformPortalAdminSettings] Hero bg upload error:', err);
      onShowToast(err?.message || 'فشل في رفع صورة خلفية القسم الترحيبي', 'error');
    } finally {
      setIsUploadingHeroBg(false);
      if (heroBgInputRef.current) heroBgInputRef.current.value = '';
    }
  };

  // Save changes to backend database and verify persistence
  const handleSaveChanges = async () => {
    setIsSaving(true);
    setSaveStatusMessage(null);
    try {
      const saved = await savePortalSettings(settings);
      setSettings(saved);
      setHasUnsavedChanges(false);
      setSaveStatusMessage({
        type: 'success',
        text: 'تم حفظ التعديلات بنجاح في قاعدة البيانات والخادم السحابي، وتم التحقق من مطابقة البيانات المحفوظة.',
      });
      onShowToast('تم حفظ التعديلات بنجاح', 'success');
    } catch (err: any) {
      console.error('[PlatformPortalAdminSettings] Save error:', err);
      const errMsg = err?.message || 'فشل في حفظ التعديلات في قاعدة البيانات. يرجى المحاولة مرة أخرى.';
      setSaveStatusMessage({
        type: 'error',
        text: `فشل في حفظ التعديلات: ${errMsg}`,
      });
      onShowToast(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const handleConfirmReset = async () => {
    setIsSaving(true);
    setShowResetConfirmModal(false);
    setSaveStatusMessage(null);
    try {
      const reset = await resetPortalSettingsToDefaults();
      setSettings(reset);
      setHasUnsavedChanges(false);
      setSaveStatusMessage({
        type: 'success',
        text: 'تمت استعادة الإعدادات الافتراضية لواجهة المنصة وحفظها بنجاح في قاعدة البيانات.',
      });
      onShowToast('تمت استعادة الإعدادات الافتراضية لواجهة المنصة وحفظها بنجاح', 'success');
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || 'فشل في استعادة الإعدادات الافتراضية';
      setSaveStatusMessage({
        type: 'error',
        text: `فشل في استعادة الإعدادات: ${errMsg}`,
      });
      onShowToast(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const totalSectionsCount = Object.keys(settings.visibility).length;
  const enabledSectionsCount = Object.values(settings.visibility).filter(Boolean).length;
  const currentTheme = settings.theme || DEFAULT_PORTAL_THEME;

  return (
    <div className="space-y-6" dir="rtl">
      {/* ================= SECTION HEADER ================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-600/20">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900">التحكم بواجهة المنصة</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                Super Admin Only
              </span>
              {hasUnsavedChanges && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  يوجد تغييرات غير محفوظة
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              إدارة كافة عناصر ونصوص وألوان وخلفيات وشعارات الواجهة العامة لمنظومة العمل الجمعوي، مع الحفظ الفعلي والدائم في قاعدة البيانات السحابية واستقرار التعديلات بعد التحديث أو تسجيل الخروج.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefreshFromServer}
            disabled={isSaving || isRefreshing}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="تحديث واسترجاع الإعدادات المحفوظة من الخادم وقاعدة البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'جاري التحميل...' : 'تحديث من الخادم'}</span>
          </button>

          <button
            onClick={() => setShowResetConfirmModal(true)}
            disabled={isSaving}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="إعادة ضبط كافة الإعدادات والنصوص للقيم الافتراضية"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>إعادة الإعداد الافتراضي</span>
          </button>

          {onPreviewPortal && (
            <button
              onClick={onPreviewPortal}
              className="px-3.5 py-2.5 rounded-xl border border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
              <span>معاينة الواجهة العامة</span>
            </button>
          )}

          {/* Primary Save Button */}
          <button
            id="btn-save-portal-ui-settings"
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ring-2 ring-emerald-400/40"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'جاري حفظ التعديلات في قاعدة البيانات...' : 'حفظ التعديلات'}</span>
          </button>
        </div>
      </div>

      {/* ================= STATUS BANNER ================= */}
      {saveStatusMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 animate-fade-in ${
            saveStatusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {saveStatusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span className="text-xs font-bold leading-relaxed">{saveStatusMessage.text}</span>
        </div>
      )}

      {/* ================= STATUS & KPI STRIP ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">حالة الأقسام المفعلة</span>
            <span className="text-xl font-black text-emerald-600">
              {enabledSectionsCount} <span className="text-xs text-slate-500">من {totalSectionsCount} مفعّلة</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">فلتر البحث وفلتر المدينة</span>
            <span className="text-xs font-bold text-slate-700 flex items-center gap-2 mt-1">
              <span>البحث: {settings.visibility.searchFilter ? '🟢 مفعّل' : '🔴 معطّل'}</span>
              <span>•</span>
              <span>المدينة: {settings.visibility.cityFilter ? '🟢 مفعّل' : '🔴 معطّل'}</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">تخزين قاعدة البيانات</span>
            <span className="text-xs font-bold text-slate-700 block mt-1">
              مزامنة دائمة • {settings.updatedBy || 'Super Admin'}
            </span>
            <span className="text-[10px] text-slate-400">
              {settings.lastUpdated
                ? new Date(settings.lastUpdated).toLocaleDateString('ar-MA', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'إعدادات المنظومة'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ================= SUB-TABS NAVIGATION ================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          onClick={() => setActiveSubTab('visibility')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'visibility'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Eye className="w-4 h-4 text-emerald-400" />
          <span>تفعيل وتعطيل الأقسام والفلاتر</span>
        </button>

        <button
          onClick={() => setActiveSubTab('texts')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'texts'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4 text-teal-400" />
          <span>تعديل العناوين والنصوص</span>
        </button>

        <button
          onClick={() => setActiveSubTab('appearance')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'appearance'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Palette className="w-4 h-4 text-amber-400" />
          <span>الألوان والخلفيات والشعارات</span>
        </button>

        <button
          onClick={() => setActiveSubTab('summary')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'summary'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span>دليل الصلاحيات وحالة قاعدة البيانات</span>
        </button>
      </div>

      {/* ================= TAB 1: VISIBILITY & FILTERS ================= */}
      {activeSubTab === 'visibility' && (
        <div className="space-y-6">
          {/* Card: Search & City Filter */}
          <div className="bg-gradient-to-tr from-emerald-950 via-slate-900 to-teal-950 text-white rounded-3xl p-6 border border-emerald-500/30 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-400 text-xs font-black">
              <Search className="w-4 h-4" />
              <span>التحكم في فلاتر البحث والتصفية بالواجهة العامة</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Filter 1: Search Filter */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-white">فلتر البحث (Search Filter)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    إظهار أو إخفاء حقل البحث النصي بالاسم والمدينة والكلمات المفتاحية في واجهة المنصة.
                  </p>
                </div>

                <button
                  onClick={() => handleToggleVisibility('searchFilter')}
                  className={`w-14 h-7 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                    settings.visibility.searchFilter ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      settings.visibility.searchFilter ? '-translate-x-8' : '-translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Filter 2: City Filter */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-teal-400" />
                    <span className="text-sm font-bold text-white">فلتر المدينة (City Filter)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    إظهار أو إخفاء القائمة المنسدلة لتصفية الجمعيات حسب المدينة في واجهة المنصة.
                  </p>
                </div>

                <button
                  onClick={() => handleToggleVisibility('cityFilter')}
                  className={`w-14 h-7 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                    settings.visibility.cityFilter ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      settings.visibility.cityFilter ? '-translate-x-8' : '-translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Grid of Other Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Section: Announcement Bar */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-start justify-between gap-4 hover:border-slate-300 transition-colors">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-bold text-slate-900">شريط الإعلانات العلوي (Announcement Bar)</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  الشريط الأسود أعلى الصفحة الذي يعرض شارة SaaS ورسالة الترحيب ورابط الدخول.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      settings.visibility.announcementBar
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.visibility.announcementBar ? '🟢 مفعّل بالواجهة' : '🔴 معطّل ومخفي'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleVisibility('announcementBar')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  settings.visibility.announcementBar ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    settings.visibility.announcementBar ? '-translate-x-7' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Section: Main Header */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-start justify-between gap-4 hover:border-slate-300 transition-colors">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  <h3 className="text-sm font-bold text-slate-900">الترويسة الرئيسية وشعار المنصة (Header & Nav)</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  شعار المنصة، العنوان التعريفي، وزر تدشين الجمعية الجديد السريع في شريط التنقل العلوي.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      settings.visibility.mainHeader ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.visibility.mainHeader ? '🟢 مفعّل بالواجهة' : '🔴 معطّل ومخفي'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleVisibility('mainHeader')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  settings.visibility.mainHeader ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    settings.visibility.mainHeader ? '-translate-x-7' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Section: Hero Section */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-start justify-between gap-4 hover:border-slate-300 transition-colors">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h3 className="text-sm font-bold text-slate-900">القسم الترحيبي الرئيسي (Hero Section)</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  العنوان البارز، زر التدشين الكبير، وزر الدخول السريع في الواجهة.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      settings.visibility.heroSection ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.visibility.heroSection ? '🟢 مفعّل بالواجهة' : '🔴 معطّل ومخفي'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleVisibility('heroSection')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  settings.visibility.heroSection ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    settings.visibility.heroSection ? '-translate-x-7' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Section: Hero Metrics */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-start justify-between gap-4 hover:border-slate-300 transition-colors">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-900">إحصائيات الهيرو الرقمية (Hero Metrics)</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  شارات الأرقام (عدد الجمعيات، نسبة الأمان 100%، وسرعة التدشين).
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      settings.visibility.heroMetrics ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.visibility.heroMetrics ? '🟢 مفعّل بالواجهة' : '🔴 معطّل ومخفي'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleVisibility('heroMetrics')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  settings.visibility.heroMetrics ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    settings.visibility.heroMetrics ? '-translate-x-7' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Section: Master Template Showcase */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-start justify-between gap-4 hover:border-slate-300 transition-colors">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900">بطاقة القالب الأساسي المعتمد (Master Template)</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  قسم عرض نموذج جمعية النور المعتمد وشرح استنساخ البنية الرقمية منه.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      settings.visibility.masterTemplateShowcase
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.visibility.masterTemplateShowcase ? '🟢 مفعّل بالواجهة' : '🔴 معطّل ومخفي'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleVisibility('masterTemplateShowcase')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  settings.visibility.masterTemplateShowcase ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    settings.visibility.masterTemplateShowcase ? '-translate-x-7' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Section: Catalog Section */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-start justify-between gap-4 hover:border-slate-300 transition-colors">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  <h3 className="text-sm font-bold text-slate-900">دليل ومنصات الجمعيات (Catalog Section)</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  القسم المخصص لعرض بطاقات الجمعيات ونموذج جمعية النور المعتمد.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      settings.visibility.catalogSection
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.visibility.catalogSection ? '🟢 مفعّل بالواجهة' : '🔴 معطّل ومخفي'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleVisibility('catalogSection')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  settings.visibility.catalogSection ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    settings.visibility.catalogSection ? '-translate-x-7' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Section: Donations Section */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-start justify-between gap-4 hover:border-slate-300 transition-colors">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <h3 className="text-sm font-bold text-slate-900">قسم حملات التبرع والمشاريع (Donations)</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  البانر المخصص للتبرع والمساهمة في مشاريع التنمية مع صورة الغلاف المخصصة.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      settings.visibility.donationsSection
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.visibility.donationsSection ? '🟢 مفعّل بالواجهة' : '🔴 معطّل ومخفي'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleVisibility('donationsSection')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  settings.visibility.donationsSection ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    settings.visibility.donationsSection ? '-translate-x-7' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Section: Pillars Section */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-start justify-between gap-4 hover:border-slate-300 transition-colors">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
                  <h3 className="text-sm font-bold text-slate-900">قسم ركائز ومميزات المنظومة (Pillars)</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  شبكة البطاقات الست التي توضح مزايا استقلال البيانات، الإدارة المالية، وبطاقات العضوية.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      settings.visibility.pillarsSection
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.visibility.pillarsSection ? '🟢 مفعّل بالواجهة' : '🔴 معطّل ومخفي'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleVisibility('pillarsSection')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  settings.visibility.pillarsSection ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    settings.visibility.pillarsSection ? '-translate-x-7' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Section: Footer Section */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-start justify-between gap-4 hover:border-slate-300 transition-colors md:col-span-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">تذييل المنصة وحقوق النشر (Footer)</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  الشريط السفلي للحقوق، وشعار المنصة، وتاريخ الحقوق والاعتماد.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      settings.visibility.footerSection
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {settings.visibility.footerSection ? '🟢 مفعّل بالواجهة' : '🔴 معطّل ومخفي'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleVisibility('footerSection')}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  settings.visibility.footerSection ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    settings.visibility.footerSection ? '-translate-x-7' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>قم بتفعيل أو تعطيل الأقسام ثم اضغط «حفظ التعديلات» لاعتمادها في قاعدة البيانات السحابية.</span>
            </div>
            <button
              id="btn-save-portal-ui-settings-bottom-visibility"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ring-2 ring-emerald-400/40"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'جاري حفظ التعديلات في قاعدة البيانات...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 2: TEXTS & TITLES ================= */}
      {activeSubTab === 'texts' && (
        <div className="space-y-6">
          {/* Card 1: Announcement Bar & Header */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
              <span>نصوص شريط الإعلانات والترويسة العلوية</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">شارة الإعلان العلوي (Badge)</label>
                <input
                  type="text"
                  value={settings.texts.announcementBadge}
                  onChange={(e) => handleTextChange('announcementBadge', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">نص الإعلان العلوي الكامل</label>
                <input
                  type="text"
                  value={settings.texts.announcementText}
                  onChange={(e) => handleTextChange('announcementText', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">اسم المنصة بالترويسة (Brand Name)</label>
                <input
                  type="text"
                  value={settings.texts.headerBrandName}
                  onChange={(e) => handleTextChange('headerBrandName', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الشعار اللفظي بالترويسة (Header Tagline)</label>
                <input
                  type="text"
                  value={settings.texts.headerBrandTagline}
                  onChange={(e) => handleTextChange('headerBrandTagline', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">نص زر إنشاء المنصة السريع بالترويسة</label>
                <input
                  type="text"
                  value={settings.texts.createAssociationButtonText}
                  onChange={(e) => handleTextChange('createAssociationButtonText', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Hero Section Texts */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>نصوص القسم الترحيبي الرئيسي (Hero Section)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">شارة الهيرو العلوية (Hero Badge)</label>
                <input
                  type="text"
                  value={settings.texts.heroBadge}
                  onChange={(e) => handleTextChange('heroBadge', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">السطر الأول من العنوان الرئيسي</label>
                <input
                  type="text"
                  value={settings.texts.heroTitleLine1}
                  onChange={(e) => handleTextChange('heroTitleLine1', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">السطر المميز والملوّن من العنوان الرئيسي (Highlight)</label>
                <input
                  type="text"
                  value={settings.texts.heroTitleHighlight}
                  onChange={(e) => handleTextChange('heroTitleHighlight', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">الوصف التوضيحي بالهيرو</label>
                <textarea
                  rows={3}
                  value={settings.texts.heroDescription}
                  onChange={(e) => handleTextChange('heroDescription', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">نص زر التدشين الرئيسي (Hero CTA Button)</label>
                <input
                  type="text"
                  value={settings.texts.heroCtaButtonText}
                  onChange={(e) => handleTextChange('heroCtaButtonText', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">نص زر معاينة القالب المعتمد</label>
                <input
                  type="text"
                  value={settings.texts.heroPreviewTemplateButtonText}
                  onChange={(e) => handleTextChange('heroPreviewTemplateButtonText', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Master Template & Catalog Texts */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
              <span>نصوص القالب الأساسي ودليل الجمعيات وفلتر البحث</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">شارة القالب المعتمد</label>
                <input
                  type="text"
                  value={settings.texts.masterTemplateBadge}
                  onChange={(e) => handleTextChange('masterTemplateBadge', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">نص زر معاينة القالب الأساسي</label>
                <input
                  type="text"
                  value={settings.texts.masterTemplateButtonText}
                  onChange={(e) => handleTextChange('masterTemplateButtonText', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">وصف القالب الأساسي المعتمد</label>
                <textarea
                  rows={2}
                  value={settings.texts.masterTemplateDescription}
                  onChange={(e) => handleTextChange('masterTemplateDescription', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">شارة دليل الجمعيات (Catalog Badge)</label>
                <input
                  type="text"
                  value={settings.texts.catalogBadge}
                  onChange={(e) => handleTextChange('catalogBadge', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">النص التوضيحي داخل حقل البحث (Placeholder)</label>
                <input
                  type="text"
                  value={settings.texts.searchPlaceholder}
                  onChange={(e) => handleTextChange('searchPlaceholder', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">عنوان قسم الجمعيات</label>
                <input
                  type="text"
                  value={settings.texts.catalogTitle}
                  onChange={(e) => handleTextChange('catalogTitle', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">وصف قسم الجمعيات</label>
                <input
                  type="text"
                  value={settings.texts.catalogDescription}
                  onChange={(e) => handleTextChange('catalogDescription', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Donations Section Texts */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>نصوص قسم مشاريع التنمية والتبرع (Donations Section)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">عنوان قسم التبرعات والمشاريع</label>
                <input
                  type="text"
                  value={settings.texts.donationsSectionTitle || ''}
                  onChange={(e) => handleTextChange('donationsSectionTitle', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">وصف قسم التبرعات والمشاريع</label>
                <textarea
                  rows={2}
                  value={settings.texts.donationsSectionDesc || ''}
                  onChange={(e) => handleTextChange('donationsSectionDesc', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Card 5: Pillars Section Texts */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
              <span>نصوص ركائز ومميزات المنظومة (Pillars Section)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">عنوان قسم الركائز الرئيسي</label>
                <input
                  type="text"
                  value={settings.texts.pillarsTitle}
                  onChange={(e) => handleTextChange('pillarsTitle', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">العنوان الفرعي لقسم الركائز</label>
                <input
                  type="text"
                  value={settings.texts.pillarsSubtitle}
                  onChange={(e) => handleTextChange('pillarsSubtitle', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Pillar 1 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">الركيزة 1</span>
                <input
                  type="text"
                  value={settings.texts.pillar1Title}
                  onChange={(e) => handleTextChange('pillar1Title', e.target.value)}
                  placeholder="عنوان الركيزة 1"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none font-bold"
                />
                <textarea
                  rows={2}
                  value={settings.texts.pillar1Desc}
                  onChange={(e) => handleTextChange('pillar1Desc', e.target.value)}
                  placeholder="وصف الركيزة 1"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Pillar 2 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">الركيزة 2</span>
                <input
                  type="text"
                  value={settings.texts.pillar2Title}
                  onChange={(e) => handleTextChange('pillar2Title', e.target.value)}
                  placeholder="عنوان الركيزة 2"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none font-bold"
                />
                <textarea
                  rows={2}
                  value={settings.texts.pillar2Desc}
                  onChange={(e) => handleTextChange('pillar2Desc', e.target.value)}
                  placeholder="وصف الركيزة 2"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Pillar 3 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">الركيزة 3</span>
                <input
                  type="text"
                  value={settings.texts.pillar3Title}
                  onChange={(e) => handleTextChange('pillar3Title', e.target.value)}
                  placeholder="عنوان الركيزة 3"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none font-bold"
                />
                <textarea
                  rows={2}
                  value={settings.texts.pillar3Desc}
                  onChange={(e) => handleTextChange('pillar3Desc', e.target.value)}
                  placeholder="وصف الركيزة 3"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Pillar 4 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">الركيزة 4</span>
                <input
                  type="text"
                  value={settings.texts.pillar4Title || ''}
                  onChange={(e) => handleTextChange('pillar4Title', e.target.value)}
                  placeholder="عنوان الركيزة 4"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none font-bold"
                />
                <textarea
                  rows={2}
                  value={settings.texts.pillar4Desc || ''}
                  onChange={(e) => handleTextChange('pillar4Desc', e.target.value)}
                  placeholder="وصف الركيزة 4"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Pillar 5 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">الركيزة 5</span>
                <input
                  type="text"
                  value={settings.texts.pillar5Title || ''}
                  onChange={(e) => handleTextChange('pillar5Title', e.target.value)}
                  placeholder="عنوان الركيزة 5"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none font-bold"
                />
                <textarea
                  rows={2}
                  value={settings.texts.pillar5Desc || ''}
                  onChange={(e) => handleTextChange('pillar5Desc', e.target.value)}
                  placeholder="وصف الركيزة 5"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Pillar 6 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">الركيزة 6</span>
                <input
                  type="text"
                  value={settings.texts.pillar6Title || ''}
                  onChange={(e) => handleTextChange('pillar6Title', e.target.value)}
                  placeholder="عنوان الركيزة 6"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none font-bold"
                />
                <textarea
                  rows={2}
                  value={settings.texts.pillar6Desc || ''}
                  onChange={(e) => handleTextChange('pillar6Desc', e.target.value)}
                  placeholder="وصف الركيزة 6"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Card 6: Footer Texts */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
              <span>نصوص تذييل المنصة وحقوق النشر (Footer)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">اسم المنصة بالتذييل</label>
                <input
                  type="text"
                  value={settings.texts.footerBrandName}
                  onChange={(e) => handleTextChange('footerBrandName', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">نص حقوق النشر والاعتماد</label>
                <input
                  type="text"
                  value={settings.texts.footerCopyrightText}
                  onChange={(e) => handleTextChange('footerCopyrightText', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>عند الانتهاء من تعديل العناوين والنصوص، اضغط «حفظ التعديلات» لاعتمادها في قاعدة البيانات السحابية.</span>
            </div>
            <button
              id="btn-save-portal-ui-settings-bottom-texts"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ring-2 ring-emerald-400/40"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'جاري حفظ التعديلات في قاعدة البيانات...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 3: APPEARANCE, COLORS, BACKGROUNDS & LOGO ================= */}
      {activeSubTab === 'appearance' && (
        <div className="space-y-6">
          {/* Card: Platform Logo (شعار المنصة) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>شعار المنصة الرسمي (Platform Logo)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">يظهر في الترويسة الرئيسية وشريط الحقوق</span>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Logo Preview Card */}
              <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative group shadow-inner">
                {settings.logoUrl || settings.texts.platformLogoUrl ? (
                  <img
                    src={settings.logoUrl || settings.texts.platformLogoUrl}
                    alt="Platform Logo Preview"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-400 gap-1">
                    <Building2 className="w-8 h-8" />
                    <span className="text-[10px] font-bold">بدون شعار مخصص</span>
                  </div>
                )}
                {isUploadingLogo && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center text-white">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  </div>
                )}
              </div>

              {/* Upload & Action Controls */}
              <div className="space-y-3 flex-1">
                <p className="text-xs text-slate-600 leading-relaxed">
                  ارفع الشعار الرسمي للمنصة من جهازك (PNG أو JPG أو WebP أو SVG). يتم حفظ الملف تلقائياً في خدمة التخزين السحابي الدائمة لضمان عدم اختفائه.
                </p>

                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo || isSaving}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingLogo ? 'جاري رفع الشعار...' : 'رفع الشعار من جهازك'}</span>
                  </button>

                  {(settings.logoUrl || settings.texts.platformLogoUrl) && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={isSaving}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إزالة الشعار</span>
                    </button>
                  )}
                </div>

                <div className="pt-1">
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">أو أدخل رابط الشعار المباشر (URL):</label>
                  <input
                    type="text"
                    value={settings.logoUrl || settings.texts.platformLogoUrl || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSettings((prev) => ({
                        ...prev,
                        logoUrl: val,
                        texts: { ...prev.texts, platformLogoUrl: val },
                      }));
                      setHasUnsavedChanges(true);
                      setSaveStatusMessage(null);
                    }}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none font-mono"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card: Theme Colors & Presets (نظام الألوان وتخصيص المظهر) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span>نظام الألوان وتخصيص المظهر (Theme Colors)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">تغيير الألوان الرئيسية وخلفيات الواجهة</span>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">قوالب ألوان جاهزة بنقرة واحدة:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {THEME_PRESETS.map((preset) => {
                  const isCurrent =
                    currentTheme.primaryColor === preset.theme.primaryColor &&
                    currentTheme.heroGradientEnd === preset.theme.heroGradientEnd;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyThemePreset(preset)}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isCurrent
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-lg border border-slate-300 shadow-xs shrink-0"
                          style={{ backgroundColor: preset.theme.primaryColor }}
                        />
                        <span className="text-xs font-bold text-slate-800">{preset.name.split(' (')[0]}</span>
                      </div>
                      {isCurrent && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Primary Color */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">اللون الرئيسي للمنصة</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTheme.primaryColor || '#059669'}
                    onChange={(e) => handleThemeColorChange('primaryColor', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white shrink-0"
                  />
                  <input
                    type="text"
                    value={currentTheme.primaryColor || '#059669'}
                    onChange={(e) => handleThemeColorChange('primaryColor', e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none font-mono text-center font-bold"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">لون التمييز والأزرار البارزة</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTheme.accentColor || '#0d9488'}
                    onChange={(e) => handleThemeColorChange('accentColor', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white shrink-0"
                  />
                  <input
                    type="text"
                    value={currentTheme.accentColor || '#0d9488'}
                    onChange={(e) => handleThemeColorChange('accentColor', e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none font-mono text-center font-bold"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Secondary Color */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">اللون الثانوي الداكن</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTheme.secondaryColor || '#0f172a'}
                    onChange={(e) => handleThemeColorChange('secondaryColor', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white shrink-0"
                  />
                  <input
                    type="text"
                    value={currentTheme.secondaryColor || '#0f172a'}
                    onChange={(e) => handleThemeColorChange('secondaryColor', e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none font-mono text-center font-bold"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Hero Gradient Start */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">بداية تدرج الهيرو (Gradient Start)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTheme.heroGradientStart || '#0f172a'}
                    onChange={(e) => handleThemeColorChange('heroGradientStart', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white shrink-0"
                  />
                  <input
                    type="text"
                    value={currentTheme.heroGradientStart || '#0f172a'}
                    onChange={(e) => handleThemeColorChange('heroGradientStart', e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none font-mono text-center font-bold"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Hero Gradient End */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">نهاية تدرج الهيرو (Gradient End)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTheme.heroGradientEnd || '#064e3b'}
                    onChange={(e) => handleThemeColorChange('heroGradientEnd', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white shrink-0"
                  />
                  <input
                    type="text"
                    value={currentTheme.heroGradientEnd || '#064e3b'}
                    onChange={(e) => handleThemeColorChange('heroGradientEnd', e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none font-mono text-center font-bold"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Page Background Color */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">لون خلفية الصفحة العامة</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTheme.backgroundColor || '#f8fafc'}
                    onChange={(e) => handleThemeColorChange('backgroundColor', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white shrink-0"
                  />
                  <input
                    type="text"
                    value={currentTheme.backgroundColor || '#f8fafc'}
                    onChange={(e) => handleThemeColorChange('backgroundColor', e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none font-mono text-center font-bold"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card: Hero Background Image (خلفية القسم الترحيبي) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>صورة خلفية القسم الترحيبي (Hero Background Image)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">تظهر كخلفية جمالية خلف نصوص الهيرو</span>
            </div>

            <div className="space-y-4">
              {/* Preview */}
              <div className="w-full h-40 rounded-2xl border border-slate-200 overflow-hidden relative bg-slate-900 flex items-center justify-center">
                {settings.texts.heroBackgroundImage ? (
                  <img
                    src={settings.texts.heroBackgroundImage}
                    alt="Hero Background Preview"
                    className="w-full h-full object-cover"
                    style={{ opacity: (settings.texts.heroBackgroundOverlayOpacity ?? 35) / 100 }}
                  />
                ) : (
                  <div className="text-center text-slate-400 space-y-1">
                    <ImageIcon className="w-8 h-8 mx-auto opacity-40" />
                    <span className="text-xs">تدرج لوني افتراضي (بدون صورة خلفية)</span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-white font-black text-sm drop-shadow-md">معاينة القسم الترحيبي الرئيسي</span>
                </div>
              </div>

              {/* Upload & controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    ref={heroBgInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleHeroBgFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => heroBgInputRef.current?.click()}
                    disabled={isUploadingHeroBg || isSaving}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingHeroBg ? 'جاري رفع الصورة...' : 'رفع صورة خلفية الهيرو'}</span>
                  </button>

                  {settings.texts.heroBackgroundImage && (
                    <button
                      type="button"
                      onClick={() => handleTextChange('heroBackgroundImage', '')}
                      disabled={isSaving}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إزالة الصورة</span>
                    </button>
                  )}
                </div>

                {/* Opacity slider */}
                <div className="flex items-center gap-3 w-full sm:w-64">
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">الشفافية:</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={settings.texts.heroBackgroundOverlayOpacity ?? 35}
                    onChange={(e) => handleTextChange('heroBackgroundOverlayOpacity', Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-slate-700 w-10 text-left">
                    {settings.texts.heroBackgroundOverlayOpacity ?? 35}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Donations Section Cover Image (غلاف قسم التبرعات) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>صورة غلاف قسم التبرعات والمشاريع (Donations Cover Image)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">تظهر في خلفية بانر حملات التبرع</span>
            </div>

            <div className="space-y-4">
              <div className="w-full h-44 rounded-2xl border border-slate-200 overflow-hidden relative bg-slate-950 flex items-center justify-center">
                <img
                  src={settings.texts.donationsSectionCoverImage || DEFAULT_DONATIONS_COVER_IMAGE}
                  alt="Donations Cover Preview"
                  className="w-full h-full object-cover"
                  style={{
                    opacity: (100 - (settings.texts.donationsSectionCoverOverlayOpacity ?? DEFAULT_DONATIONS_COVER_OPACITY)) / 100,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-white font-black text-sm drop-shadow-md">
                    {settings.texts.donationsSectionTitle || 'تبرع وشارك في مشاريع التنمية'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={isUploadingCover || isSaving}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingCover ? 'جاري رفع الصورة...' : 'رفع غلاف قسم التبرعات'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleTextChange('donationsSectionCoverImage', DEFAULT_DONATIONS_COVER_IMAGE);
                      handleTextChange('donationsSectionCoverOverlayOpacity', DEFAULT_DONATIONS_COVER_OPACITY);
                    }}
                    disabled={isSaving}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة الغلاف الافتراضي</span>
                  </button>
                </div>

                {/* Opacity slider */}
                <div className="flex items-center gap-3 w-full sm:w-64">
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">درجة التعتيم:</span>
                  <input
                    type="range"
                    min="10"
                    max="95"
                    step="5"
                    value={settings.texts.donationsSectionCoverOverlayOpacity ?? DEFAULT_DONATIONS_COVER_OPACITY}
                    onChange={(e) => handleTextChange('donationsSectionCoverOverlayOpacity', Number(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-slate-700 w-10 text-left">
                    {settings.texts.donationsSectionCoverOverlayOpacity ?? DEFAULT_DONATIONS_COVER_OPACITY}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>عند تعديل الألوان والشعارات والخلفيات، اضغط «حفظ التعديلات» لاعتمادها بشكل دائم في قاعدة البيانات.</span>
            </div>
            <button
              id="btn-save-portal-ui-settings-bottom-appearance"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ring-2 ring-emerald-400/40"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'جاري حفظ التعديلات في قاعدة البيانات...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 4: SUMMARY & DATABASE VERIFICATION ================= */}
      {activeSubTab === 'summary' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>دليل الصلاحيات وحالة ثبات البيانات في السحابة</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>عزل كامل وقواعد أمان صارمة</span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                يتم تخزين إعدادات الواجهة العامة في قاعدة بيانات مخصصة على الخادم ومجموعة سحابية موازية (`portal_settings`) مستقلة تماماً عن إعدادات الجمعيات المستقلة، مع منع أي تداخل بين المنصات.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Save className="w-4 h-4 text-cyan-600" />
                <span>ثبات دائم ومطابقة بعد الحفظ</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                عند النقر على زر «حفظ التعديلات»، يقوم النظام برفع الصور إلى خدمة التخزين الدائمة، وحفظ الإعدادات في قاعدة البيانات، ثم إعادة قراءة البيانات للتأكد من كتابتها بنجاح قبل عرض رسالة التأكيد.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>أمان استعادة الضبط الافتراضي</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                يمكن في أي وقت استرجاع التهيئة الرسمية الأصلية لجميع الأقسام والنصوص والألوان بنقرة واحدة عبر زر «إعادة الإعداد الافتراضي»، مع اشتراط تأكيد العملية لتفادي الأخطاء غير المقصودة.
              </p>
            </div>
          </div>

          {/* Database Verification Status Table */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-black text-slate-800">بيانات التخزين والتحقق الحالية:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">آخر تحديث في قاعدة البيانات:</span>
                <span className="font-bold text-slate-800 font-mono text-[11px]">
                  {settings.lastUpdated
                    ? new Date(settings.lastUpdated).toLocaleString('ar-MA')
                    : 'غير محدد'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">المسؤول عن التعديل:</span>
                <span className="font-bold text-emerald-700">{settings.updatedBy || 'Super Admin'}</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">حالة شعار المنصة:</span>
                <span className="font-bold text-slate-800">
                  {settings.logoUrl || settings.texts.platformLogoUrl ? '✓ شعار مخصص محفوظ' : 'الشعار الافتراضي'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">اللون الرئيسي الحالي:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-slate-300"
                    style={{ backgroundColor: currentTheme.primaryColor || '#059669' }}
                  />
                  <span className="font-mono font-bold text-slate-800">{currentTheme.primaryColor || '#059669'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= STICKY / FLOATING BOTTOM SAVE BAR ================= */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-8 sm:right-8 z-40 max-w-4xl mx-auto bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-100">توجد تعديلات جديدة غير محفوظة على واجهة المنصة</p>
              <p className="text-[11px] text-slate-400">احفظ التعديلات الآن لتثبيتها واعتمادها بشكل دائم في قاعدة البيانات</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleRefreshFromServer}
              disabled={isSaving || isRefreshing}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              تراجع / إلغاء
            </button>
            <button
              id="btn-save-portal-ui-settings-sticky"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 ring-2 ring-emerald-300/40"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'جاري حفظ التعديلات...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= RESET CONFIRMATION MODAL ================= */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <RotateCcw className="w-7 h-7" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900">تأكيد استعادة الإعدادات الافتراضية</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                هل أنت متأكد من رغبتك في إعادة ضبط واجهة المنصة للقيم الافتراضية؟ سيتم تفعيل كافة الأقسام والفلاتر وإرجاع العناوين والنصوص والألوان الأصلية.
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
              ⚠️ هذا الإجراء سيتم حفظه مباشرة في قاعدة البيانات الدائمة على الخادم.
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                تأكيد الاستعادة الافتراضية
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
