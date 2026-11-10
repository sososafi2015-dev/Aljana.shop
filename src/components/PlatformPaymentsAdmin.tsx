import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Building2,
  Wallet,
  DollarSign,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  Check,
  X,
  Settings,
  Save,
  ShieldCheck,
  Calendar,
  Phone,
  User,
  ExternalLink,
  RefreshCw,
  Sliders,
  Sparkles,
  Heart,
  FileText,
  History,
  MapPin,
  Download
} from 'lucide-react';
import { TenantPaymentRecord, PlatformPaymentSettings, PaymentStatus, AssociationTenant } from '../types';
import {
  getAllTenantPayments,
  getPlatformPaymentSettings,
  savePlatformPaymentSettings,
  verifyTenantPayment,
  confirmPaymentAndActivateTenant,
  rejectTenantPayment,
  syncPaymentsFromBackend,
} from '../paymentStorage';
import { getAllTenants, syncTenantsFromBackend } from '../tenantStorage';

interface PlatformPaymentsAdminProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onTenantsUpdated?: () => void;
}

export const PlatformPaymentsAdmin: React.FC<PlatformPaymentsAdminProps> = ({
  onShowToast,
  onTenantsUpdated,
}) => {
  const [payments, setPayments] = useState<TenantPaymentRecord[]>(getAllTenantPayments);
  const [tenants, setTenants] = useState<AssociationTenant[]>(getAllTenants);
  const [settings, setSettings] = useState<PlatformPaymentSettings>(getPlatformPaymentSettings);
  const [currentSubTab, setCurrentSubTab] = useState<'requests' | 'settings'>('requests');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');

  // Proof Modal
  const [viewingProof, setViewingProof] = useState<{ url: string; title: string; fileName?: string } | null>(null);

  // Review Subscription Request & Operation Log Modal
  const [reviewingPayment, setReviewingPayment] = useState<TenantPaymentRecord | null>(null);
  const [verificationNote, setVerificationNote] = useState('');

  // Reject Modal
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Confirm & Activate Modal State
  const [confirmingPayment, setConfirmingPayment] = useState<TenantPaymentRecord | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Settings form states
  const [formSettings, setFormSettings] = useState<PlatformPaymentSettings>(settings);

  const refreshData = () => {
    const raw = getAllTenantPayments();
    // Strictly isolate: platform support payments belong exclusively to the Platform Support Account, not Association Subscriptions
    const filtered = (raw || []).filter(
      (p) => p && (p.type as string) !== 'platform_support' && (p.type as string) !== 'support' && p.tenantId !== 'platform' && p.tenantId !== 'platform_support'
    );
    setPayments(filtered);
    setTenants(getAllTenants());
    setSettings(getPlatformPaymentSettings());
    if (reviewingPayment) {
      const updatedReview = filtered.find((p) => p.id === reviewingPayment.id);
      if (updatedReview) setReviewingPayment(updatedReview);
    }
  };

  useEffect(() => {
    refreshData();
    syncPaymentsFromBackend().then(() => refreshData()).catch(() => {});
    syncTenantsFromBackend().then(() => refreshData()).catch(() => {});

    const handleUpdate = () => refreshData();
    window.addEventListener('chayef-payments-changed', handleUpdate);
    window.addEventListener('chayef-tenants-changed', handleUpdate);
    return () => {
      window.removeEventListener('chayef-payments-changed', handleUpdate);
      window.removeEventListener('chayef-tenants-changed', handleUpdate);
    };
  }, []);

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    if ((p.type as string) === 'platform_support' || (p.type as string) === 'support' || p.tenantId === 'platform' || p.tenantId === 'platform_support') {
      return false;
    }
    if (statusFilter !== 'all' && p.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.tenantName.toLowerCase().includes(q);
      const matchOwner = p.ownerName.toLowerCase().includes(q);
      const matchPhone = p.ownerPhone.toLowerCase().includes(q);
      const matchRef = (p.transactionReference || '').toLowerCase().includes(q);
      if (!matchName && !matchOwner && !matchPhone && !matchRef) {
        return false;
      }
    }
    return true;
  });

  // Calculate Metrics
  const pendingCount = payments.filter((p) => p.status === 'pending').length;
  const verifiedCount = payments.filter((p) => p.status === 'verified').length;
  const confirmedCount = payments.filter((p) => p.status === 'confirmed').length;
  const rejectedCount = payments.filter((p) => p.status === 'rejected').length;
  const pendingSubscriptionTenants = tenants.filter(
    (t) => !t.isMasterTemplate && t.status === 'pending_subscription'
  );

  const totalCollectedMad = payments
    .filter((p) => p.status === 'confirmed' && p.currency === 'MAD')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalCollectedUsd = payments
    .filter((p) => p.status === 'confirmed' && p.currency === 'USD')
    .reduce((sum, p) => sum + p.amount, 0);

  // Actions
  const handleVerifyPayment = (payment: TenantPaymentRecord, customNote?: string) => {
    const result = verifyTenantPayment(payment.id, 'الإدارة العامة', customNote);
    if (result.success) {
      onShowToast(
        `تم التحقق من صحة الدفع لجمعية «${payment.tenantName}» وتوثيق الحالة بنجاح ✓. يمكنك الآن تفعيل المنصة.`,
        'success'
      );
      refreshData();
      if (onTenantsUpdated) onTenantsUpdated();
    } else {
      onShowToast(result.error || 'تعذر التحقق من الدفع.', 'error');
    }
  };

  const handleOpenConfirmModal = (payment: TenantPaymentRecord) => {
    setConfirmingPayment(payment);
  };

  const handleExecuteConfirmPayment = () => {
    if (!confirmingPayment) return;
    setIsProcessingAction(true);

    try {
      const result = confirmPaymentAndActivateTenant(confirmingPayment.id, 'الإدارة العامة');
      if (result.success) {
        onShowToast(
          `تم تأكيد الدفع وتفعيل منصة «${confirmingPayment.tenantName}» بنجاح! ✅\n«تم تأكيد عملية الدفع وتفعيل منصة جمعيتك بنجاح. يمكنك الآن الدخول إلى منصتك والبدء في استخدامها.»`,
          'success'
        );
        refreshData();
        if (onTenantsUpdated) onTenantsUpdated();
      } else {
        onShowToast(result.error || 'فشلت عملية التأكيد والتفعيل.', 'error');
      }
    } catch (err: any) {
      console.error('Error confirming payment:', err);
      onShowToast(err?.message || 'حدث خطأ أثناء تنفيذ عملية التفعيل.', 'error');
    } finally {
      setIsProcessingAction(false);
      setConfirmingPayment(null);
    }
  };

  const handleOpenReject = (paymentId: string) => {
    setRejectingPaymentId(paymentId);
    setRejectionReason('تعذر التحقق من صحة معلومات الدفع أو الإشعار المرفق.');
  };

  const handleConfirmReject = () => {
    if (!rejectingPaymentId) return;

    const result = rejectTenantPayment(rejectingPaymentId, 'الإدارة العامة', rejectionReason.trim());
    if (result.success) {
      onShowToast('تم رفض طلب الاشتراك وإرجاع حالة المنصة إلى «في انتظار الدفع» مع تسجيل العملية.', 'info');
      setRejectingPaymentId(null);
      setRejectionReason('');
      refreshData();
      if (onTenantsUpdated) onTenantsUpdated();
    } else {
      onShowToast(result.error || 'فشلت العملية.', 'error');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    savePlatformPaymentSettings(formSettings);
    setSettings(formSettings);
    onShowToast('تم حفظ وتحديث إعدادات رسوم وطرق الدفع بنجاح.', 'success');
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Building2 className="w-3.5 h-3.5" />
            حساب بنكي
          </span>
        );
      case 'cash_plus':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Wallet className="w-3.5 h-3.5" />
            Cash Plus
          </span>
        );
      case 'credit_card':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CreditCard className="w-3.5 h-3.5" />
            بطاقة بنكية
          </span>
        );
      case 'paypal':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <DollarSign className="w-3.5 h-3.5" />
            PayPal
          </span>
        );
      default:
        return <span>{method}</span>;
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            بانتظار التحقق من الدفع
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            تم التحقق من الدفع • بانتظار التفعيل
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            تم التفعيل ✅
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            مرفوض ❌
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            ملغى
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const getTenantPlatformStatusBadge = (tenantId: string) => {
    const t = tenants.find((x) => x.id === tenantId);
    if (!t) return null;
    if (t.status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          حالة المنصة: مفعّلة
        </span>
      );
    }
    if (t.status === 'pending_activation') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          حالة المنصة: في انتظار التفعيل
        </span>
      );
    }
    if (t.status === 'pending_subscription') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          حالة المنصة: في انتظار الدفع
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        حالة المنصة: معطلة
      </span>
    );
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>إجمالي الطلبات</span>
            <CreditCard className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{payments.length}</div>
          <span className="text-[11px] text-slate-400">كافة العمليات المسجلة</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm bg-amber-50/30">
          <div className="flex items-center justify-between text-xs text-amber-700 mb-1 font-bold">
            <span>في انتظار المراجعة</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 font-mono">{pendingCount}</div>
          <span className="text-[11px] text-amber-600">تحتاج فحص وتأكيد</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm bg-emerald-50/30">
          <div className="flex items-center justify-between text-xs text-emerald-700 mb-1 font-bold">
            <span>تم تفعيلها بنجاح</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 font-mono">{confirmedCount}</div>
          <span className="text-[11px] text-emerald-600">منصات نشطة حالياً</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>المحصل المالي</span>
            <DollarSign className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-lg font-black text-slate-900 font-mono">
            {totalCollectedMad.toLocaleString()} MAD
          </div>
          {totalCollectedUsd > 0 && (
            <span className="text-[11px] text-slate-500 block font-mono">
              + ${totalCollectedUsd.toLocaleString()} USD
            </span>
          )}
        </div>
      </div>

      {/* Sub-Tabs Nav */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentSubTab('requests')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              currentSubTab === 'requests'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span>طلبات تفعيل المنصات ({payments.length})</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                {pendingCount} قيد المراجعة
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentSubTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              currentSubTab === 'settings'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Settings className="w-4 h-4 text-emerald-400" />
            <span>إعدادات رسوم وطرق الدفع</span>
          </button>
        </div>

        <button
          type="button"
          onClick={refreshData}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="تحديث البيانات"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* SUB-TAB 1: REQUESTS */}
      {currentSubTab === 'requests' && (
        <div className="space-y-4">
          
          {/* Platforms Currently in 'pending_subscription' (Awaiting Subscription Payment) */}
          {pendingSubscriptionTenants.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>منصات حديثة التسجيل بحالة «في انتظار الدفع» ({pendingSubscriptionTenants.length}):</span>
                </div>
                <span className="text-[11px] text-amber-800 font-semibold">
                  ممنوعة من الدخول للوحة الإدارة حتى تسديد الاشتراك وتأكيد الدفع والتفعيل الإداري
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {pendingSubscriptionTenants.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white rounded-xl p-3 border border-amber-200/80 flex items-center justify-between gap-3 text-xs shadow-2xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{t.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          في انتظار الدفع
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        المسؤول: {t.ownerName} • <span dir="ltr">{t.ownerPhone}</span> • {t.country} ({t.city})
                      </div>
                    </div>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 shrink-0">
                      بانتظار تسديد الاشتراك
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث باسم الجمعية، اسم صاحب المنصة، رقم الهاتف، أو رقم المعاملة..."
                className="w-full pl-4 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">جميع طلبات الاشتراك ({payments.length})</option>
                <option value="pending">بانتظار التحقق من الدفع ({pendingCount})</option>
                <option value="verified">تم التحقق من الدفع • بانتظار التفعيل ({verifiedCount})</option>
                <option value="confirmed">تم التفعيل ({confirmedCount})</option>
                <option value="rejected">مرفوضة ({rejectedCount})</option>
              </select>
            </div>
          </div>

          {/* Payments Table */}
          {filteredPayments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-700">لا توجد طلبات دفع مطابقة</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'جرب تعديل خيارات البحث أو تصفية الحالة.'
                  : 'لم يتم تسجيل أي طلبات تفعيل منصات جديدة حتى الآن.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">الجمعية والمسؤول</th>
                      <th className="py-3.5 px-4">المبلغ والعملة</th>
                      <th className="py-3.5 px-4">طريقة الدفع</th>
                      <th className="py-3.5 px-4">إثبات الدفع</th>
                      <th className="py-3.5 px-4">تاريخ الطلب</th>
                      <th className="py-3.5 px-4">حالة الدفع</th>
                      <th className="py-3.5 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayments.map((p) => {
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          
                          {/* Association & Owner */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{p.tenantName}</span>
                              {p.type === 'renewal' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  تجديد سنوي
                                </span>
                              ) : p.type === 'ad_campaign' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  حملة إعلانية
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  تفعيل أولي
                                </span>
                              )}
                            </div>
                            <div className="text-slate-500 flex items-center gap-2 mt-0.5 text-[11px]">
                              <span>{p.ownerName}</span>
                              <span>•</span>
                              <span dir="ltr" className="font-mono">{p.ownerPhone}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              الدولة: {p.country}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-indigo-900 text-sm">
                              {p.amount} {p.currency}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              المرجع: {p.transactionReference || '-'}
                            </div>
                          </td>

                          {/* Method */}
                          <td className="py-3.5 px-4">
                            {getMethodBadge(p.paymentMethod)}
                            {p.cardLast4 && (
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                •••• {p.cardLast4}
                              </div>
                            )}
                          </td>

                          {/* Proof */}
                          <td className="py-3.5 px-4">
                            {p.proofDocumentUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingProof({
                                    url: p.proofDocumentUrl!,
                                    title: `إثبات دفع جمعية «${p.tenantName}»`,
                                    fileName: p.proofFileName,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>معاينة الإثبات</span>
                              </button>
                            ) : p.paymentMethod === 'credit_card' ? (
                              <span className="text-[11px] text-emerald-700 font-semibold">
                                دفع إلكتروني مباشر
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">لا يوجد إثبات</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4">
                            <div className="text-slate-700 font-mono">
                              {new Date(p.submittedAt).toLocaleDateString('ar-MA')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {new Date(p.submittedAt).toLocaleTimeString('ar-MA', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          {/* Status & Platform Lifecycle */}
                          <td className="py-3.5 px-4 space-y-1.5">
                            <div>{getStatusBadge(p.status)}</div>
                            <div>{getTenantPlatformStatusBadge(p.tenantId)}</div>
                            {p.status === 'rejected' && p.rejectionReason && (
                              <div className="text-[10px] text-rose-600 mt-1 max-w-xs truncate" title={p.rejectionReason}>
                                السبب: {p.rejectionReason}
                              </div>
                            )}
                            {Array.isArray(p.statusHistory) && p.statusHistory.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewingPayment(p);
                                  setVerificationNote(p.adminNotes || '');
                                }}
                                className="inline-flex items-center gap-1 text-[10px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                              >
                                <History className="w-3 h-3" />
                                <span>سجل العمليات ({p.statusHistory.length})</span>
                              </button>
                            )}
                          </td>

                          {/* Actions: Review Request, Verify Payment, Activate Platform, Reject Request */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewingPayment(p);
                                  setVerificationNote(p.adminNotes || '');
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                                title="مراجعة طلب الاشتراك وسجل العمليات"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                <span>مراجعة الطلب</span>
                              </button>

                              {p.status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyPayment(p)}
                                    className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                    title="الخطوة 1: التحقق من صحة الدفع"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>التحقق من الدفع</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenConfirmModal(p)}
                                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                    title="الخطوة 2: تفعيل المنصة والموافقة الإدارية"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>تفعيل المنصة</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenReject(p.id)}
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="رفض طلب الاشتراك"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>رفض الطلب</span>
                                  </button>
                                </>
                              )}

                              {p.status === 'verified' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenConfirmModal(p)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95 animate-pulse"
                                    title="تفعيل المنصة بعد أن تم التحقق من الدفع"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>تفعيل المنصة الآن</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenReject(p.id)}
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="رفض الطلب"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>رفض</span>
                                  </button>
                                </>
                              )}

                              {p.status === 'confirmed' && (
                                <span className="text-[11px] text-emerald-700 font-bold px-2">
                                  مفعلة بواسطة {p.reviewedBy || 'الإدارة'}
                                </span>
                              )}

                              {p.status === 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenConfirmModal(p)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                                  title="إعادة التفعيل"
                                >
                                  إعادة التفعيل
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
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB 2: SETTINGS */}
      {currentSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          
          {/* Centralized Payment Support Integration Banner */}
          <div className="bg-gradient-to-r from-indigo-900 to-blue-900 text-white p-5 rounded-2xl shadow-sm border border-indigo-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>توحيد طرق الدفع مع قسم «دعم المنصة»</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                    المصدر المركزي الموحد
                  </span>
                </h4>
                <p className="text-xs text-indigo-200 mt-1 leading-relaxed">
                  طرق الدفع المعتمدة لتفعيل المنصات الجديدة والإعلانات مربوطة وموحدة كلياً مع قسم «دعم المنصة» بالإدارة العامة. أي إضافة أو تعديل أو تعطيل لطريقة دفع هناك ينعكس فوراً وتلقائياً على تفعيل المنصات.
                </p>
              </div>
            </div>
          </div>

          {/* General Fees */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                رسوم التفعيل والعملات الافتراضية
              </h3>
              <span className="text-[11px] text-slate-500">
                يمكنك التعديل مستقبلاً مباشرة دون الحاجة لتغيير الكود
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  رسوم التفعيل داخل المغرب (درهم مغربي MAD) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formSettings.activationFeeMad}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, activationFeeMad: Number(e.target.value) || 0 })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">القيمة الافتراضية: 199 MAD</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  رسوم التفعيل خارج المغرب (دولار أمريكي USD) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formSettings.activationFeeUsd}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, activationFeeUsd: Number(e.target.value) || 0 })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">القيمة الموازية للمستخدمين الدوليين ($)</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  سعر الصرف المعتمد (1 USD = X MAD)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={formSettings.exchangeRate}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, exchangeRate: Number(e.target.value) || 10 })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Bank Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">معلومات التحويل البنكي (Virement)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formSettings.bankAccount.enabled}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>تفعيل خيار الدفع البنكي</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم صاحب الحساب</label>
                <input
                  type="text"
                  value={formSettings.bankAccount.accountHolder}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, accountHolder: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم البنك</label>
                <input
                  type="text"
                  value={formSettings.bankAccount.bankName}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, bankName: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الحساب / RIB (24 رقم)</label>
                <input
                  type="text"
                  value={formSettings.bankAccount.rib}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, rib: e.target.value },
                    })
                  }
                  dir="ltr"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رمز IBAN</label>
                <input
                  type="text"
                  value={formSettings.bankAccount.iban}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, iban: e.target.value },
                    })
                  }
                  dir="ltr"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">تعليمات إضافية للمستخدمين</label>
                <textarea
                  rows={2}
                  value={formSettings.bankAccount.additionalInstructions}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, additionalInstructions: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Cash Plus Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-800 text-sm">معلومات Cash Plus (كاش بليس)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formSettings.cashPlus.enabled}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      cashPlus: { ...formSettings.cashPlus, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>تفعيل خيار Cash Plus</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المستفيد</label>
                <input
                  type="text"
                  value={formSettings.cashPlus.beneficiaryName}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      cashPlus: { ...formSettings.cashPlus, beneficiaryName: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف المرتبط</label>
                <input
                  type="text"
                  value={formSettings.cashPlus.phone}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      cashPlus: { ...formSettings.cashPlus, phone: e.target.value },
                    })
                  }
                  dir="ltr"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الحساب أو المرجع</label>
                <input
                  type="text"
                  value={formSettings.cashPlus.accountOrRef}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      cashPlus: { ...formSettings.cashPlus, accountOrRef: e.target.value },
                    })
                  }
                  dir="ltr"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">تعليمات الدفع عبر الوكالات</label>
                <textarea
                  rows={2}
                  value={formSettings.cashPlus.instructions}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      cashPlus: { ...formSettings.cashPlus, instructions: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Credit Card & PayPal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Credit Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 text-sm">البطاقة البنكية</h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formSettings.creditCard.enabled}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        creditCard: { ...formSettings.creditCard, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>تفعيل الدفع بالبطاقة</span>
                </label>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم بوابة الدفع</label>
                  <input
                    type="text"
                    value={formSettings.creditCard.gatewayName}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        creditCard: { ...formSettings.creditCard, gatewayName: e.target.value },
                      })
                    }
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تعليمات الأمان</label>
                  <textarea
                    rows={2}
                    value={formSettings.creditCard.instructions}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        creditCard: { ...formSettings.creditCard, instructions: e.target.value },
                      })
                    }
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* PayPal */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-sky-600" />
                  <h3 className="font-bold text-slate-800 text-sm">حساب PayPal</h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formSettings.paypal.enabled}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        paypal: { ...formSettings.paypal, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>تفعيل الدفع بـ PayPal</span>
                </label>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني لحساب PayPal</label>
                  <input
                    type="email"
                    value={formSettings.paypal.email}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        paypal: { ...formSettings.paypal, email: e.target.value },
                      })
                    }
                    dir="ltr"
                    className="w-full p-3 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تعليمات PayPal</label>
                  <textarea
                    rows={2}
                    value={formSettings.paypal.instructions}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        paypal: { ...formSettings.paypal, instructions: e.target.value },
                      })
                    }
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 text-xs"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="px-8 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              <span>حفظ وتطبيق إعدادات الدفع</span>
            </button>
          </div>

        </form>
      )}

      {/* Proof Lightbox Modal */}
      {viewingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-bold text-sm truncate">{viewingProof.title}</span>
              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[80vh] overflow-y-auto text-center bg-slate-50 flex items-center justify-center">
              {viewingProof.url.startsWith('data:application/pdf') || viewingProof.url.toLowerCase().includes('.pdf') || viewingProof.fileName?.toLowerCase().endsWith('.pdf') ? (
                <div className="p-8 text-center space-y-3 bg-white rounded-xl shadow-xs border border-slate-200">
                  <FileText className="w-12 h-12 text-rose-600 mx-auto" />
                  <p className="font-bold text-slate-800 text-sm">ملف PDF مرفق: {viewingProof.fileName || 'وصل_الدفع.pdf'}</p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <a
                      href={viewingProof.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>فتح وعرض ملف الـ PDF</span>
                    </a>
                    <a
                      href={viewingProof.url}
                      download={viewingProof.fileName || 'proof.pdf'}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>تحميل</span>
                    </a>
                  </div>
                </div>
              ) : (
                <img
                  src={viewingProof.url}
                  alt={viewingProof.title}
                  className="max-h-[70vh] max-w-full object-contain rounded-xl border border-slate-200 shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <AlertCircle className="w-5 h-5" />
              <span>رفض عملية الدفع</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              يرجى توضيح سبب رفض هذه العملية ليظهر لصاحب الجمعية عند تسجيل دخوله:
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              placeholder="مثال: تعذر التحقق من الوصل المرفق / المبلغ غير مطابق..."
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingPaymentId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm & Activate Modal */}
      {confirmingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {confirmingPayment.type === 'platform_support' ? 'تأكيد استلام وتوثيق دعم المنصة' : 'تأكيد عملية الدفع وتفعيل المنصة'}
                </h3>
                <p className="text-xs text-slate-500">الإدارة العامة للمنصة</p>
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 space-y-2 text-xs text-slate-700">
              <div className="flex justify-between items-center py-1 border-b border-emerald-100/60">
                <span className="text-slate-500 font-medium">
                  {confirmingPayment.type === 'platform_support' ? 'الجهة المستفيدة:' : 'اسم الجمعية:'}
                </span>
                <span className="font-bold text-slate-900">{confirmingPayment.tenantName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-emerald-100/60">
                <span className="text-slate-500 font-medium">
                  {confirmingPayment.type === 'platform_support' ? 'اسم الداعم / المساهم:' : 'المسؤول / الممثل:'}
                </span>
                <span className="font-bold text-slate-900">{confirmingPayment.ownerName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-emerald-100/60">
                <span className="text-slate-500 font-medium">
                  {confirmingPayment.type === 'platform_support' ? 'مبلغ الدعم والمساهمة:' : 'قيمة الاشتراك / التفعيل:'}
                </span>
                <span className="font-black text-emerald-800">
                  {confirmingPayment.amount.toLocaleString()} {confirmingPayment.currency} {confirmingPayment.planName ? `(${confirmingPayment.planName})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">طريقة الدفع:</span>
                <span className="font-bold text-slate-900">{(confirmingPayment as any).paymentMethodName || confirmingPayment.paymentMethod}</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 leading-relaxed space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>الإجراءات التي ستتم تلقائياً:</span>
              </div>
              {confirmingPayment.type === 'platform_support' ? (
                <ul className="list-disc list-inside space-y-1 text-slate-600 pr-1 text-[11px]">
                  <li>تأكيد استلام وتوثيق مساهمة دعم المنصة في سجل المدفوعات الدائم.</li>
                  <li>تحديث حالة طلب الدفع إلى <strong>«مؤكد»</strong> وتوثيق اسم المسؤول والتاريخ.</li>
                  <li>إدراج مبلغ الدعم ضمن إجمالي المداخيل والمساهمات المحققة للمنصة.</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-slate-600 pr-1 text-[11px]">
                  <li>تغيير حالة الجمعية في قاعدة البيانات من <strong>«في انتظار التفعيل»</strong> إلى <strong>«مفعلة»</strong> فوراً.</li>
                  <li>تحديث حالة طلب الدفع إلى <strong>«مؤكد»</strong> وتوثيق اسم المسؤول والتاريخ.</li>
                  <li>إتاحة الدخول الكامل لصاحب الجمعية للوحة تحكم منصته والبدء بالعمل.</li>
                </ul>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setConfirmingPayment(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleExecuteConfirmPayment}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessingAction ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري التفعيل...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>نعم، تأكيد وتفعيل المنصة الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Subscription Request Review & Operation Status Log Modal */}
      {reviewingPayment && (() => {
        const targetTenant = tenants.find((t) => t.id === reviewingPayment.tenantId);
        const payHistory = Array.isArray(reviewingPayment.statusHistory) ? reviewingPayment.statusHistory : [];
        const tenantHistory = Array.isArray(targetTenant?.subscriptionStatusHistory)
          ? targetTenant!.subscriptionStatusHistory!
          : [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir="rtl">
            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-5 max-h-[90vh] overflow-y-auto text-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      مراجعة طلب الاشتراك والتفعيل الإداري — «{reviewingPayment.tenantName}»
                    </h3>
                    <p className="text-xs text-slate-500">
                      التحقق من الدفع • تفعيل المنصة أو رفض الطلب • سجل حالة كل عملية
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewingPayment(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Association & Payment Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div className="space-y-2">
                  <div className="font-black text-slate-800 border-b border-slate-200 pb-1">بيانات الجمعية والمسؤول</div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">اسم الجمعية:</span>
                    <span className="font-bold text-slate-900">{reviewingPayment.tenantName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">صاحب الجمعية:</span>
                    <span className="font-bold text-slate-900">{reviewingPayment.ownerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">رقم الهاتف:</span>
                    <span className="font-mono font-bold text-slate-900" dir="ltr">{reviewingPayment.ownerPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">الدولة والمدينة:</span>
                    <span className="font-bold text-slate-900">
                      {targetTenant?.country || reviewingPayment.country} {targetTenant?.city ? `• ${targetTenant.city}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">حالة المنصة الحالية:</span>
                    {getTenantPlatformStatusBadge(reviewingPayment.tenantId)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-black text-slate-800 border-b border-slate-200 pb-1">بيانات الدفع والاشتراك</div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">المبلغ المسدد:</span>
                    <span className="font-mono font-black text-indigo-900 text-sm">
                      {reviewingPayment.amount} {reviewingPayment.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">طريقة الدفع:</span>
                    {getMethodBadge(reviewingPayment.paymentMethod)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">رقم المرجع:</span>
                    <span className="font-mono font-bold text-slate-800">{reviewingPayment.transactionReference || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">حالة التحقق من الدفع:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      reviewingPayment.paymentVerified || reviewingPayment.status === 'verified' || reviewingPayment.status === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {reviewingPayment.paymentVerified || reviewingPayment.status === 'verified' || reviewingPayment.status === 'confirmed'
                        ? '✓ تم التحقق من الدفع'
                        : '⏳ بانتظار التحقق من الدفع'}
                    </span>
                  </div>
                  {reviewingPayment.proofDocumentUrl && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setViewingProof({
                            url: reviewingPayment.proofDocumentUrl!,
                            title: `إثبات دفع جمعية «${reviewingPayment.tenantName}»`,
                            fileName: reviewingPayment.proofFileName,
                          })
                        }
                        className="w-full py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-indigo-200 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة وثيقة إثبات الدفع المرفقة</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Administrative Review Note Input & Decision Controls */}
              {(reviewingPayment.status === 'pending' || reviewingPayment.status === 'verified') && (
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-3">
                  <div className="font-black text-xs text-indigo-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>إجراءات المراجعة والتحقق من الدفع والتفعيل الإداري:</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ملاحظة التحقق الإداري (تُسجّل في سجل العمليات):
                    </label>
                    <input
                      type="text"
                      value={verificationNote}
                      onChange={(e) => setVerificationNote(e.target.value)}
                      placeholder="مثال: تم التحقق من الوصل البنكي ومطابقة مبلغ الاشتراك..."
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {reviewingPayment.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleVerifyPayment(reviewingPayment, verificationNote)}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>1. التحقق من الدفع وتوثيق الحالة</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const toConfirm = reviewingPayment;
                        setReviewingPayment(null);
                        handleOpenConfirmModal(toConfirm);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{reviewingPayment.status === 'verified' ? 'تفعيل المنصة الآن (تم التحقق مسبقاً)' : '2. تأكيد الدفع وتفعيل المنصة'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const toRejectId = reviewingPayment.id;
                        setReviewingPayment(null);
                        handleOpenReject(toRejectId);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>رفض الطلب</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Chronological Operation Log (تسجيل حالة كل عملية) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>سجل حالة العمليات ومراحل الاشتراك والتفعيل ({payHistory.length || tenantHistory.length})</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">توثيق زمني لكل عملية</span>
                </div>

                {payHistory.length === 0 && tenantHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">لا توجد عمليات مسجلة إضافية.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {(tenantHistory.length > 0 ? tenantHistory : payHistory).map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-xl border border-slate-200/90 text-xs flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            <span>{item.label}</span>
                          </div>
                          {item.note && <p className="text-[11px] text-slate-600 leading-relaxed">{item.note}</p>}
                          {item.actor && (
                            <span className="text-[10px] text-slate-400 block">بواسطة: {item.actor}</span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0" dir="ltr">
                          {new Date(item.timestamp).toLocaleString('ar-MA')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setReviewingPayment(null)}
                  className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
