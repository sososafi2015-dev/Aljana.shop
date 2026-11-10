import React from 'react';
import { 
  X, 
  Sparkles, 
  MapPin, 
  HeartHandshake, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  ExternalLink,
  Calendar,
  CreditCard,
  Building2,
  Eye,
  Info,
  Edit3
} from 'lucide-react';
import type { AssociationTenant, AdCampaignRequest, PlatformAdCampaign } from '../types';

interface AdCampaignPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: AssociationTenant;
  campaignRequest?: AdCampaignRequest | null;
  activeCampaign?: PlatformAdCampaign | null;
  onNavigateToPublicDonations?: () => void;
  onOpenCorrection?: (req: AdCampaignRequest) => void;
}

export const AdCampaignPreviewModal: React.FC<AdCampaignPreviewModalProps> = ({
  isOpen,
  onClose,
  tenant,
  campaignRequest,
  activeCampaign,
  onNavigateToPublicDonations,
  onOpenCorrection,
}) => {
  if (!isOpen) return null;

  // Determine current effective status
  const effectiveStatus = campaignRequest?.status || (activeCampaign ? 'approved' : 'pending_payment');
  const isApproved = effectiveStatus === 'approved' || (activeCampaign && activeCampaign.enabled);
  const isPendingReview = effectiveStatus === 'paid_pending_review' || effectiveStatus === 'under_review';
  const isCorrectionRequested = effectiveStatus === 'correction_requested';
  const isRejected = effectiveStatus === 'rejected';
  const isPendingPayment = effectiveStatus === 'pending_payment';

  // Effective campaign details from request or active campaign
  const campaignTitle = campaignRequest?.campaignTitle || activeCampaign?.title || `إعلان مشاريع ${tenant.name}`;
  const startDate = campaignRequest?.startDate || activeCampaign?.startDate || new Date().toISOString().split('T')[0];
  const endDate = campaignRequest?.endDate || activeCampaign?.endDate || '';
  const monthsCount = campaignRequest?.monthsCount || 1;
  const amount = campaignRequest?.amount || (monthsCount * (tenant.country === 'المغرب' ? 199 : 20));
  const currency = campaignRequest?.currency || (tenant.country === 'المغرب' ? 'MAD' : 'USD');
  const paymentStatus = campaignRequest?.paymentStatus || (isApproved ? 'confirmed' : 'unpaid');

  const stats = tenant.stats || {
    membersCount: 14,
    activitiesCount: 5,
    totalBalance: 35000,
    campaignsCount: 2,
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fade-in"
      dir="rtl"
    >
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6 text-slate-800 flex flex-col max-h-[92vh]">
        
        {/* ================= MODAL HEADER ================= */}
        <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 relative shrink-0 border-b border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 left-5 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق المعاينة"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white">
                  معاينة الحملة الإعلانية المعتمدة
                </h2>
                {/* Status Badges */}
                {isApproved && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>معتمدة ونشطة بالصفحة الأولى</span>
                  </span>
                )}
                {isPendingReview && (
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[11px] font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>قيد المراجعة الإدارية</span>
                  </span>
                )}
                {isCorrectionRequested && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>مطلوب تصحيح بيانات</span>
                  </span>
                )}
                {isRejected && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[11px] font-bold flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    <span>مرفوضة من الإدارة</span>
                  </span>
                )}
                {isPendingPayment && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>مسجلة بانتظار الدفع</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200/80 mt-1 font-medium">
                المظهر الفعلي والنهائي لبطاقة الجمعية كما تظهر لزوار المنصة والمتبرعين
              </p>
            </div>
          </div>
        </div>

        {/* ================= SCROLLABLE CONTENT ================= */}
        <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1">

          {/* STATUS EXPLANATION BANNER */}
          {isApproved && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm font-bold text-emerald-950 mb-0.5">الحملة الإعلانية معتمدة ومفعلة حالياً</strong>
                <p className="leading-relaxed text-emerald-800">
                  تمت مراجعة وصل الدفع واعتماد الحملة رسمياً من الإدارة العامة. جمعيتكم تظهر الآن في المرتبة الأولى بقسم تبرع وشارك في مشاريع التنمية بالصفحة الأولى للمنصة.
                </p>
              </div>
            </div>
          )}

          {isPendingReview && (
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex items-start gap-3 text-xs text-sky-900">
              <Clock className="w-5 h-5 text-sky-600 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <strong className="block text-sm font-bold text-sky-950 mb-0.5">الطلب محفوظ في قاعدة البيانات وقيد المراجعة الإدارية</strong>
                <p className="leading-relaxed text-sky-800">
                  تم استلام طلب الحملة بنجاح، وتقوم الإدارة العامة حالياً بالتحقق من بيانات الدفع لتأكيد الظهور. توضح المعاينة أدناه الشكل الدقيق الذي ستظهر به الجمعية لجمهور المنصة فور الاعتماد.
                </p>
              </div>
            </div>
          )}

          {isCorrectionRequested && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3 text-xs text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <strong className="block text-sm font-bold text-amber-950">ملاحظة من الإدارة العامة: مطلوب تصحيح البيانات</strong>
                <p className="leading-relaxed bg-amber-100/80 p-2.5 rounded-xl border border-amber-200/60 font-medium text-amber-900">
                  «{campaignRequest?.correctionNotes || 'يرجى مراجعة تفاصيل الحملة وتحديثها.'}»
                </p>
                {onOpenCorrection && campaignRequest && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCorrection(campaignRequest);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer mt-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل البيانات وإعادة الإرسال الآن</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {isRejected && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-900">
              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm font-bold text-rose-950 mb-0.5">تم رفض هذا الطلب من قبل الإدارة العامة</strong>
                <p className="leading-relaxed text-rose-800 mt-0.5">
                  <strong>سبب الرفض:</strong> {campaignRequest?.rejectionReason || 'تعذر اعتماد الطلب بالصيغة الحالية.'}
                </p>
              </div>
            </div>
          )}

          {isPendingPayment && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm font-bold text-amber-950 mb-0.5">بيانات الحملة مسجلة ومحفوظة كمسودة</strong>
                <p className="leading-relaxed text-amber-800">
                  تم حفظ تفاصيل الحملة بنجاح في قاعدة البيانات. لبدء المراجعة والتدشين الرسمي، يرجى استكمال خطوة تأكيد أداء واجب الإعلان.
                </p>
              </div>
            </div>
          )}

          {/* ================= EXACT LIVE PLATFORM CARD PREVIEW ================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>المعاينة الحية لبطاقة الجمعية في الصفحة الأولى (قسم التبرعات):</span>
              </label>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                أولوية الصدارة #1
              </span>
            </div>

            {/* Container simulating public page grid item */}
            <div className="bg-slate-100/70 p-4 sm:p-6 rounded-3xl border border-slate-200 flex justify-center">
              <div 
                className="w-full max-w-md bg-white rounded-3xl border-2 border-amber-400 ring-4 ring-amber-400/20 shadow-xl overflow-hidden flex flex-col transition-all duration-300"
              >
                {/* Card Banner Image Header */}
                <div className="h-36 bg-slate-900 relative overflow-hidden">
                  <img
                    src={
                      tenant.bannerImageUrl ||
                      'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80'
                    }
                    alt={tenant.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-200" />
                      <span>{campaignTitle}</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm bg-emerald-600 text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>جمعية نشطة</span>
                    </span>
                  </div>

                  {/* Location Badge */}
                  <div className="absolute bottom-3 right-3 text-white text-xs font-bold flex items-center gap-1.5 z-10 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {tenant.city}، {tenant.country}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    {/* Association Logo & Name */}
                    <div className="flex items-center gap-3">
                      {tenant.logoUrl ? (
                        <img 
                          src={tenant.logoUrl} 
                          alt={tenant.name} 
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-200 shrink-0">
                          {tenant.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="text-base font-black text-slate-900 leading-snug">
                          {tenant.name}
                        </h3>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          معتمدة رسمياً
                        </span>
                      </div>
                    </div>

                    {/* Tagline / Mission */}
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 pt-1">
                      {tenant.tagline ||
                        'مبادرات خيرية، دعم الأسر المعوزة، وتنفيذ مشاريع تنموية مستدامة بالمنطقة.'}
                    </p>
                  </div>

                  {/* Stats Ribbon */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">
                        حملات التبرع
                      </span>
                      <span className="text-xs font-black text-emerald-700">
                        {stats.campaignsCount ?? 2} حملات
                      </span>
                    </div>
                    <div className="border-x border-slate-200/80">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        الأنشطة
                      </span>
                      <span className="text-xs font-black text-slate-700">
                        {stats.activitiesCount ?? 5} أنشطة
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">
                        الأعضاء
                      </span>
                      <span className="text-xs font-black text-slate-700">
                        {stats.membersCount ?? 14} عضو
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                    >
                      <HeartHandshake className="w-4 h-4" />
                      <span>تبرع للمشاريع الآن</span>
                    </button>
                    <button
                      type="button"
                      className="py-2.5 px-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 border border-slate-200"
                    >
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>استكشف الجمعية</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ================= SAVED CAMPAIGN DATA IN DATABASE ================= */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>بيانات الحملة المحفوظة فعلياً في قاعدة البيانات:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-slate-500 font-medium block">عنوان الحملة:</span>
                <span className="font-bold text-slate-900 block truncate">{campaignTitle}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-slate-500 font-medium block">مدة الحملة:</span>
                <span className="font-bold text-indigo-700 font-mono block">{monthsCount} شهر</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-slate-500 font-medium block">قيمة الإعلان:</span>
                <span className="font-bold text-emerald-700 font-mono block">
                  {amount.toLocaleString()} {currency}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-slate-500 font-medium block">تاريخ البدء:</span>
                <span className="font-bold text-slate-800 font-mono block">
                  {startDate ? new Date(startDate).toLocaleDateString('ar-MA') : '—'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-slate-500 font-medium block">تاريخ الانتهاء:</span>
                <span className="font-bold text-slate-800 font-mono block">
                  {endDate ? new Date(endDate).toLocaleDateString('ar-MA') : '—'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-slate-500 font-medium block">حالة الدفع والوصل:</span>
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  {paymentStatus === 'confirmed'
                    ? 'مدفوع ومؤكد'
                    : paymentStatus === 'pending_verification'
                    ? 'قيد التحقق من الوصل'
                    : 'بانتظار الدفع'}
                </span>
              </div>

              {campaignRequest?.id && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1 sm:col-span-2 md:col-span-3">
                  <span className="text-slate-500 font-medium block">رقم وتاريخ الطلب:</span>
                  <div className="flex items-center gap-4 text-slate-800 font-mono text-[11px] flex-wrap">
                    <span>الرقم: {campaignRequest.id}</span>
                    {campaignRequest.paymentReference && (
                      <span>مرجع الدفع: {campaignRequest.paymentReference}</span>
                    )}
                    <span>آخر تحديث: {new Date(campaignRequest.updatedAt || campaignRequest.createdAt).toLocaleString('ar-MA')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>المعاينة للعرض فقط ولا تقوم بإنشاء أو تكرار أي سجلات في قاعدة البيانات.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer w-full sm:w-auto"
            >
              إغلاق المعاينة
            </button>

            {isApproved && onNavigateToPublicDonations && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToPublicDonations();
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer w-full sm:w-auto"
              >
                <ExternalLink className="w-4 h-4" />
                <span>مشاهدة الظهور بالصفحة الأولى</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
