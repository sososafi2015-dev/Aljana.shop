import React, { useState, useEffect } from 'react';
import {
  X,
  HeartHandshake,
  Check,
  ShieldCheck,
  Building,
  Copy,
  Coins,
  Sparkles,
  AlertCircle,
  FileCheck,
  Layers,
  Edit3,
  CheckCircle2,
  Video,
  Play,
  ChevronDown,
  ChevronUp,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import type { DonationCampaign, ContributionTypeConfig, AssociationSettings, CampaignContribution } from '../types';
import { DEFAULT_DONATION_PRESETS } from '../types';
import { apiSubmitDonationContribution } from '../api/campaignsApi';
import { ensurePermanentImageUrl } from '../api/imageApi';
import { VideoPlayer } from '../utils/videoUtils';

interface CampaignDonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: DonationCampaign | null;
  contributionTypes: ContributionTypeConfig[];
  presetAmounts?: number[];
  settings: AssociationSettings;
  associationId?: string;
  onDonationSuccess: (newContrib: CampaignContribution, updatedCampaign?: DonationCampaign, targetTenantId?: string) => void;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const CampaignDonationModal: React.FC<CampaignDonationModalProps> = ({
  isOpen,
  onClose,
  campaign,
  contributionTypes,
  presetAmounts,
  settings,
  associationId,
  onDonationSuccess,
  addToast = (_type: 'success' | 'error' | 'info', _message: string) => {},
}) => {
  if (!isOpen || !campaign) return null;

  // Active enabled contribution types sorted by admin order
  const activeTypes = (contributionTypes || [])
    .filter((t) => t.enabled !== false && !t.isDeleted && t.showInStore !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const fallbackType: ContributionTypeConfig = {
    id: 'type-charity-donation',
    nameAr: 'مساهمة مالية في إنجاز مشروع عمل خيري',
    isFinancial: true,
    enabled: true,
    isDefault: false,
    descriptionAr: 'تبرع ومساعدة خيرية عامة أو مخصصة لصالح المشروع الخيري',
  };

  const defaultType =
    activeTypes.find((t) => t.isDefault) ||
    activeTypes[0] ||
    fallbackType;

  // Presets resolution
  const availablePresets: number[] =
    presetAmounts && presetAmounts.length > 0
      ? presetAmounts
      : settings.donationPresetAmounts && settings.donationPresetAmounts.length > 0
      ? settings.donationPresetAmounts
      : DEFAULT_DONATION_PRESETS;

  // State
  const [selectedTypeId, setSelectedTypeId] = useState<string>(defaultType.id);
  const [amountMode, setAmountMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<number>(
    availablePresets[0] || 100
  );
  const [customAmountInput, setCustomAmountInput] = useState<string>('');
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);

  const [donorName, setDonorName] = useState<string>('');
  const [donorPhone, setDonorPhone] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'check'>('bank_transfer');
  const [notes, setNotes] = useState<string>('');
  const [proofImagePreview, setProofImagePreview] = useState<string>('');
  const [proofImageUrl, setProofImageUrl] = useState<string>('');
  const [proofFileName, setProofFileName] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);
  const [proofUploadProgress, setProofUploadProgress] = useState<number | null>(null);
  const proofFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedRib, setCopiedRib] = useState<boolean>(false);
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [successReceipt, setSuccessReceipt] = useState<{
    id: string;
    amount: number;
    donorName: string;
    date: string;
    time: string;
    campaignTitle: string;
    typeName: string;
    proofImageUrl?: string;
  } | null>(null);

  // Selected contribution type object
  const currentType =
    activeTypes.find((t) => t.id === selectedTypeId) ||
    (selectedTypeId === fallbackType.id ? fallbackType : defaultType);
  const isFinancial = currentType.isFinancial;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTypeId(defaultType.id);
      setAmountMode('preset');
      setSelectedPreset(availablePresets[0] || 100);
      setCustomAmountInput('');
      setCustomAmountError(null);
      setDonorName('');
      setDonorPhone('');
      setIsAnonymous(false);
      setPaymentMethod('bank_transfer');
      setNotes('');
      setProofImagePreview('');
      setProofImageUrl('');
      setProofFileName('');
      setIsUploadingProof(false);
      setProofUploadProgress(null);
      setShowVideo(false);
      setSuccessReceipt(null);
    }
  }, [isOpen, campaign?.id]);

  // Validation function for custom amount
  const validateCustomAmount = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'يرجى كتابة مبلغ التبرع المطلوب بالدرهم.';
    }
    if (trimmed.includes('-')) {
      return 'لا يمكن إدخال قيم سالبة، يرجى كتابة مبلغ موجب صحيح.';
    }
    const num = Number(trimmed);
    if (isNaN(num)) {
      return 'القيمة المدخلة غير صالحة، يرجى إدخال أرقام صحيحة فقط.';
    }
    if (num <= 0) {
      return 'يجب أن يكون مبلغ التبرع أكبر من صفر (0 درهم).';
    }
    return null;
  };

  const handleSelectPreset = (val: number) => {
    setAmountMode('preset');
    setSelectedPreset(val);
    setCustomAmountError(null);
  };

  const handleSelectCustomMode = () => {
    setAmountMode('custom');
    if (customAmountInput) {
      setCustomAmountError(validateCustomAmount(customAmountInput));
    } else {
      setCustomAmountError(null);
    }
  };

  const handleCustomInputChange = (raw: string) => {
    if (raw.startsWith('-')) return; // strictly block negative input
    setCustomAmountInput(raw);
    const err = validateCustomAmount(raw);
    setCustomAmountError(err);
  };

  // Compute final effective donation amount
  const effectiveAmount: number =
    !isFinancial
      ? 0
      : amountMode === 'preset'
      ? selectedPreset
      : Number(customAmountInput) || 0;

  const isAmountValid =
    !isFinancial ||
    (amountMode === 'preset' && selectedPreset > 0) ||
    (amountMode === 'custom' &&
      customAmountInput.trim() !== '' &&
      !customAmountError &&
      Number(customAmountInput) > 0);

  const handleCopyRib = () => {
    if (settings.ribBank) {
      navigator.clipboard.writeText(settings.ribBank.replace(/\s+/g, ''));
      setCopiedRib(true);
      addToast('info', 'تم نسخ رقم الحساب البنكي (RIB) للحافظة بنجاح.');
      setTimeout(() => setCopiedRib(false), 2500);
    }
  };

  const handleOpenProofFilePicker = () => {
    if (proofFileInputRef.current) {
      proofFileInputRef.current.value = '';
      proofFileInputRef.current.click();
    }
  };

  const handleRemoveProofImage = () => {
    setProofImagePreview('');
    setProofImageUrl('');
    setProofFileName('');
    setIsUploadingProof(false);
    setProofUploadProgress(null);
    if (proofFileInputRef.current) {
      proofFileInputRef.current.value = '';
    }
  };

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const lowerName = (file.name || '').toLowerCase();
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));
    const hasValidMime = validMimeTypes.includes((file.type || '').toLowerCase());

    if (!hasValidMime && !hasValidExt) {
      addToast('error', 'يرجى اختيار صورة بصيغة مدعومة فقط: JPG أو JPEG أو PNG أو WEBP.');
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      addToast('error', 'حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 20 ميجابايت.');
      if (e.target) e.target.value = '';
      return;
    }

    setProofFileName(file.name);

    // Show immediate local preview via FileReader
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);

    // Upload permanently to Firebase Storage / server disk
    const targetAssociationId = campaign?.tenantId || campaign?.associationId || associationId || 'tenant_nour';
    setIsUploadingProof(true);
    setProofUploadProgress(15);
    try {
      const permanentUrl = await ensurePermanentImageUrl(file, {
        category: 'donation_proofs',
        tenantId: targetAssociationId,
        fileName: file.name || 'bank-transfer-proof.jpg',
        recordId: campaign?.id,
        onProgress: (pct) => setProofUploadProgress(pct),
      });
      setProofImageUrl(permanentUrl);
      setProofImagePreview(permanentUrl);
      addToast('success', 'تم إرفاق وحفظ صورة إثبات الدفع بنجاح.');
    } catch (err: any) {
      console.warn('[CampaignDonationModal] Proof image upload warning:', err);
      addToast('error', err?.message || 'تعذر رفع الصورة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsUploadingProof(false);
      setProofUploadProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    if (isFinancial) {
      if (amountMode === 'custom') {
        const err = validateCustomAmount(customAmountInput);
        if (err) {
          setCustomAmountError(err);
          addToast('error', err);
          return;
        }
      }
      if (effectiveAmount <= 0) {
        addToast('error', 'يجب أن يكون مبلغ التبرع أكبر من صفر (0 درهم).');
        return;
      }
    }

    if (!isAnonymous && !donorName.trim()) {
      addToast('error', 'يرجى كتابة اسم المتبرع أو تفعيل خيار "فاعل خير".');
      return;
    }

    const targetAssociationId = campaign.tenantId || campaign.associationId || associationId || 'tenant_nour';
    setIsSubmitting(true);
    try {
      let resolvedProofUrl: string | undefined = undefined;
      if (isFinancial && paymentMethod === 'bank_transfer') {
        const candidateUrl = proofImageUrl || proofImagePreview;
        if (candidateUrl) {
          if (candidateUrl.startsWith('data:') || candidateUrl.startsWith('blob:')) {
            try {
              resolvedProofUrl = await ensurePermanentImageUrl(candidateUrl, {
                category: 'donation_proofs',
                tenantId: targetAssociationId,
                fileName: proofFileName || 'bank-transfer-proof.jpg',
                recordId: campaign.id,
              });
            } catch {
              resolvedProofUrl = candidateUrl;
            }
          } else {
            resolvedProofUrl = candidateUrl;
          }
        }
      }

      const result = await apiSubmitDonationContribution({
        campaignId: campaign.id,
        donorName: isAnonymous ? 'فاعل خير' : donorName.trim(),
        donorPhone: donorPhone.trim() || undefined,
        isAnonymous,
        contributionTypeId: currentType.id,
        amount: effectiveAmount,
        notes: notes.trim() || undefined,
        paymentMethod: isFinancial ? paymentMethod : undefined,
        proofImageUrl: resolvedProofUrl,
        receiptUrl: resolvedProofUrl,
        tenantId: targetAssociationId,
        associationId: targetAssociationId,
      });

      if (result.success && result.contribution) {
        const resolvedTenant = result.tenantId || targetAssociationId;
        setSuccessReceipt({
          id: result.contribution.id,
          amount: result.contribution.amount,
          donorName: result.contribution.donorName,
          date: result.contribution.date,
          time: result.contribution.time || new Date().toLocaleTimeString('ar-MA'),
          campaignTitle: campaign.title,
          typeName: result.contribution.contributionTypeName,
          proofImageUrl: result.contribution.proofImageUrl || resolvedProofUrl,
        });

        onDonationSuccess(result.contribution, result.campaign, resolvedTenant);

        addToast('success', 'جزاكم الله خيراً! تم تسجيل وتوثيق مساهمتكم بنجاح.');
      } else {
        addToast('error', result.error || 'تعذر تسجيل المساهمة، يرجى المحاولة لاحقاً.');
      }
    } catch (err: any) {
      addToast('error', 'حدث خطأ في الاتصال، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Progress metrics calculation
  const target = campaign.targetAmount || 0;
  const currentCollected = campaign.collectedAmount || 0;
  const remaining = Math.max(0, target - currentCollected);
  const percent = target > 0 ? Math.min(100, Math.round((currentCollected / target) * 100)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-5 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <HeartHandshake className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {campaign.targetProject || 'مشروع خيري مستهدف'}
                </span>
                <span className="text-xs text-emerald-200 font-medium">حملة تبرع رسمية</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold line-clamp-1">{campaign.title}</h2>
            </div>
          </div>

          {/* Quick Progress Bar in Header */}
          <div className="mt-4 pt-3 border-t border-white/15">
            <div className="flex items-center justify-between text-xs text-emerald-100 mb-1.5 font-medium">
              <span>
                تم جمع: <strong className="text-white">{currentCollected.toLocaleString()} {settings.currency || 'درهم'}</strong>
              </span>
              <span>
                الهدف: <strong className="text-white">{target.toLocaleString()} {settings.currency || 'درهم'}</strong>
              </span>
              <span className="font-bold text-amber-300">{percent}%</span>
            </div>
            <div className="w-full bg-black/25 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-emerald-300 h-full rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            {remaining > 0 && (
              <div className="text-[11px] text-emerald-200/80 mt-1 text-left">
                المتبقي لاكتمال المشروع: {remaining.toLocaleString()} {settings.currency || 'درهم'}
              </div>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {successReceipt ? (
            /* Success Receipt Screen */
            <div className="text-center py-6 space-y-5 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border-4 border-emerald-200 dark:border-emerald-800">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  تقبل الله منكم صالح الأعمال!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  تم تسجيل مساهمتكم الكريمة في الحملة وتحديث رصيد المشروع بنجاح.
                </p>
              </div>

              {/* Printable Receipt Card */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-right space-y-3 max-w-md mx-auto shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      إيصال مساهمة تبرع
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">#{successReceipt.id.slice(-8)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">المشروع / الحملة:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{successReceipt.campaignTitle}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">المتبرع:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{successReceipt.donorName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">نوع المساهمة:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{successReceipt.typeName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">التاريخ والوقت:</span>
                    <span className="text-slate-700 dark:text-slate-300">{successReceipt.date} - {successReceipt.time}</span>
                  </div>
                </div>

                {successReceipt.amount > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">مبلغ التبرع:</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {successReceipt.amount.toLocaleString()} {settings.currency || 'درهم'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  العودة للحملات
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessReceipt(null);
                    setAmountMode('preset');
                    setSelectedPreset(availablePresets[0] || 100);
                    setCustomAmountInput('');
                  }}
                  className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-all cursor-pointer"
                >
                  تقديم مساهمة أخرى
                </button>
              </div>
            </div>
          ) : (
            /* Donation Form */
            <div className="space-y-6">
              {/* Optional Promotional Campaign Video Teaser */}
              {campaign?.videoUrl && (
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setShowVideo(!showVideo)}
                    className="w-full p-3.5 flex items-center justify-between text-right hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-rose-600/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <Play className="w-4 h-4 fill-current translate-x-0.5" />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                          مشاهدة الفيديو التعريفي للمشروع
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          شاهد أهداف وتفاصيل الحملة الميدانية بالفيديو
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-bold">
                      <span>{showVideo ? 'إخفاء' : 'تشغيل الفيديو'}</span>
                      {showVideo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>
                  {showVideo && (
                    <div className="p-3 bg-black border-t border-slate-200 dark:border-slate-700">
                      <div className="rounded-xl overflow-hidden shadow-md">
                        <VideoPlayer
                          url={campaign.videoUrl}
                          title={campaign.title}
                          aspectRatio="video"
                          showPlatformBadge={true}
                          autoPlay={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. Contribution Type Section (نوع المساهمة المالية الموجودة بالنضام) */}
              <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>نوع المساهمة المالية الموجودة بالنضام</span>
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    اختر نوع المساهمة
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeTypes.map((type) => {
                    const isSelected = selectedTypeId === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setSelectedTypeId(type.id)}
                        className={`p-3.5 rounded-xl border text-right transition-all flex items-start justify-between cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex-1 pl-2">
                          <div className="font-bold text-sm flex items-center gap-1.5">
                            {type.nameAr}
                            {type.isDefault && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 font-semibold">
                                افتراضي
                              </span>
                            )}
                          </div>
                          {type.descriptionAr ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {type.descriptionAr}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                              {type.isFinancial ? 'مساهمة مالية نقدية' : 'مساهمة عينية / لوجستية'}
                            </p>
                          )}
                          <div className="mt-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              type.isFinancial
                                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                                : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                            }`}>
                              {type.isFinancial ? 'مساهمة مالية' : 'مساهمة عينية'}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 flex-shrink-0 ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Choose Donation Amount (اختر مبلغ التبرع) */}
              {isFinancial && (
                <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Coins className="w-5 h-5 text-amber-500" />
                      <span>اختر مبلغ التبرع</span>
                    </h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                      بالدرهم المغربي ({settings.currency || 'درهم'})
                    </span>
                  </div>

                  {/* Predefined Amounts Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
                    {availablePresets.map((val) => {
                      const isSelected = amountMode === 'preset' && selectedPreset === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleSelectPreset(val)}
                          className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 flex flex-col items-center justify-center gap-0.5 cursor-pointer border ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30 scale-[1.02]'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-750'
                          }`}
                        >
                          <span className="tracking-wide">{val.toLocaleString()}</span>
                          <span className="text-[10px] font-normal opacity-80">{settings.currency || 'درهم'}</span>
                        </button>
                      );
                    })}

                    {/* "مبلغ آخر" Option Button */}
                    <button
                      type="button"
                      onClick={handleSelectCustomMode}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 flex flex-col items-center justify-center gap-0.5 cursor-pointer border ${
                        amountMode === 'custom'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-500/30 scale-[1.02]'
                          : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border-dashed border-amber-300 dark:border-amber-700/70 hover:border-amber-500 hover:bg-amber-50/60 dark:hover:bg-amber-950/30'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>مبلغ آخر</span>
                      </span>
                      <span className="text-[10px] font-normal opacity-80">تحديد مبلغ يدوي</span>
                    </button>
                  </div>

                  {/* Custom Amount Input Field (revealed when amountMode === 'custom') */}
                  {amountMode === 'custom' && (
                    <div className="pt-2 animate-fadeIn">
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border-2 border-amber-500/80 dark:border-amber-500/80 shadow-sm space-y-2">
                        <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                          أدخل مبلغ التبرع:
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            autoFocus
                            value={customAmountInput}
                            onChange={(e) => handleCustomInputChange(e.target.value)}
                            placeholder="أدخل مبلغ التبرع المطلوب بالدرهم..."
                            className={`w-full text-lg sm:text-xl font-bold p-3 pl-20 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none transition-all ${
                              customAmountError
                                ? 'border-rose-500 ring-2 ring-rose-400/20'
                                : 'border-slate-300 dark:border-slate-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                            }`}
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-600 dark:text-slate-300 pointer-events-none">
                            {settings.currency || 'درهم'}
                          </span>
                        </div>

                        {/* Live Validation Guidance */}
                        {customAmountError ? (
                          <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 mt-1">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{customAmountError}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>يجب أن يكون المبلغ قيمة رقمية صحيحة وأكبر من صفر (بدون قيم سالبة).</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Donor Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    بيانات المتبرع
                  </label>
                  {/* Anonymous Donor Checkbox */}
                  <label className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                    />
                    التبرع باسم «فاعل خير» (مجهول الاسم)
                  </label>
                </div>

                {!isAnonymous ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        required={!isAnonymous}
                        value={donorName}
                        onChange={(e) => setDonorName(e.target.value)}
                        placeholder="الاسم الكامل للمتبرع *"
                        className="w-full p-3 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        value={donorPhone}
                        onChange={(e) => setDonorPhone(e.target.value)}
                        placeholder="رقم الواتساب (توصل بحسابك، توصل بالدعاء)"
                        className="w-full p-3 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>سيتم إخفاء اسمك وعرض مساهمتك في قائمة المتبرعين تحت اسم «فاعل خير».</span>
                  </div>
                )}
              </div>

              {/* 4. Payment Method & Association Bank Info */}
              {isFinancial && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-800 dark:text-slate-200 block">
                    طريقة دفع المساهمة
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'bank_transfer', label: 'تحويل بنكي', desc: 'عبر تطبيق البنك' },
                      { id: 'cash', label: 'نقداً', desc: 'بمقر الجمعية' },
                      { id: 'check', label: 'شيك بنكي', desc: 'باسم الجمعية' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          paymentMethod === m.id
                            ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 bg-white dark:bg-slate-800'
                        }`}
                      >
                        <span className="text-xs sm:text-sm block font-semibold">{m.label}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{m.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Bank Details Display */}
                  {paymentMethod === 'bank_transfer' && (
                    <div className="space-y-3 mt-2">
                      {settings.ribBank && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-emerald-600" />
                              الحساب البنكي الرسمي للجمعية ({settings.bankName}):
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyRib}
                              className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-semibold"
                            >
                              {copiedRib ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedRib ? 'تم النسخ!' : 'نسخ رقم الحساب'}
                            </button>
                          </div>
                          <div className="font-mono font-bold text-slate-900 dark:text-white text-sm bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 tracking-wider text-center select-all">
                            {settings.ribBank}
                          </div>
                        </div>
                      )}

                      {/* Optional Payment Proof Upload Field (Shown ONLY when bank_transfer is selected) */}
                      <div className="p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span>إرفاق صورة إثبات الدفع (اختياري)</span>
                          </label>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            JPG, JPEG, PNG, WEBP
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          يمكنك إرفاق صورة وصل التحويل البنكي من معرض الصور أو ملفات جهازك لتوثيق العملية، أو إتمام التبرع مباشرة دون إرفاق صورة.
                        </p>

                        {/* Hidden File Picker Input - Strictly NO capture attribute so it opens File Manager / Gallery directly */}
                        <input
                          ref={proofFileInputRef}
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          onChange={handleProofFileChange}
                          className="hidden"
                        />

                        {!proofImagePreview ? (
                          <button
                            type="button"
                            onClick={handleOpenProofFilePicker}
                            disabled={isUploadingProof}
                            className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 bg-white dark:bg-slate-800/90 hover:bg-emerald-50/60 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                          >
                            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>رفع صورة</span>
                          </button>
                        ) : (
                          <div className="space-y-2.5 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 max-h-48 flex items-center justify-center">
                              <img
                                src={proofImagePreview}
                                alt="معاينة إثبات الدفع"
                                className="max-h-48 w-auto object-contain mx-auto"
                              />
                              {isUploadingProof && (
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-2xs flex flex-col items-center justify-center text-white text-xs font-bold gap-1.5">
                                  <span>جاري حفظ الصورة... {proofUploadProgress ? `${proofUploadProgress}%` : ''}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold truncate flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{proofFileName || 'تم إرفاق صورة إثبات الدفع'}</span>
                              </span>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={handleOpenProofFilePicker}
                                  disabled={isUploadingProof}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>تغيير الصورة</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRemoveProofImage}
                                  disabled={isUploadingProof}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1 transition cursor-pointer border border-rose-200/60 dark:border-rose-800/50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>حذف الصورة</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. Notes - hidden if bank transfer is selected */}
              {(!isFinancial || paymentMethod !== 'bank_transfer') && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    ملاحظة إضافية (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="وقت تسليم، توصل بي موقع مقر الجمعية..."
                    className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !isAmountValid}
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold text-base shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>جاري معالجة وتوثيق التبرع...</span>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-amber-300" />
                      <span>
                        تأكيد التبرع والمساهمة
                        {isFinancial && effectiveAmount > 0
                          ? ` (${effectiveAmount.toLocaleString()} ${settings.currency || 'درهم'})`
                          : ''}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
