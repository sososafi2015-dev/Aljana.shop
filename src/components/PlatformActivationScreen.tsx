import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  CreditCard, 
  ArrowRight, 
  LogOut, 
  Globe, 
  ShieldCheck, 
  Sparkles,
  RefreshCw,
  MapPin, 
  Phone, 
  User, 
  FileText,
  Lock
} from 'lucide-react';
import { AssociationTenant, TenantPaymentRecord, PaymentMethod, PlatformPaymentSettings } from '../types';
import { 
  getLatestPaymentForTenant, 
  getActivationFeeForCountry, 
  getPlatformPaymentSettings,
  syncPlatformPaymentSettingsFromBackend,
  syncPaymentsFromBackend,
  DEFAULT_ACTIVATION_NOTICE_TEXT,
} from '../paymentStorage';
import { getTenantById, syncTenantsFromBackend } from '../tenantStorage';
import { PaymentMethodModal } from './PaymentMethodModal';

interface PlatformActivationScreenProps {
  tenant: AssociationTenant;
  isNewlyCreated?: boolean;
  onBackToPortal: () => void;
  onLogout?: () => void;
  onActivated?: () => void;
}

export const PlatformActivationScreen: React.FC<PlatformActivationScreenProps> = ({
  tenant,
  isNewlyCreated = false,
  onBackToPortal,
  onLogout,
  onActivated,
}) => {
  const [settings, setSettings] = useState<PlatformPaymentSettings>(() => getPlatformPaymentSettings());
  const feeInfo = getActivationFeeForCountry(tenant.country, settings);
  
  const [latestPayment, setLatestPayment] = useState<TenantPaymentRecord | null>(() => 
    getLatestPaymentForTenant(tenant.id)
  );
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Sync settings from server and listen for real-time changes
  useEffect(() => {
    syncPlatformPaymentSettingsFromBackend().then((s) => {
      if (s) setSettings(s);
    });

    const handleSettingsUpdate = (e: any) => {
      const updated = e?.detail || getPlatformPaymentSettings();
      setSettings(updated);
    };

    window.addEventListener('platform-payment-settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('platform-payment-settings-updated', handleSettingsUpdate);
    };
  }, []);

  const [currentTenant, setCurrentTenant] = useState<AssociationTenant>(tenant);

  useEffect(() => {
    setCurrentTenant(tenant);
  }, [tenant]);

  // Poll or refresh payment & tenant status from both backend database and local storage
  const refreshPaymentStatus = async () => {
    setIsCheckingStatus(true);
    try {
      await Promise.all([
        syncTenantsFromBackend().catch(() => {}),
        syncPaymentsFromBackend().catch(() => {}),
      ]);
    } catch {}
    const p = getLatestPaymentForTenant(tenant.id);
    setLatestPayment(p);
    const freshTenant = getTenantById(tenant.id);
    if (freshTenant) {
      setCurrentTenant(freshTenant);
      if (freshTenant.status === 'active' && onActivated) {
        onActivated();
      }
    }
    setIsCheckingStatus(false);
  };

  useEffect(() => {
    refreshPaymentStatus();
    // Periodic refresh every 4 seconds in case admin confirms in another window
    const timer = setInterval(refreshPaymentStatus, 4000);
    return () => clearInterval(timer);
  }, [tenant.id]);

  // If status became active, trigger callback
  useEffect(() => {
    if (currentTenant.status === 'active' && onActivated) {
      onActivated();
    }
  }, [currentTenant.status, onActivated]);

  const isPending = latestPayment?.status === 'pending';
  const isVerified = latestPayment?.status === 'verified' || Boolean(currentTenant.paymentVerified && currentTenant.status !== 'active');
  const isRejected = latestPayment?.status === 'rejected';
  const isConfirmed = latestPayment?.status === 'confirmed' || currentTenant.status === 'active';
  const isWaitingActivation = isPending || isVerified || (currentTenant.status === 'pending_activation' && Boolean(latestPayment) && !isRejected);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 text-slate-100 flex flex-col justify-between py-8 px-4 font-sans" dir="rtl">
      
      {/* Top Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-indigo-300 block">syoumax منصة العمل الجمعوي</span>
            <span className="text-sm font-semibold text-white truncate max-w-xs">{tenant.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          )}
          <button
            onClick={onBackToPortal}
            className="px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold border border-indigo-400/30 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>البوابة الرئيسية</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-4xl mx-auto my-8 flex-1 flex flex-col items-center justify-center">
        
        {/* Main Status Container */}
        <div className="w-full bg-white/95 text-slate-900 rounded-3xl shadow-2xl border border-white/20 p-6 md:p-10 relative overflow-hidden backdrop-blur-md">
          
          {/* Subtle Top Decorative Accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-indigo-500 to-teal-500" />

          {/* Heading Section */}
          <div className="text-center space-y-3 mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 mb-1 shadow-inner">
              {isWaitingActivation ? (
                <Clock className="w-8 h-8 text-amber-600" />
              ) : isNewlyCreated ? (
                <Sparkles className="w-8 h-8 text-indigo-600 animate-pulse" />
              ) : (
                <Lock className="w-8 h-8 text-amber-600" />
              )}
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black border ${
                isWaitingActivation
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                <span className="w-2 h-2 rounded-full animate-ping bg-amber-600" />
                {isWaitingActivation ? 'حالة المنصة: قيد مراجعة الدفع ⏳' : 'حالة المنصة: في انتظار الدفع'}
              </span>
              {isVerified && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  تم التحقق من الدفع • بانتظار موافقة الإدارة العامة للتفعيل
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
              {isWaitingActivation
                ? 'تم إرسال وصل الدفع — منصتك الآن في حالة «قيد مراجعة الدفع»'
                : isNewlyCreated
                ? 'تم إنشاء منصتك بنجاح — الحالة الحالية: «في انتظار الدفع»'
                : 'منصتك في حالة «في انتظار الدفع» لتسديد الاشتراك'}
            </h1>

            <p className="text-sm md:text-base text-slate-700 max-w-2xl mx-auto leading-relaxed font-medium">
              {isWaitingActivation
                ? 'انتقلت حالة منصتك إلى «قيد مراجعة الدفع» بعد تأكيد إرسال وصل الدفع. لا يتم تفعيل المنصة إلا بعد التحقق من صحة الوصل والحصول على موافقة الإدارة العامة للمنصة الرئيسية.'
                : (settings.activationNoticeText || DEFAULT_ACTIVATION_NOTICE_TEXT)}
            </p>
          </div>

          {/* Access Restriction Security Notice (Requirement 1 & 3) */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 leading-relaxed space-y-1">
              <div className="font-black text-amber-900">نظام الدفع والتفعيل الإلزامي:</div>
              <p>
                {settings.activationNoticeText || DEFAULT_ACTIVATION_NOTICE_TEXT}
              </p>
            </div>
          </div>

          {/* 3-Step Subscription & Activation Lifecycle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-xs">
            <div className={`p-3.5 rounded-2xl border-2 transition-all ${
              !isWaitingActivation
                ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-sm'
                : 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-black flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] text-white ${!isWaitingActivation ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                    {isWaitingActivation ? '✓' : '1'}
                  </span>
                  <span>في انتظار الدفع</span>
                </span>
                {!isWaitingActivation && <span className="text-[10px] font-bold bg-amber-200 px-2 py-0.5 rounded-full">الحالة الحالية</span>}
              </div>
              <p className="text-[11px] opacity-90">بعد تأكيد إنشاء المنصة تبقى في انتظار تسديد الاشتراك ({feeInfo.amount} {feeInfo.currency}).</p>
            </div>

            <div className={`p-3.5 rounded-2xl border-2 transition-all ${
              isWaitingActivation
                ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-black flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${isWaitingActivation ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    2
                  </span>
                  <span>قيد مراجعة الدفع</span>
                </span>
                {isWaitingActivation && <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">الحالة الحالية</span>}
              </div>
              <p className="text-[11px] opacity-90">بعد إرسال وصل الدفع تنتقل إلى مراجعة الوصل والتحقق من صحة الدفع وموافقة الإدارة العامة.</p>
            </div>

            <div className="p-3.5 rounded-2xl border-2 bg-slate-50 border-slate-200 text-slate-500">
              <div className="flex items-center justify-between mb-1">
                <span className="font-black flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[11px]">
                    3
                  </span>
                  <span>مفعّلة</span>
                </span>
              </div>
              <p className="text-[11px] opacity-90">بعد موافقة الإدارة العامة تتغير الحالة إلى «مفعّلة» ويُسمح بالدخول للوحة الإدارة.</p>
            </div>
          </div>

          {/* Association Snapshot Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{currentTenant.name}</h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                    {currentTenant.country}
                  </span>
                </div>
                {currentTenant.nameFr && (
                  <p className="text-xs text-slate-500 mt-0.5" dir="ltr">{currentTenant.nameFr}</p>
                )}
              </div>

              {/* Status Badge */}
              <div className="text-right sm:text-left shrink-0">
                <span className="text-[11px] text-slate-400 block mb-0.5">حالة المنصة الحالية</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  isWaitingActivation
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-ping ${isWaitingActivation ? 'bg-amber-600' : 'bg-amber-500'}`} />
                  {isWaitingActivation ? 'قيد مراجعة الدفع ⏳' : 'في انتظار الدفع'}
                </span>
              </div>
            </div>

            {/* Quick Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>المدينة: <strong>{currentTenant.city}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <span>المسؤول: <strong>{currentTenant.ownerName}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span dir="ltr"><strong>{currentTenant.ownerPhone}</strong></span>
              </div>
            </div>
          </div>

          {/* Legal Document Status Note if exists */}
          {tenant.legalDocument && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">وثيقة إثبات ترخيص الجمعية:</span>
                  <span className="text-slate-500 text-[11px] font-mono">{tenant.legalDocument.fileName} ({tenant.legalDocument.fileSizeFormatted})</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                  tenant.legalDocument.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : tenant.legalDocument.status === 'rejected'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}>
                  {tenant.legalDocument.status === 'approved'
                    ? '✓ وثيقة معتمدة ومقبولة'
                    : tenant.legalDocument.status === 'rejected'
                    ? '✗ وثيقة مرفوضة'
                    : '⏳ وثيقة الترخيص قيد مراجعة الإدارة العامة'}
                </span>
              </div>
            </div>
          )}

          {/* Price & Activation Card */}
          <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/20 p-6 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              
              <div>
                <span className="text-xs font-bold text-indigo-700 block mb-1">
                  رسوم تفعيل المنصة الرسمية
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-indigo-900 tracking-tight font-mono">
                    {feeInfo.amount.toLocaleString()}
                  </span>
                  <span className="text-base font-bold text-indigo-700">
                    {feeInfo.currencyNameAr} ({feeInfo.currency})
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  دفعة تفعيل موحدة تمنحكم الاستفادة الكاملة من كافة خصائص ومميزات المنصة الذكية.
                </p>
              </div>

              {/* Action Button */}
              <div className="w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>
                    {isRejected ? 'إعادة تسديد الاشتراك وتأكيد الدفع' : isWaitingActivation ? 'عرض تفاصيل طلب الاشتراك والدفع' : 'تسديد مبلغ الاشتراك وتفعيل المنصة'}
                  </span>
                </button>
              </div>

            </div>
          </div>

          {/* Current Payment Status Banner */}
          {latestPayment && (
            <div className="mb-6 animate-fade-in">
              {(isPending || isVerified) && (
                <div className={`p-5 rounded-2xl border space-y-2 ${
                  isVerified
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-950'
                    : 'bg-amber-50 border-amber-200/90 text-amber-900'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {isVerified ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                      )}
                      <h4 className="font-bold text-sm">
                        {isVerified
                          ? 'تم التحقق من صحة الدفع إدارياً — بانتظار التفعيل النهائي للمنصة'
                          : 'تم إرسال وصل الدفع بنجاح — حالة الطلب الآن «قيد مراجعة الدفع»'}
                      </h4>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      isVerified
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-amber-200 text-amber-900 border-amber-300'
                    }`}>
                      {isVerified ? 'تم التحقق من الدفع ✓' : 'قيد مراجعة الدفع ⏳'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    {isVerified
                      ? 'تمت مراجعة طلب الاشتراك والتحقق من صحة الوصل من طرف الإدارة العامة بنجاح. سيتم فتح لوحة إدارة المنصة فور صدور قرار التفعيل الإداري لتصبح الحالة «مفعّلة».'
                      : 'شكراً لك. تم حفظ وصل الدفع بنجاح، والطلب الآن «قيد مراجعة الدفع». ستقوم الإدارة العامة بالتحقق من صحة الوصل واعتماد الدفع للموافقة على تفعيل المنصة.'}
                  </p>
                  <div className="pt-2 flex items-center justify-between text-[11px] opacity-80 border-t border-current/15 font-mono">
                    <span>رقم المعاملة: {latestPayment.transactionReference}</span>
                    <span>تاريخ الإرسال: {new Date(latestPayment.submittedAt).toLocaleDateString('ar-MA')}</span>
                  </div>
                </div>
              )}

              {isRejected && (
                <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200/90 text-rose-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      <h4 className="font-bold text-sm">تم رفض طلب الاشتراك / الدفع — المنصة بحالة «في انتظار الدفع»</h4>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-200 text-rose-900 border border-rose-300">
                      مرفوض ❌
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-rose-800">
                    تعذر التحقق من عملية الدفع المرسلة. يرجى مراجعة معلومات الدفع وإعادة تسديد الاشتراك لتفعيل المنصة.
                  </p>
                  {latestPayment.rejectionReason && (
                    <p className="text-xs font-semibold text-rose-900 bg-rose-100/60 p-2.5 rounded-xl border border-rose-200">
                      سبب الرفض من الإدارة: {latestPayment.rejectionReason}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Refresh status helper */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>نظام حماية وتفعيل الجمعيات الآمن</span>
            </span>

            <button
              type="button"
              onClick={refreshPaymentStatus}
              disabled={isCheckingStatus}
              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
              <span>تحديث الحالة</span>
            </button>
          </div>

        </div>

      </main>

      {/* Footer Notice */}
      <footer className="w-full max-w-5xl mx-auto text-center text-xs text-white/50 pt-6">
        syoumax منصة العمل الجمعوي بالمملكة المغربية • نظام تفعيل المنصات المستقلة الموحد © {new Date().getFullYear()}
      </footer>

      {/* Payment Method Modal */}
      <PaymentMethodModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
        }}
        tenant={currentTenant}
        mode="activation"
        customAmount={feeInfo.amount}
        customCurrency={feeInfo.currency}
        onPaymentSubmitted={() => {
          refreshPaymentStatus();
        }}
      />

    </div>
  );
};
