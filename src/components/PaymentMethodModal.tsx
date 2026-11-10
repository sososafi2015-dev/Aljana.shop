import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Building2, 
  Wallet, 
  CreditCard, 
  CheckCircle2, 
  Upload, 
  Copy, 
  Check, 
  AlertCircle, 
  Lock, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight,
  ExternalLink,
  DollarSign,
  Globe,
  Smartphone,
  HelpCircle,
  QrCode,
  Eye,
  Download,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Send,
  ZoomIn
} from 'lucide-react';
import { AssociationTenant, PaymentMethod, PlatformSupportSettings, CustomSupportPaymentMethod, SupportedCurrency, TenantPaymentRecord } from '../types';
import { 
  getActivationFeeForCountry, 
  submitTenantPayment,
  getAllTenantPayments,
  saveAllTenantPayments
} from '../paymentStorage';
import { getAllTenants, saveAllTenants } from '../tenantStorage';
import { getPlatformSupportSettings } from '../platformSupportStorage';
import { PayPalCheckoutButton } from './PayPalCheckoutButton';
import { ensurePermanentImageUrl } from '../api/imageApi';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { 
  openNativeReceiptPicker, 
  validateReceiptFile, 
  getDeviceReceiptAcceptAttribute,
  normalizeReceiptFileName,
  formatFileSize 
} from '../utils/receiptPicker';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: AssociationTenant;
  onPaymentSubmitted: () => void;
  mode?: 'activation' | 'renewal' | 'ad_campaign';
  initialMethod?: PaymentMethod | null;
  customAmount?: number;
  customCurrency?: SupportedCurrency;
  adCampaignData?: {
    startDate: string;
    endDate: string;
    monthsCount: number;
    campaignTitle?: string;
    campaignBannerUrl?: string;
  };
}

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  onClose,
  tenant,
  onPaymentSubmitted,
  mode = 'activation',
  initialMethod = null,
  customAmount,
  customCurrency,
  adCampaignData,
}) => {
  const isRenewal = mode === 'renewal';
  const isAdCampaign = mode === 'ad_campaign';

  // Unified settings directly from platformSupportStorage (Single source of truth)
  const [settings, setSettings] = useState<PlatformSupportSettings>(() => getPlatformSupportSettings());

  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail) {
        setSettings(e.detail);
      } else {
        setSettings(getPlatformSupportSettings());
      }
    };
    window.addEventListener('platform-support-settings-updated', handler);
    return () => window.removeEventListener('platform-support-settings-updated', handler);
  }, []);

  const defaultFeeInfo = getActivationFeeForCountry(tenant.country);

  const effectiveAmount = customAmount !== undefined ? customAmount : defaultFeeInfo.amount;
  const effectiveCurrency = customCurrency || defaultFeeInfo.currency;
  const formattedFee = customAmount !== undefined 
    ? `${effectiveAmount.toLocaleString()} ${effectiveCurrency}` 
    : defaultFeeInfo.formatted;

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(initialMethod);
  const [step, setStep] = useState<'select' | 'details' | 'success'>(initialMethod ? 'details' : 'select');

  // Sync if initialMethod changes while modal is open
  useEffect(() => {
    if (initialMethod) {
      setSelectedMethod(initialMethod);
      setStep('details');
    }
  }, [initialMethod]);

  // Form states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<{ name: string; url: string; size: string; file?: File } | null>(() => {
    try {
      const cached = sessionStorage.getItem(`chayef_temp_payment_proof_${tenant.id}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [txnRef, setTxnRef] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPayPalConfirmedSuccess, setIsPayPalConfirmedSuccess] = useState(false);
  const [confirmedPeriodInfo, setConfirmedPeriodInfo] = useState<{ periodStart?: string; periodEnd?: string; ref?: string } | null>(null);

  // Native Gallery / File Input References (no camera invocation)
  const bankFileInputRef = useRef<HTMLInputElement | null>(null);
  const cashPlusFileInputRef = useRef<HTMLInputElement | null>(null);
  const customFileInputRef = useRef<HTMLInputElement | null>(null);

  // Save preview data to sessionStorage when changed (excluding non-serializable File)
  const updateProofFile = (fileData: { name: string; url: string; size: string; file?: File } | null) => {
    setProofFile(fileData);
    try {
      if (fileData) {
        sessionStorage.setItem(
          `chayef_temp_payment_proof_${tenant.id}`,
          JSON.stringify({
            name: fileData.name,
            url: fileData.url,
            size: fileData.size,
          })
        );
      } else {
        sessionStorage.removeItem(`chayef_temp_payment_proof_${tenant.id}`);
      }
    } catch (e) {
      console.warn('Could not save proof to sessionStorage:', e);
    }
  };

  // Credit card inputs (Never saved permanently!)
  const [cardHolder, setCardHolder] = useState(tenant.ownerName || '');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  /**
   * Directly handles receipt image or saved file selection from device gallery or file manager
   * across Android, iPhone, Tablet, and Desktop.
   * Permits JPG, JPEG, PNG, WebP (and saved PDF receipts) up to 20MB.
   * Strictly NO camera activation.
   */
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    processSelectedReceiptFile(file);
    if (e.target) e.target.value = '';
  };

  const processSelectedReceiptFile = (file: File) => {
    const validation = validateReceiptFile(file);
    if (!validation.valid) {
      setErrorMessage(
        validation.error || 'صيغة الملف غير مدعومة. يرجى اختيار صورة لوصل الدفع (JPG, JPEG, PNG, WebP) أو ملف PDF من جهازك.'
      );
      return;
    }

    const normalizedName = normalizeReceiptFileName(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      updateProofFile({
        name: normalizedName,
        url: dataUrl,
        size: formatFileSize(file.size),
        file,
      });
      setErrorMessage('');
      setUploadProgress(0);
    };
    reader.onerror = () => {
      setErrorMessage('تعذر قراءة ملف الوصل المختار من جهازك.');
    };
    reader.readAsDataURL(file);
  };

  const handleReceiptDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedReceiptFile(file);
    }
  };

  const handleRemoveReceipt = () => {
    updateProofFile(null);
    setUploadProgress(0);
    if (bankFileInputRef.current) bankFileInputRef.current.value = '';
    if (cashPlusFileInputRef.current) cashPlusFileInputRef.current.value = '';
    if (customFileInputRef.current) customFileInputRef.current.value = '';
  };

  const handleSelectMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setErrorMessage('');
    setTxnRef('');
    setStep('details');
  };

  const handleFillSandboxCard = () => {
    setCardHolder(tenant.ownerName || 'محمد العلمي');
    setCardNumber('4242 •••• •••• 4242');
    setCardExpiry('12/28');
    setCardCvv('888');
  };

  // Find active custom method if selectedMethod matches one
  const selectedCustomMethod = settings.customMethods.find(
    (m) => m.id === selectedMethod || `custom_${m.id}` === selectedMethod
  );

  const handleSubmitPayment = async () => {
    if (!selectedMethod) return;
    setErrorMessage('');
    setIsSubmitting(true);
    setUploadProgress(10);

    try {
      // Validate inputs depending on method
      const isBankOrCash = selectedMethod === 'bank_transfer' || selectedMethod === 'cash_plus';
      const isCustomRequiringProof = selectedCustomMethod && selectedCustomMethod.requiresReceipt !== false;

      if ((isBankOrCash || isCustomRequiringProof) && !proofFile) {
        setErrorMessage('يرجى اختيار صورة وصل الدفع من معرض الهاتف أو الجهاز للمتابعة.');
        setIsSubmitting(false);
        return;
      }

      // Permanent file storage upload for bank transfer / cash plus / custom
      let permanentProofUrl: string | undefined = undefined;

      if (proofFile) {
        try {
          setUploadProgress(25);
          const fileToUpload = proofFile.file || proofFile.url;
          permanentProofUrl = await ensurePermanentImageUrl(fileToUpload, {
            tenantId: tenant.id,
            category: 'receipts',
            fileName: proofFile.name || `receipt_${Date.now()}.jpg`,
            onProgress: (percent) => {
              setUploadProgress(Math.max(25, Math.min(95, percent)));
            },
          });

          if (!permanentProofUrl || permanentProofUrl.startsWith('data:')) {
            throw new Error('فشل الحصول على رابط التخزين الدائم للوصل.');
          }
          setUploadProgress(95);
        } catch (uploadErr: any) {
          console.error('[PaymentMethodModal] Permanent upload failed:', uploadErr);
          setErrorMessage('تعذر رفع صورة الوصل إلى التخزين الدائم. يرجى التحقق من جودة الاتصال والمحاولة مجدداً.');
          setIsSubmitting(false);
          return;
        }
      }

      if (selectedMethod === 'credit_card') {
        if (!cardHolder.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvv.trim()) {
          setErrorMessage('يرجى إكمال جميع بيانات البطاقة البنكية للمتابعة.');
          setIsSubmitting(false);
          return;
        }
        // Small delay to simulate secure 3D-Secure / payment gateway handshake
        await new Promise((resolve) => setTimeout(resolve, 1400));
      }

      if (selectedMethod === 'paypal') {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // Extract last 4 digits only if credit card - STRICTLY NEVER STORE FULL CARD OR CVV
      let last4: string | undefined;
      if (selectedMethod === 'credit_card') {
        const cleanDigits = cardNumber.replace(/\D/g, '');
        last4 = cleanDigits.slice(-4) || '4242';
      }

      const generatedRef = txnRef.trim() || (
        selectedMethod === 'credit_card' 
          ? `CC-${Date.now().toString().slice(-6)}` 
          : selectedMethod === 'paypal' 
          ? `PP-${Date.now().toString().slice(-6)}` 
          : `${isAdCampaign ? 'AD' : isRenewal ? 'RNW' : 'DEP'}-${Date.now().toString().slice(-6)}`
      );

      const result = submitTenantPayment({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        ownerId: tenant.ownerId,
        ownerName: tenant.ownerName,
        ownerPhone: tenant.ownerPhone,
        amount: effectiveAmount,
        currency: effectiveCurrency,
        country: tenant.country,
        paymentMethod: selectedMethod,
        type: isAdCampaign ? 'ad_campaign' : isRenewal ? 'renewal' : 'activation',
        periodStart: adCampaignData?.startDate,
        periodEnd: adCampaignData?.endDate,
        monthsCount: adCampaignData?.monthsCount,
        adCampaignTitle: adCampaignData?.campaignTitle,
        proofDocumentUrl: permanentProofUrl || proofFile?.url,
        proofFileName: proofFile?.name,
        cardLast4: last4,
        transactionReference: generatedRef,
        adminNotes: notes.trim() || undefined,
      });

      if (!result.success || !result.payment) {
        setErrorMessage(result.error || 'تعذر إرسال طلب الدفع.');
        setIsSubmitting(false);
        return;
      }

      // Confirm backend persistence on server disk & server-side Firestore
      try {
        const backendRes = await fetch('/api/platform-payments/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment: {
              ...result.payment,
              proofDocumentUrl: permanentProofUrl || result.payment.proofDocumentUrl,
            },
          }),
        });
        if (!backendRes.ok) {
          console.warn('[PaymentMethodModal] Backend submit returned non-OK status:', backendRes.status);
        }
      } catch (srvErr) {
        console.warn('[PaymentMethodModal] Backend submit notice:', srvErr);
      }

      // Persist to Cloud Firestore (`tenant_payments` and `tenants` update) with undefined fields stripped
      try {
        const sanitizedPayment = JSON.parse(
          JSON.stringify({
            ...result.payment,
            proofDocumentUrl: permanentProofUrl || result.payment.proofDocumentUrl,
            status: 'pending',
            _updatedAt: new Date().toISOString(),
          })
        );
        await setDoc(doc(db, 'tenant_payments', result.payment.id), sanitizedPayment, { merge: true });

        if (!isRenewal && !isAdCampaign && tenant.status !== 'active') {
          await setDoc(
            doc(db, 'tenants', tenant.id),
            {
              status: 'pending_activation',
              paymentVerified: false,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (fsErr) {
        console.warn('[Firestore] Notice persisting payment to Firestore:', fsErr);
      }

      try {
        sessionStorage.removeItem(`chayef_temp_payment_proof_${tenant.id}`);
      } catch {}

      setUploadProgress(100);
      setStep('success');
      onPaymentSubmitted();
    } catch (err: any) {
      console.error('Error submitting payment:', err);
      setErrorMessage('حدث خطأ أثناء معالجة طلب الدفع وحفظ الوصل. يرجى المحاولة لاحقاً.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const enabledCustomMethods = settings.customMethods.filter((m) => m.enabled);
  const hasAnyMethodEnabled = settings.bankAccount.enabled || 
    settings.cashPlus.enabled || 
    settings.creditCard.enabled || 
    settings.paypal.enabled || 
    enabledCustomMethods.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-l from-indigo-700 via-indigo-800 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 left-5 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <CreditCard className="w-6 h-6 text-indigo-200" />
            </div>
            <div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-100 border border-indigo-400/30">
                {isAdCampaign ? 'حملة إعلانية مميزة بالصفحة الأولى' : isRenewal ? 'تجديد الاشتراك السنوي' : 'تفعيل المنصة الرسمية'}
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5">
                {step === 'select' && (isAdCampaign ? 'طرق الدفع المعتمدة لتسديد رسوم الإعلان' : isRenewal ? 'اختر طريقة أداء واجب التجديد' : 'اختر طريقة الدفع')}
                {step === 'details' && (isAdCampaign ? 'إتمام عملية دفع الإعلان وتأكيد الطلب' : isRenewal ? 'إتمام عملية أداء واجب التجديد السنوي' : 'إتمام عملية الدفع والتفعيل')}
                {step === 'success' && (isAdCampaign ? 'تم إرسال طلب تدشين الإعلان بنجاح' : isRenewal ? 'تم إرسال طلب تجديد الاشتراك' : 'تم إرسال طلب الدفع')}
              </h2>
            </div>
          </div>

          <p className="text-indigo-100 text-sm leading-relaxed mt-1">
            منصة: <strong>«{tenant.name}»</strong> • {isAdCampaign ? `المبلغ الإجمالي المستحق (${adCampaignData?.monthsCount || 1} أشهر): ` : isRenewal ? 'واجب التجديد السنوي (سنة كاملة): ' : 'رسوم التفعيل المطلوبة: '}
            <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30 font-mono mr-1">
              {formattedFee}
            </span>
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6">

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">تنبيه:</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* STEP 1: METHOD SELECTION */}
          {step === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-700 font-bold">
                  {isAdCampaign 
                    ? 'حدد طريقة الدفع المناسبة لجمعيتكم لأداء رسوم الحملة الإعلانية:' 
                    : 'يرجى تحديد طريقة الدفع المناسبة لكم:'}
                </p>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>طرق دفع موحدة مع إدارة المنصة</span>
                </span>
              </div>

              {!hasAnyMethodEnabled ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-800">لا توجد طرق دفع مفعلة حالياً</p>
                  <p className="text-xs text-slate-500 mt-1">
                    يرجى التواصل مع الإدارة العامة لتفعيل طرق الدفع المعتمدة.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* 1. Bank Transfer */}
                  {settings.bankAccount.enabled && (
                    <button
                      type="button"
                      onClick={() => handleSelectMethod('bank_transfer')}
                      className="group relative p-5 rounded-2xl border-2 text-right transition-all duration-200 border-slate-200 hover:border-indigo-500 hover:shadow-md bg-white hover:bg-indigo-50/20 flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base mb-1">حساب بنكي (Virement)</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          تحويل بنكي مباشر إلى الحساب البنكي الرسمي مع إرفاق الوصل.
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-indigo-600 font-bold">
                        <span>عرض بيانات الحساب البنكي</span>
                        <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    </button>
                  )}

                  {/* 2. Cash Plus */}
                  {settings.cashPlus.enabled && (
                    <button
                      type="button"
                      onClick={() => handleSelectMethod('cash_plus')}
                      className="group relative p-5 rounded-2xl border-2 text-right transition-all duration-200 border-slate-200 hover:border-amber-500 hover:shadow-md bg-white hover:bg-amber-50/20 flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <Wallet className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base mb-1">Cash Plus / كاش بليس</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          الدفع نقداً في أي وكالة كاش بليس بالمغرب عبر رقم المرجع أو الهاتف.
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-amber-600 font-bold">
                        <span>عرض بيانات كاش بليس</span>
                        <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    </button>
                  )}

                  {/* 3. Credit / Debit Card */}
                  {settings.creditCard.enabled && (
                    <button
                      type="button"
                      onClick={() => handleSelectMethod('credit_card')}
                      className="group relative p-5 rounded-2xl border-2 text-right transition-all duration-200 border-slate-200 hover:border-emerald-500 hover:shadow-md bg-white hover:bg-emerald-50/20 flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3 className="font-bold text-slate-800 text-base">بطاقة بنكية</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                            فوري
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          دفع آمن بالبطاقة البنكية المغربية والدولية (Visa / Mastercard / CMI).
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-emerald-600 font-bold">
                        <span>إدخال بيانات البطاقة</span>
                        <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    </button>
                  )}

                  {/* 4. PayPal (Real Integration) */}
                  {settings.paypal.enabled && (
                    <button
                      type="button"
                      onClick={() => handleSelectMethod('paypal')}
                      className="group relative p-5 rounded-2xl border-2 text-right transition-all duration-200 border-slate-200 hover:border-sky-500 hover:shadow-md bg-white hover:bg-sky-50/20 flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <DollarSign className="w-6 h-6" />
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3 className="font-bold text-slate-800 text-base">PayPal & بطاقات دولية</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                            {settings.paypal.mode === 'live' ? 'بوابة حية' : 'تكامل ذكي'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          دفع إلكتروني آمن وفوري عبر حساب PayPal أو البطاقات الدولية المعتمدة.
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-sky-600 font-bold">
                        <span>المتابعة والدفع عبر PayPal</span>
                        <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    </button>
                  )}

                  {/* 5. Custom Methods */}
                  {enabledCustomMethods.map((cm) => (
                    <button
                      key={cm.id}
                      type="button"
                      onClick={() => handleSelectMethod(cm.id)}
                      className="group relative p-5 rounded-2xl border-2 text-right transition-all duration-200 border-slate-200 hover:border-purple-500 hover:shadow-md bg-white hover:bg-purple-50/20 flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          {cm.type === 'bank' ? <Building2 className="w-6 h-6" /> :
                           cm.type === 'wallet' ? <Wallet className="w-6 h-6" /> :
                           cm.type === 'card' ? <CreditCard className="w-6 h-6" /> :
                           cm.type === 'link' ? <ExternalLink className="w-6 h-6" /> :
                           <Globe className="w-6 h-6" />}
                        </div>
                        <h3 className="font-bold text-slate-800 text-base mb-1">{cm.name}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {cm.instructions || 'طريقة دفع معتمدة من إدارة المنصة.'}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-purple-600 font-bold">
                        <span>عرض التفاصيل والدفع</span>
                        <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    </button>
                  ))}

                </div>
              )}

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3 text-xs text-slate-600">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  جميع طرق الدفع موحدة ومؤمنة بالكامل مع الإدارة المركزية. يتم تدقيق العمليات وتفعيل الإعلانات والخدمات فور التأكيد.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: METHOD DETAILS & SUBMISSION */}
          {step === 'details' && selectedMethod && (
            <div className="space-y-6 animate-fade-in">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>تغيير طريقة الدفع</span>
                </button>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  المبلغ المطلوب: <strong className="text-indigo-600">{formattedFee}</strong>
                </span>
              </div>

              {/* METHOD: BANK TRANSFER */}
              {selectedMethod === 'bank_transfer' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      معلومات الحساب البنكي للإدارة
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 block mb-0.5">صاحب الحساب:</span>
                        <span className="font-bold text-slate-800">{settings.bankAccount.accountHolder}</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 block mb-0.5">اسم البنك:</span>
                        <span className="font-bold text-slate-800">{settings.bankAccount.bankName}</span>
                      </div>
                    </div>

                    {/* RIB */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">رقم الحساب / RIB (24 رقماً):</span>
                        <span className="font-mono font-bold text-slate-900 text-sm tracking-wide" dir="ltr">
                          {settings.bankAccount.rib}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(settings.bankAccount.rib, 'rib')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                      >
                        {copiedKey === 'rib' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'rib' ? 'تم النسخ!' : 'نسخ RIB'}
                      </button>
                    </div>

                    {/* IBAN */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">IBAN:</span>
                        <span className="font-mono font-bold text-slate-900 text-sm tracking-wide" dir="ltr">
                          {settings.bankAccount.iban}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(settings.bankAccount.iban, 'iban')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                      >
                        {copiedKey === 'iban' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'iban' ? 'تم النسخ!' : 'نسخ IBAN'}
                      </button>
                    </div>

                    <p className="text-xs text-slate-500 italic bg-amber-50/70 p-3 rounded-xl border border-amber-200/60 text-amber-900">
                      📌 <strong>ملاحظة:</strong> {settings.bankAccount.additionalInstructions}
                    </p>
                  </div>

                  {/* Proof Upload (Bank Transfer) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">
                        إثبات التحويل البنكي (صورة الوصل من معرض الهاتف أو الجهاز) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        <span>مدير الملفات والمعرض فقط (بدون كاميرا)</span>
                      </span>
                    </div>

                    {/* Hidden Native File Input: Opens native file manager directly across Android, iPhone, Tablet, PC without camera */}
                    <input
                      ref={bankFileInputRef}
                      type="file"
                      accept={getDeviceReceiptAcceptAttribute()}
                      onClick={(e) => {
                        e.currentTarget.removeAttribute('capture');
                        e.currentTarget.value = '';
                      }}
                      onChange={handleReceiptFileChange}
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                    />

                    {proofFile ? (
                      /* Receipt Preview Card with 3 Action Buttons */
                      <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm p-4 space-y-3.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-xs font-bold text-slate-800">معاينة وصل التحويل البنكي</span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            جاهز للإرسال والمراجعة ✓
                          </span>
                        </div>

                        {/* Image / File Preview Box */}
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center max-h-64 group">
                          {proofFile.url.startsWith('data:application/pdf') || proofFile.name.toLowerCase().endsWith('.pdf') ? (
                            <div className="py-10 px-6 text-center text-white space-y-2">
                              <ImageIcon className="w-10 h-10 text-indigo-400 mx-auto" />
                              <p className="text-xs font-bold">{proofFile.name}</p>
                              <p className="text-[11px] text-slate-300">ملف وصل الدفع جاهز للإرسال ({proofFile.size})</p>
                            </div>
                          ) : (
                            <>
                              <img
                                src={proofFile.url}
                                alt="معاينة وصل التحويل البنكي"
                                className="max-h-60 w-auto object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
                                onClick={() => setPreviewModalOpen(true)}
                              />
                              <button
                                type="button"
                                onClick={() => setPreviewModalOpen(true)}
                                className="absolute bottom-2.5 left-2.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-colors cursor-pointer shadow-md"
                                title="تكبير ومعاينة الوصل بالحجم الكامل"
                              >
                                <ZoomIn className="w-3.5 h-3.5 text-indigo-300" />
                                <span>معاينة بالحجم الكامل</span>
                              </button>
                            </>
                          )}
                        </div>

                        {/* Details Info */}
                        <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-2 truncate">
                            <ImageIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="font-bold text-slate-800 truncate" title={proofFile.name}>{proofFile.name}</span>
                          </div>
                          <span className="font-mono text-slate-500 shrink-0 font-bold">{proofFile.size}</span>
                        </div>

                        {/* Upload Progress Bar if submitting */}
                        {isSubmitting && (
                          <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-100 space-y-1.5 animate-fade-in">
                            <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                              <span>جاري رفع الوصل إلى التخزين الدائم وحفظ السجل...</span>
                              <span className="font-mono">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-indigo-200/60 rounded-full h-2.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-l from-emerald-500 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* The 3 Required Action Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          {/* Button 1: تغيير الصورة */}
                          <button
                            type="button"
                            onClick={() => openNativeReceiptPicker(bankFileInputRef.current, processSelectedReceiptFile)}
                            disabled={isSubmitting}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                            <span>تغيير الصورة</span>
                          </button>

                          {/* Button 2: حذف الصورة */}
                          <button
                            type="button"
                            onClick={handleRemoveReceipt}
                            disabled={isSubmitting}
                            className="w-full px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>حذف الصورة</span>
                          </button>

                          {/* Button 3: إرسال الوصل */}
                          <button
                            type="button"
                            onClick={handleSubmitPayment}
                            disabled={isSubmitting}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {isSubmitting ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>جاري الإرسال...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>إرسال الوصل</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Pick receipt from phone gallery or device file manager button */
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleReceiptDrop}
                        onClick={() => openNativeReceiptPicker(bankFileInputRef.current, processSelectedReceiptFile)}
                        className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-2xl p-6 text-center transition-all bg-indigo-50/20 cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
                          <ImageIcon className="w-7 h-7" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNativeReceiptPicker(bankFileInputRef.current, processSelectedReceiptFile);
                          }}
                          className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2 active:scale-95 cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>رفع صورة الوصل من معرض الهاتف أو الجهاز</span>
                        </button>
                        <p className="text-xs text-slate-500 mt-2 font-medium">
                          اختر صورة الوصل أو الملف المحفوظ من مدير ملفات جهازك (JPG, JPEG, PNG, WebP, PDF)
                        </p>
                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 shadow-2xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>يفتح مدير الملفات الأصلي للهاتف أو الحاسوب أو اللوحي مباشرة (دون تشغيل الكاميرا)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* METHOD: CASH PLUS */}
              {selectedMethod === 'cash_plus' && (
                <div className="space-y-4">
                  <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-amber-600" />
                      معلومات التحويل والدفع عبر كاش بليس (Cash Plus)
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-amber-200/80">
                        <span className="text-slate-400 block mb-0.5">اسم المستفيد:</span>
                        <span className="font-bold text-slate-800">{settings.cashPlus.beneficiaryName}</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-amber-200/80">
                        <span className="text-slate-400 block mb-0.5">رقم الهاتف:</span>
                        <span className="font-bold text-slate-800 font-mono" dir="ltr">{settings.cashPlus.phone}</span>
                      </div>
                    </div>

                    {/* Account / Reference */}
                    <div className="p-3 bg-white rounded-xl border border-amber-200/80 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">رقم الحساب / المرجع:</span>
                        <span className="font-mono font-bold text-amber-800 text-sm tracking-wide" dir="ltr">
                          {settings.cashPlus.accountOrRef}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(settings.cashPlus.accountOrRef, 'cpRef')}
                        className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                      >
                        {copiedKey === 'cpRef' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'cpRef' ? 'تم النسخ!' : 'نسخ المرجع'}
                      </button>
                    </div>

                    {settings.cashPlus.instructions && (
                      <p className="text-xs text-amber-900 bg-amber-100/60 p-3 rounded-xl border border-amber-200">
                        💡 <strong>تعليمات:</strong> {settings.cashPlus.instructions}
                      </p>
                    )}

                    {/* حقل «الدفع السريع عبر QR Code» (يظهر مباشرةً أسفل حقول معلومات التحويل والدفع عبر كاش بليس) */}
                    {Boolean(settings.cashPlus?.qrCodeEnabled && settings.cashPlus?.qrCodeUrl) && (
                      <div className="flex flex-col sm:flex-row items-center gap-3.5 p-3.5 bg-white rounded-xl border-2 border-amber-300 shadow-2xs">
                        <img
                          src={settings.cashPlus.qrCodeUrl}
                          alt="رمز QR Code كاش بليس"
                          className="w-28 h-28 object-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs shrink-0"
                        />
                        <div className="flex-1 space-y-1.5 text-right w-full sm:w-auto">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <QrCode className="w-3 h-3 text-amber-700" />
                            <span>الدفع السريع عبر QR Code</span>
                          </span>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {settings.cashPlus.qrCodeInstructions || 'امسح رمز الاستجابة السريعة (QR Code) عبر تطبيق كاش بليس في هاتفك لإتمام التحويل والدفع فوراً.'}
                          </p>
                          <div className="pt-1 flex items-center gap-2 flex-wrap">
                            <a
                              href={settings.cashPlus.qrCodeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                              <span>عرض الرمز بالحجم الكامل</span>
                            </a>
                            <a
                              href={settings.cashPlus.qrCodeUrl}
                              download={settings.cashPlus.qrCodeFileName || 'cashplus-qrcode.png'}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-bold transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              <span>تحميل الرمز</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Proof Upload (Cash Plus) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">
                        إثبات وصل كاش بليس (صورة الوصل من معرض الهاتف أو الجهاز) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-amber-700" />
                        <span>مدير الملفات والمعرض فقط (بدون كاميرا)</span>
                      </span>
                    </div>

                    {/* Hidden Native File Input: Opens native file manager directly across Android, iPhone, Tablet, PC without camera */}
                    <input
                      ref={cashPlusFileInputRef}
                      type="file"
                      accept={getDeviceReceiptAcceptAttribute()}
                      onClick={(e) => {
                        e.currentTarget.removeAttribute('capture');
                        e.currentTarget.value = '';
                      }}
                      onChange={handleReceiptFileChange}
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                    />

                    {proofFile ? (
                      /* Receipt Preview Card with 3 Action Buttons */
                      <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-sm p-4 space-y-3.5">
                        <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-xs font-bold text-slate-800">معاينة وصل كاش بليس (Cash Plus)</span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            جاهز للإرسال والمراجعة ✓
                          </span>
                        </div>

                        {/* Image / File Preview Box */}
                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center max-h-64 group">
                          {proofFile.url.startsWith('data:application/pdf') || proofFile.name.toLowerCase().endsWith('.pdf') ? (
                            <div className="py-10 px-6 text-center text-white space-y-2">
                              <ImageIcon className="w-10 h-10 text-amber-400 mx-auto" />
                              <p className="text-xs font-bold">{proofFile.name}</p>
                              <p className="text-[11px] text-slate-300">ملف وصل الدفع جاهز للإرسال ({proofFile.size})</p>
                            </div>
                          ) : (
                            <>
                              <img
                                src={proofFile.url}
                                alt="معاينة وصل كاش بليس"
                                className="max-h-60 w-auto object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
                                onClick={() => setPreviewModalOpen(true)}
                              />
                              <button
                                type="button"
                                onClick={() => setPreviewModalOpen(true)}
                                className="absolute bottom-2.5 left-2.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-colors cursor-pointer shadow-md"
                                title="تكبير ومعاينة الوصل بالحجم الكامل"
                              >
                                <ZoomIn className="w-3.5 h-3.5 text-amber-300" />
                                <span>معاينة بالحجم الكامل</span>
                              </button>
                            </>
                          )}
                        </div>

                        {/* Details Info */}
                        <div className="flex items-center justify-between text-xs bg-amber-50/50 p-2.5 rounded-xl border border-amber-200">
                          <div className="flex items-center gap-2 truncate">
                            <ImageIcon className="w-4 h-4 text-amber-700 shrink-0" />
                            <span className="font-bold text-slate-800 truncate" title={proofFile.name}>{proofFile.name}</span>
                          </div>
                          <span className="font-mono text-slate-500 shrink-0 font-bold">{proofFile.size}</span>
                        </div>

                        {/* Upload Progress Bar if submitting */}
                        {isSubmitting && (
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5 animate-fade-in">
                            <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                              <span>جاري رفع الوصل إلى التخزين الدائم وحفظ السجل...</span>
                              <span className="font-mono">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-amber-200 rounded-full h-2.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-l from-emerald-500 to-amber-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* The 3 Required Action Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          {/* Button 1: تغيير الصورة */}
                          <button
                            type="button"
                            onClick={() => openNativeReceiptPicker(cashPlusFileInputRef.current, processSelectedReceiptFile)}
                            disabled={isSubmitting}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                            <span>تغيير الصورة</span>
                          </button>

                          {/* Button 2: حذف الصورة */}
                          <button
                            type="button"
                            onClick={handleRemoveReceipt}
                            disabled={isSubmitting}
                            className="w-full px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>حذف الصورة</span>
                          </button>

                          {/* Button 3: إرسال الوصل */}
                          <button
                            type="button"
                            onClick={handleSubmitPayment}
                            disabled={isSubmitting}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {isSubmitting ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>جاري الإرسال...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>إرسال الوصل</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Pick receipt from phone gallery or device file manager button */
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleReceiptDrop}
                        onClick={() => openNativeReceiptPicker(cashPlusFileInputRef.current, processSelectedReceiptFile)}
                        className="border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-2xl p-6 text-center transition-all bg-amber-50/30 cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3 shadow-inner">
                          <ImageIcon className="w-7 h-7 text-amber-700" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNativeReceiptPicker(cashPlusFileInputRef.current, processSelectedReceiptFile);
                          }}
                          className="px-6 py-3 rounded-2xl bg-gradient-to-l from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2 active:scale-95 cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>رفع صورة الوصل من معرض الهاتف أو الجهاز</span>
                        </button>
                        <p className="text-xs text-slate-500 mt-2 font-medium">
                          اختر صورة وصل الإيداع أو الملف المحفوظ من مدير ملفات جهازك (JPG, JPEG, PNG, WebP, PDF)
                        </p>
                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white border border-amber-200 text-amber-900 shadow-2xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>يفتح مدير الملفات الأصلي للهاتف أو الحاسوب أو اللوحي مباشرة (دون تشغيل الكاميرا)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* METHOD: CREDIT / DEBIT CARD */}
              {selectedMethod === 'credit_card' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
                    
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-indigo-200 font-semibold">بوابة الدفع الآمنة (3D-Secure)</span>
                      </div>
                      <span className="text-xs font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-indigo-100">
                        CMI / VISA / MC
                      </span>
                    </div>

                    <div className="font-mono text-lg tracking-widest mb-4" dir="ltr">
                      {cardNumber || '•••• •••• •••• ••••'}
                    </div>

                    <div className="flex justify-between items-end text-xs">
                      <div>
                        <span className="text-[10px] text-indigo-300 block mb-0.5">اسم صاحب البطاقة</span>
                        <span className="font-bold tracking-wide">{cardHolder || 'CARDHOLDER NAME'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-300 block mb-0.5">تاريخ الانتهاء</span>
                        <span className="font-mono font-bold">{cardExpiry || 'MM/YY'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleFillSandboxCard}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                    >
                      ⚡ تجربة سريعة (ملء بطاقة اختبار)
                    </button>
                  </div>

                  {/* Card Form */}
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">اسم صاحب البطاقة</label>
                      <input
                        type="text"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        placeholder="الاسم كما هو مدون على البطاقة"
                        className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">رقم البطاقة البنكية (16 رقماً)</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4242 4242 4242 4242"
                        maxLength={19}
                        dir="ltr"
                        className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">تاريخ الانتهاء</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          maxLength={5}
                          dir="ltr"
                          className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm text-center"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">رمز الأمان (CVV)</label>
                        <input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          placeholder="•••"
                          maxLength={4}
                          dir="ltr"
                          className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>حماية مصرفية مشفرة: لا نقوم إطلاقاً بتخزين أرقام بطاقتك أو رمز الأمان على خوادمنا.</span>
                  </div>
                </div>
              )}

              {/* METHOD: PAYPAL (Smart Integration & Buttons) */}
              {selectedMethod === 'paypal' && (
                <div className="space-y-4">
                  <div className="bg-sky-50/70 p-5 rounded-2xl border border-sky-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-sky-600" />
                        الدفع المباشر والآمن عبر PayPal أو البطاقات الدولية
                      </h4>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-sky-100 text-sky-800 border border-sky-200">
                        {settings.paypal.mode === 'live' ? 'وضع حقيقي Live' : 'وضع تجريبي Sandbox'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {settings.paypal.instructions || 'يمكنكم إتمام عملية الدفع مباشرة وبشكل آمن عبر حسابكم على PayPal أو بواسطة البطاقات البنكية الدولية Visa و Mastercard.'}
                    </p>

                    {settings.paypal.email && (
                      <div className="p-3 bg-white rounded-xl border border-sky-200 flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 text-xs block mb-0.5">حساب PayPal الرسمي:</span>
                          <span className="font-mono font-bold text-sky-800 text-sm" dir="ltr">
                            {settings.paypal.email}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(settings.paypal.email, 'ppEmail')}
                          className="px-3 py-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                        >
                          {copiedKey === 'ppEmail' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey === 'ppEmail' ? 'تم النسخ!' : 'نسخ الإيميل'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Real PayPal Smart Buttons */}
                  <div className="bg-white p-5 rounded-2xl border border-sky-200/90 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">بوابة الدفع الفورية (PayPal Smart Buttons):</span>
                      <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تأكيد فوري وآلي</span>
                      </span>
                    </div>

                    <PayPalCheckoutButton
                      amount={effectiveAmount}
                      currency={effectiveCurrency === 'USD' ? 'USD' : 'MAD'}
                      supporterName={tenant.ownerName || tenant.name}
                      supporterPhone={tenant.ownerPhone || ''}
                      supporterMessage={
                        isAdCampaign
                          ? `رسوم الحملة الإعلانية: ${adCampaignData?.campaignTitle || tenant.name}`
                          : `رسوم ${isRenewal ? 'تجديد اشتراك' : 'تفعيل منصة'}: ${tenant.name}`
                      }
                      donorName={tenant.ownerName || tenant.name}
                      donorPhone={tenant.ownerPhone || ''}
                      donorNote={
                        isAdCampaign
                          ? `رسوم الحملة الإعلانية: ${adCampaignData?.campaignTitle || tenant.name}`
                          : `رسوم ${isRenewal ? 'تجديد اشتراك' : 'تفعيل منصة'}: ${tenant.name}`
                      }
                      purpose={isAdCampaign ? 'ad_campaign' : isRenewal ? 'renewal' : 'activation'}
                      tenantId={tenant.id}
                      tenantName={tenant.name}
                      onSuccess={(details: any) => {
                        const orderRef = details.orderId || details.paypalOrderId || details.transactionId || details.id;
                        const periodStart = details.periodStart || new Date().toISOString();
                        const periodEnd = details.periodEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

                        // 1. Update allTenants locally so active status is reflected immediately
                        const allTenants = getAllTenants();
                        const tIdx = allTenants.findIndex((t) => t.id === tenant.id);
                        if (tIdx !== -1) {
                          const curTenant = allTenants[tIdx];
                          const existingHistory = Array.isArray(curTenant.subscriptionStatusHistory)
                            ? curTenant.subscriptionStatusHistory
                            : [];

                          allTenants[tIdx] = {
                            ...curTenant,
                            status: 'active',
                            paymentVerified: true,
                            paymentVerifiedAt: new Date().toISOString(),
                            paymentVerifiedBy: 'PayPal Automated API',
                            subscriptionStartedAt: curTenant.subscriptionStartedAt || periodStart,
                            subscriptionExpiresAt: periodEnd,
                            lastRenewalPaymentId: orderRef,
                            lastRenewalDate: new Date().toISOString(),
                            activationFeePaid: curTenant.activationFeePaid || effectiveAmount,
                            activationFeeDate: curTenant.activationFeeDate || new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            subscriptionStatusHistory: [
                              ...existingHistory,
                              {
                                status: 'active',
                                label: isRenewal ? 'تم تجديد الاشتراك عبر PayPal' : 'تم تفعيل المنصة وتأكيد الدفع عبر PayPal',
                                timestamp: new Date().toISOString(),
                                actor: 'PayPal API Integration',
                                note: `تم تأكيد سداد مبلغ الاشتراك (${effectiveAmount} ${effectiveCurrency}) بنجاح عبر PayPal (مرجع: ${orderRef}).`,
                              },
                            ],
                          };
                          saveAllTenants(allTenants);

                          // Sync with Firestore if initialized
                          try {
                            const tenantDocRef = doc(db, 'tenants', tenant.id);
                            setDoc(tenantDocRef, allTenants[tIdx], { merge: true }).catch(() => {});
                          } catch {}
                        }

                        // 2. Record confirmed payment record locally
                        const allPayments = getAllTenantPayments();
                        const confirmedPayment: TenantPaymentRecord = {
                          id: details.id || `pay_pp_${Date.now()}`,
                          tenantId: tenant.id,
                          tenantName: tenant.name,
                          tenantSlug: tenant.slug,
                          ownerId: tenant.ownerId,
                          ownerName: tenant.ownerName,
                          ownerPhone: tenant.ownerPhone,
                          amount: effectiveAmount,
                          currency: effectiveCurrency,
                          country: tenant.country,
                          paymentMethod: 'paypal',
                          status: 'confirmed',
                          paymentVerified: true,
                          paymentVerifiedAt: new Date().toISOString(),
                          paymentVerifiedBy: 'PayPal Automated Gateway',
                          reviewedAt: new Date().toISOString(),
                          reviewedBy: 'PayPal Automated Gateway',
                          type: isAdCampaign ? 'ad_campaign' : isRenewal ? 'renewal' : 'activation',
                          periodStart,
                          periodEnd,
                          monthsCount: adCampaignData?.monthsCount,
                          adCampaignTitle: adCampaignData?.campaignTitle,
                          createdAt: new Date().toISOString(),
                          submittedAt: new Date().toISOString(),
                          transactionReference: orderRef,
                          adminNotes: `PayPal Order ID: ${orderRef} (Confirmed & Verified by Server)`,
                          statusHistory: [
                            {
                              status: 'confirmed',
                              label: isRenewal ? 'تم تجديد الاشتراك وتأكيد الدفع عبر PayPal' : 'تم تفعيل المنصة وتأكيد الدفع عبر PayPal',
                              timestamp: new Date().toISOString(),
                              actor: 'PayPal API Integration',
                              note: `تم تأكيد سداد مبلغ الاشتراك (${effectiveAmount} ${effectiveCurrency}) بنجاح عبر PayPal.`,
                            },
                          ],
                        };
                        saveAllTenantPayments([
                          confirmedPayment,
                          ...allPayments.filter((p) => p.transactionReference !== orderRef && p.id !== confirmedPayment.id),
                        ]);

                        setConfirmedPeriodInfo({ periodStart, periodEnd, ref: orderRef });
                        setIsPayPalConfirmedSuccess(true);
                        setStep('success');
                        onPaymentSubmitted();
                      }}
                      onError={(err) => {
                        setErrorMessage(err || 'حدث خطأ أثناء معالجة الدفع عبر PayPal.');
                      }}
                    />
                  </div>

                  {/* Fallback Manual Transaction Ref */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                    <label className="block font-bold text-slate-700">
                      أو أدخل رقم المعاملة يدوياً في حال قمت بالتحويل المسبق خارج المنصة عبر PayPal:
                    </label>
                    <input
                      type="text"
                      value={txnRef}
                      onChange={(e) => setTxnRef(e.target.value)}
                      placeholder="مثال: 9AB12345CD67890"
                      dir="ltr"
                      className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              {/* METHOD: CUSTOM METHODS */}
              {selectedCustomMethod && (
                <div className="space-y-4">
                  <div className="bg-purple-50/60 p-5 rounded-2xl border border-purple-200 space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      {selectedCustomMethod.name}
                    </h4>

                    {selectedCustomMethod.instructions && (
                      <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-purple-100">
                        {selectedCustomMethod.instructions}
                      </p>
                    )}

                    {(selectedCustomMethod.accountName || selectedCustomMethod.accountNumber) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {selectedCustomMethod.accountName && (
                          <div className="p-3 bg-white rounded-xl border border-purple-100">
                            <span className="text-slate-400 block mb-0.5">اسم المستفيد / الحساب:</span>
                            <span className="font-bold text-slate-800">{selectedCustomMethod.accountName}</span>
                          </div>
                        )}
                        {selectedCustomMethod.accountNumber && (
                          <div className="p-3 bg-white rounded-xl border border-purple-100 flex items-center justify-between">
                            <div>
                              <span className="text-slate-400 block mb-0.5">الرقم / المعرف / الهاتف:</span>
                              <span className="font-mono font-bold text-purple-900" dir="ltr">{selectedCustomMethod.accountNumber}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(selectedCustomMethod.accountNumber!, 'customRef')}
                              className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 text-xs font-bold cursor-pointer"
                            >
                              {copiedKey === 'customRef' ? 'تم النسخ' : 'نسخ'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedCustomMethod.paymentUrl && (
                      <div className="pt-2">
                        <a
                          href={selectedCustomMethod.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors shadow-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>فتح رابط الدفع المباشر ({selectedCustomMethod.name})</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Proof Upload if Required (Custom Method) */}
                  {selectedCustomMethod.requiresReceipt !== false && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700">
                          إرفاق صورة الوصل أو الإشعار من معرض الهاتف أو الجهاز <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] font-semibold text-purple-800 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ImageIcon className="w-3 h-3 text-purple-700" />
                          <span>مدير الملفات والمعرض فقط (بدون كاميرا)</span>
                        </span>
                      </div>

                      {/* Hidden Native File Input: Opens native file manager directly across Android, iPhone, Tablet, PC without camera */}
                      <input
                        ref={customFileInputRef}
                        type="file"
                        accept={getDeviceReceiptAcceptAttribute()}
                        onClick={(e) => {
                          e.currentTarget.removeAttribute('capture');
                          e.currentTarget.value = '';
                        }}
                        onChange={handleReceiptFileChange}
                        className="hidden"
                        tabIndex={-1}
                        aria-hidden="true"
                      />

                      {proofFile ? (
                        <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-sm p-4 space-y-3.5">
                          <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                            <span className="text-xs font-bold text-slate-800">معاينة وصل الدفع</span>
                            <span className="text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                              جاهز للإرسال ✓
                            </span>
                          </div>

                          <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center max-h-64 group">
                            {proofFile.url.startsWith('data:application/pdf') || proofFile.name.toLowerCase().endsWith('.pdf') ? (
                              <div className="py-10 px-6 text-center text-white space-y-2">
                                <ImageIcon className="w-10 h-10 text-purple-400 mx-auto" />
                                <p className="text-xs font-bold">{proofFile.name}</p>
                                <p className="text-[11px] text-slate-300">ملف وصل الدفع جاهز للإرسال ({proofFile.size})</p>
                              </div>
                            ) : (
                              <>
                                <img
                                  src={proofFile.url}
                                  alt="معاينة الوصل"
                                  className="max-h-60 w-auto object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
                                  onClick={() => setPreviewModalOpen(true)}
                                />
                                <button
                                  type="button"
                                  onClick={() => setPreviewModalOpen(true)}
                                  className="absolute bottom-2.5 left-2.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-colors cursor-pointer shadow-md"
                                >
                                  <ZoomIn className="w-3.5 h-3.5 text-purple-300" />
                                  <span>معاينة بالحجم الكامل</span>
                                </button>
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-xs bg-purple-50/50 p-2.5 rounded-xl border border-purple-100">
                            <span className="font-bold text-slate-800 truncate">{proofFile.name}</span>
                            <span className="font-mono text-slate-500 font-bold">{proofFile.size}</span>
                          </div>

                          {isSubmitting && (
                            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-1.5 animate-fade-in">
                              <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                                <span>جاري رفع الوصل إلى التخزين الدائم...</span>
                                <span className="font-mono">{uploadProgress}%</span>
                              </div>
                              <div className="w-full bg-purple-200 rounded-full h-2.5 overflow-hidden">
                                <div
                                  className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => openNativeReceiptPicker(customFileInputRef.current, processSelectedReceiptFile)}
                              disabled={isSubmitting}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-purple-700" />
                              <span>تغيير الصورة</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveReceipt}
                              disabled={isSubmitting}
                              className="w-full px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>حذف الصورة</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleSubmitPayment}
                              disabled={isSubmitting}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {isSubmitting ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  <span>جاري الإرسال...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>إرسال الوصل</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleReceiptDrop}
                          onClick={() => openNativeReceiptPicker(customFileInputRef.current, processSelectedReceiptFile)}
                          className="border-2 border-dashed border-purple-200 hover:border-purple-500 rounded-2xl p-6 text-center transition-all bg-purple-50/20 cursor-pointer"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNativeReceiptPicker(customFileInputRef.current, processSelectedReceiptFile);
                            }}
                            className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                          >
                            <Upload className="w-4 h-4" />
                            <span>رفع صورة الوصل من معرض الهاتف أو الجهاز</span>
                          </button>
                          <p className="text-xs text-slate-500 mt-2 font-medium">
                            اختر صورة وصل الإيداع أو الملف المحفوظ من مدير ملفات جهازك (JPG, JPEG, PNG, WebP, PDF)
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button (For non-PayPal instant buttons or manual review) */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
                >
                  رجوع
                </button>
                {selectedMethod === 'paypal' && !txnRef.trim() ? (
                  <div className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl bg-sky-50 text-sky-800 font-bold text-xs border border-sky-200 text-center">
                    <span>✓ يرجى الضغط على زر PayPal أو البطاقة أعلاه لإتمام الدفع وتفعيل المنصة آلياً</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitPayment}
                    disabled={isSubmitting}
                    className="px-8 py-3 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جاري الرفع والمعالجة الآمنة...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isAdCampaign ? `تأكيد طلب تدشين الإعلان (${formattedFee})` : `تأكيد إرسال الدفع (${formattedFee})`}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>

            </div>
          )}

          {/* STEP 3: SUCCESS & CONFIRMATION */}
          {step === 'success' && (
            <div className="text-center py-6 space-y-4 animate-fade-in">
              {isPayPalConfirmedSuccess ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border-2 border-emerald-300 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>

                  <div className="space-y-2 max-w-md mx-auto">
                    <h3 className="text-xl font-black text-slate-900">
                      {isAdCampaign
                        ? 'تم تأكيد دفع رسوم الإعلان بنجاح عبر PayPal!'
                        : isRenewal
                        ? 'تم تجديد اشتراك الجمعية بنجاح عبر PayPal!'
                        : 'تم تأكيد الدفع وتفعيل المنصة بنجاح عبر PayPal!'}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                      {isAdCampaign
                        ? 'تم التحقق من نجاح المعاملة من خوادم PayPal وتفعيل الحملة الإعلانية بنجاح.'
                        : 'تم التحقق من نجاح المعاملة رسمياً من خوادم PayPal، وتحديث حالة الاشتراك إلى «نشط ومفعّل» بشكل دائم.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/90 border-2 border-emerald-300 max-w-md mx-auto space-y-2.5 text-right">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                      <span>حالة المنظمة والاشتراك:</span>
                      <span className="px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 font-black border border-emerald-400">
                        اشتراك مفعّل ونشط ✓
                      </span>
                    </div>
                    {confirmedPeriodInfo?.periodEnd && (
                      <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                        <span>صلاحية الاشتراك الجديد:</span>
                        <span className="font-bold font-mono">
                          إلى غاية {confirmedPeriodInfo.periodEnd.split('T')[0]}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                      <span>المبلغ المؤكد:</span>
                      <span className="font-bold font-mono">{formattedFee}</span>
                    </div>
                    {confirmedPeriodInfo?.ref && (
                      <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                        <span>معرّف عملية PayPal:</span>
                        <span className="font-mono text-[11px] font-bold" dir="ltr">
                          {confirmedPeriodInfo.ref}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
                    >
                      متابعة والدخول إلى المنصة
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 border-2 border-amber-200 flex items-center justify-center mx-auto animate-bounce">
                    <ClockIcon className="w-8 h-8" />
                  </div>

                  <div className="space-y-2 max-w-md mx-auto">
                    <h3 className="text-xl font-bold text-slate-900">
                      {isAdCampaign ? 'تم إرسال طلب تدشين الإعلان بنجاح' : isRenewal ? 'تم إرسال طلب تجديد الاشتراك بنجاح' : 'تم استلام وصل الدفع بنجاح'}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                      {isAdCampaign
                        ? 'شكراً لكم. تم حفظ إشعار الدفع في التخزين الدائم، وسيتم تدقيقه من قبل الإدارة العامة لتفعيل ظهور جمعيتكم في الصفحة الأولى.'
                        : isRenewal
                        ? 'شكراً لكم. تم رفع وحفظ وصل التجديد بنجاح، وستقوم الإدارة العامة بمراجعته وتحديث صلاحية الاشتراك.'
                        : 'شكراً لك. تم رفع وصل الدفع بنجاح إلى التخزين السحابي الدائم وحفظه في النظام، وحالة طلبك الآن «قيد مراجعة الدفع». لا يمكن تفعيل المنصة إلا بعد تدقيق الوصل وموافقة الإدارة العامة.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/90 border-2 border-amber-300 max-w-md mx-auto space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                      <span>حالة الطلب الحالية:</span>
                      <span className="px-3 py-1 rounded-full bg-amber-200 text-amber-950 font-black border border-amber-400">
                        قيد مراجعة الدفع ⏳
                      </span>
                    </div>
                    {isAdCampaign && adCampaignData && (
                      <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs text-amber-800">
                        <span>مدة الحملة:</span>
                        <span className="font-bold">{adCampaignData.monthsCount} شهر / أشهر</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs text-amber-800">
                      <span>المبلغ المسجل:</span>
                      <span className="font-bold font-mono">{formattedFee}</span>
                    </div>
                    <div className="pt-2 border-t border-amber-200/60 text-right text-[11px] text-amber-900 leading-relaxed font-semibold">
                      🔒 تنبيه أمني: تظل المنصة مقفلة ولا يمكن الدخول إلى لوحة إدارتها حتى تتم مطابقة الوصل والموافقة الرسمية من الإدارة العامة.
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-8 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
                    >
                      فهمت، العودة لشاشة الحالة
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Fullscreen Receipt Image Lightbox Modal */}
          {previewModalOpen && proofFile && (
            <div
              className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setPreviewModalOpen(false)}
            >
              <div
                className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-white/20 p-3 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10 text-white">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold truncate max-w-md">{proofFile.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({proofFile.size})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(false)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="إغلاق المعاينة"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-3 flex items-center justify-center overflow-auto max-h-[75vh]">
                  <img
                    src={proofFile.url}
                    alt="معاينة كاملة لوصل الدفع"
                    className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
