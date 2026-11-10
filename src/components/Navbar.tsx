import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Building, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Globe, 
  TrendingUp, 
  Users, 
  HeartHandshake, 
  Layers, 
  FileSpreadsheet, 
  Settings,
  CreditCard,
  Phone,
  Copy,
  Check,
  UserCheck,
  UserPlus,
  User,
  LogOut,
  Key
} from 'lucide-react';
import { Language, UserRole, AssociationSettings, UIElementConfig, Member, CurrentAdminSession } from '../types';
import { translations } from '../translations';
import { isSectionVisibleForUser, isCurrentBalanceVisibleForUser } from '../utils/visibilityRules';
import { WhatsAppIcon, buildWhatsAppChatUrl } from '../utils/whatsappUtils';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  onRequestAdmin: () => void;
  onLogoutAdmin: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
  settings: AssociationSettings;
  currentBalance: number;
  uiElements?: UIElementConfig[];
  loggedInMember?: Member | null;
  onRequestMemberLogin?: () => void;
  onRequestRegisterMember?: () => void;
  onLogoutMember?: () => void;
  currentAdminSession?: CurrentAdminSession | null;
  isMasterPlatformAdmin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  role,
  onRequestAdmin,
  onLogoutAdmin,
  lang,
  setLang,
  settings,
  currentBalance,
  uiElements,
  loggedInMember,
  onRequestMemberLogin,
  onRequestRegisterMember,
  onLogoutMember,
  currentAdminSession,
  isMasterPlatformAdmin,
}) => {
  const t = translations[lang] as any;
  const [showBankModal, setShowBankModal] = useState(false);
  const [copiedRib, setCopiedRib] = useState(false);

  const isAuthorizedAdmin = !loggedInMember && (role === 'admin' || isMasterPlatformAdmin) && Boolean(currentAdminSession);

  const isVisible = (id: string) => {
    return isSectionVisibleForUser(id, {
      isAdmin: Boolean(isAuthorizedAdmin || role === 'admin' || isMasterPlatformAdmin),
      isMember: Boolean(loggedInMember),
      uiElements: uiElements || [],
    });
  };

  const isBalanceVisible = isCurrentBalanceVisibleForUser({
    isAdmin: Boolean(isAuthorizedAdmin || role === 'admin' || isMasterPlatformAdmin),
    isMember: Boolean(loggedInMember),
    uiElements: uiElements || [],
  });

  // Hidden admin entrance: Triple-click detection on store logo
  const logoClickCountRef = useRef(0);
  const logoClickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = () => {
    // Normal store navigation: click navigates to home
    setActiveTab('home');

    // Only proceed if triple-click hidden login is enabled, user is not already admin, and not logged in as a member
    const isTripleClickEnabled = settings.enableTripleClickLogoLogin ?? true;
    if (!isTripleClickEnabled || role === 'admin' || Boolean(loggedInMember)) {
      return;
    }

    logoClickCountRef.current += 1;

    if (logoClickTimerRef.current) {
      clearTimeout(logoClickTimerRef.current);
    }

    if (logoClickCountRef.current >= 3) {
      // 3 clicks registered in short succession: reveal admin login modal
      logoClickCountRef.current = 0;
      onRequestAdmin();
    } else {
      // Reset counter after 900ms if no further clicks occur
      logoClickTimerRef.current = setTimeout(() => {
        logoClickCountRef.current = 0;
      }, 900);
    }
  };

  const rawNavItems = [
    { id: 'home', elementId: 'home', label: t.home, icon: Layers },
    { id: 'activities', elementId: 'nav_tab_activities', label: t.activities, icon: HeartHandshake },
    { id: 'members', elementId: 'nav_tab_members', label: t.members, icon: Users },
    { id: 'ledger', elementId: 'nav_tab_ledger', label: t.ledger, icon: FileSpreadsheet },
    ...(loggedInMember ? [{ id: 'my-account', elementId: 'my-account', label: t.myAccount || 'حسابي', icon: User }] : []),
    ...(isAuthorizedAdmin ? [{ id: 'admin', elementId: 'admin', label: t.adminPanel, icon: Settings }] : []),
  ];

  const navItems = rawNavItems.filter((item) => {
    if (item.id === 'home' || item.id === 'admin' || item.id === 'my-account') return true;
    return isVisible(item.elementId);
  });

  const handleCopyRib = () => {
    navigator.clipboard.writeText(settings.ribBank);
    setCopiedRib(true);
    setTimeout(() => setCopiedRib(false), 2000);
  };

  const effectiveWhatsApp = (settings.whatsapp && settings.whatsapp.trim()) || (settings.phone && settings.phone.trim()) || '0661000001';
  const whatsAppChatUrl = buildWhatsAppChatUrl(
    effectiveWhatsApp,
    `السلام عليكم ورحمة الله، أتواصل معكم بخصوص ${settings.name || 'الجمعية'}`
  );

  return (
    <>
      <header 
        className="sticky top-0 z-40 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-colors duration-300"
        style={{
          backgroundColor: settings.themeColors?.navbarColor ? `${settings.themeColors.navbarColor}f5` : 'rgba(255, 255, 255, 0.95)',
        }}
      >
        {/* Top Info Bar */}
        <div 
          className="text-slate-300 text-xs py-1.5 px-4 transition-colors duration-300"
          style={{
            backgroundColor: settings.themeColors?.secondaryColor || '#0f172a',
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {t.financialHealth}
              </span>
              <span className="font-mono text-slate-400 hidden md:inline">
                RIB: {settings.ribBank}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Member Auth Button in Top Bar */}
              {loggedInMember ? (
                <div className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-700/60 rounded-lg px-2 py-0.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white font-bold overflow-hidden">
                    {loggedInMember.avatarUrl ? (
                      <img src={loggedInMember.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      loggedInMember.fullName.charAt(0)
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab('my-account')}
                    className="text-emerald-300 hover:text-white font-bold text-[11px] truncate max-w-[100px] sm:max-w-[140px]"
                    title="الذهاب إلى حسابي الشخصي"
                  >
                    {loggedInMember.fullName}
                  </button>
                  <button
                    onClick={onLogoutMember}
                    className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors"
                    title="تسجيل الخروج من الحساب"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {onRequestRegisterMember && (
                    <button
                      onClick={onRequestRegisterMember}
                      className="flex items-center gap-1 text-emerald-100 hover:text-white transition-colors text-xs font-bold px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/60 shadow-xs cursor-pointer"
                      title="تسجيل منخرط جديد"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-emerald-200" />
                      <span>{t.registerNewMember || 'تسجيل منخرط جديد'}</span>
                    </button>
                  )}
                  <button
                    onClick={onRequestMemberLogin}
                    className="flex items-center gap-1 text-emerald-300 hover:text-white transition-colors text-xs font-semibold px-2 py-0.5 rounded bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700/60 cursor-pointer"
                    title="تسجيل دخول المنخرطين"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.memberLogin || 'تسجيل دخول المنخرطين'}</span>
                  </button>
                </div>
              )}

              {/* Bank RIB Quick button */}
              {isVisible('nav_bank_rib_btn') && (
                <button
                  onClick={() => setShowBankModal(true)}
                  className="hidden md:flex items-center gap-1 text-slate-300 hover:text-white transition-colors text-xs font-medium px-2 py-0.5 rounded bg-slate-800 border border-slate-700"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'الحساب البنكي' : 'RIB'}</span>
                </button>
              )}

              {/* Official Association WhatsApp Button (Top Bar) */}
              {whatsAppChatUrl && (
                <a
                  href={whatsAppChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="topbar-whatsapp-btn"
                  className="inline-flex items-center gap-1.5 text-white bg-[#25D366] hover:bg-[#20ba59] active:scale-95 transition-all text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs cursor-pointer group flex-shrink-0"
                  title={`تواصل عبر واتساب مع ${settings.name || 'الجمعية'} (${effectiveWhatsApp})`}
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 fill-current group-hover:scale-110 transition-transform" />
                  <span className="hidden sm:inline">واتساب الجمعية</span>
                  <span className="sm:hidden">واتساب</span>
                </a>
              )}

              {/* Language Switcher */}
              <div className="flex items-center gap-1 border-r rtl:border-r-0 rtl:border-l border-slate-700 px-1.5 sm:px-2">
                <Globe className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
                <button
                  onClick={() => setLang('ar')}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    lang === 'ar' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  عربي
                </button>
                <button
                  onClick={() => setLang('fr')}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    lang === 'fr' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  FR
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    lang === 'en' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>

              {/* Role Indicator & Admin Auth Button */}
              {isAuthorizedAdmin ? (
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] flex items-center gap-1.5 border ${
                    currentAdminSession?.isMasterPlatformAdmin
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : (currentAdminSession?.type === 'sub_admin' || currentAdminSession?.role === 'secondary_admin')
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  }`}>
                    {currentAdminSession?.isMasterPlatformAdmin ? (
                      <ShieldCheck className="w-3 h-3 text-amber-300" />
                    ) : (currentAdminSession?.type === 'sub_admin' || currentAdminSession?.role === 'secondary_admin') ? (
                      <Key className="w-3 h-3 text-blue-300" />
                    ) : (
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    )}
                    <span className="hidden sm:inline">
                      {currentAdminSession?.isMasterPlatformAdmin
                        ? 'الأدمن الرئيسي (الإدارة العامة)'
                        : (currentAdminSession?.type === 'sub_admin' || currentAdminSession?.role === 'secondary_admin')
                          ? `أدمن: ${currentAdminSession.fullName}`
                          : t.roleAdmin}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={onLogoutAdmin}
                    className="px-2.5 py-0.5 rounded-full bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 transition-all text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    title="تسجيل الخروج وإنهاء الجلسة الحالية"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              ) : (
                !loggedInMember && (settings.showAdminLoginButton ?? false) && (
                  <button
                    onClick={onRequestAdmin}
                    className="flex items-center gap-1 text-slate-300 hover:text-emerald-400 transition-colors font-medium text-xs bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md"
                    title={t.switchToAdmin}
                  >
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span className="hidden sm:inline">{t.switchToAdmin}</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Main Header Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Logo & Association Name */}
          <div 
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer select-none group"
            title={settings.enableTripleClickLogoLogin ? 'الصفحة الرئيسية' : undefined}
          >
            {settings.logoUrl ? (
              <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-md shadow-slate-200/50 group-hover:scale-105 transition-transform flex-shrink-0 overflow-hidden">
                <img
                  src={settings.logoUrl}
                  alt={settings.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div 
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${settings.themeColors?.secondaryColor || '#0f172a'} 0%, ${settings.themeColors?.primaryColor || '#047857'} 100%)`
                }}
              >
                <Building className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight store-heading">
                  {lang === 'ar' ? settings.name : lang === 'fr' ? settings.nameFr : settings.nameEn}
                </h1>
                <span 
                  className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${settings.themeColors?.primaryColor || '#059669'}18`,
                    color: settings.themeColors?.primaryColor || '#065f46',
                    border: `1px solid ${settings.themeColors?.primaryColor || '#059669'}33`,
                  }}
                >
                  منصة الشفافية
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium line-clamp-1">
                {lang === 'ar' ? settings.tagline : lang === 'fr' ? settings.taglineFr : settings.taglineEn}
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    color: isActive ? (settings.themeColors?.primaryColor || '#065f46') : undefined,
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-white shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Icon 
                    className="w-4 h-4" 
                    style={{ color: isActive ? (settings.themeColors?.primaryColor || '#059669') : undefined }} 
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Actions & Balance Container */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Professional WhatsApp Button */}
            {whatsAppChatUrl && (
              <a
                href={whatsAppChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                id="main-header-whatsapp-btn"
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow-md transition-all cursor-pointer group flex-shrink-0 border border-emerald-400/40"
                title={`محادثة مباشرة عبر واتساب مع ${settings.name || 'الجمعية'} (${effectiveWhatsApp})`}
              >
                <WhatsAppIcon className="w-4 h-4 sm:w-5 sm:h-5 fill-current group-hover:scale-110 transition-transform flex-shrink-0" />
                <span className="hidden sm:inline font-bold">واتساب الجمعية</span>
                <span className="sm:hidden font-bold">واتساب</span>
              </a>
            )}

            {/* Balance Badge Quick View */}
            {isBalanceVisible && isVisible('nav_balance_badge') && (
              <div 
                onClick={() => setActiveTab('ledger')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                style={{
                  backgroundColor: `${settings.themeColors?.primaryColor || '#059669'}14`,
                  border: `1px solid ${settings.themeColors?.primaryColor || '#059669'}40`,
                }}
                title="انقر لعرض سجل الشفافية المباشر"
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full animate-ping"
                  style={{ backgroundColor: settings.themeColors?.primaryColor || '#10b981' }}
                />
                <div className="text-start rtl:text-right">
                  <span 
                    className="text-[10px] block font-semibold leading-none"
                    style={{ color: settings.themeColors?.primaryColor || '#047857' }}
                  >
                    {t.currentBalance}
                  </span>
                  <span 
                    className="text-sm sm:text-base font-black font-mono leading-tight"
                    style={{ color: settings.themeColors?.headingColor || settings.themeColors?.primaryColor || '#022c22' }}
                  >
                    {currentBalance.toLocaleString()} <span className="text-xs font-normal" style={{ color: settings.themeColors?.primaryColor || '#047857' }}>{t.currencyShort}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Bank RIB Modal */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{`الحساب البنكي لـ ${settings.name || 'الجمعية'}`}</h3>
                  <p className="text-xs text-slate-500">{settings.bankName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowBankModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 block mb-1">رقم الحساب البنكي الموحد (RIB):</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-slate-800 text-sm break-all">
                    {settings.ribBank}
                  </span>
                  <button
                    onClick={handleCopyRib}
                    className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors flex-shrink-0"
                    title="نسخ رقم الـ RIB"
                  >
                    {copiedRib ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block mb-0.5">البنك:</span>
                  <span className="font-semibold text-slate-800">{settings.bankName}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block mb-0.5">المدينة / الفرع:</span>
                  <span className="font-semibold text-slate-800">{settings.address || 'المقر الرئيسي للجمعية'}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p>
                  يتم تسجيل أي تحويل أو مساهمة تلقائيًا في سجل الشفافية ونشر الوصل المعتمد بموافقة المتبرع.
                </p>
              </div>

              <button
                onClick={() => setShowBankModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-colors mt-2"
              >
                إغلاق
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};
