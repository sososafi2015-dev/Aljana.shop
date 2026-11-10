import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  ShieldCheck,
  Building2,
  Calendar,
  CreditCard,
  Receipt,
  Download,
  ExternalLink,
  ChevronDown,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  Phone,
  User,
  MapPin,
  HelpCircle,
  Sliders,
  Send,
  Plus,
  RefreshCw,
  AlertTriangle,
  X,
  Check,
  MessageSquare,
  Lock
} from 'lucide-react';
import {
  AdCampaignRequest,
  AdCampaignRequestStatus,
  AdCampaignPaymentStatus,
  PaymentMethod,
  AssociationTenant,
  PlatformAdCampaign,
} from '../types';
import {
  getAllAdCampaignRequests,
  getAdCampaignRequestById,
  createOrUpdateAdCampaignRequest,
  reviewAdCampaignRequest,
  deleteAdCampaignRequest,
  fetchAdCampaignRequestsFromServer,
  AD_CAMPAIGN_REQUESTS_EVENT,
  getAllAdCampaigns,
} from '../adCampaignStorage';
import { getAllTenants } from '../tenantStorage';

interface CampaignLaunchRequestsAdminProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onPreviewTenant?: (tenantId: string) => void;
  onCampaignActivated?: (campaign: PlatformAdCampaign) => void;
  canApprove?: boolean;
}

// Status labels and styling
export const REQUEST_STATUS_CONFIG: Record<
  AdCampaignRequestStatus,
  { label: string; bg: string; text: string; border: string; icon: any; dotColor: string }
> = {
  pending_payment: {
    label: 'في انتظار الدفع',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: Clock,
    dotColor: 'bg-amber-500',
  },
  paid_pending_review: {
    label: 'تم الدفع – في انتظار المراجعة',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: AlertCircle,
    dotColor: 'bg-blue-500',
  },
  under_review: {
    label: 'قيد المراجعة',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    icon: Sliders,
    dotColor: 'bg-purple-500',
  },
  approved: {
    label: 'تمت الموافقة',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: CheckCircle2,
    dotColor: 'bg-emerald-500',
  },
  rejected: {
    label: 'مرفوض',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    icon: XCircle,
    dotColor: 'bg-rose-500',
  },
  correction_requested: {
    label: 'طلب تصحيح/استكمال',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
    icon: AlertTriangle,
    dotColor: 'bg-orange-500',
  },
  cancelled: {
    label: 'ملغى',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: XCircle,
    dotColor: 'bg-slate-400',
  },
};

export const PAYMENT_STATUS_CONFIG: Record<
  AdCampaignPaymentStatus,
  { label: string; bg: string; text: string }
> = {
  unpaid: { label: 'لم يتم الدفع', bg: 'bg-slate-100', text: 'text-slate-600' },
  pending_verification: { label: 'في انتظار التحقق', bg: 'bg-amber-100', text: 'text-amber-800' },
  confirmed: { label: 'مدفوع ومؤكد', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  refunded: { label: 'مسترجع', bg: 'bg-purple-100', text: 'text-purple-800' },
  failed: { label: 'فشل الدفع', bg: 'bg-rose-100', text: 'text-rose-800' },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'تحويل بنكي / شيك',
  cash_plus: 'وكالة كاش بلوس / حوالة',
  credit_card: 'بطاقة بنكية إلكترونية',
  paypal: 'حساب PayPal',
  other: 'طريقة دفع أخرى / مخصصة',
};

function formatArabicDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('ar-MA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export const CampaignLaunchRequestsAdmin: React.FC<CampaignLaunchRequestsAdminProps> = ({
  onShowToast,
  onPreviewTenant,
  onCampaignActivated,
  canApprove = true,
}) => {
  const [requests, setRequests] = useState<AdCampaignRequest[]>(getAllAdCampaignRequests);
  const [tenants, setTenants] = useState<AssociationTenant[]>(getAllTenants);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenantFilter, setSelectedTenantFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedPaymentStatusFilter, setSelectedPaymentStatusFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_desc' | 'duration'>('newest');

  // Modals state
  const [detailsModalRequest, setDetailsModalRequest] = useState<AdCampaignRequest | null>(null);
  const [reviewModalRequest, setReviewModalRequest] = useState<AdCampaignRequest | null>(null);
  const [proofViewerUrl, setProofViewerUrl] = useState<string | null>(null);

  // Review form state inside review modal
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject' | 'correction_requested'>('approve');
  const [reviewPriorityOrder, setReviewPriorityOrder] = useState<number>(1);
  const [reviewStartDate, setReviewStartDate] = useState<string>('');
  const [reviewEndDate, setReviewEndDate] = useState<string>('');
  const [reviewRejectionReason, setReviewRejectionReason] = useState<string>('');
  const [reviewCorrectionNotes, setReviewCorrectionNotes] = useState<string>('');
  const [reviewAdminNotes, setReviewAdminNotes] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Create Manual Request Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [manualTenantId, setManualTenantId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualMonths, setManualMonths] = useState<number>(1);
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualEndDate, setManualEndDate] = useState('');
  const [manualPriority, setManualPriority] = useState<number>(1);
  const [manualAmount, setManualAmount] = useState<number>(199);
  const [manualFormError, setManualFormError] = useState<string | null>(null);

  // Sync and event listener
  useEffect(() => {
    const handleRequestsChange = (e: any) => {
      if (e?.detail?.requests) {
        setRequests(e.detail.requests);
      } else {
        setRequests(getAllAdCampaignRequests());
      }
    };

    const handleTenantsChange = () => {
      setTenants(getAllTenants());
    };

    window.addEventListener(AD_CAMPAIGN_REQUESTS_EVENT, handleRequestsChange as EventListener);
    window.addEventListener('chayef-tenants-changed', handleTenantsChange);

    // Initial server fetch
    fetchAdCampaignRequestsFromServer().then((data) => {
      if (data && data.length > 0) {
        setRequests(data);
      }
    });

    return () => {
      window.removeEventListener(AD_CAMPAIGN_REQUESTS_EVENT, handleRequestsChange as EventListener);
      window.removeEventListener('chayef-tenants-changed', handleTenantsChange);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchAdCampaignRequestsFromServer();
      setRequests(data);
      setTenants(getAllTenants());
      onShowToast('تم تحديث قائمة طلبات تدشين الحملات الإعلانية', 'success');
    } catch {
      onShowToast('تعذر تحديث البيانات من الخادم', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Metrics summary
  const stats = useMemo(() => {
    let pendingPayment = 0;
    let paidPendingReview = 0;
    let underReview = 0;
    let approved = 0;
    let rejected = 0;
    let correction = 0;
    let totalRevenue = 0;

    requests.forEach((r) => {
      if (r.status === 'pending_payment') pendingPayment++;
      else if (r.status === 'paid_pending_review') paidPendingReview++;
      else if (r.status === 'under_review') underReview++;
      else if (r.status === 'approved') {
        approved++;
        totalRevenue += r.amount || 0;
      } else if (r.status === 'rejected') rejected++;
      else if (r.status === 'correction_requested') correction++;
    });

    return {
      total: requests.length,
      pendingPayment,
      paidPendingReview,
      underReview,
      approved,
      rejected,
      correction,
      totalRevenue,
    };
  }, [requests]);

  // Filtered and sorted requests
  const filteredRequests = useMemo(() => {
    const now = Date.now();

    return requests.filter((r) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (r.tenantName || '').toLowerCase().includes(q);
        const matchTitle = (r.campaignTitle || '').toLowerCase().includes(q);
        const matchDesc = (r.campaignDescription || '').toLowerCase().includes(q);
        const matchOwner = (r.ownerName || '').toLowerCase().includes(q);
        const matchRef = (r.paymentReference || '').toLowerCase().includes(q);
        const matchCity = (r.tenantCity || '').toLowerCase().includes(q);
        if (!matchName && !matchTitle && !matchDesc && !matchOwner && !matchRef && !matchCity) return false;
      }

      // 2. Tenant Filter
      if (selectedTenantFilter !== 'all' && r.tenantId !== selectedTenantFilter) {
        return false;
      }

      // 3. Status Filter
      if (selectedStatusFilter !== 'all' && r.status !== selectedStatusFilter) {
        return false;
      }

      // 4. Payment Status Filter
      if (selectedPaymentStatusFilter !== 'all' && r.paymentStatus !== selectedPaymentStatusFilter) {
        return false;
      }

      // 5. Date Filter
      if (dateRangeFilter !== 'all') {
        const reqTime = new Date(r.createdAt).getTime();
        if (dateRangeFilter === 'today') {
          const oneDay = 24 * 60 * 60 * 1000;
          if (now - reqTime > oneDay) return false;
        } else if (dateRangeFilter === '7days') {
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          if (now - reqTime > sevenDays) return false;
        } else if (dateRangeFilter === '30days') {
          const thirtyDays = 30 * 24 * 60 * 60 * 1000;
          if (now - reqTime > thirtyDays) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'amount_desc') {
        return (b.amount || 0) - (a.amount || 0);
      }
      if (sortBy === 'duration') {
        return (b.monthsCount || 1) - (a.monthsCount || 1);
      }
      return 0;
    });
  }, [
    requests,
    searchQuery,
    selectedTenantFilter,
    selectedStatusFilter,
    selectedPaymentStatusFilter,
    dateRangeFilter,
    sortBy,
  ]);

  // Open Review Modal
  const handleOpenReviewModal = (req: AdCampaignRequest) => {
    setReviewModalRequest(req);
    setReviewDecision('approve');
    setReviewPriorityOrder(req.requestedPriorityOrder || 1);
    setReviewStartDate(req.startDate || new Date().toISOString().split('T')[0]);
    setReviewEndDate(req.endDate || '');
    setReviewRejectionReason(req.rejectionReason || '');
    setReviewCorrectionNotes(req.correctionNotes || '');
    setReviewAdminNotes(req.adminNotes || '');
    setReviewError(null);
  };

  // Submit Review Decision
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalRequest) return;

    setReviewError(null);
    setIsSubmittingReview(true);

    try {
      if (reviewDecision === 'reject' && !reviewRejectionReason.trim()) {
        setReviewError('يرجى كتابة سبب الرفض لتوضيحه للجمعية');
        setIsSubmittingReview(false);
        return;
      }

      const result = reviewAdCampaignRequest(reviewModalRequest.id, reviewDecision, {
        rejectionReason: reviewRejectionReason,
        correctionNotes: reviewCorrectionNotes,
        adminNotes: reviewAdminNotes,
        adminName: 'الإدارة العامة للمنصة',
        priorityOrder: Number(reviewPriorityOrder) || 1,
        customStartDate: reviewStartDate,
        customEndDate: reviewEndDate,
      });

      if (!result.success) {
        setReviewError(result.error || 'حدث خطأ أثناء معالجة الطلب');
        setIsSubmittingReview(false);
        return;
      }

      if (reviewDecision === 'approve') {
        onShowToast(`تمت الموافقة بنجاح وتفعيل الحملة الإعلانية للجمعية «${reviewModalRequest.tenantName}»`, 'success');
        if (result.campaign && onCampaignActivated) {
          onCampaignActivated(result.campaign);
        }
      } else if (reviewDecision === 'reject') {
        onShowToast(`تم رفض طلب الحملة وحفظ سبب الرفض بنجاح`, 'info');
      } else if (reviewDecision === 'correction_requested') {
        onShowToast(`تم إرسال طلب تصحيح واستكمال المعلومات للجمعية`, 'info');
      }

      setReviewModalRequest(null);
    } catch (err: any) {
      setReviewError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Open Manual Create Modal
  const handleOpenCreateModal = () => {
    const firstTenant = tenants[0];
    setManualTenantId(firstTenant?.id || '');
    setManualTitle('');
    setManualDescription('');
    setManualMonths(1);
    const today = new Date();
    const end = new Date(today);
    end.setMonth(end.getMonth() + 1);
    setManualStartDate(today.toISOString().split('T')[0]);
    setManualEndDate(end.toISOString().split('T')[0]);
    setManualPriority(1);
    setManualAmount(199);
    setManualFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleManualMonthsChange = (m: number) => {
    setManualMonths(m);
    setManualAmount(m * 199);
    if (manualStartDate) {
      const s = new Date(manualStartDate);
      s.setMonth(s.getMonth() + m);
      setManualEndDate(s.toISOString().split('T')[0]);
    }
  };

  const handleCreateManualRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setManualFormError(null);

    if (!manualTenantId) {
      setManualFormError('يرجى اختيار الجمعية');
      return;
    }
    if (!manualTitle.trim()) {
      setManualFormError('يرجى إدخال عنوان الحملة الإعلانية');
      return;
    }
    if (!manualStartDate || !manualEndDate) {
      setManualFormError('يرجى تحديد تواريخ بداية ونهاية الحملة');
      return;
    }

    const matchedTenant = tenants.find((t) => t.id === manualTenantId);

    createOrUpdateAdCampaignRequest({
      tenantId: manualTenantId,
      tenantName: matchedTenant?.name || 'جمعية',
      campaignTitle: manualTitle.trim(),
      campaignDescription: manualDescription.trim(),
      monthsCount: manualMonths,
      startDate: manualStartDate,
      endDate: manualEndDate,
      requestedPriorityOrder: Number(manualPriority) || 1,
      amount: manualAmount,
      currency: 'MAD',
      monthlyRate: 199,
      status: 'paid_pending_review',
      paymentStatus: 'pending_verification',
      paymentMethod: 'bank_transfer',
      paymentAmount: manualAmount,
      paymentCurrency: 'MAD',
    });

    onShowToast('تم إنشاء طلب الحملة الإعلانية بنجاح وإدراجه للمراجعة', 'success');
    setIsCreateModalOpen(false);
  };

  const handleDeleteRequest = (req: AdCampaignRequest) => {
    if (window.confirm(`هل أنت متأكد من حذف طلب الحملة الإعلانية «${req.campaignTitle}» الخاصة بـ «${req.tenantName}»؟`)) {
      deleteAdCampaignRequest(req.id);
      onShowToast('تم حذف الطلب بنجاح', 'info');
      if (detailsModalRequest?.id === req.id) {
        setDetailsModalRequest(null);
      }
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* ================= SECTION HEADER & OVERVIEW ================= */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-500/20 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                طلبات تدشين حملة جديدة
              </h3>
              {stats.paidPendingReview > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <span>{stats.paidPendingReview} طلب بانتظار المراجعة</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              إدارة ومراجعة جميع طلبات تدشين الحملات الإعلانية المقدمة من الجمعيات، وفحص بيانات الدفع والوصولات، واعتماد الحملات لتفعيل ظهورها الفوري في الصفحة الأولى.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-200 flex items-center justify-center cursor-pointer disabled:opacity-50"
            title="تحديث قائمة الطلبات"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <button
            id="btn-create-manual-ad-request"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 flex-1 md:flex-initial"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>تسجيل طلب تدشين يدوي</span>
          </button>
        </div>
      </div>

      {/* ================= STATS SUMMARY CARDS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Requests */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 mb-1 flex items-center justify-between">
            <span>إجمالي الطلبات</span>
            <FileText className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">طلب مسجل</div>
        </div>

        {/* Paid - Pending Review */}
        <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-blue-700 mb-1 flex items-center justify-between">
            <span>تم الدفع وبانتظار المراجعة</span>
            <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-800">{stats.paidPendingReview}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">تحتاج قرار الإدارة</div>
        </div>

        {/* Pending Payment */}
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-amber-700 mb-1 flex items-center justify-between">
            <span>في انتظار الدفع</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-800">{stats.pendingPayment}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">لم تسدد بعد</div>
        </div>

        {/* Approved */}
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center justify-between">
            <span>تمت الموافقة</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-800">{stats.approved}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">حملات مفعلة</div>
        </div>

        {/* Correction Requested */}
        <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-orange-700 mb-1 flex items-center justify-between">
            <span>طلب تصحيح</span>
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
          </div>
          <div className="text-xl font-black text-orange-800">{stats.correction}</div>
          <div className="text-[10px] text-orange-600 mt-0.5">بانتظار رد الجمعية</div>
        </div>

        {/* Rejected */}
        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-rose-700 mb-1 flex items-center justify-between">
            <span>مرفوضة</span>
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-black text-rose-800">{stats.rejected}</div>
          <div className="text-[10px] text-rose-600 mt-0.5">مع توضيح السبب</div>
        </div>
      </div>

      {/* ================= SEARCH & ADVANCED FILTERS BAR ================= */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Quick Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم الجمعية، اسم الحملة، رقم المرجع، أو اسم صاحب الجمعية..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Association */}
            <select
              value={selectedTenantFilter}
              onChange={(e) => setSelectedTenantFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">كل الجمعيات ({tenants.length})</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* Filter by Request Status */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">كل حالات الطلب</option>
              <option value="paid_pending_review">تم الدفع – في انتظار المراجعة</option>
              <option value="pending_payment">في انتظار الدفع</option>
              <option value="approved">تمت الموافقة</option>
              <option value="under_review">قيد المراجعة</option>
              <option value="correction_requested">طلب تصحيح/استكمال</option>
              <option value="rejected">مرفوض</option>
            </select>

            {/* Filter by Payment Status */}
            <select
              value={selectedPaymentStatusFilter}
              onChange={(e) => setSelectedPaymentStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">كل حالات الدفع</option>
              <option value="pending_verification">في انتظار التحقق</option>
              <option value="confirmed">مدفوع ومؤكد</option>
              <option value="unpaid">لم يتم الدفع</option>
              <option value="failed">فشل الدفع</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="newest">الأحدث تقديماً</option>
              <option value="oldest">الأقدم تقديماً</option>
              <option value="amount_desc">المبلغ الأعلى</option>
              <option value="duration">المدة الأطول</option>
            </select>

            {/* Reset Filter Button */}
            {(searchQuery || selectedTenantFilter !== 'all' || selectedStatusFilter !== 'all' || selectedPaymentStatusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTenantFilter('all');
                  setSelectedStatusFilter('all');
                  setSelectedPaymentStatusFilter('all');
                  setDateRangeFilter('all');
                }}
                className="px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-rose-200 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ================= REQUESTS LIST TABLE ================= */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
              <FileText className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">لا توجد طلبات تدشين حملات مطابقة</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              لم يتم العثور على أي طلبات بناءً على معايير الفلترة المحددة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold select-none">
                <tr>
                  <th className="py-3.5 px-4">الجمعية ومقدم الطلب</th>
                  <th className="py-3.5 px-4">اسم ووصف الحملة</th>
                  <th className="py-3.5 px-4">مدة الحملة والفترة</th>
                  <th className="py-3.5 px-4">المبلغ والدفع</th>
                  <th className="py-3.5 px-4 text-center">حالة الطلب</th>
                  <th className="py-3.5 px-4 text-center">تاريخ التقديم</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات الإدارية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRequests.map((req) => {
                  const statusCfg = REQUEST_STATUS_CONFIG[req.status] || REQUEST_STATUS_CONFIG.pending_payment;
                  const paymentCfg = PAYMENT_STATUS_CONFIG[req.paymentStatus] || PAYMENT_STATUS_CONFIG.unpaid;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* 1. Association Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {req.tenantLogoUrl ? (
                            <img
                              src={req.tenantLogoUrl}
                              alt={req.tenantName}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{req.tenantName}</span>
                              {req.tenantCity && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({req.tenantCity})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                              {req.ownerName && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{req.ownerName}</span>
                                </span>
                              )}
                              {req.ownerPhone && (
                                <span className="text-slate-400 font-mono text-[10px]" dir="ltr">
                                  {req.ownerPhone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Campaign Name & Description */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 leading-snug">
                          {req.campaignTitle}
                        </div>
                        {req.campaignDescription ? (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {req.campaignDescription}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic mt-0.5">بدون وصف إضافي</p>
                        )}
                        {req.requestedPriorityOrder && (
                          <span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                            ترتيب الظهور المطلوب: #{req.requestedPriorityOrder}
                          </span>
                        )}
                      </td>

                      {/* 3. Duration & Dates */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            {req.monthsCount === 1
                              ? 'شهر واحد'
                              : req.monthsCount === 2
                              ? 'شهران'
                              : `${req.monthsCount} أشهر`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 space-y-0.5 font-mono">
                          <div>من: {req.startDate || '—'}</div>
                          <div>إلى: {req.endDate || '—'}</div>
                        </div>
                      </td>

                      {/* 4. Amount & Payment Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 flex items-baseline gap-1">
                          <span className="text-sm">{req.amount}</span>
                          <span className="text-[10px] text-slate-500">{req.currency}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${paymentCfg.bg}`}>
                            {paymentCfg.label}
                          </span>
                          {req.paymentMethod && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              • {PAYMENT_METHOD_LABELS[req.paymentMethod]}
                            </span>
                          )}
                        </div>
                        {req.paymentReference && (
                          <div className="text-[10px] text-indigo-700 font-mono mt-0.5">
                            مرجع: {req.paymentReference}
                          </div>
                        )}
                      </td>

                      {/* 5. Request Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
                          <span>{statusCfg.label}</span>
                        </span>

                        {req.rejectionReason && (
                          <div
                            className="text-[10px] text-rose-600 mt-1 max-w-[140px] truncate mx-auto cursor-help"
                            title={req.rejectionReason}
                          >
                            السبب: {req.rejectionReason}
                          </div>
                        )}
                      </td>

                      {/* 6. Submission Date */}
                      <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatArabicDate(req.createdAt)}
                      </td>

                      {/* 7. Action Buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* View Details Button */}
                          <button
                            onClick={() => setDetailsModalRequest(req)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-all border border-slate-200"
                            title="الاطلاع على تفاصيل الطلب"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Review & Decide Button */}
                          <button
                            onClick={() => handleOpenReviewModal(req)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1"
                            title="مراجعة الطلب واتخاذ القرار"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>مراجعة</span>
                          </button>

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

      {/* ================= 1. VIEW REQUEST DETAILS MODAL ================= */}
      {detailsModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    تفاصيل طلب تدشين الحملة الإعلانية
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    رقم الطلب: {detailsModalRequest.id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDetailsModalRequest(null)}
                className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              
              {/* Status Header Banner */}
              {(() => {
                const cfg = REQUEST_STATUS_CONFIG[detailsModalRequest.status] || REQUEST_STATUS_CONFIG.pending_payment;
                const Icon = cfg.icon;
                return (
                  <div className={`p-4 rounded-2xl border ${cfg.bg} ${cfg.border} flex items-start gap-3`}>
                    <Icon className={`w-5 h-5 ${cfg.text} shrink-0 mt-0.5`} />
                    <div className="space-y-1">
                      <div className={`font-black text-sm ${cfg.text}`}>
                        حالة الطلب: {cfg.label}
                      </div>
                      {detailsModalRequest.rejectionReason && (
                        <p className="text-rose-800 font-medium">
                          سبب الرفض: {detailsModalRequest.rejectionReason}
                        </p>
                      )}
                      {detailsModalRequest.correctionNotes && (
                        <p className="text-orange-800 font-medium">
                          ملاحظات التصحيح: {detailsModalRequest.correctionNotes}
                        </p>
                      )}
                      {detailsModalRequest.reviewedBy && (
                        <p className="text-[11px] text-slate-500">
                          تمت المراجعة بواسطة: {detailsModalRequest.reviewedBy} بتاريخ {formatArabicDate(detailsModalRequest.reviewedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 1. Association Information */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h5 className="font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  بيانات الجمعية ومقدم الطلب
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">اسم الجمعية:</span>
                    <span className="font-bold text-slate-900">{detailsModalRequest.tenantName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">المدينة / الدولة:</span>
                    <span className="font-medium text-slate-800">
                      {detailsModalRequest.tenantCity || 'غير محدد'} - {detailsModalRequest.tenantCountry || 'المغرب'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">صاحب الجمعية / المسؤول:</span>
                    <span className="font-medium text-slate-800">{detailsModalRequest.ownerName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">رقم الهاتف للتواصل:</span>
                    <span className="font-mono text-slate-800" dir="ltr">{detailsModalRequest.ownerPhone || '—'}</span>
                  </div>
                </div>
              </div>

              {/* 2. Campaign Specifications */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h5 className="font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  بيانات ومواصفات الحملة الإعلانية
                </h5>
                <div className="space-y-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">عنوان الحملة الترويجية:</span>
                    <span className="font-bold text-slate-900 text-sm">{detailsModalRequest.campaignTitle}</span>
                  </div>
                  {detailsModalRequest.campaignDescription && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">وصف الحملة / الغرض:</span>
                      <p className="text-slate-700 leading-relaxed">{detailsModalRequest.campaignDescription}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <span className="text-slate-400 block text-[10px]">مدة الحملة:</span>
                      <span className="font-bold text-slate-800">
                        {detailsModalRequest.monthsCount === 1 ? 'شهر واحد' : `${detailsModalRequest.monthsCount} أشهر`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">تاريخ البداية:</span>
                      <span className="font-mono text-slate-800">{detailsModalRequest.startDate || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">تاريخ النهاية:</span>
                      <span className="font-mono text-slate-800">{detailsModalRequest.endDate || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Payment & Receipt Information */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h5 className="font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  بيانات الرسوم وتفاصيل الدفع
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">المبلغ المطلوب:</span>
                    <span className="font-black text-slate-900 text-sm">
                      {detailsModalRequest.amount} {detailsModalRequest.currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">حالة الدفع:</span>
                    <span className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full font-bold mt-0.5 ${PAYMENT_STATUS_CONFIG[detailsModalRequest.paymentStatus]?.bg}`}>
                      {PAYMENT_STATUS_CONFIG[detailsModalRequest.paymentStatus]?.label}
                    </span>
                  </div>
                  {detailsModalRequest.paymentMethod && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">طريقة الدفع:</span>
                      <span className="font-medium text-slate-800">{PAYMENT_METHOD_LABELS[detailsModalRequest.paymentMethod]}</span>
                    </div>
                  )}
                  {detailsModalRequest.paymentReference && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">رقم أو مرجع العملية:</span>
                      <span className="font-mono font-bold text-indigo-700">{detailsModalRequest.paymentReference}</span>
                    </div>
                  )}
                  {detailsModalRequest.paymentSubmittedAt && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">تاريخ وساعة الدفع:</span>
                      <span className="font-mono text-slate-700">{formatArabicDate(detailsModalRequest.paymentSubmittedAt)}</span>
                    </div>
                  )}
                </div>

                {/* Proof of payment viewer */}
                {detailsModalRequest.proofDocumentUrl && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-500 block text-xs font-bold mb-2 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                      <span>وثيقة أو إثبات الدفع المرفوع:</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <img
                        src={detailsModalRequest.proofDocumentUrl}
                        alt="إثبات الدفع"
                        className="w-24 h-24 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-90"
                        onClick={() => setProofViewerUrl(detailsModalRequest.proofDocumentUrl || null)}
                      />
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-slate-800">
                          {detailsModalRequest.proofFileName || 'وصل التحويل البنكي / الإيداع'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setProofViewerUrl(detailsModalRequest.proofDocumentUrl || null)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>معاينة الإثبات بحجم كامل</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteRequest(detailsModalRequest)}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition-all"
              >
                حذف الطلب
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailsModalRequest(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold transition-all"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const req = detailsModalRequest;
                    setDetailsModalRequest(null);
                    handleOpenReviewModal(req);
                  }}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>مراجعة الطلب الآن</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= 2. REVIEW & DECISION MODAL ================= */}
      {reviewModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    مراجعة واتخاذ القرار بشأن طلب الحملة الإعلانية
                  </h4>
                  <p className="text-xs text-slate-500">
                    الجمعية: {reviewModalRequest.tenantName} • المبلغ: {reviewModalRequest.amount} {reviewModalRequest.currency}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setReviewModalRequest(null)}
                className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitReview} className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              
              {reviewError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{reviewError}</span>
                </div>
              )}

              {/* Step 1: Decision Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  حدد القرار الإداري المطلوب:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Option 1: Approve */}
                  {canApprove ? (
                    <button
                      type="button"
                      onClick={() => setReviewDecision('approve')}
                      className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col gap-1.5 ${
                        reviewDecision === 'approve'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>الموافقة وتفعيل الحملة</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-snug">
                        تأكيد الدفع وتفعيل ظهور الجمعية الفوري في الصفحة الأولى.
                      </p>
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-100 text-slate-400 flex flex-col gap-1.5 cursor-not-allowed opacity-75">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-500 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-slate-400" />
                          <span>الموافقة وتفعيل الحملة</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        صلاحية الموافقة غير ممنوحة لحسابك الإداري.
                      </p>
                    </div>
                  )}

                  {/* Option 2: Reject */}
                  <button
                    type="button"
                    onClick={() => setReviewDecision('reject')}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col gap-1.5 ${
                      reviewDecision === 'reject'
                        ? 'border-rose-600 bg-rose-50 text-rose-950 ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-rose-800 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>رفض الطلب</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      رفض الطلب مع إمكانية كتابة سبب الرفض الموجه للجمعية.
                    </p>
                  </button>

                  {/* Option 3: Request Correction */}
                  <button
                    type="button"
                    onClick={() => setReviewDecision('correction_requested')}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col gap-1.5 ${
                      reviewDecision === 'correction_requested'
                        ? 'border-orange-600 bg-orange-50 text-orange-950 ring-2 ring-orange-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-orange-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <span>طلب تصحيح/استكمال</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      إرسال ملاحظات للجمعية لتعديل الوصل أو البيانات.
                    </p>
                  </button>
                </div>
              </div>

              {/* Conditional Form Fields based on decision */}
              {reviewDecision === 'approve' && (
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3.5">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>إعدادات تفعيل الحملة الإعلانية وترتيب الظهور:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Priority Order */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        ترتيب الظهور في الصفحة الأولى:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={reviewPriorityOrder}
                        onChange={(e) => setReviewPriorityOrder(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-slate-800"
                      />
                      <span className="text-[10px] text-slate-400 block">1 = الترتيب الأول، 2 = الثاني...</span>
                    </div>

                    {/* Start Date */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        تاريخ البداية:
                      </label>
                      <input
                        type="date"
                        value={reviewStartDate}
                        onChange={(e) => setReviewStartDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-slate-800"
                      />
                    </div>

                    {/* End Date */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        تاريخ النهاية:
                      </label>
                      <input
                        type="date"
                        value={reviewEndDate}
                        onChange={(e) => setReviewEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-emerald-800 leading-relaxed bg-white/80 p-3 rounded-xl border border-emerald-100">
                    💡 <strong>توضيح النظام:</strong> فور تأكيد الموافقة، سيتم تحويل حالة الطلب إلى «تمت الموافقة»، وتأكيد سجل الدفع المالي، وإدراج الجمعية مباشرة في نظام ترتيب الظهور لقسم التبرعات.
                  </p>
                </div>
              )}

              {reviewDecision === 'reject' && (
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2">
                  <label className="block text-xs font-bold text-rose-900 flex items-center justify-between">
                    <span>سبب الرفض الموجه للجمعية (إلزامي):</span>
                    <span className="text-[10px] text-rose-600 font-normal">سيظهر للجمعية في لوحة تحكمها</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reviewRejectionReason}
                    onChange={(e) => setReviewRejectionReason(e.target.value)}
                    placeholder="مثال: وصل التحويل البنكي المرفق غير واضح، أو لم يتم إيداع المبلغ المطلوب..."
                    className="w-full px-3 py-2.5 rounded-xl border border-rose-300 focus:ring-2 focus:ring-rose-500 focus:outline-none text-xs text-slate-800 placeholder:text-slate-400"
                    required
                  />
                </div>
              )}

              {reviewDecision === 'correction_requested' && (
                <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-2">
                  <label className="block text-xs font-bold text-orange-900 flex items-center justify-between">
                    <span>ملاحظات واستفسارات التصحيح للجمعية:</span>
                    <span className="text-[10px] text-orange-600 font-normal">تظهر للجمعية لتحديث طلبها</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reviewCorrectionNotes}
                    onChange={(e) => setReviewCorrectionNotes(e.target.value)}
                    placeholder="مثال: يرجى رفع صورة واضحة لختم البنك مع تأكيد رقم الحساب..."
                    className="w-full px-3 py-2.5 rounded-xl border border-orange-300 focus:ring-2 focus:ring-orange-500 focus:outline-none text-xs text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              )}

              {/* Internal Admin Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>ملاحظات إدارية داخلية (اختياري):</span>
                  <span className="text-[10px] text-slate-400 font-normal">مرئية للإدارة العامة فقط</span>
                </label>
                <input
                  type="text"
                  value={reviewAdminNotes}
                  onChange={(e) => setReviewAdminNotes(e.target.value)}
                  placeholder="ملاحظات توثيق داخلية..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs text-slate-800"
                />
              </div>

              {/* Modal Footer Controls */}
              <div className="p-4 border-t border-slate-200 -mx-6 -mb-6 bg-slate-50 flex items-center justify-between mt-6">
                <button
                  type="button"
                  onClick={() => setReviewModalRequest(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold transition-all"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className={`px-6 py-2.5 rounded-xl text-white font-black transition-all shadow-md flex items-center gap-2 ${
                    reviewDecision === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : reviewDecision === 'reject'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      : 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                  }`}
                >
                  {isSubmittingReview ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[3]" />
                  )}
                  <span>
                    {reviewDecision === 'approve'
                      ? 'تأكيد الموافقة وتفعيل الإعلان'
                      : reviewDecision === 'reject'
                      ? 'تأكيد رفض الطلب'
                      : 'إرسال طلب التصحيح'}
                  </span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= 3. PROOF OF PAYMENT ZOOM VIEWER ================= */}
      {proofViewerUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-sm text-slate-800">معاينة إثبات / وصل الدفع</span>
              </div>
              <button
                onClick={() => setProofViewerUrl(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-900/5">
              <img
                src={proofViewerUrl}
                alt="وصل الدفع"
                className="max-h-[70vh] object-contain rounded-xl shadow-md border border-slate-200"
              />
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <a
                href={proofViewerUrl}
                download="recu_paiement.jpg"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل الصورة</span>
              </a>
              <button
                onClick={() => setProofViewerUrl(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. MANUAL REQUEST CREATION MODAL ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    تسجيل طلب تدشين حملة جديدة يدويًا
                  </h4>
                  <p className="text-xs text-slate-500">
                    إدخال طلب نيابة عن جمعية وإدراجه في جدول المراجعة والاعتماد
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualRequest} className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              
              {manualFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{manualFormError}</span>
                </div>
              )}

              {/* Association selector */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-800">اختر الجمعية:</label>
                <select
                  value={manualTenantId}
                  onChange={(e) => setManualTenantId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.city || 'المدينة'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Campaign Title */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-800">عنوان الحملة الإعلانية:</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="مثال: إعلان رعاية الأيتام والتعليم"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Campaign Description */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-800">وصف مختصر للحملة:</label>
                <textarea
                  rows={2}
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="أهداف الحملة وتفاصيل المشاريع المطلوب إبرازها..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Duration & Months */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-800">المدة المحددة بالشهور:</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 6].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleManualMonthsChange(m)}
                      className={`py-2 rounded-xl border font-bold text-xs transition-all ${
                        manualMonths === m
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {m === 1 ? 'شهر واحد' : `${m} أشهر`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">تاريخ البداية:</label>
                  <input
                    type="date"
                    value={manualStartDate}
                    onChange={(e) => setManualStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">تاريخ النهاية:</label>
                  <input
                    type="date"
                    value={manualEndDate}
                    onChange={(e) => setManualEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Amount & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">المبلغ الإجمالي (درهم):</label>
                  <input
                    type="number"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">ترتيب الظهور المطلوب:</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={manualPriority}
                    onChange={(e) => setManualPriority(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 -mx-6 -mb-6 bg-slate-50 flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black transition-all shadow-md shadow-indigo-600/20"
                >
                  حفظ وتسجيل الطلب
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
