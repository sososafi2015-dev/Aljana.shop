import React, { useState, useMemo } from 'react';
import {
  RefreshCw,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  Eye,
  ExternalLink,
  ChevronLeft,
  X,
  Printer,
  HelpCircle,
  Building2,
  Sparkles,
  ArrowUpRight,
  Receipt,
  Download,
  Check
} from 'lucide-react';
import { AssociationTenant, TenantPaymentRecord, Language } from '../types';
import {
  getTenantSubscriptionDetails,
  getPlatformPaymentSettings,
  cancelTenantPayment,
  getActivationFeeForCountry,
} from '../paymentStorage';
import { PaymentMethodModal } from './PaymentMethodModal';

interface SubscriptionRenewalSectionProps {
  tenant: AssociationTenant;
  lang?: Language;
  onRefresh?: () => void;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const SubscriptionRenewalSection: React.FC<SubscriptionRenewalSectionProps> = ({
  tenant,
  lang = 'ar',
  onRefresh,
  addToast,
}) => {
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [viewReceiptPayment, setViewReceiptPayment] = useState<TenantPaymentRecord | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [localVersion, setLocalVersion] = useState(0);

  // Compute detailed subscription info
  const subInfo = useMemo(() => {
    return getTenantSubscriptionDetails(tenant);
  }, [tenant, localVersion]);

  const settings = getPlatformPaymentSettings();
  const feeInfo = getActivationFeeForCountry(tenant.country, settings);

  // Helper date formatter in Arabic
  const formatDateArabic = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('ar-MA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(d);
    } catch {
      return isoString.split('T')[0] || '—';
    }
  };

  const formatShortDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ar-MA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return isoString.split('T')[0] || '—';
    }
  };

  const handleCancelPending = (paymentId: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء طلب الدفع المعلق؟')) {
      return;
    }
    setIsCancelling(true);
    const res = cancelTenantPayment(paymentId);
    setIsCancelling(false);
    if (res.success) {
      if (addToast) addToast('info', 'تم إلغاء طلب الدفع بنجاح.');
      setLocalVersion((v) => v + 1);
      if (onRefresh) onRefresh();
    } else {
      if (addToast) addToast('error', res.error || 'تعذر إلغاء الطلب.');
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return 'تحويل بنكي (RIB)';
      case 'cash_plus':
        return 'كاش بليس (Cash Plus)';
      case 'credit_card':
        return 'بطاقة بنكية (CMI / Visa / MasterCard)';
      case 'paypal':
        return 'بايبال (PayPal)';
      default:
        return method || 'تحويل مباشر';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800" dir="rtl" id="subscription-renewal-container">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                <Building2 className="w-3.5 h-3.5" />
                {tenant.name}
              </span>
              
              {subInfo.status === 'active' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  اشتراك نشط ({subInfo.remainingDays} يوم متبقي)
                </span>
              )}
              {subInfo.status === 'expiring_soon' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  قريب من الانتهاء ({subInfo.remainingDays} يوم متبقي)
                </span>
              )}
              {subInfo.status === 'expired' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-400/30">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  اشتراك منتهي الصلاحية
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <RefreshCw className="w-7 h-7 text-indigo-400" />
              تجديد الاشتراك ومعلومات المنظومة
            </h1>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed">
              إدارة الاشتراك السنوي لمنصة الجمعية، تتبع مدة الصلاحية، أداء واجب التجديد، والاطلاع على سجل المعاملات المالية المعتمدة.
            </p>
          </div>

          {/* Quick CTA Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
            <button
              onClick={() => setIsRenewalModalOpen(true)}
              className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-950/40 hover:shadow-emerald-900/60 transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              <CreditCard className="w-5 h-5 text-emerald-200 group-hover:scale-110 transition-transform" />
              <span>أداء واجب التجديد السنوي</span>
            </button>
          </div>
        </div>
      </div>

      {/* Subscription Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Activation Fee Paid */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">مبلغ التفعيل الأساسي</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1">
            {subInfo.activationFeePaid} <span className="text-sm font-bold text-slate-500">{subInfo.currency}</span>
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>تاريخ الدفع: {formatShortDate(subInfo.activationFeeDate)}</span>
          </p>
        </div>

        {/* Card 2: Subscription Start Date */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">تاريخ بداية الاشتراك</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-lg font-black text-slate-900 mb-1">
            {formatDateArabic(subInfo.subscriptionStartDate)}
          </div>
          <p className="text-xs text-slate-500">
            انطلاق دورة الاشتراك الحالية
          </p>
        </div>

        {/* Card 3: Subscription Expiry Date */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">تاريخ انتهاء الاشتراك</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-lg font-black text-slate-900 mb-1">
            {formatDateArabic(subInfo.subscriptionEndDate)}
          </div>
          <p className="text-xs text-slate-500">
            نهاية الصلاحية (دورة سنوية 12 شهراً)
          </p>
        </div>

        {/* Card 4: Status Indicator */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">حالة الاشتراك الحالية</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              subInfo.status === 'active'
                ? 'bg-emerald-50 text-emerald-600'
                : subInfo.status === 'expiring_soon'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-red-50 text-red-600'
            }`}>
              {subInfo.status === 'active' && <CheckCircle2 className="w-5 h-5" />}
              {subInfo.status === 'expiring_soon' && <AlertTriangle className="w-5 h-5" />}
              {subInfo.status === 'expired' && <X className="w-5 h-5" />}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-block w-3 h-3 rounded-full ${
              subInfo.status === 'active'
                ? 'bg-emerald-500'
                : subInfo.status === 'expiring_soon'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-red-500'
            }`} />
            <span className={`text-xl font-black ${
              subInfo.status === 'active'
                ? 'text-emerald-700'
                : subInfo.status === 'expiring_soon'
                ? 'text-amber-700'
                : 'text-red-700'
            }`}>
              {subInfo.statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {subInfo.status === 'active' && 'المنصة مفعلة وتعمل بكامل المميزات'}
            {subInfo.status === 'expiring_soon' && 'يرجى التجديد قبل انتهاء المدة'}
            {subInfo.status === 'expired' && 'انتهت مدة الصلاحية، يرجى التجديد الآن'}
          </p>
        </div>

        {/* Card 5: Remaining Days & Progress */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">الأيام المتبقية</span>
            <span className="text-xs font-semibold text-slate-400">
              {subInfo.consumedPercent}% مستهلك
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-2">
            {subInfo.remainingDays > 0 ? (
              <>
                {subInfo.remainingDays} <span className="text-sm font-bold text-slate-500">يوماً</span>
              </>
            ) : (
              <span className="text-red-600 text-lg">منتهي (0 يوم)</span>
            )}
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                subInfo.status === 'active'
                  ? 'bg-emerald-500'
                  : subInfo.status === 'expiring_soon'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${subInfo.consumedPercent}%` }}
            />
          </div>
        </div>

        {/* Card 6: Renewal Fee Required */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">واجب التجديد السنوي</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1">
            {subInfo.annualFee} <span className="text-sm font-bold text-slate-500">{subInfo.currency}</span>
          </div>
          <p className="text-xs text-slate-500">
            تغطية سنة إضافية (12 شهراً)
          </p>
        </div>
      </div>

      {/* Renewal Policy & Calculation Rule Banner */}
      <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 md:p-6 space-y-3">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              قواعد وآلية التجديد السنوي الذكية (ضمان عدم ضياع الأيام)
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              تعتمد المنصة دورة اشتراك سنوية مقدارها <strong>سنة كاملة (12 شهراً)</strong> من تاريخ البداية.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="bg-white/90 rounded-xl p-3.5 border border-emerald-200 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-sm">
              ✓
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-900 mb-0.5">التجديد قبل انتهاء الاشتراك:</h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                يبدأ الاشتراك الجديد تلقائيًا من <strong>تاريخ انتهاء الاشتراك الحالي</strong>، مما يضمن احتفاظكم بكامل الأيام المتبقية دون أي انتقاص.
              </p>
            </div>
          </div>

          <div className="bg-white/90 rounded-xl p-3.5 border border-blue-200 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-sm">
              ✓
            </div>
            <div>
              <h4 className="text-xs font-bold text-blue-900 mb-0.5">التجديد بعد انتهاء الاشتراك:</h4>
              <p className="text-xs text-blue-800 leading-relaxed">
                يبدأ الاشتراك الجديد من <strong>تاريخ تأكيد عملية الدفع</strong> لمدة 12 شهرًا كاملة.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Renewal Banner (If any) */}
      {subInfo.pendingPayment && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 md:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <Clock className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                    طلب قيد المراجعة والتدقيق
                  </span>
                  <span className="text-xs text-slate-500">
                    المرجع: <strong>{subInfo.pendingPayment.transactionReference}</strong>
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  تم إرسال طلب {subInfo.pendingPayment.type === 'renewal' ? 'تجديد الاشتراك' : 'تفعيل المنصة'} بمبلغ {subInfo.pendingPayment.amount} {subInfo.pendingPayment.currency}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  طريقة الدفع: <strong>{getMethodLabel(subInfo.pendingPayment.paymentMethod)}</strong> • تاريخ التقديم: {formatDateArabic(subInfo.pendingPayment.submittedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
              {subInfo.pendingPayment.proofDocumentUrl && (
                <button
                  onClick={() => setSelectedProofUrl(subInfo.pendingPayment?.proofDocumentUrl || null)}
                  className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>معاينة الوصل</span>
                </button>
              )}
              <button
                disabled={isCancelling}
                onClick={() => handleCancelPending(subInfo.pendingPayment!.id)}
                className="px-3.5 py-2 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                <span>إلغاء الطلب</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment & Renewal History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">سجل عمليات التفعيل والتجديد</h3>
              <p className="text-xs text-slate-500">
                قائمة المعاملات المالية الموثقة والوصلات المعتمدة لهذه الجمعية
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsRenewalModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>طلب تجديد جديد</span>
          </button>
        </div>

        {subInfo.paymentsHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-1" />
            <p className="text-base font-bold text-slate-700 mb-1">لا توجد عمليات مسجلة حتى الآن</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              يمكنكم تقديم طلب تجديد الاشتراك السنوي في أي وقت بالضغط على الزر أدناه.
            </p>
            <button
              onClick={() => setIsRenewalModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              أداء واجب التجديد الآن
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-bold text-slate-500">
                  <th className="py-3.5 px-4">نوع المعاملة</th>
                  <th className="py-3.5 px-4">المبلغ والعملة</th>
                  <th className="py-3.5 px-4">طريقة الدفع</th>
                  <th className="py-3.5 px-4">الرقم المرجعي</th>
                  <th className="py-3.5 px-4">تاريخ العملية</th>
                  <th className="py-3.5 px-4">الفترة المغطاة</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subInfo.paymentsHistory.map((p) => {
                  const isRenewalType = p.type === 'renewal';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isRenewalType ? 'bg-purple-500' : 'bg-indigo-500'}`} />
                          <span>{isRenewalType ? 'تجديد سنوي (12 شهر)' : 'تفعيل المنصة الأولي'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        {p.amount} <span className="text-xs text-slate-500">{p.currency}</span>
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-600">
                        {getMethodLabel(p.paymentMethod)}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-slate-700">
                        {p.transactionReference || '—'}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-600">
                        {formatShortDate(p.submittedAt || p.createdAt)}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-600 font-mono">
                        {p.periodStart && p.periodEnd ? (
                          <span>
                            {formatShortDate(p.periodStart)} ← {formatShortDate(p.periodEnd)}
                          </span>
                        ) : (
                          'سنة كاملة'
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {p.status === 'confirmed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            مؤكد ومعتمد
                          </span>
                        )}
                        {p.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3.5 h-3.5" />
                            قيد المراجعة
                          </span>
                        )}
                        {p.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                            <X className="w-3.5 h-3.5" />
                            مرفوض
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {p.proofDocumentUrl && (
                            <button
                              onClick={() => setSelectedProofUrl(p.proofDocumentUrl || null)}
                              title="معاينة إشعار الدفع"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {p.status === 'confirmed' && (
                            <button
                              onClick={() => setViewReceiptPayment(p)}
                              title="عرض وصل الأداء والاشتراك"
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Data Protection and Guarantee Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white mb-1">
              ضمان الحفاظ الكامل على البيانات والملفات
            </h4>
            <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
              تلتزم إدارة syoumax منصة العمل الجمعوي بالحفاظ الأبدي والشامل على جميع بيانات الجمعية وسجلاتها وأعضائها ووثائقها المحفوظة في قاعدة البيانات دون أي حذف، حتى في حال انقضاء فترة الاشتراك السنوي.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>تخزين سحابي مؤمن 100%</span>
        </div>
      </div>

      {/* Proof Document Preview Modal */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                معاينة وصل / إشعار الدفع
              </h3>
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto flex items-center justify-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
              {selectedProofUrl.startsWith('data:image') || selectedProofUrl.includes('.png') || selectedProofUrl.includes('.jpg') || selectedProofUrl.includes('.jpeg') ? (
                <img
                  src={selectedProofUrl}
                  alt="إشعار الدفع"
                  className="max-w-full max-h-[60vh] object-contain rounded-xl shadow"
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="w-16 h-16 text-indigo-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700 mb-2">مستند إشعار الدفع (PDF أو ملف مستند)</p>
                  <a
                    href={selectedProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                    فتح المستند في نافذة مستقلة
                  </a>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt / Invoice Modal for Confirmed Payments */}
      {viewReceiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8 border border-slate-200 text-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">وصل أداء اشتراك معتمد</h3>
                  <p className="text-xs text-slate-500">syoumax منصة العمل الجمعوي</p>
                </div>
              </div>
              <button
                onClick={() => setViewReceiptPayment(null)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="space-y-4 bg-slate-50/75 p-5 rounded-2xl border border-slate-100 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">اسم الجمعية:</span>
                <span className="font-bold text-slate-900">{tenant.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">نوع المعاملة:</span>
                <span className="font-bold text-slate-900">
                  {viewReceiptPayment.type === 'renewal' ? 'تجديد سنوي (12 شهر)' : 'تفعيل أولي للمنصة'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">المبلغ المؤدى:</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {viewReceiptPayment.amount} {viewReceiptPayment.currency}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">طريقة الأداء:</span>
                <span className="font-bold text-slate-900">{getMethodLabel(viewReceiptPayment.paymentMethod)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">الرقم المرجعي:</span>
                <span className="font-mono font-bold text-slate-900">{viewReceiptPayment.transactionReference}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">تاريخ المعاملة:</span>
                <span className="font-bold text-slate-900">{formatDateArabic(viewReceiptPayment.submittedAt)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">الفترة المغطاة:</span>
                <span className="font-bold text-slate-900">
                  {viewReceiptPayment.periodStart && viewReceiptPayment.periodEnd ? (
                    `${formatShortDate(viewReceiptPayment.periodStart)} إلى ${formatShortDate(viewReceiptPayment.periodEnd)}`
                  ) : (
                    'سنة كاملة (12 شهر)'
                  )}
                </span>
              </div>
            </div>

            {/* Stamp / Confirmation */}
            <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-900 font-medium">
                تم اعتماد هذه المعاملة وتوثيق التجديد رسميًا بواسطة: <strong>{viewReceiptPayment.reviewedBy || 'الإدارة المركزية'}</strong>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الوصل</span>
              </button>
              <button
                onClick={() => setViewReceiptPayment(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Renewal Modal */}
      {isRenewalModalOpen && (
        <PaymentMethodModal
          isOpen={isRenewalModalOpen}
          onClose={() => setIsRenewalModalOpen(false)}
          tenant={tenant}
          mode="renewal"
          onPaymentSubmitted={() => {
            setLocalVersion((v) => v + 1);
            if (addToast) {
              addToast('success', 'تم إرسال طلب تجديد الاشتراك السنوي بنجاح للمراجعة.');
            }
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
};
