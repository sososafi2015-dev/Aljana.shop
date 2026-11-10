import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Sparkles, 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight,
  Home,
  Search, 
  MapPin, 
  Globe, 
  CreditCard, 
  ExternalLink, 
  HeartHandshake, 
  Lock, 
  BarChart3,
  Award,
  Layers,
  ChevronLeft,
  LogIn,
  FolderKanban,
  Coins,
  MessageCircle,
  Heart,
  LayoutDashboard,
  Play,
  Video,
  X
} from 'lucide-react';
import { getPublicPortalTenants, MASTER_TEMPLATE_TENANT_ID } from '../tenantStorage';
import {
  getPortalSettings,
  fetchPortalSettings,
  PORTAL_SETTINGS_EVENT,
  DEFAULT_PORTAL_SETTINGS,
  DEFAULT_WATCH_VIDEOS_COLORS
} from '../portalSettingsStorage';
import { AssociationTenant, PlatformPortalSettings } from '../types';
import { DonationTeaserSection } from './DonationTeaserSection';
import { DonationProjectsPage } from './DonationProjectsPage';
import { usePlatformIdentity } from '../api/platformIdentityApi';
import { PlatformSupportModal } from './PlatformSupportModal';
import { PlatformTutorialsSection } from './PlatformTutorialsSection';
import { hexToRgba } from './WatchVideosColorSettingsPanel';

interface MainPlatformPortalProps {
  onSelectTenant: (tenantId: string, fromDonations?: boolean) => void;
  onOpenCreateWizard: () => void;
  onOpenMasterAdmin: () => void;
  onOpenLoginModal?: () => void;
  onDirectDonate?: (assoc: AssociationTenant) => void;
  initialDonationsOpen?: boolean;
  onDonationsPageOpenChange?: (isOpen: boolean) => void;
}

export const MainPlatformPortal: React.FC<MainPlatformPortalProps> = ({
  onSelectTenant,
  onOpenCreateWizard,
  onOpenMasterAdmin,
  onOpenLoginModal,
  onDirectDonate,
  initialDonationsOpen = false,
  onDonationsPageOpenChange,
}) => {
  // Only the Master Template "جمعية النور للتنمية والتضامن" is shown on the public portal
  const tenants = getPublicPortalTenants();
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [portalSettings, setPortalSettings] = useState<PlatformPortalSettings>(getPortalSettings);
  const [isDonationsPageOpen, setIsDonationsPageOpen] = useState<boolean>(initialDonationsOpen);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [isWatchVideosOpen, setIsWatchVideosOpen] = useState<boolean>(false);
  const { identity: platformIdentity } = usePlatformIdentity();

  // Secret Master Admin Reveal Trigger: hidden by default for users.
  // Only revealed after clicking the platform name «syoumax منصة العمل الجمعوي» 5 consecutive times.
  const [showMasterAdminEntry, setShowMasterAdminEntry] = useState<boolean>(false);
  const brandClickCountRef = useRef<number>(0);
  const lastBrandClickTimeRef = useRef<number>(0);
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleBrandSecretClick = (e?: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    // If more than 4 seconds passed since last click, start fresh count at 1
    if (now - lastBrandClickTimeRef.current > 4000) {
      brandClickCountRef.current = 1;
    } else {
      brandClickCountRef.current += 1;
    }
    lastBrandClickTimeRef.current = now;

    // After 5 consecutive clicks on the platform name, reveal the admin button
    if (brandClickCountRef.current >= 5) {
      setShowMasterAdminEntry(true);
      brandClickCountRef.current = 0;

      // Reset any active auto-hide timer
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }

      // Automatically hide the button again after 5 minutes of inactivity
      autoHideTimerRef.current = setTimeout(() => {
        setShowMasterAdminEntry(false);
      }, 300000);
    }
  };

  useEffect(() => {
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsDonationsPageOpen(initialDonationsOpen);
  }, [initialDonationsOpen]);

  const handleOpenDonations = () => {
    setIsDonationsPageOpen(true);
    onDonationsPageOpenChange?.(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseDonations = () => {
    setIsDonationsPageOpen(false);
    onDonationsPageOpenChange?.(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToHome = () => {
    setSearchQuery('');
    setCityFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenWhatsApp = () => {
    const rawNumber = platformIdentity?.whatsapp || '00212718861646';
    // Clean to digits only, stripping +, 00, spaces, dashes
    const cleanDigits = rawNumber.replace(/[\s\-\(\)\.]/g, '').replace(/^\+|^00/, '');
    const message = encodeURIComponent(`السلام عليكم ورحمة الله، أتواصل معكم بخصوص ${platformIdentity?.platformName || 'syoumax منصة العمل الجمعوي'}`);
    const whatsappUrl = `https://wa.me/${cleanDigits}?text=${message}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  // Synchronize portal settings with backend database
  useEffect(() => {
    fetchPortalSettings().then((fresh) => {
      setPortalSettings(fresh);
    });

    const handleSettingsChange = (e: any) => {
      if (e.detail) {
        setPortalSettings(e.detail);
      } else {
        setPortalSettings(getPortalSettings());
      }
    };

    window.addEventListener(PORTAL_SETTINGS_EVENT, handleSettingsChange);
    return () => window.removeEventListener(PORTAL_SETTINGS_EVENT, handleSettingsChange);
  }, []);

  const visibility = portalSettings.visibility || DEFAULT_PORTAL_SETTINGS.visibility;
  const texts = portalSettings.texts || DEFAULT_PORTAL_SETTINGS.texts;

  // If user opens the dedicated donations page, render the full dedicated page
  if (isDonationsPageOpen) {
    return (
      <DonationProjectsPage
        onBackToHome={handleCloseDonations}
        onSelectTenant={(tenantId) => onSelectTenant(tenantId, true)}
        onDirectDonate={onDirectDonate}
        customTitle={texts.donationsSectionTitle}
        customDescription={texts.donationsSectionDesc}
        coverImage={texts.donationsSectionCoverImage}
        coverOverlayOpacity={texts.donationsSectionCoverOverlayOpacity}
      />
    );
  }

  // Extract unique cities
  const cities = Array.from(new Set(tenants.map((t) => t.city).filter(Boolean)));

  // Filtered tenants
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch = 
      !visibility.searchFilter ||
      !searchQuery.trim() ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.tagline && t.tagline.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCity = !visibility.cityFilter || cityFilter === 'all' || t.city === cityFilter;
    return matchesSearch && matchesCity;
  });

  const masterTemplate = tenants.find((t) => t.isTemplate || t.id === MASTER_TEMPLATE_TENANT_ID) || tenants[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col" dir="rtl">
      {/* ================= TOP ANNOUNCEMENT BAR ================= */}
      {visibility.announcementBar && (
        <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {texts.announcementBadge || 'SaaS Multi-Tenant'}
              </span>
              <span className="hidden sm:inline text-slate-300 font-medium">
                {texts.announcementText || 'المنصة السحابية الموحدة لإدارة الجمعيات بنظام استقلال البيانات التام والصلاحيات المتعددة'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {masterTemplate && (
                <button
                  id="btn-portal-topbar-app-interface"
                  onClick={() => onSelectTenant(masterTemplate.id)}
                  className="text-[11px] font-black text-emerald-300 hover:text-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/40"
                  title="الانتقال إلى واجهة التطبيق الرئيسية"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تصفح واجهة التطبيق</span>
                </button>
              )}
              {onOpenLoginModal && (
                <>
                  <button
                    onClick={onOpenLoginModal}
                    className="text-[11px] font-bold text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>تسجيل الدخول</span>
                  </button>
                  {showMasterAdminEntry && <span className="text-slate-600 text-xs">•</span>}
                </>
              )}
              {showMasterAdminEntry && (
                <button
                  id="btn-portal-topbar-master-admin"
                  onClick={onOpenMasterAdmin}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer animate-fade-in"
                  title="دخول إلى لوحة الإدارة"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>دخول إلى لوحة الإدارة</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN NAVIGATION HEADER ================= */}
      {visibility.mainHeader && (
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-2">
            {/* Logo & Platform Name «syoumax منصة العمل الجمعوي» (Click 5 times consecutively to reveal Admin Button) */}
            <div
              onClick={handleBrandSecretClick}
              className="flex items-center gap-2.5 sm:gap-3.5 cursor-pointer select-none group touch-manipulation active:scale-[0.98] transition-transform"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleBrandSecretClick();
                }
              }}
              title=""
            >
              {(portalSettings.logoUrl || texts.platformLogoUrl || platformIdentity?.platformLogo) ? (
                <div className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-full bg-white border-2 border-emerald-500/30 shadow-md shadow-emerald-900/10 flex items-center justify-center p-1 shrink-0 overflow-hidden transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-600 group-hover:shadow-lg group-active:scale-95">
                  <img
                    src={portalSettings.logoUrl || texts.platformLogoUrl || platformIdentity?.platformLogo}
                    alt={texts.headerBrandName || platformIdentity?.platformName || 'شعار المنصة'}
                    className="w-full h-full object-contain rounded-full select-none pointer-events-none"
                    referrerPolicy="no-referrer"
                    loading="eager"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20 shrink-0 group-active:scale-95">
                  <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
              )}
              <div>
                <div className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5 leading-tight group-hover:text-emerald-950 transition-colors">
                  <span>{texts.headerBrandName || platformIdentity?.platformName || 'syoumax منصة العمل الجمعوي'}</span>
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-black">
                    PRO
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium hidden sm:block mt-0.5">{texts.headerBrandTagline || 'منظومة رقمية شاملة لإدارة وتطوير العمل الجمعوي'}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Direct Link to Main Application Interface «واجهة التطبيق» */}
              {masterTemplate && (
                <button
                  id="btn-portal-header-app-interface"
                  onClick={() => onSelectTenant(masterTemplate.id)}
                  className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black rounded-xl shadow-md shadow-emerald-600/25 hover:shadow-emerald-600/35 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 shrink-0 ring-2 ring-emerald-400/50"
                  title="الدخول الفوري إلى واجهة التطبيق الرئيسية (النموذج المعتمد لجمعية النور)"
                >
                  <LayoutDashboard className="w-4 h-4 text-emerald-200" />
                  <span>واجهة التطبيق</span>
                </button>
              )}

              {/* Quick link to Donations & Development Projects */}
              {(visibility.donationsSection ?? true) && (
                <button
                  id="btn-portal-header-donations"
                  onClick={handleOpenDonations}
                  className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-200 cursor-pointer"
                  title="تبرع وشارك في مشاريع التنمية"
                >
                  <HeartHandshake className="w-4 h-4 text-emerald-600" />
                  <span>مشاريع التنمية والتبرع</span>
                </button>
              )}

              {/* Prominent Login Button for existing owners & admins */}
              {onOpenLoginModal && (
                <button
                  id="btn-portal-header-login"
                  onClick={onOpenLoginModal}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs sm:text-sm font-black rounded-xl border border-emerald-300 hover:border-emerald-400 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-xs active:scale-95"
                  title="تسجيل الدخول للجمعيات المسجلة"
                >
                  <LogIn className="w-4 h-4 text-emerald-700" />
                  <span>تسجيل الدخول</span>
                </button>
              )}

              {/* Secret Admin Button revealed only after 5 clicks on platform name «syoumax منصة العمل الجمعوي» */}
              {showMasterAdminEntry && (
                <button
                  id="btn-portal-header-master-admin"
                  onClick={onOpenMasterAdmin}
                  className="flex items-center gap-1.5 px-3 py-2 sm:py-2.5 text-xs font-black text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border-2 border-emerald-400/80 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-600/15 active:scale-95 animate-fade-in whitespace-nowrap"
                  title="دخول إلى لوحة الإدارة"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>دخول إلى لوحة الإدارة</span>
                </button>
              )}

              {/* WhatsApp Contact Button «تواصل معنا» */}
              <button
                id="btn-portal-header-whatsapp"
                onClick={handleOpenWhatsApp}
                className="px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-black rounded-xl shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 shrink-0"
                title={`تواصل معنا عبر واتساب: ${platformIdentity?.whatsapp || '00212718861646'}`}
              >
                <MessageCircle className="w-4 h-4 fill-white/20 shrink-0" />
                <span>تواصل معنا</span>
              </button>

              {/* The Big Glowing Create Button */}
              <button
                onClick={onOpenCreateWizard}
                className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-black rounded-xl shadow-md shadow-emerald-600/25 hover:shadow-emerald-600/35 transition-all flex items-center gap-1.5 sm:gap-2 group cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-200 group-hover:rotate-12 transition-transform shrink-0" />
                <span>{texts.createAssociationButtonText || 'إنشاء منصة للجمعية'}</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ================= HERO SECTION ================= */}
      {visibility.heroSection && (
        <section
          style={{
            background: portalSettings.theme?.heroGradientStart && portalSettings.theme?.heroGradientEnd
              ? `linear-gradient(to bottom, ${portalSettings.theme.heroGradientStart}, ${portalSettings.theme.heroGradientEnd})`
              : undefined,
          }}
          className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8"
        >
          {texts.heroBackgroundImage && (
            <img
              src={texts.heroBackgroundImage}
              alt="Hero background"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ opacity: (texts.heroBackgroundOverlayOpacity ?? 35) / 100 }}
            />
          )}
          {/* Glow ambient effects */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
              <Sparkles className="w-4 h-4" />
              <span>{texts.heroBadge || 'نظام مستقل لكل جمعية • Multi-Tenant & Multi-User Architecture'}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-snug">
              {texts.heroTitleLine1 || 'أنشئ منصة رقمية متكاملة لجمعيتك'}
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                {texts.heroTitleHighlight || 'خلال دقيقة واحدة فقط'}
              </span>
            </h1>

            <p className="text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {texts.heroDescription || (
                <>
                  المنصة تتيح لأي جمعية الحصول فوراً على نسخة إلكترونية مستقلة بالكامل مبنية على
                  <strong> هيكل وتصميم قالب «جمعية النور للتنمية والتضامن»</strong>، مع لوحة تحكم إدارية خاصة، إدارة مالية شفافة، بطاقات منخرطين، وعزل تام لقواعد البيانات.
                </>
              )}
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                onClick={onOpenCreateWizard}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-2.5 group cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                <span>{texts.heroCtaButtonText || 'إنشاء منصة احترافية للجمعية الآن'}</span>
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              </button>

              {onOpenLoginModal && (
                <button
                  id="btn-portal-hero-login"
                  onClick={onOpenLoginModal}
                  className="w-full sm:w-auto px-6 py-4 bg-slate-800/90 hover:bg-emerald-950/60 text-emerald-300 hover:text-emerald-200 border border-slate-700 hover:border-emerald-500/50 font-black text-sm sm:text-base rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
                >
                  <LogIn className="w-4 h-4 text-emerald-400" />
                  <span>تسجيل الدخول إلى منصتك</span>
                </button>
              )}

              {masterTemplate && (
                <button
                  id="btn-portal-hero-app-interface"
                  onClick={() => onSelectTenant(masterTemplate.id)}
                  className="w-full sm:w-auto px-7 py-4 bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-400/80 font-black text-sm sm:text-base rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 active:scale-95"
                >
                  <LayoutDashboard className="w-5 h-5 text-emerald-200" />
                  <span>تصفح واجهة التطبيق (النموذج المعتمد)</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Metrics Badges */}
            {visibility.heroMetrics && (
              <div className="pt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-300 max-w-3xl mx-auto">
                <div className="p-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                  <div className="text-xl sm:text-2xl font-black text-emerald-400">{tenants.length}</div>
                  <div className="text-xs text-slate-400 mt-0.5">جمعيات منضمة</div>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                  <div className="text-xl sm:text-2xl font-black text-teal-400">100%</div>
                  <div className="text-xs text-slate-400 mt-0.5">عزل تام للبيانات</div>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                  <div className="text-xl sm:text-2xl font-black text-cyan-400">24/7</div>
                  <div className="text-xs text-slate-400 mt-0.5">وصول واستقرار سحابي</div>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                  <div className="text-xl sm:text-2xl font-black text-amber-400">دقيقة 1</div>
                  <div className="text-xs text-slate-400 mt-0.5">سرعة التدشين</div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= MASTER TEMPLATE SHOWCASE ================= */}
      {/* مخفي بطلب المستخدم لمنع تكرار حقل النموذج المعتمد دون حذفه من الكود أو قاعدة البيانات */}
      {false && visibility.masterTemplateShowcase && masterTemplate && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30">
                <Award className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    {masterTemplate.name}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                    {texts.masterTemplateBadge || 'القالب الأساسي المعتمد (Master Template)'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
                  {texts.masterTemplateDescription || 'هذا هو النموذج والتصميم الذي يُستنسخ منه هيكل كل جمعية جديدة تسجل في المنصة. يحتوي على أقسام الأنشطة الميدانية، الدفتر المالي للشفافية، بطاقات الانخراط برمز QR، وحملات التبرع.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => onSelectTenant(masterTemplate.id)}
              className="w-full md:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer active:scale-95"
            >
              <span>{texts.masterTemplateButtonText || 'معاينة وتصفح القالب الأساسي'}</span>
              <ExternalLink className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </section>
      )}

      {/* ================= ASSOCIATIONS DIRECTORY / CATALOG ================= */}
      {visibility.catalogSection && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12 flex-1 space-y-6 sm:space-y-8">
          {/* Section Header & Filters */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 text-xs font-black shadow-xs">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span>{texts.catalogBadge || 'القالب الأساسي المعتمد • Master Template'}</span>
                </div>
                <button
                  type="button"
                  id="btn-back-to-home-catalog-header"
                  onClick={handleScrollToHome}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 active:bg-emerald-100 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 group"
                  title="الرجوع إلى الصفحة الرئيسية للمنصة"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform shrink-0" />
                  <span>الرجوع إلى الصفحة الرئيسية للمنصة</span>
                </button>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                {texts.catalogTitle || 'النموذج المعتمد بالواجهة العامة للمنصة'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed font-medium">
                {texts.catalogDescription || 'تُعرض حصريًا «جمعية النور للتنمية والتضامن» كقالب أساسي معتمد، بينما تبقى منصات الجمعيات المنشأة من طرف المستخدمين خاصة ومستقلة وتُدار حصريًا عبر الإدارة العامة (Super Admin).'}
              </p>
            </div>

            {/* Search & City Filter */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {visibility.searchFilter && (
                <div className="relative min-w-[220px] sm:min-w-[260px]">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={texts.searchPlaceholder || 'ابحث عن جمعية بالاسم أو المدينة...'}
                    className="w-full pl-3 pr-9 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 shadow-sm"
                  />
                </div>
              )}

              {visibility.cityFilter && cities.length > 0 && (
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 shadow-sm font-medium cursor-pointer"
                >
                  <option value="all">كل المدن</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Association Cards Display - Symmetrical and Balanced on Computer & Tablet */}
          {filteredTenants.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">لم يتم العثور على جمعيات مطابقة للبحث</h3>
              <p className="text-xs text-slate-400 mt-1">جرب تغيير كلمات البحث أو اختر "كل المدن".</p>
            </div>
          ) : filteredTenants.length === 1 ? (
            /* ================= SINGLE SHOWCASE CARD (BALANCED WITH DONATIONS SECTION) ================= */
            (() => {
              const assoc = filteredTenants[0];
              const isTemplate = assoc.isTemplate || assoc.id === MASTER_TEMPLATE_TENANT_ID;
              const isInactive = assoc.status === 'inactive';

              return (
                <div
                  key={assoc.id}
                  className="w-full bg-white rounded-3xl border border-amber-300/80 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden ring-2 ring-amber-400/20 flex flex-col md:grid md:grid-cols-12 min-h-[380px] lg:min-h-[420px]"
                >
                  {/* Visual Media Column (Desktop & Tablet) */}
                  <div className="md:col-span-5 lg:col-span-5 relative min-h-[260px] sm:min-h-[300px] md:min-h-full overflow-hidden bg-slate-900 group">
                    <img
                      src={assoc.bannerImageUrl || 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=80'}
                      alt={assoc.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-l from-slate-950/90 via-slate-950/40 to-transparent" />
                    
                    {/* Status & Template Badges */}
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-10">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-white shadow-md flex items-center gap-1.5 border border-amber-400/40">
                        <Award className="w-3.5 h-3.5" />
                        <span>النموذج الأساسي المعتمد</span>
                      </span>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md ${
                          isInactive
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {isInactive ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-white" />
                            <span>🔴 معطلة</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span>🟢 مفعلة ونشطة</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Location Badge */}
                    <div className="absolute bottom-4 right-4 text-white text-xs font-semibold flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/10 z-10">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{assoc.city}، {assoc.country}</span>
                    </div>
                  </div>

                  {/* Information & Action Column */}
                  <div className="md:col-span-7 lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-6">
                    <div className="space-y-3">
                      {/* Pill tags */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>باقة المنصة: PRO السحابية</span>
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>عزل تام لقواعد البيانات</span>
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          نموذج استرشادي مرجعي
                        </span>
                      </div>

                      {/* Association Title */}
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                        {assoc.name}
                      </h3>

                      {/* Tagline / Description */}
                      <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                        {assoc.tagline || texts.masterTemplateDescription || 'هذا هو النموذج والتصميم الذي يُستنسخ منه هيكل كل جمعية جديدة تسجل في المنصة. يحتوي على أقسام الأنشطة الميدانية، الدفتر المالي للشفافية، بطاقات الانخراط برمز QR، وحملات التبرع والتصويت.'}
                      </p>

                      {/* 4 Feature Highlights (Balanced with Donation Assurances) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs sm:text-sm text-slate-700 font-bold">
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>إدارة مالية شفافة ودفتر حسابات مباشر</span>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>بطاقات عضوية ذكية وتحقق برمز QR</span>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>توثيق الأنشطة الميدانية بالصور</span>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>نظام تصويت الأعضاء وحملات التبرع</span>
                        </div>
                      </div>
                    </div>

                    {/* Prominent CTA Actions */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                      {/* Back to Platform Home Button */}
                      <button
                        type="button"
                        id="btn-back-to-home-master-card"
                        onClick={handleScrollToHome}
                        className="w-full sm:w-auto px-6 py-4 bg-slate-100 hover:bg-emerald-50 active:bg-emerald-100 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 font-black text-xs sm:text-sm rounded-2xl transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xs hover:shadow active:scale-95 group order-2 sm:order-1"
                        title="الرجوع إلى الصفحة الرئيسية للمنصة"
                      >
                        <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform shrink-0" />
                        <span>الرجوع إلى الصفحة الرئيسية للمنصة</span>
                      </button>

                      {/* Visit Master Template Action */}
                      <div className="flex flex-col items-stretch sm:items-end gap-1.5 w-full sm:w-auto order-1 sm:order-2">
                        <button
                          type="button"
                          id="btn-visit-master-template-card"
                          onClick={() => onSelectTenant(assoc.id)}
                          className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-amber-700/25 hover:shadow-2xl hover:scale-[1.01] transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-95 group/btn border border-amber-400/40"
                        >
                          <span>زيارة وتصفح المنصة (النموذج المعتمد)</span>
                          <ArrowLeft className="w-5 h-5 text-amber-200 group-hover/btn:-translate-x-1.5 transition-transform" />
                        </button>
                        <span className="text-[11px] text-slate-400 text-center sm:text-left font-medium">
                          انقر للانتقال المباشر وتجربة كافة وظائف الجمعية المعتمدة
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            /* ================= MULTI-CARDS GRID (IF MULTIPLE ASSOCIATIONS) ================= */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {filteredTenants.map((assoc) => {
                const isTemplate = assoc.isTemplate || assoc.id === MASTER_TEMPLATE_TENANT_ID;
                const isInactive = assoc.status === 'inactive';

                return (
                  <div
                    key={assoc.id}
                    className={`bg-white rounded-3xl border overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col ${
                      isTemplate ? 'border-amber-300 ring-2 ring-amber-400/20' : 'border-slate-200/80'
                    }`}
                  >
                    {/* Card Banner Image */}
                    <div className="h-44 sm:h-48 md:h-52 bg-slate-800 relative overflow-hidden group">
                      <img
                        src={assoc.bannerImageUrl || 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80'}
                        alt={assoc.name}
                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                      {/* Status Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        {isTemplate && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500 text-white shadow-sm flex items-center gap-1">
                            <Award className="w-3.5 h-3.5" />
                            <span>النموذج الأساسي</span>
                          </span>
                        )}
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm ${
                            isInactive
                              ? 'bg-rose-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {isInactive ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              <span>🔴 معطلة</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              <span>🟢 مفعلة</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Location Badge */}
                      <div className="absolute bottom-3 right-3 text-white text-xs font-semibold flex items-center gap-1 bg-slate-900/70 px-2.5 py-1 rounded-lg backdrop-blur-xs">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{assoc.city}، {assoc.country}</span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 leading-snug">
                          {assoc.name}
                        </h3>
                        {assoc.tagline && (
                          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                            {assoc.tagline}
                          </p>
                        )}
                      </div>

                      {/* Tier info */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-bold text-slate-400">الباقة:</span>
                        <span className="font-bold text-emerald-700 uppercase text-[11px]">
                          {assoc.tier || 'PRO'}
                        </span>
                      </div>

                      {/* Button */}
                      <button
                        onClick={() => onSelectTenant(assoc.id)}
                        className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                          isTemplate
                            ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        }`}
                      >
                        <span>زيارة وتصفح المنصة</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ================= DONATE AND PARTICIPATE IN DEVELOPMENT PROJECTS (TEASER ONLY) ================= */}
      {(visibility.donationsSection ?? true) && (
        <DonationTeaserSection
          onOpenDonationsPage={handleOpenDonations}
          customTitle={texts.donationsSectionTitle}
          customDescription={texts.donationsSectionDesc}
          coverImage={texts.donationsSectionCoverImage}
          coverOverlayOpacity={texts.donationsSectionCoverOverlayOpacity}
        />
      )}

      {/* ================= WATCH VIDEO TUTORIALS TEASER SECTION (شاهد شرح بالفيديو كيفية استخدام المنصة) ================= */}
      {(() => {
        const wvColors = {
          ...DEFAULT_WATCH_VIDEOS_COLORS,
          ...(portalSettings?.watchVideosColors || {}),
        };
        const hasCoverImage = Boolean(wvColors.coverImageUrl && wvColors.coverImageUrl.trim());
        const wvOverlayAlpha = hasCoverImage
          ? Math.max(0, Math.min(100, Number(wvColors.coverOverlayOpacity ?? 88))) / 100
          : 0.96;

        return (
          <section
            id="main-portal-video-tutorials-section"
            aria-label="شاهد شرح بالفيديو كيفية استخدام المنصة"
            className="w-full py-5 sm:py-8 transition-colors duration-300"
            style={{ backgroundColor: wvColors.outerSectionBgColor }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div
                id="watch-videos-teaser-banner"
                onClick={() => setIsWatchVideosOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsWatchVideosOpen(true);
                  }
                }}
                className="relative rounded-3xl overflow-hidden shadow-xl cursor-pointer group transition-all duration-300 hover:shadow-2xl min-h-[260px] sm:min-h-[300px] flex flex-col justify-center"
                style={{
                  backgroundColor: wvColors.cardBgColor,
                  borderColor: wvColors.cardBorderColor,
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  color: wvColors.mainTitleColor,
                }}
              >
                {/* Ambient Background Image & Cover Image Background with Configurable Gradient Overlay */}
                <div
                  id="watch-videos-cover-background"
                  className="absolute inset-0 z-0"
                  style={{ backgroundColor: wvColors.cardBgColor }}
                >
                  {hasCoverImage && (
                    <img
                      src={wvColors.coverImageUrl}
                      alt="شاهد شرح بالفيديو كيفية استخدام المنصة"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center scale-100 group-hover:scale-105 transition-transform duration-700 opacity-45"
                    />
                  )}
                  <div
                    className="absolute inset-0 pointer-events-none transition-colors duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${hexToRgba(
                        wvColors.cardBgColor,
                        Math.min(1, wvOverlayAlpha + 0.06)
                      )} 0%, ${hexToRgba(
                        wvColors.cardSecondaryBgColor,
                        wvOverlayAlpha
                      )} 55%, ${hexToRgba(
                        wvColors.cardBgColor,
                        Math.max(0.45, wvOverlayAlpha - 0.04)
                      )} 100%)`,
                    }}
                  />
                  <div
                    className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full blur-3xl pointer-events-none"
                    style={{ backgroundColor: hexToRgba(wvColors.cardSecondaryBgColor, 0.35) }}
                  />
                  <div
                    className="absolute -left-20 -top-20 w-80 h-80 rounded-full blur-3xl pointer-events-none"
                    style={{ backgroundColor: hexToRgba(wvColors.interactiveAccentColor, 0.15) }}
                  />
                </div>

                {/* Teaser Content */}
                <div className="relative z-10 p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6 lg:gap-10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 max-w-3xl">
                    {/* Visual Icon / Preview Box */}
                    <div
                      className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl border border-white/25 group-hover:scale-105 transition-transform duration-300"
                      style={{
                        backgroundColor: wvColors.iconBoxBgColor,
                        color: wvColors.iconColor,
                      }}
                    >
                      <Video
                        className="w-8 h-8 sm:w-10 sm:h-10"
                        style={{ color: wvColors.iconColor }}
                      />
                      <span
                        className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-md"
                        style={{
                          backgroundColor: wvColors.interactiveAccentColor,
                          borderColor: wvColors.cardBgColor,
                        }}
                      >
                        <Play
                          className="w-3 h-3 translate-x-0.5"
                          style={{
                            fill: wvColors.buttonTextColor,
                            color: wvColors.buttonTextColor,
                          }}
                        />
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div
                        className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/20 text-xs font-black backdrop-blur-md transition-colors"
                        style={{
                          backgroundColor: wvColors.badgeBgColor,
                          color: wvColors.badgeTextColor,
                        }}
                      >
                        <Play
                          className="w-3.5 h-3.5"
                          style={{
                            fill: wvColors.interactiveAccentColor,
                            color: wvColors.interactiveAccentColor,
                          }}
                        />
                        <span>دليل الاستخدام المرئي خطوة بخطوة</span>
                      </div>

                      <div>
                        <h2
                          id="watch-videos-main-section-title"
                          className="keep-white text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight inline-block px-4 py-1.5 rounded-2xl transition-colors shadow-xs"
                          style={{
                            backgroundColor: wvColors.titleBgColor,
                            color: wvColors.mainTitleColor,
                            border: `1px solid ${hexToRgba(wvColors.cardBorderColor, 0.45)}`,
                          }}
                        >
                          شاهد شرح بالفيديو كيفية استخدام المنصة
                        </h2>
                      </div>

                      <p
                        id="watch-videos-section-subtitle"
                        className="text-sm sm:text-base leading-relaxed max-w-2xl font-medium transition-colors"
                        style={{ color: wvColors.subtitleColor }}
                      >
                        استعرض الفيديوهات التوضيحية المصورة التي تشرح طريقة استخدام المنصة وإنشاء حساب جمعيتك والاستفادة من جميع خدماتها الرقمية بسهولة.
                      </p>
                    </div>
                  </div>

                  {/* Call-to-action Button: مشاهدة الفيديوهات */}
                  <div className="w-full md:w-auto shrink-0 flex flex-col items-stretch md:items-center gap-2.5">
                    <button
                      type="button"
                      id="btn-watch-platform-videos"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsWatchVideosOpen(true);
                      }}
                      className="keep-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full shadow-xl shadow-red-950/40 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group/btn cursor-pointer active:scale-95 flex items-center justify-center gap-3 text-sm sm:text-base font-black border-2 border-white/25"
                      style={{
                        backgroundColor:
                          wvColors.buttonBgColor && wvColors.buttonBgColor.toLowerCase() !== '#ff6b00'
                            ? wvColors.buttonBgColor
                            : '#dc2626',
                        color: wvColors.buttonTextColor || '#ffffff',
                      }}
                    >
                      <Play
                        className="w-5 h-5"
                        style={{
                          fill: wvColors.buttonTextColor || '#ffffff',
                          color: wvColors.buttonTextColor || '#ffffff',
                        }}
                      />
                      <span
                        className="keep-white"
                        style={{ color: wvColors.buttonTextColor || '#ffffff' }}
                      >
                        مشاهدة الفيديوهات
                      </span>
                    </button>
                    <span
                      id="watch-videos-helper-text"
                      className="text-[11px] text-center font-medium transition-colors"
                      style={{ color: wvColors.helperTextColor }}
                    >
                      اضغط لفتح قائمة الفيديوهات ومشاهدتها
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ================= WATCH VIDEOS FULL INTERFACE MODAL ================= */}
      {isWatchVideosOpen && (() => {
        const wvModalColors = {
          ...DEFAULT_WATCH_VIDEOS_COLORS,
          ...(portalSettings?.watchVideosColors || {}),
        };
        return (
          <div
            id="main-portal-watch-videos-modal"
            className="fixed inset-0 z-50 backdrop-blur-md overflow-y-auto p-3 sm:p-6 md:p-8 animate-fade-in"
            style={{ backgroundColor: hexToRgba(wvModalColors.cardBgColor, 0.85) }}
            dir="rtl"
          >
            <div
              className="max-w-7xl mx-auto rounded-3xl shadow-2xl overflow-hidden transition-colors"
              style={{
                backgroundColor: wvModalColors.outerSectionBgColor,
                border: `2px solid ${wvModalColors.cardBorderColor}`,
              }}
            >
              {/* Top Navigation Bar inside Modal */}
              <div
                className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-xs transition-colors"
                style={{
                  backgroundColor: wvModalColors.cardBgColor,
                  borderBottom: `1px solid ${hexToRgba(wvModalColors.cardBorderColor, 0.45)}`,
                }}
              >
                <button
                  type="button"
                  id="btn-close-watch-videos-back-home"
                  onClick={() => setIsWatchVideosOpen(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer active:scale-95 shadow-xs"
                  style={{
                    backgroundColor: wvModalColors.badgeBgColor,
                    color: wvModalColors.badgeTextColor,
                    border: `1px solid ${hexToRgba(wvModalColors.cardBorderColor, 0.5)}`,
                  }}
                >
                  <ArrowRight className="w-4 h-4" style={{ color: wvModalColors.interactiveAccentColor }} />
                  <span>الرجوع إلى الصفحة الرئيسية للمنصة</span>
                </button>

                <button
                  type="button"
                  id="btn-close-watch-videos-x"
                  onClick={() => setIsWatchVideosOpen(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs"
                  style={{
                    backgroundColor: wvModalColors.badgeBgColor || '#065f46',
                    color: '#ffffff',
                    border: `1px solid ${hexToRgba(wvModalColors.cardBorderColor, 0.5)}`,
                  }}
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Isolated Watch Videos Gallery (main_portal_watch_videos ONLY) */}
              <div className="p-4 sm:p-6 lg:p-8" style={{ backgroundColor: wvModalColors.outerSectionBgColor }}>
                <PlatformTutorialsSection
                  activeTenantId="main_portal_watch_videos"
                  customTitle="شاهد شرح بالفيديو كيفية استخدام المنصة"
                  isMainPortalSection={true}
                  onBack={() => setIsWatchVideosOpen(false)}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= PLATFORM PILLARS ================= */}
      {visibility.pillarsSection && (
        <section className="bg-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black">{texts.pillarsTitle || 'ماذا تحصل كل جمعية عند إنشائها؟'}</h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {texts.pillarsSubtitle || 'كل جمعية تنضم للمنصة تحصل تلقائياً على نسخة مستقلة كاملة من كافة وظائف قالب جمعية النور'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="p-6 bg-slate-800/60 rounded-3xl border border-slate-700/80 space-y-3 hover:border-emerald-500/30 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">{texts.pillar1Title || 'إدارة مالية شفافة بالكامل'}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {texts.pillar1Desc || 'لوحة تحكم للمصاريف والمداخيل، إيصالات الدفع، إثباتات الفواتير، ومتابعة الرصيد المالي المباشر مع عزل تام عن سائر الجمعيات.'}
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 bg-slate-800/60 rounded-3xl border border-slate-700/80 space-y-3 hover:border-teal-500/30 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">{texts.pillar2Title || 'سجلات الأعضاء والاشتراكات'}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {texts.pillar2Desc || 'استمارة تسجيل قابلة للتخصيص، نظام اشتراكات شهرية، وبطاقات عضوية ذكية قابلة للطباعة برمز QR.'}
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 bg-slate-800/60 rounded-3xl border border-slate-700/80 space-y-3 hover:border-cyan-500/30 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">{texts.pillar3Title || 'أدمن بدرجات وصلاحيات دقيقة'}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {texts.pillar3Desc || 'صاحب الجمعية (Super Admin) يمتلك الصلاحية الكاملة لإضافة أدمن من الدرجة الثانية مع تحديد الصلاحيات لكل قسم بشكل مستقل.'}
                </p>
              </div>

              {/* Feature 4: إنشاء حملات التبرع */}
              <div className="p-6 bg-slate-800/60 rounded-3xl border border-slate-700/80 space-y-3 hover:border-amber-500/30 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">{texts.pillar4Title || 'إنشاء حملات التبرع'}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {texts.pillar4Desc || 'إمكانية إنشاء وإدارة حملات التبرع لتمويل المشاريع الخيرية وجمع المساهمات الداعمة بكل سهولة وشفافية من خلال لوحة التحكم الخاصة بكل جمعية.'}
                </p>
              </div>

              {/* Feature 5: عرض جميع الأعمال والأنشطة */}
              <div className="p-6 bg-slate-800/60 rounded-3xl border border-slate-700/80 space-y-3 hover:border-indigo-500/30 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <FolderKanban className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">{texts.pillar5Title || 'عرض جميع الأعمال والأنشطة'}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {texts.pillar5Desc || 'قسم مخصص لعرض وتوثيق كافة الأعمال والأنشطة الخيرية والتنموية بالصور والتفاصيل أمام الزوار والمنخرطين بطريقة منظمة واحترافية تعزز الثقة.'}
                </p>
              </div>

              {/* Feature 6: إستفادة من تبرعات مالية */}
              <div className="p-6 bg-slate-800/60 rounded-3xl border border-slate-700/80 space-y-3 hover:border-emerald-500/30 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Coins className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">{texts.pillar6Title || 'إستفادة من تبرعات مالية'}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {texts.pillar6Desc || 'استفد من تبرعات مالية ومساهمات المنخرطين الجدد والمحسنين، واستقطب دعم القطاع الخاص والجالية المقيمة بالخارج، لبناء شراكات وتمويل مشاريعك الخيرية والتنموية وتحقيق أثر أكبر في المجتمع.'}
                </p>
              </div>
            </div>

            {/* بانر زر «دعم المنصة» أسفل قسم الميزات مباشرة بتصميم بارز ومتناسق */}
            <div className="mt-8 p-6 bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-orange-500/5 rounded-3xl border border-orange-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-right">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/30 shadow-inner">
                  <Heart className="w-6 h-6 fill-orange-500/30 text-orange-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">هل ترغب في المساهمة في تطوير ودعم المنصة؟</h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    مساهمتكم الكريمة تساعدنا على تطوير المنصة وتحسين خدماتها لخدمة الجمعيات والمجتمع بشكل أفضل.
                  </p>
                </div>
              </div>

              <button
                id="btn-support-platform-pillar-banner"
                type="button"
                onClick={() => setIsSupportModalOpen(true)}
                className="shrink-0 px-8 py-3.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all flex items-center justify-center gap-2.5 cursor-pointer border border-orange-400/40"
              >
                <Heart className="w-5 h-5 fill-white/20 text-white animate-pulse" />
                <span>دعم المنصة</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ================= PLATFORM FOOTER ================= */}
      {visibility.footerSection && (
        <footer className="bg-slate-950 text-slate-400 text-xs py-8 px-4 border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div
              onClick={handleBrandSecretClick}
              className="flex items-center gap-2.5 cursor-pointer select-none group touch-manipulation active:scale-[0.98] transition-transform"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleBrandSecretClick();
                }
              }}
              title=""
            >
              {platformIdentity?.platformLogo ? (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-emerald-500/40 p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm group-hover:border-emerald-400 transition-colors">
                  <img src={platformIdentity.platformLogo} alt="" className="w-full h-full object-contain rounded-full pointer-events-none" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center overflow-hidden shrink-0 group-hover:bg-emerald-500/30 transition-colors">
                  <Building2 className="w-4 h-4" />
                </div>
              )}
              <span className="font-bold text-slate-300 group-hover:text-emerald-400 transition-colors">
                {platformIdentity?.platformName ? `${platformIdentity.platformName} - Smart Multi-Association Platform` : (texts.footerBrandName || 'syoumax منصة العمل الجمعوي - Smart Multi-Association Platform')}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {showMasterAdminEntry && (
                <button
                  id="btn-portal-footer-master-admin"
                  type="button"
                  onClick={onOpenMasterAdmin}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer font-bold animate-fade-in"
                  title="دخول إلى لوحة الإدارة"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>دخول إلى لوحة الإدارة</span>
                </button>
              )}
              <div className="text-slate-500 text-[11px]">
                {texts.footerCopyrightText || `جميع الحقوق محفوظة © ${new Date().getFullYear()} • القالب المعتمد: جمعية النور للتنمية والتضامن`}
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Platform Support Modal */}
      <PlatformSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />
    </div>
  );
};
