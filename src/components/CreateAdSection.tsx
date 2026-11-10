import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Calendar, 
  Clock, 
  Coins, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Eye, 
  ShieldCheck, 
  Info,
  CalendarDays,
  FileText,
  BadgeCheck,
  TrendingUp,
  Receipt,
  XCircle,
  HelpCircle,
  Check,
  Tag,
  Upload,
  Image as ImageIcon,
  Trash2,
  Edit3,
  ExternalLink,
  Send,
  RefreshCw,
  Save,
  Lock
} from 'lucide-react';
import { AssociationTenant, TenantPaymentRecord, PlatformAdCampaign, AdCampaignRequest, PaymentMethod, PlatformPaymentSettings } from '../types';
import { 
  getPlatformPaymentSettings, 
  getActivationFeeForCountry,
  getAdCreationFeeForCountry,
  syncPlatformPaymentSettingsFromBackend,
  getAdCampaignPaymentsByTenant
} from '../paymentStorage';
import { 
  getAllAdCampaigns, 
  getAdCampaignRequestsByTenant,
  createOrUpdateAdCampaignRequest,
  fetchAdCampaignRequestsFromServer,
  fetchAdCampaignsFromServer,
  AD_CAMPAIGN_REQUESTS_EVENT,
  AD_CAMPAIGNS_EVENT 
} from '../adCampaignStorage';
import { PaymentMethodModal } from './PaymentMethodModal';
import { AdCampaignPreviewModal } from './AdCampaignPreviewModal';

interface CreateAdSectionProps {
  tenant: AssociationTenant;
  onRefreshTenant?: () => void;
  onNavigateToPublicDonations?: () => void;
}

export const CreateAdSection: React.FC<CreateAdSectionProps> = ({
  tenant,
  onRefreshTenant,
  onNavigateToPublicDonations,
}) => {
  const [paymentSettings, setPaymentSettings] = useState<PlatformPaymentSettings>(() => getPlatformPaymentSettings());
  const adFeeInfo = getAdCreationFeeForCountry(tenant.country, paymentSettings);
  
  // Rate per month - strictly derived from central platform settings (الإدارة العامة للمنصة)
  const monthlyRate = adFeeInfo.amount;
  const currencySymbol = adFeeInfo.currency === 'MAD' ? 'درهم مغربي' : (adFeeInfo.currencyNameAr ? `${adFeeInfo.currencyNameAr} (${adFeeInfo.currency})` : adFeeInfo.currency);
  const currencyCode = adFeeInfo.currency;

  // Form states
  const [campaignTitle, setCampaignTitle] = useState(`إعلان مشاريع ${tenant.name}`);
  const [monthsCount, setMonthsCount] = useState<number>(1);
  
  // Date calculation
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });

  // Validation state
  const [dateError, setDateError] = useState<string | null>(null);
  
  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPaymentMethodForModal, setSelectedPaymentMethodForModal] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    // Synchronize payment settings on mount from backend database
    syncPlatformPaymentSettingsFromBackend().then((synced) => {
      if (synced) setPaymentSettings(synced);
    });

    const handlePaymentSettingsUpdate = (e: any) => {
      if (e?.detail) {
        setPaymentSettings(e.detail);
      } else {
        setPaymentSettings(getPlatformPaymentSettings());
      }
    };

    window.addEventListener('platform-payment-settings-updated', handlePaymentSettingsUpdate);
    window.addEventListener('ad-creation-fee-updated', handlePaymentSettingsUpdate);
    window.addEventListener('storage', handlePaymentSettingsUpdate);

    return () => {
      window.removeEventListener('platform-payment-settings-updated', handlePaymentSettingsUpdate);
      window.removeEventListener('ad-creation-fee-updated', handlePaymentSettingsUpdate);
      window.removeEventListener('storage', handlePaymentSettingsUpdate);
    };
  }, []);

  // Campaign Preview Modal State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewTargetReq, setPreviewTargetReq] = useState<AdCampaignRequest | null>(null);

  // Save Campaign Draft State
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveDraftSuccess, setSaveDraftSuccess] = useState(false);
  
  // History & active campaigns state
  const [tenantPayments, setTenantPayments] = useState<TenantPaymentRecord[]>([]);
  const [tenantRequests, setTenantRequests] = useState<AdCampaignRequest[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<PlatformAdCampaign[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Correction Modal State
  const [correctionModalReq, setCorrectionModalReq] = useState<AdCampaignRequest | null>(null);
  const [correctedTitle, setCorrectedTitle] = useState('');
  const [correctedMonths, setCorrectedMonths] = useState(1);
  const [correctedStart, setCorrectedStart] = useState('');
  const [correctedEnd, setCorrectedEnd] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  // Load tenant payments, requests and active ad campaign
  useEffect(() => {
    const loadData = () => {
      const payments = getAdCampaignPaymentsByTenant(tenant.id);
      setTenantPayments(payments);

      const requests = getAdCampaignRequestsByTenant(tenant.id);
      setTenantRequests(requests);

      const allCampaigns = getAllAdCampaigns();
      const now = new Date();
      const active = allCampaigns.filter(
        (c) => c.tenantId === tenant.id && c.enabled && new Date(c.startDate) <= now && new Date(c.endDate) >= now
      );
      setActiveCampaigns(active);
    };

    loadData();

    // Fetch latest from server API
    Promise.all([
      fetchAdCampaignRequestsFromServer(),
      fetchAdCampaignsFromServer(),
    ]).then(() => {
      loadData();
    }).catch(() => {});
  }, [tenant.id, refreshKey]);

  // Listen to broadcast events
  useEffect(() => {
    const handleRequestsUpdate = () => {
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener(AD_CAMPAIGN_REQUESTS_EVENT, handleRequestsUpdate);
    window.addEventListener(AD_CAMPAIGNS_EVENT, handleRequestsUpdate);
    window.addEventListener('storage', handleRequestsUpdate);
    return () => {
      window.removeEventListener(AD_CAMPAIGN_REQUESTS_EVENT, handleRequestsUpdate);
      window.removeEventListener(AD_CAMPAIGNS_EVENT, handleRequestsUpdate);
      window.removeEventListener('storage', handleRequestsUpdate);
    };
  }, []);

  // Sync dates when monthsCount changes via quick selector
  const handleQuickMonthsSelect = (months: number) => {
    setMonthsCount(months);
    const start = new Date(startDate || todayStr);
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    setEndDate(end.toISOString().split('T')[0]);
    setDateError(null);
  };

  // Sync monthsCount and validate when dates are changed manually
  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    validateAndCalculateMonths(newStart, endDate);
  };

  const handleEndDateChange = (newEnd: string) => {
    setEndDate(newEnd);
    validateAndCalculateMonths(startDate, newEnd);
  };

  const validateAndCalculateMonths = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) {
      setDateError('يرجى تحديد تاريخ البداية وتاريخ النهاية.');
      return;
    }

    const start = new Date(startStr);
    const end = new Date(endStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setDateError('صيغة التاريخ غير صالحة.');
      return;
    }

    // Calculate difference in days
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 28) {
      setDateError('مدة الإعلان يجب أن تكون بالشهور فقط، ولا يسمح النظام بإنشاء إعلان لمدة أقل من شهر واحد (30 يومًا على الأقل).');
      return;
    }

    setDateError(null);
    // Approximate whole months (round to nearest whole month >= 1)
    const calculatedMonths = Math.max(1, Math.round(diffDays / 30));
    setMonthsCount(calculatedMonths);
  };

  // Check requests statuses
  const approvedRequest = tenantRequests.find((r) => r.status === 'approved');
  const pendingReviewRequest = tenantRequests.find((r) => r.status === 'paid_pending_review' || r.status === 'under_review');
  const correctionRequestedRequest = tenantRequests.find((r) => r.status === 'correction_requested');
  const rejectedRequest = tenantRequests.find((r) => r.status === 'rejected');
  const pendingPayment = tenantPayments.find((p) => p.status === 'pending');
  const activeCampaign = activeCampaigns[0];

  // Total cost
  const totalCost = monthsCount * monthlyRate;

  // Handle open payment modal
  const handleProceedToPayment = () => {
    if (dateError) return;
    if (monthsCount < 1) {
      setDateError('الحد الأدنى لمدة الإعلان هو شهر واحد.');
      return;
    }
    setSelectedPaymentMethodForModal(null);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentCompleted = () => {
    setRefreshKey((k) => k + 1);
    if (onRefreshTenant) onRefreshTenant();
  };

  const openCampaignPreview = (req?: AdCampaignRequest | null) => {
    setPreviewTargetReq(req || null);
    setIsPreviewModalOpen(true);
  };

  const handleSaveCampaignDraft = () => {
    if (dateError) return;
    setIsSavingDraft(true);
    try {
      const calculatedEnd = endDate || (() => {
        const d = new Date(startDate || todayStr);
        d.setMonth(d.getMonth() + monthsCount);
        return d.toISOString().split('T')[0];
      })();

      // Check if there is an existing request for this tenant to update
      const existingReq = tenantRequests.find(
        (r) => r.status === 'pending_payment' || r.status === 'paid_pending_review'
      );

      createOrUpdateAdCampaignRequest({
        id: existingReq?.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        tenantLogoUrl: tenant.logoUrl,
        tenantCity: tenant.city,
        tenantCountry: tenant.country,
        ownerId: tenant.ownerId,
        ownerName: tenant.ownerName,
        ownerPhone: tenant.ownerPhone,
        campaignTitle: campaignTitle.trim() || `إعلان مشاريع ${tenant.name}`,
        monthsCount,
        startDate: startDate || todayStr,
        endDate: calculatedEnd,
        amount: totalCost,
        currency: currencyCode,
        monthlyRate,
        status: existingReq ? existingReq.status : 'pending_payment',
        paymentStatus: existingReq ? existingReq.paymentStatus : 'unpaid',
        updatedAt: new Date().toISOString(),
      });

      setSaveDraftSuccess(true);
      setTimeout(() => setSaveDraftSuccess(false), 4000);
      setRefreshKey((k) => k + 1);
      if (onRefreshTenant) onRefreshTenant();
    } catch (err) {
      console.error('Error saving campaign draft:', err);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const openCorrectionModal = (req: AdCampaignRequest) => {
    setCorrectionModalReq(req);
    setCorrectedTitle(req.campaignTitle || `إعلان مشاريع ${tenant.name}`);
    setCorrectedMonths(req.monthsCount || 1);
    setCorrectedStart(req.startDate || todayStr);
    setCorrectedEnd(req.endDate || todayStr);
  };

  const handleSaveAndResubmitCorrection = () => {
    if (!correctionModalReq) return;
    setIsSubmittingCorrection(true);
    try {
      createOrUpdateAdCampaignRequest({
        id: correctionModalReq.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        campaignTitle: correctedTitle.trim() || correctionModalReq.campaignTitle,
        monthsCount: correctedMonths,
        startDate: correctedStart,
        endDate: correctedEnd,
        amount: correctionModalReq.amount || (correctedMonths * monthlyRate),
        currency: correctionModalReq.currency || currencyCode,
        campaignBannerUrl: correctionModalReq.campaignBannerUrl,
        status: 'paid_pending_review',
        paymentStatus: 'pending_verification',
        updatedAt: new Date().toISOString(),
      });
      setCorrectionModalReq(null);
      setRefreshKey((k) => k + 1);
      if (onRefreshTenant) onRefreshTenant();
    } catch (err) {
      console.error('Error submitting correction:', err);
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800" dir="rtl">
      
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-700/40">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>خدمة الترويج والظهور المميز للمشاريع</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Megaphone className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 shrink-0" />
              إنشاء إعلان
            </h1>
            
            <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed font-medium">
              سيتم إظهار جمعيتك في الصفحة الأولى بواجهة المنصة في قسم تلقي التبرعات.
            </p>
          </div>

          {/* Quick Stat / Action Badge */}
          {activeCampaign ? (
            <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 backdrop-blur-md text-right shrink-0 w-full md:w-auto shadow-lg">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                حملة إعلانية نشطة حالياً
              </div>
              <p className="text-white font-bold text-sm truncate max-w-xs">{activeCampaign.title}</p>
              <div className="text-xs text-emerald-200/80 mt-1 flex items-center gap-2">
                <span>تنتهي في: {new Date(activeCampaign.endDate).toLocaleDateString('ar-MA')}</span>
              </div>
            </div>
          ) : pendingPayment ? (
            <div className="bg-amber-950/80 border border-amber-500/40 rounded-2xl p-4 sm:p-5 backdrop-blur-md text-right shrink-0 w-full md:w-auto shadow-lg">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold mb-1">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                طلب إعلان قيد التحقق من الدفع
              </div>
              <p className="text-white font-bold text-sm">مرجع: {pendingPayment.transactionReference}</p>
              <span className="text-xs text-amber-200/80 block mt-1">بانتظار تأكيد الإدارة العامة لتفعيل الظهور</span>
            </div>
          ) : (
            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-5 backdrop-blur-md text-right shrink-0 w-full md:w-auto">
              <div className="text-xs text-indigo-200 font-semibold mb-0.5">سعر الإعلان الشهري المعتمد:</div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                {monthlyRate} {currencySymbol} <span className="text-xs text-indigo-200 font-normal">/ شهر</span>
              </div>
              <div className="text-[10px] text-amber-200/90 font-medium mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-300 inline shrink-0" />
                <span>محدد ومعتمد من الإدارة العامة للمنصة</span>
              </div>
            </div>
          )}

          {/* Prominent Header Action: View Ad Campaign Button */}
          {(activeCampaign || tenantRequests.length > 0) && (
            <button
              type="button"
              onClick={() => openCampaignPreview(tenantRequests[0] || null)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-amber-300/50 shrink-0 hover:scale-[1.02]"
            >
              <Eye className="w-4 h-4 text-amber-100" />
              <span>👁 مشاهدة الحملة الإعلانية</span>
            </button>
          )}
        </div>
      </div>

      {/* Notice If Approved Request Exists */}
      {approvedRequest && (
        <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-emerald-900 text-sm">تمت الموافقة على الحملة الإعلانية وتفعيل الظهور بنجاح</h4>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-black">معتمد ونشط</span>
              </div>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                تم اعتماد وتدشين حملتكم الإعلانية <strong>«{approvedRequest.campaignTitle}»</strong> بنجاح. تظهر جمعيتكم الآن في مقدمة الجمعيات في الصفحة الأولى بقسم تبرع وشارك في مشاريع التنمية.
              </p>
              <div className="text-[11px] text-emerald-700/80 mt-1 font-mono">
                الفترة النشطة: {approvedRequest.startDate ? new Date(approvedRequest.startDate).toLocaleDateString('ar-MA') : '—'} إلى {approvedRequest.endDate ? new Date(approvedRequest.endDate).toLocaleDateString('ar-MA') : '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => openCampaignPreview(approvedRequest)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shrink-0 flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>👁 مشاهدة الحملة الإعلانية</span>
            </button>
            {onNavigateToPublicDonations && (
              <button
                type="button"
                onClick={onNavigateToPublicDonations}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>معاينة بالصفحة الأولى</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notice If Correction Requested */}
      {correctionRequestedRequest && (
        <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-amber-900 text-sm">ملاحظة من الإدارة العامة: مطلوب استكمال أو تصحيح بيانات الحملة</h4>
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">تتطلب تدخلك</span>
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed bg-amber-100/70 p-2.5 rounded-xl border border-amber-200/60 font-medium">
                "{correctionRequestedRequest.correctionNotes || 'يرجى مراجعة وتحديث تفاصيل الحملة الإعلانية وإعادة إرسالها.'}"
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => openCampaignPreview(correctionRequestedRequest)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>👁 مشاهدة الحملة الإعلانية</span>
            </button>
            <button
              type="button"
              onClick={() => openCorrectionModal(correctionRequestedRequest)}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل البيانات وإعادة الإرسال</span>
            </button>
          </div>
        </div>
      )}

      {/* Notice If Request Rejected */}
      {rejectedRequest && !activeCampaign && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-rose-900 text-sm">تم رفض طلب تدشين الحملة الإعلانية</h4>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed bg-rose-100/60 p-2 rounded-lg border border-rose-200/50">
                <strong>سبب الرفض:</strong> {rejectedRequest.rejectionReason || 'تعذر اعتماد الطلب بالصيغة الحالية.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openCampaignPreview(rejectedRequest)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>👁 مشاهدة الحملة</span>
            </button>
            <span className="px-3 py-1 rounded-xl bg-rose-200 text-rose-900 font-bold text-xs shrink-0">
              مرفوض من الإدارة
            </span>
          </div>
        </div>
      )}

      {/* Notice If Pending Review Exists */}
      {pendingReviewRequest && !correctionRequestedRequest && (
        <div className="p-5 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <Clock className="w-6 h-6 text-sky-600 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h4 className="font-bold text-sky-900 text-sm">طلب تدشين الحملة الإعلانية قيد المراجعة والتدقيق</h4>
              <p className="text-xs text-sky-700 mt-0.5 leading-relaxed">
                تم استلام طلبكم بنجاح بمبلغ <strong>{pendingReviewRequest.amount} {pendingReviewRequest.currency}</strong> (حملة: <strong>{pendingReviewRequest.campaignTitle}</strong>).
                تقوم الإدارة العامة حالياً بالتحقق من وصل الدفع واعتماد ترتيب ظهور جمعيتكم في الصفحة الأولى.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openCampaignPreview(pendingReviewRequest)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4 text-amber-300" />
              <span>👁 مشاهدة الحملة الإعلانية</span>
            </button>
            <span className="px-3 py-1.5 rounded-xl bg-sky-200 text-sky-900 font-bold text-xs shrink-0 border border-sky-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 animate-spin" /> قيد المراجعة الإدارية
            </span>
          </div>
        </div>
      )}

      {/* Notice If Pending Payment Exists */}
      {pendingPayment && !pendingReviewRequest && !correctionRequestedRequest && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">لديك طلب إعلان مسجل قيد مراجعة الدفع</h4>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                تم إرسال تفاصيل الدفع بمبلغ <strong>{pendingPayment.amount} {pendingPayment.currency}</strong> (مرجع: <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900">{pendingPayment.transactionReference}</code>).
                تقوم الإدارة العامة بالتحقق من وصل الدفع وتفعيل ظهور الجمعية فوراً.
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-amber-200/80 text-amber-900 font-bold text-xs shrink-0 border border-amber-300">
            قيد التحقق ⏳
          </span>
        </div>
      )}

      {/* Main Form & Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left/Main Column: Campaign Builder */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
            
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-600" />
                  تحديد مدة وفترة الإعلان
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  حدد تاريخ بداية ونهاية الحملة الإعلانية، أو اختر المدة بالشهور مباشرة.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                الحد الأدنى: شهر واحد
              </span>
            </div>

            {/* Campaign Title Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>عنوان الإعلان / الحملة الترويجية</span>
                <span className="text-xs font-normal text-slate-400">يظهر في تقرير الحملات والواجهة</span>
              </label>
              <input
                type="text"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                placeholder="مثال: إعلان مشاريع جمعية النور للتنمية والتضامن"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm font-medium text-slate-800"
              />
            </div>

            {/* Quick Duration Buttons (Months Only) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>اختر مدة الإعلان بالشهور:</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  { months: 1, label: 'شهر واحد', badge: '1 شهر' },
                  { months: 2, label: 'شهران', badge: '2 أشهر' },
                  { months: 3, label: '3 أشهر', badge: 'فصل كامل' },
                  { months: 6, label: '6 أشهر', badge: 'نصف سنة' },
                  { months: 12, label: 'سنة كاملة', badge: '12 شهراً' },
                ].map((item) => {
                  const isSelected = monthsCount === item.months;
                  return (
                    <button
                      key={item.months}
                      type="button"
                      onClick={() => handleQuickMonthsSelect(item.months)}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/90 text-indigo-900 ring-2 ring-indigo-500/30 shadow-sm'
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold">{item.label}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              
              {/* Start Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>تاريخ بداية الحملة الإعلانية:</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  min={todayStr}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm font-mono text-slate-800"
                />
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>تاريخ نهاية الحملة الإعلانية:</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || todayStr}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm font-mono text-slate-800"
                />
              </div>

            </div>

            {/* Date Validation Error */}
            {dateError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">تنبيه بشأن مدة الإعلان:</p>
                  <p className="mt-0.5">{dateError}</p>
                </div>
              </div>
            )}

            {/* Rule Clarification Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-start gap-3">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed space-y-1">
                <p className="font-bold text-slate-800">ضوابط مدة الإعلان والظهور:</p>
                <p>
                  • مدة الإعلان محددة بالشهور فقط، ولا يسمح النظام بأي إعلان يقل عن شهر كامل (30 يوماً).
                </p>
                <p>
                  • يبدأ ظهور الجمعية فور تأكيد الدفع من الإدارة العامة، ويستمر طوال فترة الحملة المحددة.
                </p>
              </div>
            </div>

          </div>

          {/* Previous Ad Campaigns & Requests History */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                سجل طلبات تدشين الحملات الإعلانية للجمعية
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {tenantRequests.length} طلب / طلبات
              </span>
            </div>

            {tenantRequests.length === 0 && tenantPayments.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                لا توجد طلبات إعلانات سابقة لهذه الجمعية حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="pb-3 pr-2">الحملة</th>
                      <th className="pb-3 px-2">المدة</th>
                      <th className="pb-3 px-2">الفترة</th>
                      <th className="pb-3 px-2">المبلغ</th>
                      <th className="pb-3 px-2">حالة الطلب</th>
                      <th className="pb-3 pl-2 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {tenantRequests.map((req) => {
                      const isApproved = req.status === 'approved';
                      const isUnderReview = req.status === 'under_review' || req.status === 'paid_pending_review';
                      const isCorrection = req.status === 'correction_requested';
                      const isRejected = req.status === 'rejected';
                      const isPendingPay = req.status === 'pending_payment';

                      return (
                        <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 pr-2">
                            <div className="flex items-center gap-2">
                              {tenant.logoUrl ? (
                                <img
                                  src={tenant.logoUrl}
                                  alt=""
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                                  <Megaphone className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate max-w-[160px]">
                                  {req.campaignTitle}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {req.id.slice(-8)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 font-medium">
                            {req.monthsCount} شهر / أشهر
                          </td>
                          <td className="py-3 px-2 text-[11px] text-slate-500 font-mono">
                            {req.startDate ? new Date(req.startDate).toLocaleDateString('ar-MA') : '-'} إلى {req.endDate ? new Date(req.endDate).toLocaleDateString('ar-MA') : '-'}
                          </td>
                          <td className="py-3 px-2 font-mono font-bold text-emerald-700">
                            {req.amount} {req.currency}
                          </td>
                          <td className="py-3 px-2">
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                <Check className="w-3 h-3" /> معتمد ونشط
                              </span>
                            )}
                            {isUnderReview && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold text-[10px]">
                                <Clock className="w-3 h-3 animate-spin" /> قيد المراجعة
                              </span>
                            )}
                            {isCorrection && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                                <AlertCircle className="w-3 h-3" /> مطلوب تصحيح
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                                <XCircle className="w-3 h-3" /> مرفوض
                              </span>
                            )}
                            {isPendingPay && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                                <CreditCard className="w-3 h-3" /> بانتظار الدفع
                              </span>
                            )}
                          </td>
                          <td className="py-3 pl-2 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openCampaignPreview(req)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                                title="مشاهدة الحملة الإعلانية"
                              >
                                <Eye className="w-3 h-3" />
                                <span>مشاهدة</span>
                              </button>
                              {isCorrection && (
                                <button
                                  type="button"
                                  onClick={() => openCorrectionModal(req)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                                >
                                  استكمال
                                </button>
                              )}
                              {isPendingPay && (
                                <button
                                  type="button"
                                  onClick={handleProceedToPayment}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                                >
                                  دفع
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

        </div>

        {/* Right Column: Pricing Summary & Call to Action */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Price Breakdown Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-md border border-indigo-100 space-y-6 sticky top-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                ملخص التكلفة والحساب
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                تسعيرة رسمية
              </span>
            </div>

            <div className="space-y-3 text-xs">
              
              <div className="flex items-center justify-between text-slate-600">
                <span>سعر الإعلان للشهر الواحد:</span>
                <span className="font-mono font-bold text-slate-900">{monthlyRate} {currencySymbol}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>المدة المختارة:</span>
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  {monthsCount} {monthsCount === 1 ? 'شهر واحد' : monthsCount === 2 ? 'شهران' : `${monthsCount} أشهر`}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>تاريخ البداية:</span>
                <span className="font-mono text-slate-700">{startDate}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>تاريخ النهاية:</span>
                <span className="font-mono text-slate-700">{endDate}</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">التكلفة الإجمالية المستحقة:</span>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-600 font-mono">
                    {totalCost.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-slate-600 mr-1">{currencyCode}</span>
                </div>
              </div>

            </div>

            {/* Key Benefits List */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 space-y-2 text-xs text-indigo-950">
              <div className="font-bold text-indigo-900 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>مميزات الظهور الإعلاني:</span>
              </div>
              <p className="flex items-start gap-1.5 text-indigo-800">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>إظهار مشاريع وتبرعات الجمعية في واجهة المنصة بالصفحة الأولى.</span>
              </p>
              <p className="flex items-start gap-1.5 text-indigo-800">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>أولوية في ترتيب الظهور لجذب المحسنين والمتبرعين.</span>
              </p>
              <p className="flex items-start gap-1.5 text-indigo-800">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>شعار وبطاقة الجمعية مع رابط مباشر لصفحة جمع التبرعات.</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              {/* Primary: Proceed to payment & deployment */}
              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={!!dateError || !!pendingPayment}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-l from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>الانتقال إلى خطوة الدفع والتدشين</span>
              </button>

              {/* View Ad Campaign Modal Button */}
              <button
                type="button"
                onClick={() => openCampaignPreview(tenantRequests[0] || null)}
                className="w-full py-3 px-4 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4 text-amber-600" />
                <span>👁 مشاهدة الحملة الإعلانية</span>
              </button>

              {/* Save Campaign Draft */}
              <button
                type="button"
                onClick={handleSaveCampaignDraft}
                disabled={isSavingDraft || !!dateError}
                className="w-full py-2.5 px-3 rounded-xl border border-indigo-200 hover:bg-indigo-50/70 text-indigo-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingDraft ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ حفظ بيانات الحملة...</span>
                  </>
                ) : saveDraftSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">تم حفظ الحملة بنجاح في قاعدة البيانات</span>
                  </>
                ) : (
                  <>
                    <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                    <span>حفظ بيانات الحملة الإعلانية</span>
                  </>
                )}
              </button>

              {onNavigateToPublicDonations && (
                <button
                  type="button"
                  onClick={onNavigateToPublicDonations}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>معاينة قسم التبرعات في الصفحة الأولى</span>
                </button>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Payment Method Modal with ad_campaign mode */}
      <PaymentMethodModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedPaymentMethodForModal(null);
        }}
        tenant={tenant}
        onPaymentSubmitted={handlePaymentCompleted}
        mode="ad_campaign"
        initialMethod={selectedPaymentMethodForModal}
        customAmount={totalCost}
        customCurrency={currencyCode}
        adCampaignData={{
          startDate,
          endDate,
          monthsCount,
          campaignTitle: campaignTitle.trim() || `إعلان مشاريع ${tenant.name}`,
        }}
      />

      {/* Correction & Details Modal */}
      {correctionModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-slate-800 space-y-6 relative my-8 animate-fade-in" dir="rtl">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">استكمال وتصحيح بيانات الحملة الإعلانية</h3>
                  <p className="text-xs text-slate-500">طلب رقم: {correctionModalReq.id.slice(-8)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCorrectionModalReq(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Admin notes box */}
            {correctionModalReq.correctionNotes && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>ملاحظات ومطالب الإدارة العامة:</span>
                </div>
                <p className="leading-relaxed bg-white/80 p-2.5 rounded-xl border border-amber-200/60 font-medium">
                  {correctionModalReq.correctionNotes}
                </p>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">عنوان الحملة الإعلانية:</label>
                <input
                  type="text"
                  value={correctedTitle}
                  onChange={(e) => setCorrectedTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">تاريخ البداية:</label>
                  <input
                    type="date"
                    value={correctedStart}
                    onChange={(e) => setCorrectedStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">تاريخ النهاية:</label>
                  <input
                    type="date"
                    value={correctedEnd}
                    onChange={(e) => setCorrectedEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                  />
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCorrectionModalReq(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAndResubmitCorrection}
                disabled={isSubmittingCorrection}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingCorrection ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ الإرسال...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>حفظ وإعادة الإرسال للإدارة</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Ad Campaign Preview Modal */}
      <AdCampaignPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        tenant={tenant}
        campaignRequest={previewTargetReq}
        activeCampaign={activeCampaign}
      />

    </div>
  );
};
