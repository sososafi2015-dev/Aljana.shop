import React from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  Award, 
  HeartHandshake, 
  ShieldCheck, 
  Layers, 
  FileSpreadsheet, 
  TrendingUp, 
  Users, 
  UserPlus,
  FileCheck, 
  Globe, 
  CreditCard, 
  Smartphone, 
  Building,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Info,
  CheckCircle2,
  ChevronRight,
  Bell,
  Heart,
  Phone,
  Mail,
  MapPin,
  Clock
} from 'lucide-react';
import { UIElementConfig, Language, AssociationSettings, FinancialOperation } from '../types';

interface DynamicUIElementsProps {
  category?: string;
  page?: string;
  uiElements: UIElementConfig[];
  settings: AssociationSettings;
  lang: Language;
  operations?: FinancialOperation[];
  onOpenDonationModal?: () => void;
  onRequestMemberLogin?: () => void;
  onRequestRegisterMember?: () => void;
  onOpenReportModal?: () => void;
  setActiveTab: (tab: string) => void;
  isMember?: boolean;
  isAdmin?: boolean;
}

export const DynamicUIElementIcon: React.FC<{ iconName?: string; className?: string }> = ({ 
  iconName, 
  className = 'w-5 h-5' 
}) => {
  switch (iconName) {
    case 'Sparkles': return <Sparkles className={className} />;
    case 'Award': return <Award className={className} />;
    case 'HeartHandshake': return <HeartHandshake className={className} />;
    case 'ShieldCheck': return <ShieldCheck className={className} />;
    case 'Layers': return <Layers className={className} />;
    case 'FileSpreadsheet': return <FileSpreadsheet className={className} />;
    case 'TrendingUp': return <TrendingUp className={className} />;
    case 'Users': return <Users className={className} />;
    case 'FileCheck': return <FileCheck className={className} />;
    case 'Globe': return <Globe className={className} />;
    case 'CreditCard': return <CreditCard className={className} />;
    case 'Smartphone': return <Smartphone className={className} />;
    case 'Building': return <Building className={className} />;
    case 'Bell': return <Bell className={className} />;
    case 'Heart': return <Heart className={className} />;
    default: return <Sparkles className={className} />;
  }
};

/**
 * Renders dynamic custom UI elements and targeted platform blocks
 */
export const DynamicUIElementsSection: React.FC<DynamicUIElementsProps> = ({
  category,
  page = 'home',
  uiElements = [],
  settings,
  lang,
  operations = [],
  onOpenDonationModal,
  onRequestMemberLogin,
  onRequestRegisterMember,
  onOpenReportModal,
  setActiveTab,
  isMember,
  isAdmin,
}) => {
  // Filter active elements matching category/page
  const matchingElements = uiElements.filter((el) => {
    if (!el || el.enabled === false) return false;
    
    // Check non-member visibility
    if (!isAdmin && !isMember && el.visibleToNonMembers === false) {
      return false;
    }

    if (category && el.category !== category) return false;
    if (page && el.page && el.page !== 'all' && el.page !== page) return false;

    return true;
  }).sort((a, b) => (a.order || 0) - (b.order || 0));

  if (matchingElements.length === 0) {
    return null;
  }

  const handleAction = (action?: string, link?: string, targetTab?: string) => {
    if (action === 'donate' && onOpenDonationModal) {
      onOpenDonationModal();
    } else if (action === 'join' && onRequestMemberLogin) {
      onRequestMemberLogin();
    } else if (action === 'report' && onOpenReportModal) {
      onOpenReportModal();
    } else if (action === 'tab' && targetTab) {
      setActiveTab(targetTab);
    } else if (action === 'link' && link) {
      window.open(link, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {matchingElements.map((el) => {
        // 1. Built-in targeted platform components
        if (el.id === 'announcements_banner') {
          return (
            <div 
              key={el.id}
              className="p-4 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent text-slate-800 shadow-xs flex items-center justify-between gap-3 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white uppercase tracking-wider">
                      إعلان هام
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {lang === 'ar' ? el.nameAr : lang === 'fr' ? el.nameFr : el.nameEn}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {lang === 'ar' ? el.descriptionAr : lang === 'fr' ? el.descriptionFr : el.descriptionEn}
                  </p>
                </div>
              </div>
              {onOpenDonationModal && (
                <button
                  onClick={onOpenDonationModal}
                  style={{ backgroundColor: settings.themeColors?.primaryColor || '#059669' }}
                  className="hidden sm:flex px-4 py-2 rounded-xl text-white text-xs font-bold items-center gap-1.5 hover:opacity-90 transition-opacity flex-shrink-0 shadow-xs"
                >
                  <span>تبرع وشارك الآن</span>
                  {lang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          );
        }

        if (el.id === 'quick_actions') {
          return (
            <div 
              key={el.id}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              <button
                onClick={() => onOpenDonationModal && onOpenDonationModal()}
                className="p-4 rounded-2xl bg-white border border-emerald-100 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                  style={{ 
                    backgroundColor: `${settings.themeColors?.primaryColor || '#059669'}15`,
                    color: settings.themeColors?.primaryColor || '#059669'
                  }}
                >
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 block">تبرع فوري</span>
                  <span className="text-[10px] text-slate-500 block">دعم المشاريع الخيرية</span>
                </div>
              </button>

              <button
                onClick={() => {
                  if (onRequestRegisterMember) {
                    onRequestRegisterMember();
                  } else if (onRequestMemberLogin) {
                    onRequestMemberLogin();
                  }
                }}
                className="p-4 rounded-2xl bg-white border border-blue-100 hover:border-blue-300 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 block">تسجيل منخرط جديد</span>
                  <span className="text-[10px] text-slate-500 block">عضوية وفضاء شخصي</span>
                </div>
              </button>

              <button
                onClick={() => onOpenReportModal && onOpenReportModal()}
                className="p-4 rounded-2xl bg-white border border-purple-100 hover:border-purple-300 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 block">الكشف المالي</span>
                  <span className="text-[10px] text-slate-500 block">استخراج تقرير موثق</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('ledger')}
                className="p-4 rounded-2xl bg-white border border-amber-100 hover:border-amber-300 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 block">سجل العمليات</span>
                  <span className="text-[10px] text-slate-500 block">فواتير ووصولات حية</span>
                </div>
              </button>
            </div>
          );
        }

        if (el.id === 'association_goals') {
          return (
            <div key={el.id} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-lg">
                  {lang === 'ar' ? el.nameAr : lang === 'fr' ? el.nameFr : el.nameEn}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-1.5">
                  <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    01
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">العمل الإنساني والتكافل</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    تقديم المساعدات الميدانية المباشرة ورعاية الأسر الهشة وتوزيع المواد الغذائية والطبية.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-1.5">
                  <span className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    02
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">التربية والتشجيع الدراسي</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    دعم تمدرس الأطفال، توفير المحافظ واللوازم المدرسية، ومحاربة الهدر المدرسي.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1.5">
                  <span className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                    03
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">الشفافية والحكامة المالية</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    نشر كل درهم يتم التبرع به أو صرفه مرفقاً بالوثيقة المحاسبية الرسمية لترسيخ الثقة.
                  </p>
                </div>
              </div>
            </div>
          );
        }

        if (el.id === 'join_cta_banner') {
          return (
            <div 
              key={el.id}
              className="p-6 sm:p-8 rounded-3xl text-white relative overflow-hidden shadow-lg transition-all"
              style={{
                background: `linear-gradient(135deg, ${settings.themeColors?.primaryColor || '#047857'} 0%, ${settings.themeColors?.secondaryColor || '#0f172a'} 100%)`
              }}
            >
              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center sm:text-start rtl:sm:text-right max-w-xl">
                  <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-xs inline-block">
                    انضم إلى عائلة الجمعية
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    كن شريكاً في صناعة الأثر والخير المجتمعي
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
                    تسجيل انخراطك يمنحك حق التصويت على القرارات، الاطلاع الكامل على السجلات، واستخراج بطاقة العضوية الرسمية.
                  </p>
                </div>
                <button
                  onClick={() => onRequestMemberLogin && onRequestMemberLogin()}
                  className="px-6 py-3 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-emerald-700" />
                  <span>تقديم طلب الانخراط الآن</span>
                  {lang === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        }

        if (el.id === 'contact_card') {
          return (
            <div key={el.id} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {lang === 'ar' ? el.nameAr : lang === 'fr' ? el.nameFr : el.nameEn}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">المقر الرسمي:</span>
                    <span className="font-bold text-slate-800">{settings.city || 'المغرب'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Phone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">الهاتف والواتساب:</span>
                    <span className="font-bold text-slate-800 font-mono" dir="ltr">
                      {settings.whatsapp || settings.phone || '+212 600-000000'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <CreditCard className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">الحساب البنكي (RIB):</span>
                    <span className="font-bold text-slate-800 font-mono text-[11px] truncate block max-w-[170px]">{settings.ribBank}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        if (el.id === 'recent_operations_preview') {
          const recentOps = operations.slice(0, 3);
          return (
            <div key={el.id} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">
                    {lang === 'ar' ? el.nameAr : lang === 'fr' ? el.nameFr : el.nameEn}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab('ledger')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                >
                  <span>عرض السجل الكامل</span>
                  {lang === 'ar' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {recentOps.map((op) => (
                  <div key={op.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${op.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="font-bold text-slate-800">{op.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-[11px] font-mono">{op.date}</span>
                      <span className={`font-mono font-black ${op.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {op.type === 'income' ? '+' : '-'}{op.amount.toLocaleString()} د.م
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // 2. Custom UI Element (dynamic card / banner created by admin)
        const custom = el.customContent;
        const title = custom?.titleAr || el.nameAr;
        const body = custom?.bodyAr || el.descriptionAr;
        const badge = custom?.badgeTextAr;
        const btnText = custom?.buttonTextAr;
        const btnAction = custom?.buttonAction || 'tab';
        const btnLink = custom?.buttonLink;
        const targetTab = custom?.targetTab || 'home';

        return (
          <motion.div
            key={el.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-3 relative overflow-hidden"
            style={{
              borderColor: custom?.themeStyle === 'emerald' ? '#a7f3d0' : undefined,
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor: `${settings.themeColors?.primaryColor || '#059669'}15`,
                    color: settings.themeColors?.primaryColor || '#047857',
                  }}
                >
                  <DynamicUIElementIcon iconName={el.iconName} className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {badge && (
                      <span 
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs"
                        style={{ backgroundColor: settings.themeColors?.primaryColor || '#059669' }}
                      >
                        {badge}
                      </span>
                    )}
                    <h3 className="font-bold text-slate-900 text-base">
                      {title}
                    </h3>
                  </div>
                  {body && (
                    <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                      {body}
                    </p>
                  )}
                </div>
              </div>

              {btnText && (
                <button
                  onClick={() => handleAction(btnAction, btnLink, targetTab)}
                  style={{ backgroundColor: settings.themeColors?.buttonColor || settings.themeColors?.primaryColor || '#059669' }}
                  className="px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 transition-opacity flex-shrink-0 cursor-pointer"
                >
                  <span>{btnText}</span>
                  {btnAction === 'link' ? (
                    <ExternalLink className="w-3.5 h-3.5" />
                  ) : lang === 'ar' ? (
                    <ArrowLeft className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
