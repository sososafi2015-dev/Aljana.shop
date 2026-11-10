import React, { useState } from 'react';
import { 
  Building2, 
  ArrowRight, 
  Sparkles, 
  ChevronDown, 
  ShieldAlert, 
  CheckCircle2, 
  ExternalLink,
  Plus,
  LogIn,
  ShieldCheck
} from 'lucide-react';
import { getAllTenants } from '../tenantStorage';
import { AssociationTenant, Language } from '../types';
import { usePlatformIdentity } from '../api/platformIdentityApi';

interface AssociationTopBannerProps {
  currentTenant: AssociationTenant;
  lang?: Language;
  onBackToPortal: () => void;
  onSwitchTenant: (tenantId: string) => void;
  onOpenCreateWizard: () => void;
  onOpenLoginModal?: () => void;
  returnToDonations?: boolean;
  onBackToDonations?: () => void;
  onOpenMasterAdmin?: () => void;
  isMasterPlatformAdmin?: boolean;
}

export const AssociationTopBanner: React.FC<AssociationTopBannerProps> = ({
  currentTenant,
  lang = 'ar',
  onBackToPortal,
  onSwitchTenant,
  onOpenCreateWizard,
  onOpenLoginModal,
  returnToDonations = false,
  onBackToDonations,
  onOpenMasterAdmin,
  isMasterPlatformAdmin = false,
}) => {
  const tenants = getAllTenants().filter((t) => isMasterPlatformAdmin || t.status === 'active');
  const { identity: platformIdentity } = usePlatformIdentity();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getTenantName = (t: AssociationTenant) => {
    if (lang === 'ar') return t.name;
    if (lang === 'fr') return t.nameFr || t.name;
    return t.nameEn || t.nameFr || t.name;
  };

  const isInactive = currentTenant.status === 'inactive';

  return (
    <div className="w-full relative z-40 bg-slate-900 text-white text-xs border-b border-slate-800" dir="rtl">
      {/* If inactive banner alert */}
      {isInactive && (
        <div className="bg-rose-600 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>
            {isMasterPlatformAdmin
              ? 'تنبيه إداري: تم تعليق هذه المنصة للمستخدمين، وتتصفحها أنت كأدمن رئيسي للإدارة العامة بصلاحيات كاملة.'
              : 'تنبيه إداري: تم تعليق وتوقيف هذه المنصة مؤقتًا من قِبل الإدارة العامة للمنصة. تقتصر الصلاحيات الحالية على المعاينة فقط.'}
          </span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 flex-wrap">
        {/* Left / Back to Portal Button */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            id="btn-back-to-portal-top"
            onClick={onBackToPortal}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer text-xs shadow-sm hover:shadow active:scale-95 border border-emerald-400/40"
            title="الرجوع إلى الصفحة الرئيسية للمنصة"
          >
            {platformIdentity?.platformLogo ? (
              <div className="w-5 h-5 rounded-full bg-white border border-emerald-300 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                <img
                  src={platformIdentity.platformLogo}
                  alt="syoumax"
                  className="w-full h-full object-contain rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
            )}
            <span>الرجوع إلى الصفحة الرئيسية للمنصة</span>
          </button>

          {isMasterPlatformAdmin && onOpenMasterAdmin && (
            <button
              type="button"
              id="btn-back-to-master-admin-top"
              onClick={onOpenMasterAdmin}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs shadow-sm hover:shadow active:scale-95"
              title="الرجوع إلى لوحة تحكم الإدارة العامة للمنصة"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
              <span>لوحة الإدارة العامة</span>
            </button>
          )}

          {returnToDonations && onBackToDonations && (
            <button
              type="button"
              id="btn-back-to-donations-top"
              onClick={onBackToDonations}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs shadow-sm hover:shadow active:scale-95 ring-2 ring-emerald-400/50"
              title="الرجوع إلى صفحة تبرع وشارك في مشاريع التنمية"
            >
              <ArrowRight className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
              <span className="font-black text-xs sm:text-sm">رجوع</span>
              <span className="hidden sm:inline text-[11px] font-bold text-slate-900">
                (مشاريع التنمية والتبرع)
              </span>
            </button>
          )}

          <span className="text-slate-500 hidden sm:inline">|</span>

          {/* Current Association Pill with Switcher */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700/80 rounded-lg text-slate-200 transition-colors border border-slate-700"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-xs">{getTenantName(currentTenant)}</span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">({currentTenant.city})</span>
              <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-bold">واجهة التطبيق</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 text-slate-800 z-50 animate-scale-in"
                onClick={() => setDropdownOpen(false)}
              >
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  التبديل بين منصات الجمعيات
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1">
                  {tenants.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onSwitchTenant(t.id)}
                      className={`w-full text-right px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        t.id === currentTenant.id
                          ? 'bg-emerald-50 text-emerald-800 font-bold'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="truncate">
                        <div className="truncate">{getTenantName(t)}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{t.city}، {t.country}</div>
                      </div>
                      {t.id === currentTenant.id && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-2 mt-2 border-t border-slate-100">
                  <button
                    onClick={onOpenCreateWizard}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إنشاء منصة لجمعية جديدة</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side CTA */}
        <div className="flex items-center gap-2">
          {currentTenant.isTemplate && (
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
              القالب الأساسي المعتمد (Master Template)
            </span>
          )}

          {onOpenLoginModal && (
            <button
              onClick={onOpenLoginModal}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-bold rounded-lg border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              title="تسجيل الدخول إلى منصتك"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>تسجيل الدخول</span>
            </button>
          )}

          <button
            onClick={onOpenCreateWizard}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">إنشاء منصة لجمعيتك</span>
            <span className="sm:hidden">جمعية جديدة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
