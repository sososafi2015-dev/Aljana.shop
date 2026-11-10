import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  DollarSign,
  Building2,
  Phone,
  MessageCircle,
  ExternalLink,
  Edit3,
  Check,
  X,
  CreditCard,
  Eye,
  FileText,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  Download,
  Info,
  CalendarCheck,
  ChevronDown
} from 'lucide-react';
import { AssociationTenant, TenantPaymentRecord, SubscriptionTier } from '../types';
import {
  getAllTenants,
  saveAllTenants,
  updateTenantDetails
} from '../tenantStorage';
import {
  getTenantSubscriptionDetails,
  getPlatformPaymentSettings,
  getAllTenantPayments,
  saveAllTenantPayments,
  confirmPaymentAndActivateTenant,
  rejectTenantPayment,
  recordDirectSubscriptionRenewal,
  updateTenantSubscriptionDates,
  TenantSubscriptionInfo,
  getActivationFeeForCountry
} from '../paymentStorage';
import { getCountryFlag } from './CreateAssociationWizardModal';

interface PlatformSubscriptionRenewalsAdminProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onPreviewTenant?: (tenantId: string) => void;
  onTenantsUpdated?: () => void;
}

export const PlatformSubscriptionRenewalsAdmin: React.FC<PlatformSubscriptionRenewalsAdminProps> = ({
  onShowToast,
  onPreviewTenant,
  onTenantsUpdated,
}) => {
  // Load tenants and payments data
  const [tenants, setTenants] = useState<AssociationTenant[]>(getAllTenants);
  const [payments, setPayments] = useState<TenantPaymentRecord[]>(getAllTenantPayments);
  const [localVersion, setLocalVersion] = useState(0);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'expired' | 'critical' | 'warning' | 'has_pending'>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'remaining_asc' | 'remaining_desc' | 'name' | 'fee_desc'>('remaining_asc');

  // Modals state
  // 1. Direct Renewal Modal
  const [renewingItem, setRenewingItem] = useState<{ tenant: AssociationTenant; subInfo: TenantSubscriptionInfo } | null>(null);
  const [renewalYears, setRenewalYears] = useState<number>(1);
  const [renewalPaymentMethod, setRenewalPaymentMethod] = useState<string>('bank_transfer');
  const [renewalRef, setRenewalRef] = useState<string>('');
  const [renewalAmount, setRenewalAmount] = useState<number>(199);
  const [renewalNotes, setRenewalNotes] = useState<string>('');
  const [isCustomDateRenewal, setIsCustomDateRenewal] = useState(false);
  const [customRenewalEndDate, setCustomRenewalEndDate] = useState<string>('');
  const [isProcessingRenewal, setIsProcessingRenewal] = useState(false);

  // 2. Adjust Dates Modal
  const [adjustingItem, setAdjustingItem] = useState<{ tenant: AssociationTenant; subInfo: TenantSubscriptionInfo } | null>(null);
  const [adjustStartDate, setAdjustStartDate] = useState<string>('');
  const [adjustEndDate, setAdjustEndDate] = useState<string>('');
  const [adjustStatus, setAdjustStatus] = useState<'active' | 'inactive'>('active');

  // 3. View Payment / History Modal
  const [viewHistoryTenant, setViewHistoryTenant] = useState<AssociationTenant | null>(null);

  // 4. Pending Payment Review Modal
  const [reviewingPayment, setReviewingPayment] = useState<TenantPaymentRecord | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Refresh data handler
  const refreshAllData = () => {
    setTenants(getAllTenants());
    setPayments(getAllTenantPayments());
    setLocalVersion((v) => v + 1);
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Compute all tenant subscription statuses and filter strictly for remainingDays <= 20
  const qualifyingRenewalItems = useMemo(() => {
    const list: Array<{
      tenant: AssociationTenant;
      subInfo: TenantSubscriptionInfo;
      pendingPayment?: TenantPaymentRecord;
    }> = [];

    for (const tenant of tenants) {
      const subInfo = getTenantSubscriptionDetails(tenant);
      // Strictly filter: Only show associations whose subscription expires within 20 days or has expired (remainingDays <= 20)
      if (subInfo.remainingDays <= 20) {
        // Check if there is any pending payment request for this tenant
        const pending = payments.find((p) => p.tenantId === tenant.id && p.status === 'pending');
        list.push({
          tenant,
          subInfo,
          pendingPayment: pending,
        });
      }
    }

    return list;
  }, [tenants, payments, localVersion]);

  // Extract unique countries and cities for filters
  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    qualifyingRenewalItems.forEach(({ tenant }) => {
      if (tenant.country && tenant.country.trim()) {
        set.add(tenant.country.trim());
      }
    });
    const arr = Array.from(set);
    return arr.sort((a, b) => {
      if (a.includes('مغرب') || a.toLowerCase().includes('morocco')) return -1;
      if (b.includes('مغرب') || b.toLowerCase().includes('morocco')) return 1;
      return a.localeCompare(b, 'ar');
    });
  }, [qualifyingRenewalItems]);

  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    qualifyingRenewalItems.forEach(({ tenant }) => {
      if (selectedCountry === 'all' || tenant.country === selectedCountry) {
        if (tenant.city && tenant.city.trim()) {
          set.add(tenant.city.trim());
        }
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [qualifyingRenewalItems, selectedCountry]);

  // Filtered and Sorted Items
  const filteredRenewalItems = useMemo(() => {
    return qualifyingRenewalItems.filter(({ tenant, subInfo, pendingPayment }) => {
      // Country Filter
      if (selectedCountry !== 'all' && tenant.country !== selectedCountry) {
        return false;
      }

      // City Filter
      if (selectedCity !== 'all' && tenant.city !== selectedCity) {
        return false;
      }

      // Urgency Filter
      if (urgencyFilter === 'expired') {
        if (subInfo.remainingDays > 0) return false;
      } else if (urgencyFilter === 'critical') {
        if (subInfo.remainingDays <= 0 || subInfo.remainingDays > 7) return false;
      } else if (urgencyFilter === 'warning') {
        if (subInfo.remainingDays <= 7 || subInfo.remainingDays > 20) return false;
      } else if (urgencyFilter === 'has_pending') {
        if (!pendingPayment) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (tenant.name || '').toLowerCase().includes(q);
        const matchCity = (tenant.city || '').toLowerCase().includes(q);
        const matchCountry = (tenant.country || '').toLowerCase().includes(q);
        const matchOwner = (tenant.ownerName || '').toLowerCase().includes(q);
        const matchPhone = (tenant.ownerPhone || '').toLowerCase().includes(q);
        const matchSlug = (tenant.slug || '').toLowerCase().includes(q);
        if (!matchName && !matchCity && !matchCountry && !matchOwner && !matchPhone && !matchSlug) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'remaining_asc') {
        return a.subInfo.remainingDays - b.subInfo.remainingDays;
      }
      if (sortBy === 'remaining_desc') {
        return b.subInfo.remainingDays - a.subInfo.remainingDays;
      }
      if (sortBy === 'name') {
        return a.tenant.name.localeCompare(b.tenant.name, 'ar');
      }
      if (sortBy === 'fee_desc') {
        return b.subInfo.annualFee - a.subInfo.annualFee;
      }
      return 0;
    });
  }, [qualifyingRenewalItems, selectedCountry, selectedCity, urgencyFilter, searchQuery, sortBy]);

  // Overall Statistics for Renewal Dashboard
  const stats = useMemo(() => {
    const totalDue = qualifyingRenewalItems.length;
    const expiredCount = qualifyingRenewalItems.filter((i) => i.subInfo.remainingDays <= 0).length;
    const criticalCount = qualifyingRenewalItems.filter((i) => i.subInfo.remainingDays > 0 && i.subInfo.remainingDays <= 7).length;
    const warningCount = qualifyingRenewalItems.filter((i) => i.subInfo.remainingDays > 7 && i.subInfo.remainingDays <= 20).length;
    const pendingCount = qualifyingRenewalItems.filter((i) => !!i.pendingPayment).length;

    const totalExpectedMad = qualifyingRenewalItems
      .filter((i) => i.subInfo.currency === 'MAD')
      .reduce((acc, i) => acc + (i.subInfo.annualFee || 199), 0);

    const totalExpectedUsd = qualifyingRenewalItems
      .filter((i) => i.subInfo.currency === 'USD')
      .reduce((acc, i) => acc + (i.subInfo.annualFee || 49), 0);

    return {
      totalDue,
      expiredCount,
      criticalCount,
      warningCount,
      pendingCount,
      totalExpectedMad,
      totalExpectedUsd,
    };
  }, [qualifyingRenewalItems]);

  // Date Formatter helper
  const formatDateDisplay = (isoDate?: string) => {
    if (!isoDate) return '—';
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('ar-MA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    } catch {
      return isoDate.split('T')[0] || '—';
    }
  };

  // Open Direct Renewal Modal
  const handleOpenRenewModal = (item: { tenant: AssociationTenant; subInfo: TenantSubscriptionInfo }) => {
    setRenewingItem(item);
    setRenewalYears(1);
    setRenewalPaymentMethod('bank_transfer');
    setRenewalRef(`RENEW-${Date.now().toString().slice(-6)}`);
    setRenewalAmount(item.subInfo.annualFee || 199);
    setRenewalNotes(`تجديد اشتراك سنوي للمنصة - ${item.tenant.name}`);
    setIsCustomDateRenewal(false);

    // Precalculate default 1-year future date from now or expiry
    const nowTime = Date.now();
    const currExpTime = item.tenant.subscriptionExpiresAt ? new Date(item.tenant.subscriptionExpiresAt).getTime() : 0;
    const baseDate = currExpTime > nowTime ? new Date(currExpTime) : new Date(nowTime);
    baseDate.setFullYear(baseDate.getFullYear() + 1);
    setCustomRenewalEndDate(baseDate.toISOString().split('T')[0]);
  };

  // Save Direct Renewal
  const handleExecuteRenewal = () => {
    if (!renewingItem) return;
    setIsProcessingRenewal(true);

    try {
      let customEndDateIso: string | undefined = undefined;
      if (isCustomDateRenewal && customRenewalEndDate) {
        customEndDateIso = new Date(customRenewalEndDate).toISOString();
      }

      const result = recordDirectSubscriptionRenewal(renewingItem.tenant.id, {
        years: isCustomDateRenewal ? 1 : renewalYears,
        customEndDate: customEndDateIso,
        paymentMethod: renewalPaymentMethod,
        transactionReference: renewalRef,
        amount: Number(renewalAmount),
        currency: (renewingItem.subInfo.currency === 'USD' ? 'USD' : 'MAD'),
        notes: renewalNotes,
        adminName: 'الإدارة العامة للمنصة',
      });

      if (result.success) {
        onShowToast(
          `تم تسجيل تجديد اشتراك «${renewingItem.tenant.name}» بنجاح وتحديث الصلاحية إلى ${formatDateDisplay(result.periodEnd)}. الجمعية الآن سارية واختفت تلقائياً من قائمة التجديد. ✅`,
          'success'
        );
        setRenewingItem(null);
        refreshAllData();
        if (onTenantsUpdated) onTenantsUpdated();
      } else {
        onShowToast(result.error || 'تعذر تسجيل التجديد.', 'error');
      }
    } catch (err: any) {
      console.error('Renewal error:', err);
      onShowToast(err?.message || 'حدث خطأ أثناء تجديد الاشتراك.', 'error');
    } finally {
      setIsProcessingRenewal(false);
    }
  };

  // Open Adjust Dates Modal
  const handleOpenAdjustDates = (item: { tenant: AssociationTenant; subInfo: TenantSubscriptionInfo }) => {
    setAdjustingItem(item);
    setAdjustStartDate(item.subInfo.subscriptionStartDate ? item.subInfo.subscriptionStartDate.split('T')[0] : '');
    setAdjustEndDate(item.subInfo.subscriptionEndDate ? item.subInfo.subscriptionEndDate.split('T')[0] : '');
    setAdjustStatus(item.tenant.status === 'inactive' ? 'inactive' : 'active');
  };

  // Save Adjusted Dates
  const handleExecuteAdjustDates = () => {
    if (!adjustingItem || !adjustStartDate || !adjustEndDate) {
      onShowToast('يرجى تحديد تاريخ البداية وتاريخ النهاية.', 'error');
      return;
    }

    try {
      const startIso = new Date(adjustStartDate).toISOString();
      const endIso = new Date(adjustEndDate).toISOString();

      const result = updateTenantSubscriptionDates(adjustingItem.tenant.id, startIso, endIso, {
        status: adjustStatus,
        adminName: 'الإدارة العامة للمنصة',
      });

      if (result.success) {
        onShowToast(
          `تم تحديث تواريخ اشتراك «${adjustingItem.tenant.name}» بنجاح في قاعدة البيانات.`,
          'success'
        );
        setAdjustingItem(null);
        refreshAllData();
        if (onTenantsUpdated) onTenantsUpdated();
      } else {
        onShowToast(result.error || 'تعذر تحديث التواريخ.', 'error');
      }
    } catch (err: any) {
      console.error('Date adjustment error:', err);
      onShowToast(err?.message || 'حدث خطأ أثناء تعديل التواريخ.', 'error');
    }
  };

  // Confirm Pending Payment
  const handleConfirmPendingPayment = (payment: TenantPaymentRecord) => {
    if (!window.confirm(`هل أنت متأكد من تأكيد دفع رسوم التجديد للجمعية «${payment.tenantName}» بمبلغ ${payment.amount} ${payment.currency === 'MAD' ? 'درهم' : '$'} وتحديث الصلاحية تلقائياً؟`)) {
      return;
    }

    const result = confirmPaymentAndActivateTenant(payment.id, 'الإدارة العامة للمنصة');
    if (result.success) {
      onShowToast(`تم اعتماد طلب التجديد للجمعية «${payment.tenantName}» وتمديد الصلاحية بنجاح! ✅`, 'success');
      setReviewingPayment(null);
      refreshAllData();
      if (onTenantsUpdated) onTenantsUpdated();
    } else {
      onShowToast(result.error || 'تعذر اعتماد طلب الدفع.', 'error');
    }
  };

  // Reject Pending Payment
  const handleRejectPendingPayment = (payment: TenantPaymentRecord) => {
    if (!rejectReason.trim()) {
      onShowToast('يرجى كتابة سبب رفض الطلب لمساعدة الجمعية.', 'error');
      return;
    }

    const result = rejectTenantPayment(payment.id, 'الإدارة العامة للمنصة', rejectReason.trim());
    if (result.success) {
      onShowToast(`تم رفض طلب التجديد وتسجيل سبب الرفض بنجاح.`, 'info');
      setReviewingPayment(null);
      setIsRejecting(false);
      setRejectReason('');
      refreshAllData();
    } else {
      onShowToast(result.error || 'تعذر رفض الطلب.', 'error');
    }
  };

  // WhatsApp Reminder Generator
  const generateWhatsAppReminderUrl = (tenant: AssociationTenant, subInfo: TenantSubscriptionInfo) => {
    if (!tenant.ownerPhone) return '#';
    let cleanPhone = tenant.ownerPhone.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '212' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.substring(1);
    }

    const settings = getPlatformPaymentSettings();
    const isExpired = subInfo.remainingDays <= 0;
    const daysText = isExpired
      ? `منتهي الصلاحية منذ ${Math.abs(subInfo.remainingDays)} يوم`
      : `قريب من الانتهاء (متبقي ${subInfo.remainingDays} يوم)`;

    const msg = `السلام عليكم ورحمة الله وبركاته،
تحية طيبة السيد(ة) / ${tenant.ownerName || 'المسؤول الإداري'}،
بخصوص اشتراك منصة جمعيتكم «${tenant.name}» في syoumax منصة العمل الجمعوي:

نحيطكم علماً بأن الاشتراك السنوي للمنصة: *${daysText}*.
- تاريخ انتهاء الصلاحية: ${formatDateDisplay(subInfo.subscriptionEndDate)}
- رسوم التجديد السنوي: ${subInfo.annualFee} ${subInfo.currency === 'MAD' ? 'درهم مغربي' : 'دولار'}

يرجى تسوية رسوم التجديد السنوي لضمان استمرارية تشغيل خدمات الجمعية الإلكترونية وحفظ كافة السجلات.

معلومات الحساب البنكي للتجديد:
- اسم الحساب: ${settings.bankAccount?.accountHolder || 'المنصة الذكية'}
- البنك: ${settings.bankAccount?.bankName || 'التجاري وفا بنك'}
- رقم الحساب (RIB): ${settings.bankAccount?.rib || '007 780 0001234567890123 45'}

بعد التحويل، يرجى رفع إشعار الدفع من داخل لوحة تحكم الجمعية أو مراسلتنا هنا مباشرة.
مع تحيات الإدارة العامة للمنصة.`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800" dir="rtl" id="platform-subscription-renewals-section">
      {/* ================= HERO & TITLE BANNER ================= */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/60">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                <Calendar className="w-3.5 h-3.5" />
                <span>نافذة التجديد (خلال 20 يوماً أو منتهية)</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-slate-200">
                <Clock className="w-3 h-3" />
                تحديث ديناميكي تلقائي حسب التاريخ الفعلي
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5">
              <span>إدارة تجديد الاشتراك السنوي للمنصات</span>
            </h1>

            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              يعرض هذا القسم حصراً الجمعيات التي اقترب موعد انتهاء اشتراكها السنوي (خلال 20 يوماً فأقل) أو المنتهية اشتراكاتها بالفعل. عند تسجيل تجديد الاشتراك وتمديد الصلاحية لأكثر من 20 يوماً، تختفي الجمعية تلقائياً من هذه القائمة.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              onClick={refreshAllData}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer backdrop-blur-sm"
              title="تحديث البيانات فوراً"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تحديث الحالة</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= TOP METRICS STATS CARDS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Total Due */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-slate-700">المطالبون بالتجديد</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalDue}</div>
          <div className="text-[11px] text-slate-400 mt-1">جمعيات ضمن نافذة الـ 20 يوماً</div>
        </div>

        {/* Metric 2: Expired Subscriptions */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-xs bg-rose-50/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold">منتهية الصلاحية 🔴</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-700">{stats.expiredCount}</div>
          <div className="text-[11px] text-rose-600/80 mt-1">تحتاج تجديداً عاجلاً</div>
        </div>

        {/* Metric 3: Critical Expiring (1-7 Days) */}
        <div className="bg-white p-4 rounded-2xl border border-orange-200/80 shadow-xs bg-orange-50/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-orange-600 mb-2">
            <span className="text-xs font-bold">تنتهي خلال أسبوع 🟠</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-orange-700">{stats.criticalCount}</div>
          <div className="text-[11px] text-orange-600/80 mt-1">متبقي 1 إلى 7 أيام</div>
        </div>

        {/* Metric 4: Warning (8-20 Days) */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs bg-amber-50/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold">تنتهي خلال 8-20 يوم 🟡</span>
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-700">{stats.warningCount}</div>
          <div className="text-[11px] text-amber-600/80 mt-1">فترة التنبيه المسبق</div>
        </div>

        {/* Metric 5: Expected Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs bg-emerald-50/20 col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold">عائد التجديد المتوقع</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-800">
            {stats.totalExpectedMad.toLocaleString()} <span className="text-xs font-bold">د.م</span>
            {stats.totalExpectedUsd > 0 && (
              <span className="text-xs font-bold text-slate-500 block">+ ${stats.totalExpectedUsd}</span>
            )}
          </div>
          <div className="text-[11px] text-emerald-600/80 mt-1">عند تجديد كافة المنصات</div>
        </div>
      </div>

      {/* ================= FILTERS & SEARCH TOOLBAR ================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم الجمعية، المدينة، الدولة، اسم المسؤول، أو الهاتف..."
              className="w-full pl-4 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none transition-all"
            />
          </div>

          {/* Quick Urgency Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value as any)}
              className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-bold"
            >
              <option value="all">كل المطالبين بالتجديد ({qualifyingRenewalItems.length})</option>
              <option value="expired">🔴 منتهية الصلاحية فقط ({stats.expiredCount})</option>
              <option value="critical">🟠 حرجة (1 إلى 7 أيام) ({stats.criticalCount})</option>
              <option value="warning">🟡 قريبة (8 إلى 20 يوماً) ({stats.warningCount})</option>
              {stats.pendingCount > 0 && (
                <option value="has_pending">⏳ توجد طلبات دفع معلقة ({stats.pendingCount})</option>
              )}
            </select>

            {/* Country Selector */}
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setSelectedCity('all');
              }}
              className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-medium"
            >
              <option value="all">كل الدول ({uniqueCountries.length})</option>
              {uniqueCountries.map((c) => (
                <option key={c} value={c}>
                  {getCountryFlag(c)} {c}
                </option>
              ))}
            </select>

            {/* City Selector */}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-medium"
            >
              <option value="all">كل المدن</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>

            {/* Sort Order */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-medium"
            >
              <option value="remaining_asc">الأقرب للانتهاء (الأكثر استحقاقاً)</option>
              <option value="remaining_desc">الأطول مدة متبقية</option>
              <option value="name">أبجدياً حسب اسم الجمعية</option>
              <option value="fee_desc">الأعلى رسوماً</option>
            </select>

            <button
              onClick={() => {
                setSearchQuery('');
                setUrgencyFilter('all');
                setSelectedCountry('all');
                setSelectedCity('all');
                setSortBy('remaining_asc');
              }}
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
              title="إعادة ضبط الفلاتر"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            الجمعيات المطابقة: <strong className="text-slate-900">{filteredRenewalItems.length}</strong> من أصل {qualifyingRenewalItems.length} جمعية مستحقة
          </span>
          <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full font-bold">
            ⚡ تختفي الجمعية تلقائياً بمجرد تسجيل التجديد وتحديث تاريخ الصلاحية لأكثر من 20 يوماً
          </span>
        </div>
      </div>

      {/* ================= MAIN ASSOCIATIONS RENEWAL TABLE ================= */}
      {filteredRenewalItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-black text-slate-900">
              {qualifyingRenewalItems.length === 0
                ? 'لا توجد حالياً أي جمعيات متأخرة أو قريبة من انتهاء الاشتراك 🎉'
                : 'لا توجد نتائج مطابقة لخيارات البحث والفلترة المحددة'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {qualifyingRenewalItems.length === 0
                ? 'جميع الجمعيات المسجلة في المنصة اشتراكاتها سارية لأكثر من 20 يوماً. ستظهر أي جمعية تلقائياً في هذا القسم عند وصولها إلى 20 يوماً قبل تاريخ انتهاء اشتراكها.'
                : 'جرب إعادة ضبط الفلاتر أو تغيير كلمة البحث لعرض الجمعيات الأخرى المستحقة للتجديد.'}
            </p>
          </div>
          {qualifyingRenewalItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setUrgencyFilter('all');
                setSelectedCountry('all');
                setSelectedCity('all');
              }}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              عرض جميع الجمعيات المستحقة ({qualifyingRenewalItems.length})
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <tr>
                  <th className="py-3.5 px-4">الجمعية والمقر</th>
                  <th className="py-3.5 px-4">المسؤول والتواصل</th>
                  <th className="py-3.5 px-4">فترة الاشتراك الحالية</th>
                  <th className="py-3.5 px-4 text-center">الوضع والمدة المتبقية</th>
                  <th className="py-3.5 px-4 text-center">رسوم التجديد</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات والعمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRenewalItems.map(({ tenant, subInfo, pendingPayment }) => {
                  const isExpired = subInfo.remainingDays <= 0;
                  const isCritical = subInfo.remainingDays > 0 && subInfo.remainingDays <= 7;
                  const isWarning = subInfo.remainingDays > 7 && subInfo.remainingDays <= 20;

                  return (
                    <tr
                      key={tenant.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isExpired
                          ? 'bg-rose-50/30'
                          : isCritical
                          ? 'bg-orange-50/20'
                          : ''
                      }`}
                    >
                      {/* Column 1: Association Info */}
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                            {tenant.logoUrl ? (
                              <img src={tenant.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
                            ) : (
                              <Building2 className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                              <span>{tenant.name}</span>
                              {tenant.isTemplate && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-700">
                                  القالب الأساسي
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <span>{getCountryFlag(tenant.country)}</span>
                              <span>{tenant.city}، {tenant.country}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              ID: {tenant.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Owner & Phone */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <span>{tenant.ownerName || 'المسؤول الإداري'}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5" dir="ltr">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{tenant.ownerPhone || '—'}</span>
                          </div>
                          {tenant.ownerPhone && (
                            <a
                              href={generateWhatsAppReminderUrl(tenant, subInfo)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold transition-colors"
                              title="إرسال رسالة تذكير بالتجديد عبر واتساب"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>تذكير بالواتساب</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Column 3: Subscription Timeline */}
                      <td className="py-4 px-4">
                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400">البداية:</span>
                            <span className="font-semibold text-slate-700">{formatDateDisplay(subInfo.subscriptionStartDate)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400 font-bold">النهاية:</span>
                            <span className={`font-black ${isExpired ? 'text-rose-700' : 'text-amber-800'}`}>
                              {formatDateDisplay(subInfo.subscriptionEndDate)}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                            <div
                              className={`h-full transition-all ${
                                isExpired
                                  ? 'bg-rose-500'
                                  : isCritical
                                  ? 'bg-orange-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, subInfo.consumedPercent)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Column 4: Remaining Days & Status */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>منتهي منذ {Math.abs(subInfo.remainingDays)} يوم</span>
                            </span>
                          ) : isCritical ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-orange-100 text-orange-800 border border-orange-200">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>متبقي {subInfo.remainingDays} أيام فقط!</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3.5 h-3.5" />
                              <span>متبقي {subInfo.remainingDays} يوماً</span>
                            </span>
                          )}

                          {pendingPayment && (
                            <button
                              type="button"
                              onClick={() => setReviewingPayment(pendingPayment)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[10px] font-bold border border-indigo-200 cursor-pointer"
                              title="انقر لمراجعة وصل التحويل وتأكيد التجديد"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>طلب تجديد بانتظار الاعتماد</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Renewal Fee */}
                      <td className="py-4 px-4 text-center">
                        <div className="font-black text-slate-900 text-xs">
                          {subInfo.annualFee} {subInfo.currency === 'MAD' ? 'د.م' : '$'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          باقة {tenant.tier?.toUpperCase() || 'BASIC'}
                        </div>
                      </td>

                      {/* Column 6: Action Buttons */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* 1. Primary Action: Direct Renewal */}
                          <button
                            type="button"
                            onClick={() => handleOpenRenewModal({ tenant, subInfo })}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            title="تسجيل تجديد الاشتراك السنوي وتحديث الصلاحية"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>تجديد الاشتراك</span>
                          </button>

                          {/* 2. Adjust Dates */}
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustDates({ tenant, subInfo })}
                            className="p-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-xl transition-colors cursor-pointer"
                            title="تعديل تواريخ الصلاحية يدوياً"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* 3. View Payment History */}
                          <button
                            type="button"
                            onClick={() => setViewHistoryTenant(tenant)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                            title="عرض سجل المدفوعات والاشتراكات"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* 4. Switch to tenant */}
                          {onPreviewTenant && (
                            <button
                              type="button"
                              onClick={() => onPreviewTenant(tenant.id)}
                              className="p-1.5 text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
                              title="دخول منصة الجمعية"
                            >
                              <ExternalLink className="w-4 h-4" />
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

      {/* ================= MODAL 1: DIRECT RENEWAL MODAL ================= */}
      {renewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scale-in max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تسجيل تجديد الاشتراك السنوي</h3>
                  <p className="text-xs text-slate-500">جمعية «{renewingItem.tenant.name}»</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRenewingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-4">
              {/* Current Expiry Alert */}
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>تاريخ نهاية الاشتراك الحالي:</span>
                  <span>{formatDateDisplay(renewingItem.subInfo.subscriptionEndDate)}</span>
                </div>
                <div className="text-[11px] text-amber-700">
                  {renewingItem.subInfo.remainingDays <= 0
                    ? `⚠️ الاشتراك منتهي منذ ${Math.abs(renewingItem.subInfo.remainingDays)} يوم. سيبدأ الاشتراك الجديد اعتباراً من اليوم.`
                    : `💡 سيتم تمديد الاشتراك السنوي مباشرة ابتداءً من تاريخ الانتهاء الحالي.`}
                </div>
              </div>

              {/* Renewal Duration Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  مدة التجديد:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDateRenewal(false);
                      setRenewalYears(1);
                      setRenewalAmount((renewingItem.subInfo.annualFee || 199) * 1);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      !isCustomDateRenewal && renewalYears === 1
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    سنة واحدة (+1)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDateRenewal(false);
                      setRenewalYears(2);
                      setRenewalAmount((renewingItem.subInfo.annualFee || 199) * 2);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      !isCustomDateRenewal && renewalYears === 2
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    سنتان (+2)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDateRenewal(true);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isCustomDateRenewal
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    تاريخ مخصص
                  </button>
                </div>
              </div>

              {/* Custom Date Input if custom */}
              {isCustomDateRenewal && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تاريخ نهاية الصلاحية الجديد:
                  </label>
                  <input
                    type="date"
                    required
                    value={customRenewalEndDate}
                    onChange={(e) => setCustomRenewalEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              )}

              {/* Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    طريقة أداء الرسوم:
                  </label>
                  <select
                    value={renewalPaymentMethod}
                    onChange={(e) => setRenewalPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="bank_transfer">تحويل بنكي (RIB)</option>
                    <option value="cash_plus">كاش بليس (Cash Plus)</option>
                    <option value="credit_card">بطاقة بنكية (CMI / Visa)</option>
                    <option value="direct_cash">أداء نقدي مباشر / إداري</option>
                    <option value="free_extension">تمديد إداري استثنائي (مجاني)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المبلغ المحصّل ({renewingItem.subInfo.currency === 'MAD' ? 'درهم' : '$'}):
                  </label>
                  <input
                    type="number"
                    value={renewalAmount}
                    onChange={(e) => setRenewalAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم المعاملة أو الوصل (Reference):
                </label>
                <input
                  type="text"
                  value={renewalRef}
                  onChange={(e) => setRenewalRef(e.target.value)}
                  placeholder="مثال: RIB-882319 أو CP-5521"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات إدارية:
                </label>
                <textarea
                  rows={2}
                  value={renewalNotes}
                  onChange={(e) => setRenewalNotes(e.target.value)}
                  placeholder="ملاحظات حول عملية التجديد..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenewingItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteRenewal}
                disabled={isProcessingRenewal}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isProcessingRenewal ? 'جاري الحفظ...' : 'تأكيد التجديد وتحديث الصلاحية'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: ADJUST SUBSCRIPTION DATES MODAL ================= */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تعديل تواريخ الصلاحية يدوياً</h3>
                  <p className="text-xs text-slate-500">«{adjustingItem.tenant.name}»</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تاريخ بداية الاشتراك (Start Date):
                </label>
                <input
                  type="date"
                  required
                  value={adjustStartDate}
                  onChange={(e) => setAdjustStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تاريخ انتهاء الاشتراك (Expiration Date):
                </label>
                <input
                  type="date"
                  required
                  value={adjustEndDate}
                  onChange={(e) => setAdjustEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  حالة المنصة:
                </label>
                <select
                  value={adjustStatus}
                  onChange={(e) => setAdjustStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium"
                >
                  <option value="active">🟢 مفعلة ونشطة (Active)</option>
                  <option value="inactive">🔴 معطلة مؤقتاً (Inactive)</option>
                </select>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-800">
                ℹ️ إذا كان تاريخ الانتهاء الجديد يبعد أكثر من 20 يوماً عن التاريخ الحالي، فستختفي الجمعية تلقائياً من هذا القسم.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteAdjustDates}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
              >
                حفظ التواريخ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: PENDING PAYMENT REVIEW MODAL ================= */}
      {reviewingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scale-in max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">مراجعة طلب دفع رسوم التجديد</h3>
                  <p className="text-xs text-slate-500">«{reviewingPayment.tenantName}»</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReviewingPayment(null);
                  setIsRejecting(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3.5">
              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">المبلغ المصرح:</span>
                  <strong className="text-slate-900 font-mono text-sm">{reviewingPayment.amount} {reviewingPayment.currency === 'MAD' ? 'د.م' : '$'}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">طريقة الدفع:</span>
                  <strong className="text-slate-900">{reviewingPayment.paymentMethod}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">رقم المعاملة:</span>
                  <strong className="text-slate-900 font-mono">{reviewingPayment.transactionReference || '—'}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">تاريخ الإرسال:</span>
                  <strong className="text-slate-900">{formatDateDisplay(reviewingPayment.submittedAt)}</strong>
                </div>
              </div>

              {/* Receipt / Proof Image */}
              {reviewingPayment.proofDocumentUrl ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 block">إشعار أو وصل التحويل المرفق:</span>
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 max-h-60 flex items-center justify-center p-1">
                    <img
                      src={reviewingPayment.proofDocumentUrl}
                      alt="Receipt Proof"
                      className="max-h-56 max-w-full object-contain rounded-xl"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                  لم يتم إرفاق صورة لوصل التحويل مع هذا الطلب.
                </div>
              )}

              {/* Reject Reason input if rejecting */}
              {isRejecting && (
                <div className="space-y-1.5 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <label className="block text-xs font-bold text-rose-800">سبب رفض طلب الدفع:</label>
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="اكتب سبب الرفض لمساعدة الجمعية..."
                    className="w-full px-3 py-2 text-xs bg-white border border-rose-300 rounded-lg outline-none focus:border-rose-500"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              {!isRejecting ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsRejecting(true)}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    رفض الطلب
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewingPayment(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      إغلاق
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmPendingPayment(reviewingPayment)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>اعتماد وتجديد الاشتراك</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-end gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setIsRejecting(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectPendingPayment(reviewingPayment)}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                  >
                    تأكيد الرفض
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: TENANT PAYMENT HISTORY MODAL ================= */}
      {viewHistoryTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 animate-scale-in max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">سجل اشتراكات ومدفوعات الجمعية</h3>
                  <p className="text-xs text-slate-500">«{viewHistoryTenant.name}»</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewHistoryTenant(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3">
              {(() => {
                const tenantPayments = payments.filter((p) => p.tenantId === viewHistoryTenant.id);
                if (tenantPayments.length === 0) {
                  return (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                      لا توجد عمليات دفع مسجلة لهذه الجمعية بعد.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {tenantPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-black text-slate-900 flex items-center gap-2">
                            <span>{p.type === 'activation' ? 'تفعيل أولي للمنصة' : 'تجديد اشتراك سنوي'}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === 'confirmed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {p.status === 'confirmed' ? 'معتمد ✓' : p.status === 'rejected' ? 'مرفوض ✗' : 'قيد المراجعة ⏳'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            <span>المبلغ: <strong>{p.amount} {p.currency === 'MAD' ? 'د.م' : '$'}</strong></span> • 
                            <span> التاريخ: {formatDateDisplay(p.submittedAt)}</span>
                          </div>
                          {p.periodEnd && (
                            <div className="text-[10px] text-emerald-700 mt-0.5">
                              فترة الصلاحية المغطاة: {formatDateDisplay(p.periodStart)} إلى {formatDateDisplay(p.periodEnd)}
                            </div>
                          )}
                        </div>

                        {p.proofDocumentUrl && (
                          <a
                            href={p.proofDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold transition-colors shrink-0"
                          >
                            معاينة الوصل
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewHistoryTenant(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
