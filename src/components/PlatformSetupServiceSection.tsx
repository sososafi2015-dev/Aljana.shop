import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  CheckCircle2,
  CreditCard,
  Building2,
  Wallet,
  Globe,
  Upload,
  FileCheck,
  Clock,
  AlertCircle,
  Save,
  Copy,
  Check,
  Eye,
  Trash2,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  XCircle,
  Plus,
  RotateCcw,
  FileText,
  Phone,
  User,
  QrCode,
} from 'lucide-react';
import type {
  AssociationTenant,
  CurrentAdminSession,
  PlatformSetupServiceConfig,
  PlatformSetupServiceItem,
  PlatformSetupServiceRequest,
  PlatformSupportSettings,
  SetupServicePaymentStatus,
  SetupServiceExecutionStatus,
} from '../types';
import {
  DEFAULT_SETUP_SERVICE_CONFIG,
  DEFAULT_SETUP_SERVICE_ITEMS,
  getSetupServiceConfigSync,
  fetchSetupServiceConfigFromServer,
  saveSetupServiceConfigPermanent,
  getSetupServiceRequestsSync,
  fetchSetupServiceRequestsFromServer,
  submitSetupServicePaymentRequest,
  updateSetupServiceRequestStatus,
} from '../setupServiceStorage';
import { getPlatformSupportSettings } from '../platformSupportStorage';
import { ensurePermanentImageUrl } from '../api/imageApi';
import { PayPalCheckoutButton } from './PayPalCheckoutButton';
import {
  openNativeReceiptPicker,
  getDeviceReceiptAcceptAttribute,
  normalizeReceiptFileName,
  validateReceiptFile,
  formatFileSize,
} from '../utils/receiptPicker';

interface PlatformSetupServiceSectionProps {
  tenant?: AssociationTenant | null;
  adminSession?: CurrentAdminSession | null;
  isMasterAdminView?: boolean;
  onSaveSuccess?: (config: PlatformSetupServiceConfig) => void;
}

export const PlatformSetupServiceSection: React.FC<PlatformSetupServiceSectionProps> = ({
  tenant,
  adminSession,
  isMasterAdminView = false,
  onSaveSuccess,
}) => {
  const isSuperAdminManager = Boolean(
    isMasterAdminView || adminSession?.isMasterPlatformAdmin
  );

  // Live Config State
  const [config, setConfig] = useState<PlatformSetupServiceConfig>(() => getSetupServiceConfigSync());
  const [draftFeeInput, setDraftFeeInput] = useState<string>(() => String(getSetupServiceConfigSync().serviceFeeMad || 150));
  const [draftTitle, setDraftTitle] = useState<string>(() => getSetupServiceConfigSync().title);
  const [draftIntroText, setDraftIntroText] = useState<string>(() => getSetupServiceConfigSync().introText);
  const [draftServicesHeading, setDraftServicesHeading] = useState<string>(() => getSetupServiceConfigSync().servicesHeading);
  const [draftItems, setDraftItems] = useState<PlatformSetupServiceItem[]>(() => getSetupServiceConfigSync().serviceItems);
  const [draftGoalText, setDraftGoalText] = useState<string>(() => getSetupServiceConfigSync().goalText);

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveBanner, setSaveBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [feeValidationError, setFeeValidationError] = useState<string | null>(null);

  // Platform Support Payment Settings (Reused directly from قسم دعم المنصة)
  const [supportSettings, setSupportSettings] = useState<PlatformSupportSettings>(() => getPlatformSupportSettings());

  // Payment Flow State for Association
  const [showPaymentPanel, setShowPaymentPanel] = useState<boolean>(false);
  const [selectedMethod, setSelectedMethod] = useState<string>('bank_transfer');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptFileSize, setReceiptFileSize] = useState<string>('');
  const [receiptRawFile, setReceiptRawFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState<boolean>(false);
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [applicantName, setApplicantName] = useState<string>(
    tenant?.ownerName || adminSession?.fullName || ''
  );
  const [applicantPhone, setApplicantPhone] = useState<string>(
    tenant?.ownerPhone || adminSession?.phone || ''
  );
  const [requestNotes, setRequestNotes] = useState<string>('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);
  const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Requests State
  const [requests, setRequests] = useState<PlatformSetupServiceRequest[]>(() =>
    getSetupServiceRequestsSync(isSuperAdminManager ? undefined : tenant?.id)
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'verified' | 'completed' | 'rejected'>('all');
  const [previewProofModalUrl, setPreviewProofModalUrl] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [rejectionNotesMap, setRejectionNotesMap] = useState<Record<string, string>>({});

  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync Config & Payment Settings & Requests
  useEffect(() => {
    let mounted = true;

    fetchSetupServiceConfigFromServer().then((serverCfg) => {
      if (!mounted) return;
      setConfig(serverCfg);
      setDraftFeeInput(String(serverCfg.serviceFeeMad));
      setDraftTitle(serverCfg.title);
      setDraftIntroText(serverCfg.introText);
      setDraftServicesHeading(serverCfg.servicesHeading);
      setDraftItems(serverCfg.serviceItems);
      setDraftGoalText(serverCfg.goalText);
    });

    fetchSetupServiceRequestsFromServer(isSuperAdminManager ? undefined : tenant?.id).then((serverReqs) => {
      if (!mounted) return;
      setRequests(serverReqs);
    });

    // Refresh Platform Support payment settings from backend
    fetch('/api/platform-support/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (mounted && data?.settings) {
          setSupportSettings(data.settings);
        }
      })
      .catch(() => {});

    const handleConfigEvent = (e: Event) => {
      const custom = e as CustomEvent<PlatformSetupServiceConfig>;
      if (custom.detail && mounted) {
        setConfig(custom.detail);
      }
    };

    const handleSupportSettingsEvent = () => {
      if (mounted) {
        setSupportSettings(getPlatformSupportSettings());
      }
    };

    const handleRequestsEvent = () => {
      if (mounted) {
        setRequests(getSetupServiceRequestsSync(isSuperAdminManager ? undefined : tenant?.id));
      }
    };

    window.addEventListener('setup-service-config-updated', handleConfigEvent);
    window.addEventListener('platform-support-settings-updated', handleSupportSettingsEvent);
    window.addEventListener('setup-service-requests-updated', handleRequestsEvent);

    return () => {
      mounted = false;
      window.removeEventListener('setup-service-config-updated', handleConfigEvent);
      window.removeEventListener('platform-support-settings-updated', handleSupportSettingsEvent);
      window.removeEventListener('setup-service-requests-updated', handleRequestsEvent);
    };
  }, [isSuperAdminManager, tenant?.id]);

  // Update applicant fields when tenant changes
  useEffect(() => {
    if (tenant?.ownerName && !applicantName) setApplicantName(tenant.ownerName);
    if (tenant?.ownerPhone && !applicantPhone) setApplicantPhone(tenant.ownerPhone);
  }, [tenant?.ownerName, tenant?.ownerPhone]);

  // Build enabled payment methods list from Platform Support settings
  const availablePaymentMethods = React.useMemo(() => {
    const methods: {
      id: string;
      label: string;
      subtitle: string;
      type: 'bank_transfer' | 'cash_plus' | 'credit_card' | 'paypal' | 'custom';
      requiresReceipt: boolean;
      customObj?: any;
    }[] = [];

    if (supportSettings.bankAccount?.enabled) {
      methods.push({
        id: 'bank_transfer',
        label: 'تحويل بنكي (الحساب البنكي)',
        subtitle: supportSettings.bankAccount.bankName || 'إيداع أو تحويل بنكي مباشر',
        type: 'bank_transfer',
        requiresReceipt: true,
      });
    }

    if (supportSettings.cashPlus?.enabled) {
      methods.push({
        id: 'cash_plus',
        label: 'كاش بليس (Cash Plus)',
        subtitle: 'تحويل سريع عبر وكالات أو تطبيق Cash Plus',
        type: 'cash_plus',
        requiresReceipt: true,
      });
    }

    if (supportSettings.creditCard?.enabled) {
      methods.push({
        id: 'credit_card',
        label: 'البطاقة البنكية الإلكترونية',
        subtitle: supportSettings.creditCard.gatewayName || 'Visa / Mastercard / CMI',
        type: 'credit_card',
        requiresReceipt: false,
      });
    }

    if (supportSettings.paypal?.enabled) {
      methods.push({
        id: 'paypal',
        label: 'بايبال (PayPal)',
        subtitle: supportSettings.paypal.email || 'دفع إلكتروني عبر PayPal',
        type: 'paypal',
        requiresReceipt: false,
      });
    }

    if (Array.isArray(supportSettings.customMethods)) {
      for (const cm of supportSettings.customMethods) {
        if (cm && cm.enabled) {
          methods.push({
            id: cm.id,
            label: cm.name,
            subtitle: cm.accountName || cm.instructions || 'طريقة دفع معتمدة',
            type: 'custom',
            requiresReceipt: cm.requiresReceipt !== false,
            customObj: cm,
          });
        }
      }
    }

    return methods;
  }, [supportSettings]);

  // Ensure selectedMethod is valid
  useEffect(() => {
    if (availablePaymentMethods.length > 0 && !availablePaymentMethods.some((m) => m.id === selectedMethod)) {
      setSelectedMethod(availablePaymentMethods[0].id);
    }
  }, [availablePaymentMethods, selectedMethod]);

  const activeMethodObj = availablePaymentMethods.find((m) => m.id === selectedMethod) || availablePaymentMethods[0];

  const handleCopyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Validate fee input on change
  const handleFeeInputChange = (val: string) => {
    setDraftFeeInput(val);
    const num = Number(val);
    if (!val.trim() || !Number.isFinite(num) || num <= 0) {
      setFeeValidationError('يرجى إدخال مبلغ صحيح أكبر من صفر (لا يُسمح بالقيم السالبة أو الصفرية).');
    } else {
      setFeeValidationError(null);
    }
  };

  // Save section settings & service price permanently to database
  const handleSaveConfigChanges = async () => {
    setSaveBanner(null);
    const parsedFee = Number(draftFeeInput);
    if (!draftFeeInput.trim() || !Number.isFinite(parsedFee) || parsedFee <= 0) {
      const errMsg = 'يرجى إدخال مبلغ صحيح وأكبر من صفر لرسوم الخدمة (لا يُسمح بالقيم غير الصالحة أو السالبة).';
      setFeeValidationError(errMsg);
      setSaveBanner({ type: 'error', text: errMsg });
      return;
    }

    const cleanedItems = draftItems
      .map((it, idx) => ({
        id: it.id || `item_${idx + 1}`,
        title: it.title.trim(),
        description: it.description.trim(),
      }))
      .filter((it) => it.title.length > 0);

    if (cleanedItems.length === 0) {
      setSaveBanner({ type: 'error', text: 'يرجى الإبقاء على عنصر واحد على الأقل ضمن قائمة خدمات الإعداد.' });
      return;
    }

    setIsSavingConfig(true);
    try {
      const result = await saveSetupServiceConfigPermanent(
        {
          serviceFeeMad: Math.round(parsedFee * 100) / 100,
          currency: 'MAD',
          title: draftTitle.trim() || DEFAULT_SETUP_SERVICE_CONFIG.title,
          introText: draftIntroText.trim() || DEFAULT_SETUP_SERVICE_CONFIG.introText,
          servicesHeading: draftServicesHeading.trim() || DEFAULT_SETUP_SERVICE_CONFIG.servicesHeading,
          serviceItems: cleanedItems,
          goalText: draftGoalText.trim() || DEFAULT_SETUP_SERVICE_CONFIG.goalText,
        },
        adminSession?.fullName || 'الإدارة العامة للمنصة'
      );

      if (!result.ok) {
        setSaveBanner({
          type: 'error',
          text: result.error || 'حدث خطأ أثناء حفظ التعديلات في قاعدة البيانات.',
        });
      } else {
        setConfig(result.config);
        setDraftFeeInput(String(result.config.serviceFeeMad));
        setSaveBanner({
          type: 'success',
          text: 'تم حفظ التعديلات بنجاح',
        });
        if (onSaveSuccess) {
          onSaveSuccess(result.config);
        }
      }
    } catch (err: any) {
      setSaveBanner({
        type: 'error',
        text: err?.message || 'حدث خطأ غير متوقع أثناء حفظ التعديلات.',
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Restore default explanatory text and 150 MAD price
  const handleRestoreDefaults = () => {
    setDraftFeeInput(String(DEFAULT_SETUP_SERVICE_CONFIG.serviceFeeMad));
    setDraftTitle(DEFAULT_SETUP_SERVICE_CONFIG.title);
    setDraftIntroText(DEFAULT_SETUP_SERVICE_CONFIG.introText);
    setDraftServicesHeading(DEFAULT_SETUP_SERVICE_CONFIG.servicesHeading);
    setDraftItems([...DEFAULT_SETUP_SERVICE_ITEMS]);
    setDraftGoalText(DEFAULT_SETUP_SERVICE_CONFIG.goalText);
    setFeeValidationError(null);
  };

  // Native file picker handler for receipt
  const processSelectedReceiptFile = async (file: File) => {
    const validation = validateReceiptFile(file);
    if (!validation.valid) {
      setPaymentMessage({
        type: 'error',
        text: validation.error || 'صيغة الملف غير مدعومة.',
      });
      return;
    }

    const normalizedName = normalizeReceiptFileName(file);
    setPaymentMessage(null);
    setIsUploadingReceipt(true);
    setReceiptFileName(normalizedName);
    setReceiptFileSize(formatFileSize(file.size));
    setReceiptRawFile(file);

    try {
      const effectiveTenantId = tenant?.id || adminSession?.tenantId || 'setup_service';
      const permanentUrl = await ensurePermanentImageUrl(file, {
        tenantId: effectiveTenantId,
        category: 'setup_receipts',
        fileName: normalizedName,
      });
      setReceiptPreviewUrl(permanentUrl);
    } catch (err: any) {
      console.warn('Direct file upload fallback to DataURL:', err);
      try {
        const reader = new FileReader();
        const dataUrl: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('تعذر قراءة ملف الوصل'));
          reader.readAsDataURL(file);
        });
        const permanentUrl = await ensurePermanentImageUrl(dataUrl, {
          tenantId: tenant?.id || 'setup_service',
          category: 'setup_receipts',
          fileName: normalizedName,
        });
        setReceiptPreviewUrl(permanentUrl);
      } catch (innerErr: any) {
        setPaymentMessage({
          type: 'error',
          text: innerErr?.message || 'حدث خطأ أثناء رفع صورة الوصل. يرجى المحاولة مرة أخرى.',
        });
      }
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleReceiptFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedReceiptFile(file);
    if (e.target) {
      e.target.value = '';
    }
  };

  // Submit setup service payment request
  const handleSubmitServicePayment = async () => {
    setPaymentMessage(null);

    const effectiveTenantId = tenant?.id || adminSession?.tenantId || 'master_preview_tenant';
    const effectiveTenantName = tenant?.name || 'جمعية مسجلة بالمنصة';

    if (!activeMethodObj) {
      setPaymentMessage({ type: 'error', text: 'يرجى اختيار طريقة الدفع أولاً.' });
      return;
    }

    const requiresReceiptUpload =
      activeMethodObj.type === 'bank_transfer' ||
      activeMethodObj.type === 'cash_plus' ||
      activeMethodObj.requiresReceipt;

    if (requiresReceiptUpload && !receiptPreviewUrl) {
      setPaymentMessage({
        type: 'error',
        text: 'يرجى رفع صورة وصل الدفع من معرض الهاتف أو الجهاز لإتمام إرسال الطلب للمراجعة.',
      });
      return;
    }

    setIsSubmittingRequest(true);
    try {
      let finalPermanentReceiptUrl = receiptPreviewUrl;
      if (requiresReceiptUpload && (receiptPreviewUrl.startsWith('data:') || receiptRawFile)) {
        finalPermanentReceiptUrl = await ensurePermanentImageUrl(receiptRawFile || receiptPreviewUrl, {
          tenantId: effectiveTenantId,
          category: 'setup_receipts',
          fileName: receiptFileName || `setup_receipt_${Date.now()}.jpg`,
        });
      }

      if (requiresReceiptUpload && (!finalPermanentReceiptUrl || finalPermanentReceiptUrl.startsWith('data:'))) {
        setPaymentMessage({
          type: 'error',
          text: 'تعذر حفظ صورة الوصل في التخزين الدائم. يرجى التحقق من الاتصال والمحاولة مجدداً.',
        });
        setIsSubmittingRequest(false);
        return;
      }

      const res = await submitSetupServicePaymentRequest({
        tenantId: effectiveTenantId,
        tenantName: effectiveTenantName,
        tenantSlug: tenant?.slug || '',
        tenantCity: tenant?.city || '',
        tenantCountry: tenant?.country || 'المغرب',
        ownerId: tenant?.ownerId || adminSession?.id || '',
        ownerName: applicantName.trim() || tenant?.ownerName || adminSession?.fullName || 'مسؤول الجمعية',
        ownerPhone: applicantPhone.trim() || tenant?.ownerPhone || adminSession?.phone || '',
        amount: config.serviceFeeMad,
        currency: config.currency || 'MAD',
        paymentMethod: activeMethodObj.id,
        paymentMethodLabel: activeMethodObj.label,
        proofDocumentUrl: finalPermanentReceiptUrl,
        proofFileName: receiptFileName,
        transactionReference: transactionRef.trim(),
        notes: requestNotes.trim(),
      });

      if (!res.ok || !res.request) {
        setPaymentMessage({
          type: 'error',
          text: res.error || 'تعذر تسجيل عملية الدفع. يرجى المحاولة مجدداً.',
        });
      } else {
        setPaymentMessage({
          type: 'success',
          text: 'تم رفع وحفظ وصل تسديد مبلغ الخدمة بشكل دائم بنجاح! طلبكم مسجل الآن بحالة «قيد المراجعة» إلى حين التحقق من الدفع من طرف الإدارة العامة.',
        });
        setReceiptPreviewUrl('');
        setReceiptFileName('');
        setReceiptFileSize('');
        setReceiptRawFile(null);
        setTransactionRef('');
        setRequestNotes('');
        const refreshed = await fetchSetupServiceRequestsFromServer(isSuperAdminManager ? undefined : tenant?.id);
        setRequests(refreshed);
      }
    } catch (err: any) {
      setPaymentMessage({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء إرسال الطلب.',
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Admin review action on a request
  const handleAdminUpdateRequest = async (
    reqItem: PlatformSetupServiceRequest,
    nextPaymentStatus: SetupServicePaymentStatus,
    nextServiceStatus: SetupServiceExecutionStatus
  ) => {
    setUpdatingRequestId(reqItem.id);
    try {
      const rejectionReason = rejectionNotesMap[reqItem.id]?.trim() || reqItem.rejectionReason || '';
      const res = await updateSetupServiceRequestStatus({
        requestId: reqItem.id,
        paymentStatus: nextPaymentStatus,
        serviceStatus: nextServiceStatus,
        rejectionReason: nextPaymentStatus === 'rejected' ? rejectionReason || 'لم يتم التحقق من صحة وصل الدفع المرفق' : '',
        reviewedBy: adminSession?.fullName || 'الإدارة العامة للمنصة',
      });

      if (!res.ok) {
        setSaveBanner({
          type: 'error',
          text: res.error || 'تعذر تحديث حالة الطلب.',
        });
      } else {
        const refreshed = await fetchSetupServiceRequestsFromServer(isSuperAdminManager ? undefined : tenant?.id);
        setRequests(refreshed);
      }
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const tenantRequests = React.useMemo(() => {
    if (!tenant?.id) return requests;
    return requests.filter((r) => r.tenantId === tenant.id);
  }, [requests, tenant?.id]);

  const filteredAdminRequests = React.useMemo(() => {
    if (statusFilter === 'all') return requests;
    if (statusFilter === 'pending_review') return requests.filter((r) => r.paymentStatus === 'pending_review');
    if (statusFilter === 'verified') return requests.filter((r) => r.paymentStatus === 'verified' && r.serviceStatus !== 'completed');
    if (statusFilter === 'completed') return requests.filter((r) => r.serviceStatus === 'completed');
    if (statusFilter === 'rejected') return requests.filter((r) => r.paymentStatus === 'rejected' || r.serviceStatus === 'rejected');
    return requests;
  }, [requests, statusFilter]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* ==================== SUPER ADMIN CUSTOMIZATION & SAVE PANEL ==================== */}
      {isSuperAdminManager && (
        <div className="bg-white rounded-2xl border-2 border-emerald-600/30 shadow-md overflow-hidden">
          <div className="bg-gradient-to-l from-emerald-900 via-emerald-800 to-teal-900 px-6 py-5 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
                <Sparkles className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <span className="inline-block text-xs font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30 px-2.5 py-0.5 rounded-md mb-1">
                  إدارة القسم وتخصيص التسعيرة والمحتوى
                </span>
                <h2 className="text-lg md:text-xl font-black text-white">
                  إدارة قسم «{config.title}»
                </h2>
                <p className="text-xs text-emerald-100/90 mt-0.5">
                  تخصيص مبلغ الخدمة الافتراضي ومحتوى القسم وحفظها بشكل دائم في قاعدة البيانات لجميع الجمعيات
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
                title="استعادة القيم الافتراضية (150 درهم والنص الأصلي)"
              >
                <RotateCcw className="w-4 h-4" />
                <span>استعادة الافتراضي</span>
              </button>

              <button
                type="button"
                onClick={handleSaveConfigChanges}
                disabled={isSavingConfig}
                data-testid="save-setup-service-config-btn"
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg transition-all disabled:opacity-60 cursor-pointer"
              >
                {isSavingConfig ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ في قاعدة البيانات...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ التعديلات</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {saveBanner && (
            <div
              className={`px-6 py-3.5 flex items-center justify-between border-b ${
                saveBanner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2.5 font-bold text-sm">
                {saveBanner.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>{saveBanner.text}</span>
              </div>
              <span className="text-xs opacity-75">
                آخر تحديث: {new Date(config.updatedAt).toLocaleString('ar-MA')}
              </span>
            </div>
          )}

          <div className="p-6 space-y-6 bg-slate-50/60">
            {/* Price Customization Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-black text-slate-900">
                    مبلغ خدمة إعداد منصة الجمعية (بالدرهم المغربي MAD)
                  </label>
                  <p className="text-xs text-slate-600">
                    المبلغ الافتراضي يبدأ بـ 150 درهمًا مغربيًا. عند تعديله وحفظه، يُطبّق السعر الجديد تلقائيًا ويظهر لجميع الجمعيات عند فتح القسم.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-48">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={draftFeeInput}
                      onChange={(e) => handleFeeInputChange(e.target.value)}
                      data-testid="setup-service-fee-input"
                      className={`w-full px-4 py-2.5 rounded-xl border-2 font-black text-lg text-left dir-ltr focus:outline-none transition-colors ${
                        feeValidationError
                          ? 'border-rose-400 bg-rose-50 text-rose-900'
                          : 'border-emerald-500 bg-emerald-50/40 text-emerald-950 focus:border-emerald-600'
                      }`}
                      placeholder="150"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      درهم (MAD)
                    </span>
                  </div>

                  <div className="bg-emerald-950 text-white px-4 py-2.5 rounded-xl text-center shrink-0">
                    <span className="block text-[10px] text-emerald-300">السعر المحفوظ حاليًا</span>
                    <span className="font-black text-base">{config.serviceFeeMad} درهم</span>
                  </div>
                </div>
              </div>

              {feeValidationError && (
                <p className="mt-2.5 text-xs font-bold text-rose-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{feeValidationError}</span>
                </p>
              )}
            </div>

            {/* Section Texts Customization */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2.5">
                تخصيص نصوص وعناصر القسم التوضيحية
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان القسم</label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان قائمة الخدمات</label>
                  <input
                    type="text"
                    value={draftServicesHeading}
                    onChange={(e) => setDraftServicesHeading(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الفقرة التمهيدية</label>
                <textarea
                  rows={2}
                  value={draftIntroText}
                  onChange={(e) => setDraftIntroText(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    بنود الخدمة المشمولة ({draftItems.length} بنود)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftItems((prev) => [
                        ...prev,
                        {
                          id: `item_${Date.now()}`,
                          title: 'خدمة إضافية جديدة',
                          description: 'وصف تفصيلي للبند المضاف ضمن خدمة إعداد المنصة.',
                        },
                      ])
                    }
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بند جديد</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {draftItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                    >
                      <div className="md:col-span-4 flex items-center gap-2">
                        <span className="text-base select-none">✅</span>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, title: val } : it))
                            );
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 bg-white"
                          placeholder="عنوان الخدمة"
                        />
                      </div>
                      <div className="md:col-span-7">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, description: val } : it))
                            );
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-white"
                          placeholder="وصف الخدمة"
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setDraftItems((prev) => prev.filter((_, i) => i !== idx))
                          }
                          disabled={draftItems.length <= 1}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                          title="حذف البند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رسالة الهدف الختامية</label>
                <input
                  type="text"
                  value={draftGoalText}
                  onChange={(e) => setDraftGoalText(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Bottom Save Bar inside Admin Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-950/5 border border-emerald-700/20 rounded-xl px-5 py-3.5">
              <div className="text-xs text-slate-700 font-semibold">
                اضغط على زر «حفظ التعديلات» لتثبيت السعر والمحتوى بشكل دائم في قاعدة البيانات وتعميمه فورًا على جميع الجمعيات.
              </div>
              <button
                type="button"
                onClick={handleSaveConfigChanges}
                disabled={isSavingConfig}
                className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingConfig ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MAIN EXPLANATORY CONTENT & SERVICE FEE CARD ==================== */}
      <div
        id="setup-service-content-card"
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-l from-slate-900 via-emerald-950 to-slate-900 px-6 py-7 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>خدمة التجهيز المتكامل لمنصة الجمعية</span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">
                {config.title}
              </h1>

              <p className="text-sm md:text-base text-slate-100 leading-relaxed font-medium">
                {config.introText}
              </p>
            </div>

            {/* Primary CTA Box (Fee & payment details hidden until requested) */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 min-w-[260px] text-center shrink-0 space-y-3">
              <span className="block text-xs font-bold text-emerald-200">
                طلب خدمة الإعداد الشامل للمنصة
              </span>
              <span className="block text-[11px] text-slate-300 leading-relaxed">
                اضغط على الزر أدناه لعرض رسوم الخدمة وطرق الدفع المعتمدة وإتمام الطلب
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentPanel(true);
                  setTimeout(() => {
                    const el = document.getElementById('setup-service-payment-box');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 60);
                }}
                data-testid="open-setup-service-payment-btn"
                className="w-full py-3 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>تسديد مبلغ الخدمة</span>
              </button>
              {showPaymentPanel && (
                <button
                  type="button"
                  onClick={() => setShowPaymentPanel(false)}
                  className="w-full py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-300" />
                  <span>إغلاق واجهة الدفع</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Checklist Content Body */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg md:text-xl font-black text-slate-900">
              {config.servicesHeading}
            </h2>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md">
              {config.serviceItems.length} خدمات أساسية مشمولة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.serviceItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-50/80 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-300/60 transition-all flex items-start gap-3"
              >
                <span className="text-xl leading-none select-none mt-0.5">✅</span>
                <div className="space-y-1 text-sm leading-relaxed">
                  <span className="font-black text-slate-900">{item.title}: </span>
                  <span className="text-slate-700 font-medium">{item.description}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Closing Goal Statement */}
          <div className="p-5 rounded-2xl bg-gradient-to-l from-emerald-50 via-teal-50/70 to-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-base md:text-lg font-black text-emerald-950 leading-relaxed">
              {config.goalText}
            </p>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentPanel(true);
                  setTimeout(() => {
                    const el = document.getElementById('setup-service-payment-box');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 60);
                }}
                data-testid="bottom-open-setup-service-payment-btn"
                className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>تسديد مبلغ الخدمة</span>
              </button>
              {showPaymentPanel && (
                <button
                  type="button"
                  onClick={() => setShowPaymentPanel(false)}
                  className="px-4 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer"
                >
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>إخفاء واجهة الدفع</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== SERVICE FEE PAYMENT INTERFACE (SHOWN ONLY ON DEMAND) ==================== */}
      {showPaymentPanel && (
      <div
        id="setup-service-payment-box"
        data-testid="setup-service-payment-box"
        className="bg-white rounded-2xl border-2 border-emerald-600/25 shadow-sm overflow-hidden animate-in fade-in duration-200"
      >
        <div className="bg-slate-900 px-6 py-4 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-white">
                تسديد مبلغ الخدمة ({config.serviceFeeMad} درهم مغربي)
              </h3>
              <p className="text-xs text-slate-300">
                اختر طريقة الدفع المناسبة لك من طرق الدفع المعتمدة في المنصة، ثم أرفق إثبات الأداء للمراجعة والتفعيل
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
            <div className="bg-emerald-500/20 border border-emerald-400/30 px-4 py-2 rounded-xl text-right sm:text-center">
              <span className="block text-[11px] text-emerald-200">المبلغ المطلوب أداؤه</span>
              <div className="flex items-baseline gap-1">
                <span
                  className="text-lg font-black text-amber-300"
                  data-testid="displayed-setup-service-fee"
                >
                  {config.serviceFeeMad}
                </span>
                <span className="text-xs font-bold text-amber-200">درهم مغربي (MAD)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowPaymentPanel(false);
                const contentEl = document.getElementById('setup-service-content-card');
                if (contentEl) contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              data-testid="close-setup-service-payment-btn"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-rose-500/20 border border-white/20 hover:border-rose-400/40 text-white font-black text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0"
            >
              <XCircle className="w-4 h-4 text-rose-300" />
              <span>إغلاق واجهة الدفع والعودة للقسم</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Association Identity Banner */}
          {tenant && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center">
                  {tenant.name.charAt(0)}
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">الجمعية الطالبة للخدمة:</span>
                  <strong className="text-sm font-black text-slate-900">{tenant.name}</strong>
                </div>
              </div>
              <div className="text-xs text-slate-600 font-semibold">
                معرف الجمعية: <span className="font-mono text-slate-800">{tenant.id}</span>
              </div>
            </div>
          )}

          {/* Step 1: Select Payment Method (Reused from Platform Support Settings) */}
          <div className="space-y-3">
            <label className="block text-sm font-black text-slate-900">
              1. اختر طريقة الدفع المعتمدة:
            </label>

            {availablePaymentMethods.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-bold">
                لا توجد طرق دفع مفعلة حاليًا في إعدادات دعم المنصة. يرجى تفعيل طريقة دفع واحدة على الأقل من قسم دعم المنصة.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {availablePaymentMethods.map((m) => {
                  const isSelected = activeMethodObj?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      className={`p-4 rounded-xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {m.type === 'bank_transfer' ? (
                            <Building2 className="w-5 h-5" />
                          ) : m.type === 'cash_plus' ? (
                            <Wallet className="w-5 h-5" />
                          ) : m.type === 'credit_card' ? (
                            <CreditCard className="w-5 h-5" />
                          ) : (
                            <Globe className="w-5 h-5" />
                          )}
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                      </div>
                      <div>
                        <div className="font-black text-sm text-slate-900">{m.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{m.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Display Payment Details & Instructions for Selected Method */}
          {activeMethodObj && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <h4 className="text-sm font-black text-slate-900">
                  2. بيانات الدفع والتعليمات الخاصة بـ «{activeMethodObj.label}»
                </h4>
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-md">
                  المبلغ الواجب أداؤه: {config.serviceFeeMad} درهم مغربي
                </span>
              </div>

              {/* Bank Transfer Details */}
              {activeMethodObj.type === 'bank_transfer' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-500 block">اسم البنك</span>
                      <strong className="text-sm font-black text-slate-900">
                        {supportSettings.bankAccount.bankName || 'البنك المعتمد للمنصة'}
                      </strong>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-500 block">اسم صاحب الحساب (المستفيد)</span>
                      <strong className="text-sm font-black text-slate-900">
                        {supportSettings.bankAccount.accountHolder || 'الإدارة العامة للمنصة'}
                      </strong>
                    </div>
                  </div>

                  {supportSettings.bankAccount.rib && (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs text-slate-500 block">رقم التعريف البنكي (RIB - 24 رقمًا)</span>
                        <strong className="text-sm md:text-base font-mono font-black text-emerald-900 tracking-wider dir-ltr block">
                          {supportSettings.bankAccount.rib}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(supportSettings.bankAccount.rib, 'rib')}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {copiedField === 'rib' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedField === 'rib' ? 'تم النسخ' : 'نسخ RIB'}</span>
                      </button>
                    </div>
                  )}

                  {supportSettings.bankAccount.iban && (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs text-slate-500 block">رقم IBAN الدولي</span>
                        <strong className="text-sm font-mono font-black text-slate-800 dir-ltr block">
                          {supportSettings.bankAccount.iban}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(supportSettings.bankAccount.iban, 'iban')}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {copiedField === 'iban' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedField === 'iban' ? 'تم النسخ' : 'نسخ IBAN'}</span>
                      </button>
                    </div>
                  )}

                  {supportSettings.bankAccount.additionalInstructions && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-semibold leading-relaxed">
                      {supportSettings.bankAccount.additionalInstructions}
                    </div>
                  )}
                </div>
              )}

              {/* Cash Plus Details */}
              {activeMethodObj.type === 'cash_plus' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-500 block">اسم المستفيد (Cash Plus)</span>
                      <strong className="text-sm font-black text-slate-900">
                        {supportSettings.cashPlus.beneficiaryName || 'الإدارة العامة للمنصة'}
                      </strong>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-500 block">رقم الهاتف المعتمد</span>
                        <strong className="text-sm font-mono font-black text-emerald-900 dir-ltr block">
                          {supportSettings.cashPlus.phone}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(supportSettings.cashPlus.phone, 'cp_phone')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                      >
                        {copiedField === 'cp_phone' ? 'تم النسخ' : 'نسخ'}
                      </button>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-500 block">رقم الحساب أو المرجع</span>
                      <strong className="text-sm font-mono font-black text-slate-900">
                        {supportSettings.cashPlus.accountOrRef || '—'}
                      </strong>
                    </div>
                  </div>

                  {supportSettings.cashPlus.qrCodeEnabled && supportSettings.cashPlus.qrCodeUrl && (
                    <div className="bg-white p-4 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center gap-4">
                      <img
                        src={supportSettings.cashPlus.qrCodeUrl}
                        alt="Cash Plus QR Code"
                        className="w-32 h-32 object-contain rounded-lg border border-slate-200 p-1 bg-white"
                      />
                      <div className="space-y-1 text-center sm:text-right">
                        <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md">
                          <QrCode className="w-4 h-4" />
                          <span>الدفع السريع عبر مسح رمز QR</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {supportSettings.cashPlus.qrCodeInstructions ||
                            'امسح رمز QR عبر تطبيق الهاتف لإتمام تحويل مبلغ الخدمة، ثم ارفع صورة وصل الأداء.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {supportSettings.cashPlus.instructions && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-semibold leading-relaxed">
                      {supportSettings.cashPlus.instructions}
                    </div>
                  )}
                </div>
              )}

              {/* Credit Card Details */}
              {activeMethodObj.type === 'credit_card' && (
                <div className="space-y-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs text-slate-500 block">بوابة الدفع الإلكتروني</span>
                      <strong className="text-sm font-black text-slate-900">
                        {supportSettings.creditCard.gatewayName || 'بوابة البطاقة البنكية المدعومة عبر PayPal'}
                      </strong>
                      <p className="text-xs text-slate-600 mt-1">
                        {supportSettings.creditCard.instructions}
                      </p>
                    </div>
                    {supportSettings.creditCard.paymentUrl && (
                      <a
                        href={supportSettings.creditCard.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-2 shrink-0"
                      >
                        <span>فتح رابط الدفع بالبطاقة</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {!supportSettings.creditCard.paymentUrl && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <PayPalCheckoutButton
                        type="card"
                        amount={config.serviceFeeMad}
                        currency="MAD"
                        purpose="setup_service"
                        tenantId={tenant?.id || adminSession?.tenantId || 'master_preview_tenant'}
                        tenantName={tenant?.name || 'جمعية مسجلة بالمنصة'}
                        supporterName={applicantName || tenant?.name || 'جمعية مسجلة'}
                        supporterPhone={applicantPhone}
                        supporterMessage={`تسديد خدمة إعداد منصة الجمعية: ${tenant?.name || ''}`}
                        onSuccess={async (donation) => {
                          const confirmedRef = donation.paypalOrderId || donation.id;
                          setTransactionRef(confirmedRef);
                          setPaymentMessage({
                            type: 'success',
                            text: `تم تأكيد عملية الدفع بالبطاقة البنكية عبر PayPal بنجاح وتوثيقها في النظام (رقم العملية: ${confirmedRef}). تم تسجيل وتأكيد طلب إعداد المنصة!`,
                          });
                          const refreshed = await fetchSetupServiceRequestsFromServer(isSuperAdminManager ? undefined : tenant?.id);
                          setRequests(refreshed);
                        }}
                        onError={(err) => setPaymentMessage({ type: 'error', text: err })}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* PayPal Details */}
              {activeMethodObj.type === 'paypal' && (
                <div className="space-y-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs text-slate-500 block">حساب PayPal المعتمد</span>
                      <strong className="text-sm font-mono font-black text-slate-900">
                        {supportSettings.paypal.email}
                      </strong>
                      <p className="text-xs text-slate-600 mt-1">{supportSettings.paypal.instructions}</p>
                    </div>
                    {supportSettings.paypal.paymentUrl && (
                      <a
                        href={supportSettings.paypal.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-2 shrink-0"
                      >
                        <span>الدفع عبر PayPal</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <PayPalCheckoutButton
                      type="both"
                      amount={config.serviceFeeMad}
                      currency="MAD"
                      purpose="setup_service"
                      tenantId={tenant?.id || adminSession?.tenantId || 'master_preview_tenant'}
                      tenantName={tenant?.name || 'جمعية مسجلة بالمنصة'}
                      supporterName={applicantName || tenant?.name || 'جمعية مسجلة'}
                      supporterPhone={applicantPhone}
                      supporterMessage={`تسديد خدمة إعداد منصة الجمعية: ${tenant?.name || ''}`}
                      onSuccess={async (donation) => {
                        const confirmedRef = donation.paypalOrderId || donation.id;
                        setTransactionRef(confirmedRef);
                        setPaymentMessage({
                          type: 'success',
                          text: `تم تأكيد عملية الدفع عبر PayPal بنجاح وتوثيقها في النظام (رقم العملية: ${confirmedRef}). تم تسجيل وتأكيد طلب إعداد المنصة!`,
                        });
                        const refreshed = await fetchSetupServiceRequestsFromServer(isSuperAdminManager ? undefined : tenant?.id);
                        setRequests(refreshed);
                      }}
                      onError={(err) => setPaymentMessage({ type: 'error', text: err })}
                    />
                  </div>
                </div>
              )}

              {/* Custom Payment Method Details */}
              {activeMethodObj.type === 'custom' && activeMethodObj.customObj && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeMethodObj.customObj.accountName && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                        <span className="text-xs text-slate-500 block">اسم المستفيد / الحساب</span>
                        <strong className="text-sm font-black text-slate-900">
                          {activeMethodObj.customObj.accountName}
                        </strong>
                      </div>
                    )}
                    {activeMethodObj.customObj.accountNumber && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-500 block">رقم الحساب أو المرجع</span>
                          <strong className="text-sm font-mono font-black text-slate-900">
                            {activeMethodObj.customObj.accountNumber}
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(activeMethodObj.customObj.accountNumber, 'custom_acc')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                        >
                          {copiedField === 'custom_acc' ? 'تم النسخ' : 'نسخ'}
                        </button>
                      </div>
                    )}
                  </div>
                  {activeMethodObj.customObj.instructions && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-semibold">
                      {activeMethodObj.customObj.instructions}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Contact Info, Receipt Upload & Submit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم مسؤول الجمعية للتواصل والتنسيق
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="الاسم الكامل لمسؤول الجمعية"
                  className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم الهاتف / واتساب للتواصل حول إعداد المنصة
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  placeholder="06XXXXXXXX"
                  className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 dir-ltr text-right focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم عملية التحويل أو المرجع (اختياري)
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="مثال: REF-982341"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ملاحظات أو توجيهات خاصة بإعداد منصة جمعيتكم (اختياري)
              </label>
              <input
                type="text"
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="أوقات التواصل المفضلة أو تفاصيل إضافية..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Native File Picker for Payment Proof (Bank Transfer & Cash Plus only) */}
          {(activeMethodObj?.type === 'bank_transfer' ||
            activeMethodObj?.type === 'cash_plus' ||
            activeMethodObj?.requiresReceipt) && (
            <div className="bg-slate-50 p-5 rounded-2xl border-2 border-dashed border-slate-300 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h5 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-700" />
                    <span>إرفاق إثبات تسديد مبلغ الخدمة ({config.serviceFeeMad} درهم)</span>
                  </h5>
                  <p className="text-xs text-slate-600 mt-0.5">
                    ارفع صورة واضحة لوصل التحويل البنكي أو كاش بليس من مدير ملفات جهازك (JPG, JPEG, PNG, WebP, PDF) بدون تشغيل الكاميرا.
                  </p>
                </div>

                <input
                  ref={receiptFileInputRef}
                  type="file"
                  accept={getDeviceReceiptAcceptAttribute()}
                  onClick={(e) => {
                    e.currentTarget.removeAttribute('capture');
                    e.currentTarget.value = '';
                  }}
                  onChange={handleReceiptFileSelected}
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                />

                <button
                  type="button"
                  onClick={() => openNativeReceiptPicker(receiptFileInputRef.current, processSelectedReceiptFile)}
                  disabled={isUploadingReceipt}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {isUploadingReceipt
                      ? 'جاري رفع صورة الوصل...'
                      : receiptPreviewUrl
                      ? 'تغيير صورة الوصل'
                      : 'رفع صورة الوصل من معرض الهاتف أو الجهاز'}
                  </span>
                </button>
              </div>

              {receiptPreviewUrl && (
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {receiptFileName.toLowerCase().endsWith('.pdf') || receiptPreviewUrl.startsWith('data:application/pdf') || receiptPreviewUrl.toLowerCase().includes('.pdf') ? (
                      <div className="w-16 h-16 rounded-xl bg-rose-50 border border-rose-200 flex flex-col items-center justify-center text-rose-600 shrink-0">
                        <FileText className="w-7 h-7" />
                        <span className="text-[9px] font-bold mt-0.5">PDF</span>
                      </div>
                    ) : (
                      <img
                        src={receiptPreviewUrl}
                        alt="معاينة وصل الدفع"
                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-2xs cursor-pointer shrink-0 hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewProofModalUrl(receiptPreviewUrl)}
                      />
                    )}
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                        <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>تم حفظ وإرفاق الوصل بنجاح ✓</span>
                      </div>
                      <span className="text-xs font-bold text-slate-800 block mt-0.5 truncate max-w-xs" title={receiptFileName}>
                        {receiptFileName || 'receipt-file'}
                      </span>
                      {receiptFileSize && (
                        <span className="text-[11px] font-mono text-slate-500 block">
                          {receiptFileSize}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <button
                      type="button"
                      onClick={() => openNativeReceiptPicker(receiptFileInputRef.current, processSelectedReceiptFile)}
                      disabled={isUploadingReceipt}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                      <span>تغيير</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptPreviewUrl('');
                        setReceiptFileName('');
                        setReceiptFileSize('');
                        setReceiptRawFile(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {paymentMessage && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                paymentMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              {paymentMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="text-sm font-bold leading-relaxed">{paymentMessage.text}</div>
            </div>
          )}

          {/* Submit Payment Proof & Close Payment Interface Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                بعد تقديم إثبات الدفع، تُسجّل العملية بحالة «قيد المراجعة» ولا تُعتبر الخدمة مدفوعة أو مكتملة إلا بعد التحقق من الدفع.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentPanel(false);
                  const contentEl = document.getElementById('setup-service-content-card');
                  if (contentEl) contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                data-testid="close-setup-service-payment-footer-btn"
                className="px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <XCircle className="w-4 h-4 text-slate-600" />
                <span>إغلاق واجهة الدفع والعودة للقسم</span>
              </button>

              <button
                type="button"
                onClick={handleSubmitServicePayment}
                disabled={isSubmittingRequest || isUploadingReceipt}
                data-testid="submit-setup-service-request-btn"
                className="px-7 py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-60 cursor-pointer shrink-0"
              >
                {isSubmittingRequest ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري تسجيل طلب الخدمة...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>تسديد مبلغ الخدمة وإرسال إثبات الدفع ({config.serviceFeeMad} درهم)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ==================== ASSOCIATION REQUESTS STATUS TRACKER (FOR TENANT) ==================== */}
      {!isSuperAdminManager && tenantRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-700" />
            <span>حالة طلبات إعداد منصة جمعيتك ({tenantRequests.length})</span>
          </h3>

          <div className="space-y-3">
            {tenantRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-slate-900">
                      طلب إعداد منصة: {req.tenantName}
                    </span>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded">
                      {req.amount} {req.currency === 'MAD' ? 'درهم' : req.currency}
                    </span>
                    <span className="text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded">
                      {req.paymentMethodLabel}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    تاريخ التقديم: {new Date(req.submittedAt).toLocaleString('ar-MA')}
                  </div>
                  {req.rejectionReason && req.paymentStatus === 'rejected' && (
                    <div className="text-xs font-bold text-rose-600 mt-1">
                      سبب الرفض: {req.rejectionReason}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Payment Status Badge */}
                  {req.paymentStatus === 'pending_review' && (
                    <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>حالة الدفع: قيد المراجعة</span>
                    </span>
                  )}
                  {req.paymentStatus === 'verified' && (
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تم التحقق من الدفع</span>
                    </span>
                  )}
                  {req.paymentStatus === 'rejected' && (
                    <span className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 text-xs font-black flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>الدفع مرفوض</span>
                    </span>
                  )}

                  {/* Service Execution Status Badge */}
                  {req.serviceStatus === 'in_progress' && req.paymentStatus === 'verified' && (
                    <span className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-900 border border-blue-300 text-xs font-black">
                      جاري إعداد وتجهيز المنصة
                    </span>
                  )}
                  {req.serviceStatus === 'completed' && req.paymentStatus === 'verified' && (
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-black">
                      مكتمل - تم إعداد المنصة بنجاح
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== GENERAL ADMINISTRATION REQUESTS REVIEW TABLE ==================== */}
      {isSuperAdminManager && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base md:text-lg font-black text-white">
                طلبات الجمعيات لخدمة «سنقوم بإعداد منصة جمعيتك نيابة عنك» ({requests.length})
              </h3>
              <p className="text-xs text-slate-300">
                مراجعة وصولات الدفع المرتبطة بكل جمعية، وتأكيد الدفع ومتابعة حالة تنفيذ الخدمة بشكل مستقل عن حسابات الجمعيات
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all', label: `الكل (${requests.length})` },
                {
                  key: 'pending_review',
                  label: `قيد المراجعة (${requests.filter((r) => r.paymentStatus === 'pending_review').length})`,
                },
                {
                  key: 'verified',
                  label: `قيد التنفيذ (${requests.filter((r) => r.paymentStatus === 'verified' && r.serviceStatus !== 'completed').length})`,
                },
                {
                  key: 'completed',
                  label: `مكتملة (${requests.filter((r) => r.serviceStatus === 'completed').length})`,
                },
                {
                  key: 'rejected',
                  label: `مرفوضة (${requests.filter((r) => r.paymentStatus === 'rejected').length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === tab.key
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {filteredAdminRequests.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm font-semibold">
                لا توجد طلبات مسجلة في هذا التصنيف حاليًا.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAdminRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-black text-slate-900">
                            {req.tenantName}
                          </span>
                          <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                            {req.tenantId}
                          </span>
                          <span className="text-xs font-black bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded">
                            {req.amount} درهم
                          </span>
                          <span className="text-xs font-bold bg-white border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded">
                            {req.paymentMethodLabel}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                          <span>المسؤول: <strong>{req.ownerName}</strong></span>
                          {req.ownerPhone && <span>الهاتف: <strong className="dir-ltr">{req.ownerPhone}</strong></span>}
                          {req.transactionReference && <span>المرجع: <strong>{req.transactionReference}</strong></span>}
                          <span>التاريخ: {new Date(req.submittedAt).toLocaleString('ar-MA')}</span>
                        </div>

                        {req.notes && (
                          <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                            ملاحظات الجمعية: {req.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {req.proofDocumentUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewProofModalUrl(req.proofDocumentUrl || null)}
                            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-emerald-700" />
                            <span>معاينة وصل الدفع</span>
                          </button>
                        )}

                        {req.paymentStatus === 'pending_review' && (
                          <>
                            <button
                              type="button"
                              disabled={updatingRequestId === req.id}
                              onClick={() => handleAdminUpdateRequest(req, 'verified', 'in_progress')}
                              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>تأكيد الدفع والبدء في الإعداد</span>
                            </button>

                            <button
                              type="button"
                              disabled={updatingRequestId === req.id}
                              onClick={() => handleAdminUpdateRequest(req, 'rejected', 'rejected')}
                              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>رفض الدفع</span>
                            </button>
                          </>
                        )}

                        {req.paymentStatus === 'verified' && req.serviceStatus !== 'completed' && (
                          <button
                            type="button"
                            disabled={updatingRequestId === req.id}
                            onClick={() => handleAdminUpdateRequest(req, 'verified', 'completed')}
                            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تحديد الخدمة كمكتملة</span>
                          </button>
                        )}

                        {req.serviceStatus === 'completed' && (
                          <span className="px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تم إكمال إعداد المنصة</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Image Preview Modal */}
      {previewProofModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewProofModalUrl(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="font-black text-sm text-slate-900">معاينة وثيقة إثبات الدفع</h4>
              <button
                type="button"
                onClick={() => setPreviewProofModalUrl(null)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex justify-center bg-slate-900 rounded-xl p-4">
              {previewProofModalUrl.startsWith('data:application/pdf') || previewProofModalUrl.toLowerCase().includes('.pdf') ? (
                <div className="p-8 text-center space-y-3 bg-white rounded-xl w-full">
                  <FileText className="w-12 h-12 text-rose-600 mx-auto" />
                  <p className="font-bold text-slate-800 text-sm">ملف وصل الدفع المرفق (PDF)</p>
                  <a
                    href={previewProofModalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>فتح وعرض ملف الوصل (PDF)</span>
                  </a>
                </div>
              ) : (
                <img
                  src={previewProofModalUrl}
                  alt="إثبات الدفع"
                  className="max-w-full object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
