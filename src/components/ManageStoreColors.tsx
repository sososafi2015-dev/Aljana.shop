import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Palette,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Smartphone,
  Eye,
  Sliders,
  Type,
  MousePointerClick,
  Layers,
  Layout,
  Link2,
  Sparkles,
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  Sun,
  Moon,
  Contrast,
  HelpCircle,
  Undo2
} from 'lucide-react';
import { StoreThemeColors, AssociationSettings, Language } from '../types';
import { translations } from '../translations';
import { defaultStoreThemeColors } from '../initialData';
import { applyStoreTheme } from '../utils/themeEngine';

interface ManageStoreColorsProps {
  settings: AssociationSettings;
  onUpdateSettings: (newSettings: AssociationSettings) => void;
  lang: Language;
  onLogAudit: (action: 'create' | 'update' | 'delete', description: string) => void;
}

// Curated themes / palettes for instant harmonious styling
interface ColorPreset {
  id: string;
  nameAr: string;
  nameFr: string;
  nameEn: string;
  colors: StoreThemeColors;
}

const PRESET_THEMES: ColorPreset[] = [
  {
    id: 'emerald_royal',
    nameAr: 'الزمردي الملكي (الافتراضي الرسمي)',
    nameFr: 'Émeraude Royale (Par défaut)',
    nameEn: 'Royal Emerald (Official Default)',
    colors: { ...defaultStoreThemeColors },
  },
  {
    id: 'ocean_solidarity',
    nameAr: 'الأزرق البحري التضامني',
    nameFr: 'Bleu Océan Solidaire',
    nameEn: 'Ocean Solidarity Blue',
    colors: {
      primaryColor: '#0284c7',
      secondaryColor: '#0f172a',
      buttonColor: '#0284c7',
      headingColor: '#0c4a6e',
      textColor: '#334155',
      backgroundColor: '#f0f9ff',
      linkColor: '#0369a1',
      bannerOverlayColor: '#082f49',
      navbarColor: '#ffffff',
      cardColor: '#ffffff',
    },
  },
  {
    id: 'burgundy_gold',
    nameAr: 'العنابي والذهبي الوقور',
    nameFr: 'Bordeaux & Or Noble',
    nameEn: 'Burgundy & Noble Gold',
    colors: {
      primaryColor: '#9f1239',
      secondaryColor: '#881337',
      buttonColor: '#be123c',
      headingColor: '#4c0519',
      textColor: '#475569',
      backgroundColor: '#fff1f2',
      linkColor: '#9f1239',
      bannerOverlayColor: '#1c0309',
      navbarColor: '#ffffff',
      cardColor: '#ffffff',
    },
  },
  {
    id: 'dark_luxury',
    nameAr: 'الداكن الفاخر العصري',
    nameFr: 'Luxe Sombre Moderne',
    nameEn: 'Modern Dark Luxury',
    colors: {
      primaryColor: '#10b981',
      secondaryColor: '#1e293b',
      buttonColor: '#10b981',
      headingColor: '#f8fafc',
      textColor: '#cbd5e1',
      backgroundColor: '#0f172a',
      linkColor: '#34d399',
      bannerOverlayColor: '#020617',
      navbarColor: '#1e293b',
      cardColor: '#1e293b',
    },
  },
  {
    id: 'earthy_olive',
    nameAr: 'الزيتوني والترابي التراثي',
    nameFr: 'Olive & Terre Patrimoine',
    nameEn: 'Heritage Olive & Earth',
    colors: {
      primaryColor: '#4d7c0f',
      secondaryColor: '#365314',
      buttonColor: '#65a30d',
      headingColor: '#1a2e05',
      textColor: '#3f3f46',
      backgroundColor: '#fefce8',
      linkColor: '#4d7c0f',
      bannerOverlayColor: '#142304',
      navbarColor: '#ffffff',
      cardColor: '#ffffff',
    },
  },
];

export const ManageStoreColors: React.FC<ManageStoreColorsProps> = ({
  settings,
  onUpdateSettings,
  lang,
  onLogAudit,
}) => {
  const t = translations[lang] as any;

  // Initial colors from settings or defaults
  const initialColors: StoreThemeColors = {
    ...defaultStoreThemeColors,
    ...(settings.themeColors || {}),
  };

  // Staged colors draft in state (NOT applied to storefront until saved)
  const [draftColors, setDraftColors] = useState<StoreThemeColors>(initialColors);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'core' | 'content' | 'surfaces'>('all');

  // Check if draft has unsaved differences from settings
  const hasUnsavedChanges = Object.keys(draftColors).some(
    (key) => draftColors[key as keyof StoreThemeColors] !== initialColors[key as keyof StoreThemeColors]
  );

  // Helper to validate and sanitize HEX color input
  const handleHexChange = (key: keyof StoreThemeColors, val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('#')) {
      clean = '#' + clean;
    }
    // Allow typing up to 7 chars (# + 6 hex)
    if (clean.length <= 7) {
      setDraftColors((prev) => ({
        ...prev,
        [key]: clean,
      }));
    }
  };

  // Reset a single color back to default
  const handleResetSingleColor = (key: keyof StoreThemeColors) => {
    setDraftColors((prev) => ({
      ...prev,
      [key]: defaultStoreThemeColors[key],
    }));
  };

  // Apply a preset to draft for preview
  const handleApplyPreset = (preset: ColorPreset) => {
    setDraftColors({ ...preset.colors });
  };

  // Instant apply & save preset directly to storefront
  const handleInstantApplyPreset = (preset: ColorPreset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDraftColors({ ...preset.colors });
    const updatedSettings: AssociationSettings = {
      ...settings,
      themeColors: { ...preset.colors },
    };

    applyStoreTheme(preset.colors);
    onUpdateSettings(updatedSettings);
    onLogAudit('update', `تطبيق وحفظ نظام ألوان المتجر: ${preset.nameAr}`);
    setSuccessMessage(`تم حفظ الألوان وتطبيق نظام «${preset.nameAr}» بنجاح ✓`);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Save changes permanently and apply to storefront
  const handleSaveChanges = () => {
    const updatedSettings: AssociationSettings = {
      ...settings,
      themeColors: { ...draftColors },
    };

    // Apply theme immediately to storefront
    applyStoreTheme(draftColors);
    onUpdateSettings(updatedSettings);
    onLogAudit('update', 'تحديث وتخصيص ألوان واجهة المتجر وتطبيقها بشكل متناسق');
    setSuccessMessage('تم حفظ الألوان وتطبيقها بنجاح ✓');
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Confirm Reset all to factory defaults
  const handleConfirmResetDefaults = () => {
    setDraftColors({ ...defaultStoreThemeColors });

    const updatedSettings: AssociationSettings = {
      ...settings,
      themeColors: { ...defaultStoreThemeColors },
    };

    applyStoreTheme(defaultStoreThemeColors);
    onUpdateSettings(updatedSettings);
    onLogAudit('update', 'استعادة ألوان واجهة المتجر إلى التصميم الافتراضي المعتمد');
    setIsResetModalOpen(false);
    setSuccessMessage('تم استعادة الألوان الافتراضية وتطبيقها بنجاح ✓');
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Definition of the 10 requested colors
  const colorItems: Array<{
    key: keyof StoreThemeColors;
    name: string;
    description: string;
    category: 'core' | 'content' | 'surfaces';
    icon: React.ComponentType<{ className?: string }>;
    defaultVal: string;
    sampleUsage: string;
  }> = [
    {
      key: 'primaryColor',
      name: t.primaryColor || 'اللون الرئيسي',
      description: t.primaryColorDesc || 'يستخدم في الأيقونات الرئيسية، شارات التمييز، واللمسات الجمالية البارزة',
      category: 'core',
      icon: Sparkles,
      defaultVal: defaultStoreThemeColors.primaryColor,
      sampleUsage: 'الشارات التفاعلية، علامات التبويب، واللمسات الجمالية',
    },
    {
      key: 'secondaryColor',
      name: t.secondaryColor || 'اللون الثانوي',
      description: t.secondaryColorDesc || 'يستخدم في الأشرطة الداكنة، الشارات التكميلية، والتفاصيل المتوازنة',
      category: 'core',
      icon: Layers,
      defaultVal: defaultStoreThemeColors.secondaryColor,
      sampleUsage: 'الأشرطة الداكنة العلوية والشارات الثانوية',
    },
    {
      key: 'buttonColor',
      name: t.buttonColor || 'لون الأزرار',
      description: t.buttonColorDesc || 'يطبق على جميع أزرار الإجراءات الرئيسية، التفاعل، والتسجيل في الواجهة',
      category: 'core',
      icon: MousePointerClick,
      defaultVal: defaultStoreThemeColors.buttonColor,
      sampleUsage: 'أزرار التبرع، الانخراط، والتنقل الرئيسية',
    },
    {
      key: 'headingColor',
      name: t.headingColor || 'لون العناوين',
      description: t.headingColorDesc || 'يطبق على عناوين الأقسام، عناوين البطاقات، والخطوط البارزة',
      category: 'content',
      icon: Type,
      defaultVal: defaultStoreThemeColors.headingColor,
      sampleUsage: 'عناوين الأقسام، العناوين الرئيسية، وبطاقات الأنشطة',
    },
    {
      key: 'textColor',
      name: t.textColor || 'لون النصوص',
      description: t.textColorDesc || 'يطبق على الفقرات النصية، الأوصاف، والتفاصيل التوضيحية لضمان سهولة القراءة',
      category: 'content',
      icon: Sliders,
      defaultVal: defaultStoreThemeColors.textColor,
      sampleUsage: 'الفقرات النصية العادية، الأوصاف، وتفاصيل الأنشطة',
    },
    {
      key: 'linkColor',
      name: t.linkColor || 'لون الروابط',
      description: t.linkColorDesc || 'يطبق على الروابط التشعبية التفاعلية ونصوص الإجراءات الإضافية',
      category: 'content',
      icon: Link2,
      defaultVal: defaultStoreThemeColors.linkColor,
      sampleUsage: 'روابط المزيد، نصوص "عرض التفاصيل"، والروابط التشعبية',
    },
    {
      key: 'backgroundColor',
      name: t.backgroundColor || 'لون الخلفية',
      description: t.backgroundColorDesc || 'اللون الأساسي لخلفية صفحات المتجر وحاويات المحتوى الرئيسية',
      category: 'surfaces',
      icon: Layout,
      defaultVal: defaultStoreThemeColors.backgroundColor,
      sampleUsage: 'خلفية الواجهة الرئيسية وصفحات المتجر بالكامل',
    },
    {
      key: 'bannerOverlayColor',
      name: t.bannerOverlayColor || 'لون البانرات والتعتيم',
      description: t.bannerOverlayColorDesc || 'لون طبقة التعتيم (Overlay) المتوضعة فوق صورة الغلاف في البانر الرئيسي',
      category: 'surfaces',
      icon: Moon,
      defaultVal: defaultStoreThemeColors.bannerOverlayColor,
      sampleUsage: 'طبقة التعتيم الشفافة فوق صورة غلاف البانر الرئيسي',
    },
    {
      key: 'navbarColor',
      name: t.navbarColor || 'ألوان القوائم',
      description: t.navbarColorDesc || 'لون شريط التنقل العلوي، القوائم المنسدلة، وأشرطة التصفح',
      category: 'surfaces',
      icon: Monitor,
      defaultVal: defaultStoreThemeColors.navbarColor,
      sampleUsage: 'شريط التنقل الرئيسي (Navbar) والقوائم العلوية',
    },
    {
      key: 'cardColor',
      name: t.cardColor || 'ألوان البطاقات والعناصر',
      description: t.cardColorDesc || 'خلفيات بطاقات الأنشطة، الإحصائيات، وصناديق المعلومات التفاعلية',
      category: 'surfaces',
      icon: Layers,
      defaultVal: defaultStoreThemeColors.cardColor,
      sampleUsage: 'خلفية بطاقات الأنشطة، الإحصائيات، وسجلات الشفافية',
    },
  ];

  const filteredColorItems = colorItems.filter((item) => {
    if (activeCategoryTab === 'all') return true;
    return item.category === activeCategoryTab;
  });

  return (
    <div className="space-y-6" id="admin-store-colors-section">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-emerald-900/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
            <Palette className="w-3.5 h-3.5" />
            <span>{t.manageStoreColors || 'إدارة ألوان واجهة المتجر'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black">
              جديد
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            {t.storeColorsTitle || 'إدارة وتخصيص ألوان واجهة المتجر'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            {t.storeColorsDesc || 'لوحة مركزية متكاملة للتحكم في ألوان كافة عناصر واجهة المتجر مع معاينة تفاعلية حية وتطبيق فوري ومتناسق على جميع الأجهزة.'}
          </p>
        </div>

        {/* Global Actions in Header */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            id="btn-reset-store-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.resetColorDefaults || 'إعادة الألوان الافتراضية'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={!hasUnsavedChanges}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-md cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-300 animate-pulse'
                : 'bg-emerald-800 text-emerald-200 opacity-60 cursor-not-allowed'
            }`}
            id="btn-save-store-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.saveColorChanges || 'حفظ التغييرات'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-bold">{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsaved Changes Sticky Banner (if any) */}
      {hasUnsavedChanges && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-bold">
              توجد تعديلات لونية جديدة تظهر في المعاينة أدناه ولم تُحفظ بعد في المتجر الفعلي.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSaveChanges}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all flex items-center gap-1.5 text-xs shrink-0 cursor-pointer shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>حفظ وتطبيق الآن</span>
          </button>
        </div>
      )}

      {/* =========================================================================
          PRESET THEMES SECTION (تنسيقات وباليتات لونية جاهزة بنقرة واحدة)
         ========================================================================= */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs sm:text-sm font-black text-slate-800">
              {t.presetThemes || 'تنسيقات وباليتات لونية متناسقة جاهزة (بنقرة واحدة)'}
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            اختر باليتة متناسقة ثم عدل ألوانها بحرية قبل الحفظ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {PRESET_THEMES.map((preset) => {
            const isMatch = (
              draftColors.primaryColor === preset.colors.primaryColor &&
              draftColors.backgroundColor === preset.colors.backgroundColor &&
              draftColors.buttonColor === preset.colors.buttonColor
            );

            return (
              <div
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isMatch
                    ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/30 shadow-xs'
                    : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold line-clamp-1">
                    {lang === 'ar' ? preset.nameAr : lang === 'fr' ? preset.nameFr : preset.nameEn}
                  </span>
                  {isMatch && (
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                {/* Color Swatch Dots */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs"
                    style={{ backgroundColor: preset.colors.primaryColor }}
                    title="اللون الرئيسي"
                  />
                  <span
                    className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs"
                    style={{ backgroundColor: preset.colors.buttonColor }}
                    title="لون الأزرار"
                  />
                  <span
                    className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs"
                    style={{ backgroundColor: preset.colors.secondaryColor }}
                    title="اللون الثانوي"
                  />
                  <span
                    className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs"
                    style={{ backgroundColor: preset.colors.backgroundColor }}
                    title="لون الخلفية"
                  />
                  <span
                    className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs"
                    style={{ backgroundColor: preset.colors.bannerOverlayColor }}
                    title="تعتيم البانر"
                  />
                </div>

                <div className="flex items-center justify-between gap-1 w-full pt-1.5 border-t border-slate-200/70 mt-0.5">
                  <span className="text-[10px] text-slate-500 font-medium">معاينة وتعديل</span>
                  <button
                    type="button"
                    onClick={(e) => handleInstantApplyPreset(preset, e)}
                    className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100/90 hover:bg-emerald-200 px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                    title="تطبيق وحفظ هذا النظام فوراً على واجهة المتجر"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                    <span>تطبيق فوري</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          MAIN TWO COLUMNS LAYOUT:
          Left (or Right in RTL): Color Controls List
          Right (or Left in RTL): Interactive Live Store Preview
         ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* =====================================================================
            COLOR CONTROLS LIST (7 of 12 columns on XL)
           ===================================================================== */}
        <div className="xl:col-span-7 space-y-4">
          {/* Category Filter Tabs */}
          <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
              {[
                { id: 'all', label: 'جميع الألوان (10)' },
                { id: 'core', label: 'الأساسية والأزرار' },
                { id: 'content', label: 'العناوين والنصوص' },
                { id: 'surfaces', label: 'الخلفيات والقوائم' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategoryTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeCategoryTab === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-400 font-medium hidden md:inline shrink-0">
              انقر على المربع لاختيار اللون مباشرة
            </span>
          </div>

          {/* Color Control Cards */}
          <div className="space-y-3">
            {filteredColorItems.map((item) => {
              const currentColor = draftColors[item.key] || item.defaultVal;
              const isModified = currentColor.toLowerCase() !== item.defaultVal.toLowerCase();
              const Icon = item.icon;

              return (
                <div
                  key={item.key}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Label & Description */}
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: currentColor }}
                      >
                        <Icon className="w-5 h-5 drop-shadow-xs" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-sm text-slate-900">
                            {item.name}
                          </h5>
                          {isModified && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              معدل
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Color Controls: Swatch + Hex Input + Reset */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Interactive Color Picker Swatch */}
                      <label
                        className="relative w-11 h-10 rounded-xl border-2 border-slate-200 cursor-pointer shadow-xs hover:scale-105 transition-transform overflow-hidden flex items-center justify-center group"
                        style={{ backgroundColor: currentColor }}
                        title="انقر لفتح أداة اختيار اللون"
                      >
                        <input
                          type="color"
                          value={currentColor.length === 7 ? currentColor : item.defaultVal}
                          onChange={(e) => {
                            setDraftColors((prev) => ({
                              ...prev,
                              [item.key]: e.target.value,
                            }));
                          }}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                        <Palette className="w-4 h-4 text-white opacity-0 group-hover:opacity-90 drop-shadow-md transition-opacity" />
                      </label>

                      {/* HEX Code Text Input */}
                      <div className="relative w-28">
                        <input
                          type="text"
                          value={currentColor.toUpperCase()}
                          onChange={(e) => handleHexChange(item.key, e.target.value)}
                          placeholder="#000000"
                          className="w-full px-2.5 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase text-center"
                          maxLength={7}
                        />
                      </div>

                      {/* Individual Reset Button */}
                      <button
                        type="button"
                        onClick={() => handleResetSingleColor(item.key)}
                        disabled={!isModified}
                        title={`إعادة ${item.name} إلى القيمة الافتراضية (${item.defaultVal})`}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contextual Usage Note */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{item.sampleUsage}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      الافتراضي: {item.defaultVal}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =====================================================================
            LIVE STOREFRONT PREVIEW (5 of 12 columns on XL, sticky)
           ===================================================================== */}
        <div className="xl:col-span-5 sticky top-20 space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="text-xs sm:text-sm font-black text-slate-900">
                  {t.liveStorePreview || 'معاينة مباشرة لواجهة المتجر'}
                </h4>
              </div>

              {/* Viewport Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    previewDevice === 'desktop'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={t.desktopPreview || 'معاينة شاشة الكمبيوتر'}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">كمبيوتر</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    previewDevice === 'mobile'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={t.mobilePreview || 'معاينة شاشة الهاتف'}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">هاتف</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              {t.livePreviewNotice || 'تظهر جميع التعديلات اللونية هنا فورياً قبل الحفظ لتجربة التناسق والتباين البصري.'}
            </p>

            {/* ===================================================================
                THE LIVE SIMULATION CANVAS
               =================================================================== */}
            <div
              className={`mx-auto rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md transition-all duration-300 ${
                previewDevice === 'mobile' ? 'max-w-xs' : 'w-full'
              }`}
              style={{
                backgroundColor: draftColors.backgroundColor,
                color: draftColors.textColor,
              }}
            >
              {/* Simulated Top Navbar */}
              <div
                className="p-3 border-b transition-colors flex items-center justify-between gap-2"
                style={{
                  backgroundColor: draftColors.navbarColor,
                  borderColor: 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0 shadow-2xs"
                    style={{ backgroundColor: draftColors.primaryColor }}
                  >
                    ش
                  </div>
                  <div>
                    <h6
                      className="text-xs font-black leading-tight line-clamp-1"
                      style={{ color: draftColors.headingColor }}
                    >
                      {settings.name}
                    </h6>
                    <span
                      className="text-[9px] line-clamp-1 opacity-75 font-medium"
                      style={{ color: draftColors.textColor }}
                    >
                      بوابة الشفافية الرسمية
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${draftColors.primaryColor}15`,
                      color: draftColors.primaryColor,
                    }}
                  >
                    الرئيسية
                  </span>
                  <button
                    type="button"
                    className="text-[10px] font-bold px-2 py-1 rounded-lg text-white shadow-2xs"
                    style={{ backgroundColor: draftColors.buttonColor }}
                  >
                    دخول
                  </button>
                </div>
              </div>

              {/* Simulated Hero Banner */}
              <div className="relative overflow-hidden p-4 min-h-[160px] flex flex-col justify-end bg-slate-900 text-white">
                {/* Background image */}
                {settings.bannerImageUrl && (
                  <img
                    src={settings.bannerImageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                {/* Banner Overlay Layer */}
                <div
                  className="absolute inset-0 transition-all pointer-events-none"
                  style={{
                    backgroundColor: draftColors.bannerOverlayColor,
                    opacity: (settings.bannerDarknessOverlay ?? 40) / 100,
                  }}
                />

                {/* Banner Content */}
                <div className="relative z-10 space-y-1.5">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border"
                    style={{
                      backgroundColor: `${draftColors.secondaryColor}D0`,
                      color: '#ffffff',
                      borderColor: 'rgba(255,255,255,0.2)',
                    }}
                  >
                    جمعية معتمدة ومسجلة
                  </span>
                  <h4 className="text-sm font-black leading-tight text-white drop-shadow-md">
                    {settings.name}
                  </h4>
                  <p className="text-[10px] text-slate-100 line-clamp-2 leading-relaxed opacity-95">
                    {settings.tagline}
                  </p>

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-xs cursor-default"
                      style={{ backgroundColor: draftColors.buttonColor }}
                    >
                      ساهم معنا
                    </button>
                    <span
                      className="text-[10px] font-bold underline cursor-default flex items-center gap-0.5"
                      style={{ color: draftColors.linkColor }}
                    >
                      <span>عرض التقارير</span>
                      <ChevronRight className="w-2.5 h-2.5 rtl:rotate-180" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Simulated Storefront Body & Card */}
              <div className="p-3 sm:p-4 space-y-3">
                {/* Section Title */}
                <div className="flex items-center justify-between">
                  <h5
                    className="text-xs font-black tracking-tight"
                    style={{ color: draftColors.headingColor }}
                  >
                    أحدث أنشطة ومشاريع المتجر
                  </h5>
                  <span
                    className="text-[10px] font-bold cursor-default"
                    style={{ color: draftColors.linkColor }}
                  >
                    عرض الكل ←
                  </span>
                </div>

                {/* Sample Activity Card */}
                <div
                  className="p-3 rounded-xl border transition-all space-y-2 shadow-2xs"
                  style={{
                    backgroundColor: draftColors.cardColor,
                    borderColor: 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="px-2 py-0.5 rounded-md text-[9px] font-bold text-white"
                      style={{ backgroundColor: draftColors.secondaryColor }}
                    >
                      مشروع تنموي
                    </span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: draftColors.primaryColor }}
                    >
                      مكتمل بنسبة 85%
                    </span>
                  </div>

                  <h6
                    className="text-xs font-black leading-snug"
                    style={{ color: draftColors.headingColor }}
                  >
                    مشروع حفر وتجهيز بئر مياه الشرب
                  </h6>

                  <p
                    className="text-[10px] leading-relaxed line-clamp-2"
                    style={{ color: draftColors.textColor }}
                  >
                    مبادرة تنموية تهدف لتزويد سكان قرية الشايف بالماء الصالح للشرب بالطاقة الشمسية.
                  </p>

                  <div className="pt-1 flex items-center justify-between border-t border-slate-100/80">
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: draftColors.textColor }}
                    >
                      الهدف: 45,000 درهم
                    </span>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-2xs cursor-default"
                      style={{ backgroundColor: draftColors.buttonColor }}
                    >
                      تبرع الآن
                    </button>
                  </div>
                </div>

                {/* Simulated Footer strip */}
                <div
                  className="p-2 rounded-lg text-center text-[9px] opacity-75 font-medium border"
                  style={{
                    backgroundColor: draftColors.cardColor,
                    color: draftColors.textColor,
                    borderColor: 'rgba(0,0,0,0.05)',
                  }}
                >
                  جميع الحقوق محفوظة © {settings.name} {new Date().getFullYear()}
                </div>
              </div>
            </div>

            {/* Bottom Actions inside Preview panel */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="text-slate-500 hover:text-slate-800 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة الافتراضي</span>
              </button>

              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={!hasUnsavedChanges}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  hasUnsavedChanges
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>حفظ وتطبيق الألوان</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RESET ALL COLORS CONFIRMATION MODAL
         ========================================================================= */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <RotateCcw className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h4 className="text-base sm:text-lg font-black text-slate-900">
                  {t.resetColorDefaults || 'إعادة الألوان الافتراضية'}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {t.resetColorDefaultsConfirm || 'هل أنت متأكد من رغبتك في إعادة جميع ألوان واجهة المتجر إلى التصميم الافتراضي المعتمد؟'}
                </p>
              </div>

              {/* Default colors swatch preview */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-700 block">
                  سيتم تطبيق القيم الافتراضية التالية:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#047857]" />
                    <span>الرئيسي: #047857</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#059669]" />
                    <span>الأزرار: #059669</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#0f172a]" />
                    <span>العناوين: #0f172a</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#f8fafc] border border-slate-300" />
                    <span>الخلفية: #f8fafc</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {t.cancel || 'إلغاء'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetDefaults}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  {t.confirm || 'تأكيد الاستعادة'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
