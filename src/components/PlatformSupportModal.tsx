import React, { useState, useEffect } from 'react';
import {
  Heart,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Upload,
  X,
  CreditCard,
  Building2,
  DollarSign,
  AlertCircle,
  Loader2,
  Lock,
  FileText,
  Coins,
  ArrowRight,
  Eye,
  CheckCheck,
  MessageSquare,
  ImageIcon,
  Trash2,
  RefreshCw,
  Wallet,
  Link2,
  ExternalLink,
  Globe,
  MapPin,
  Search,
  ChevronDown,
  QrCode,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  submitPlatformSupportDonation,
  getPlatformSupportSettings,
  saveAllPlatformSupportDonations,
  getAllPlatformSupportDonations,
} from '../platformSupportStorage';
import { PaymentMethod, PlatformSupportSettings, SupportDonationRecord } from '../types';
import { PayPalCheckoutButton } from './PayPalCheckoutButton';
import { ensurePermanentImageUrl } from '../api/imageApi';
import {
  openNativeReceiptPicker,
  getDeviceReceiptAcceptAttribute,
  normalizeReceiptFileName,
  validateReceiptFile,
  formatFileSize,
} from '../utils/receiptPicker';
import {
  SUPPORTED_PAYMENT_COUNTRIES,
  isPaymentMethodAllowedInCountry,
  getCountryFlagEmoji
} from '../data/countriesData';

export const PLATFORM_SUPPORT_PRESET_AMOUNTS_MAD: number[] = [
  100, 200, 300, 400, 500, 600, 1000, 1500, 2000, 3000, 4000, 5000
];

export const PLATFORM_SUPPORT_PRESET_AMOUNTS_USD: number[] = [
  10, 20, 30, 40, 50, 60, 100, 150, 200, 300, 400, 500
];

export const POPULAR_SUPPORT_COUNTRIES = [
  { id: 'MA', nameAr: 'المغرب', flag: '🇲🇦' },
  { id: 'FR', nameAr: 'فرنسا', flag: '🇫🇷' },
  { id: 'ES', nameAr: 'إسبانيا', flag: '🇪🇸' },
  { id: 'SA', nameAr: 'السعودية', flag: '🇸🇦' },
  { id: 'AE', nameAr: 'الإمارات', flag: '🇦🇪' },
  { id: 'CA', nameAr: 'كندا', flag: '🇨🇦' },
  { id: 'US', nameAr: 'أمريكا', flag: '🇺🇸' },
  { id: 'BE', nameAr: 'بلجيكا', flag: '🇧🇪' },
  { id: 'QA', nameAr: 'قطر', flag: '🇶🇦' },
  { id: 'DE', nameAr: 'ألمانيا', flag: '🇩🇪' },
  { id: 'GB', nameAr: 'بريطانيا', flag: '🇬🇧' },
  { id: 'IT', nameAr: 'إيطاليا', flag: '🇮🇹' },
];

interface PlatformSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlatformSupportModal: React.FC<PlatformSupportModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<PlatformSupportSettings>(() => getPlatformSupportSettings());
  const [country, setCountry] = useState<string>(() => {
    try {
      return localStorage.getItem('aljana_user_country') || 'المغرب';
    } catch {
      return 'المغرب';
    }
  });
  const [showCountryPicker, setShowCountryPicker] = useState<boolean>(false);
  const [countrySearchTerm, setCountrySearchTerm] = useState<string>('');
  const [previewQrModal, setPreviewQrModal] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'MAD' | 'USD'>(() => {
    try {
      const savedCountry = localStorage.getItem('aljana_user_country') || 'المغرب';
      return savedCountry === 'المغرب' ? 'MAD' : 'USD';
    } catch {
      return 'MAD';
    }
  });
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom'>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  
  // Supporter contact
  const [supporterName, setSupporterName] = useState('');
  const [supporterPhone, setSupporterPhone] = useState('');
  const [supporterMessage, setSupporterMessage] = useState('');

  // Payment method
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('bank_transfer');

  // Bank / CashPlus proof
  const [proofDocumentUrl, setProofDocumentUrl] = useState<string | undefined>();
  const [proofFileName, setProofFileName] = useState<string | undefined>();
  const [proofFileSize, setProofFileSize] = useState<string | undefined>();
  const [proofRawFile, setProofRawFile] = useState<File | null>(null);
  const bankSupportInputRef = React.useRef<HTMLInputElement | null>(null);
  const cashPlusSupportInputRef = React.useRef<HTMLInputElement | null>(null);
  const customSupportInputRef = React.useRef<HTMLInputElement | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Credit Card fields
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Statuses
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedDonation, setCompletedDonation] = useState<SupportDonationRecord | null>(null);

  // Compute available payment methods for the active country
  const availableMethods = React.useMemo(() => {
    const list: {
      id: PaymentMethod;
      name: string;
      iconType: 'bank' | 'cash_plus' | 'credit_card' | 'paypal' | 'wallet';
      hasDirectUrl?: boolean;
      directUrl?: string;
    }[] = [];

    // 1. Bank Account
    if (settings.bankAccount?.enabled && isPaymentMethodAllowedInCountry(settings.bankAccount, country)) {
      list.push({
        id: 'bank_transfer',
        name: 'تحويل بنكي',
        iconType: 'bank',
      });
    }

    // 2. Cash Plus
    if (settings.cashPlus?.enabled && isPaymentMethodAllowedInCountry(settings.cashPlus, country)) {
      list.push({
        id: 'cash_plus',
        name: 'كاش بليس',
        iconType: 'cash_plus',
      });
    }

    // 3. Credit Card
    if (settings.creditCard?.enabled && isPaymentMethodAllowedInCountry(settings.creditCard, country)) {
      list.push({
        id: 'credit_card',
        name: 'بطاقة بنكية',
        iconType: 'credit_card',
        hasDirectUrl: Boolean(settings.creditCard?.paymentUrl),
        directUrl: settings.creditCard?.paymentUrl,
      });
    }

    // 4. PayPal
    if (settings.paypal?.enabled && isPaymentMethodAllowedInCountry(settings.paypal, country)) {
      list.push({
        id: 'paypal',
        name: 'PayPal / بطاقة',
        iconType: 'paypal',
      });
    }

    // 5. Custom Methods
    if (Array.isArray(settings.customMethods)) {
      for (const m of settings.customMethods) {
        if (m.enabled && isPaymentMethodAllowedInCountry(m, country)) {
          list.push({
            id: `custom_${m.id}` as PaymentMethod,
            name: m.name,
            iconType: 'wallet',
            hasDirectUrl: Boolean(m.paymentUrl),
            directUrl: m.paymentUrl,
          });
        }
      }
    }

    return list;
  }, [settings, country]);

  // Filter full country list by search term
  const filteredCountriesList = React.useMemo(() => {
    if (!countrySearchTerm.trim()) {
      return SUPPORTED_PAYMENT_COUNTRIES;
    }
    const q = countrySearchTerm.trim().toLowerCase();
    return SUPPORTED_PAYMENT_COUNTRIES.filter(
      (c) =>
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [countrySearchTerm]);

  // Synchronize selectedMethod when availableMethods change
  useEffect(() => {
    if (availableMethods.length > 0) {
      const isStillAvailable = availableMethods.some((m) => m.id === selectedMethod);
      if (!isStillAvailable) {
        setSelectedMethod(availableMethods[0].id);
      }
    }
  }, [availableMethods, selectedMethod]);

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    try {
      localStorage.setItem('aljana_user_country', newCountry);
    } catch (e) {
      // Ignore localStorage errors
    }
    if (newCountry === 'المغرب') {
      setCurrency('MAD');
    } else if (currency === 'MAD') {
      setCurrency('USD');
    }
    setShowCountryPicker(false);
    setCountrySearchTerm('');
  };

  // Listen to live settings changes dispatched from Admin
  useEffect(() => {
    const handleSettingsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<PlatformSupportSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      } else {
        setSettings(getPlatformSupportSettings());
      }
    };
    window.addEventListener('platform-support-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('platform-support-settings-updated', handleSettingsUpdate);
  }, []);

  // Load latest settings whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const freshSettings = getPlatformSupportSettings();
      setSettings(freshSettings);
      setErrorMessage(null);
      setCompletedDonation(null);

      // Check if selected amount exists in presets
      const validPresets = currency === 'MAD' ? freshSettings.presetAmountsMad : freshSettings.presetAmountsUsd;
      if (selectedAmount !== 'custom' && !validPresets.includes(selectedAmount as number)) {
        setSelectedAmount(validPresets[0] || 100);
      }
      if (!freshSettings.allowCustomAmount && selectedAmount === 'custom') {
        setSelectedAmount(validPresets[0] || 100);
      }
    }
  }, [isOpen, currency]);

  if (!isOpen) return null;

  const presetList = currency === 'MAD' ? (settings.presetAmountsMad || []) : (settings.presetAmountsUsd || []);

  const handleCurrencyChange = (newCurrency: 'MAD' | 'USD') => {
    setCurrency(newCurrency);
    const newPresets = newCurrency === 'MAD' ? settings.presetAmountsMad : settings.presetAmountsUsd;
    if (selectedAmount !== 'custom') {
      setSelectedAmount(newPresets[0] || (newCurrency === 'MAD' ? 100 : 10));
    }
  };

  // Current active amount
  const getActiveAmount = (): number => {
    if (selectedAmount === 'custom') {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) ? 0 : parsed;
    }
    return typeof selectedAmount === 'number' ? selectedAmount : 0;
  };

  const activeAmount = getActiveAmount();

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const openPaymentDirectly = (rawUrl?: string) => {
    if (!rawUrl) return;
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    const targetUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open payment link:', err);
    }
  };

  const processSelectedFile = (file: File) => {
    const validation = validateReceiptFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'صيغة الملف غير مدعومة.');
      return;
    }

    const normalizedName = normalizeReceiptFileName(file);
    setErrorMessage(null);
    setProofFileName(normalizedName);
    setProofFileSize(formatFileSize(file.size));
    setProofRawFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setProofDocumentUrl(reader.result as string);
    };
    reader.onerror = () => {
      setErrorMessage('تعذر قراءة ملف الوصل من جهازك.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
    e.target.value = '';
  };

  // PayPal checkout callback
  const handlePayPalSuccess = (donation: SupportDonationRecord) => {
    const existing = getAllPlatformSupportDonations();
    const updated = [donation, ...existing.filter((d) => d.id !== donation.id)];
    saveAllPlatformSupportDonations(updated);

    setCompletedDonation(donation);
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#0070ba', '#003087', '#f97316', '#10b981', '#fbbf24']
      });
    } catch {
      // ignore
    }
  };

  // Submit payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!activeAmount || activeAmount <= 0) {
      setErrorMessage('يرجى تحديد مبلغ دعم صحيح أكبر من الصفر.');
      return;
    }

    // Proof validation for transfer methods
    if ((selectedMethod === 'bank_transfer' || selectedMethod === 'cash_plus') && !proofDocumentUrl) {
      setErrorMessage('يرجى إرفاق وصل التحويل أو إشعار الإيداع لتأكيد مساهمتك في دعم المنصة.');
      return;
    }

    // Custom method validation
    const isCustomMethod = typeof selectedMethod === 'string' && selectedMethod.startsWith('custom_');
    const customMethodObj = isCustomMethod 
      ? settings.customMethods?.find(m => `custom_${m.id}` === selectedMethod)
      : null;

    if (isCustomMethod && customMethodObj?.requiresReceipt && !proofDocumentUrl) {
      setErrorMessage('يرجى إرفاق صورة الوصل أو إشعار الإيداع من المعرض لتأكيد مساهمتك.');
      return;
    }

    // Card validation: require PayPal card checkout confirmation unless external payment URL is configured
    if (selectedMethod === 'credit_card' && !settings.creditCard?.paymentUrl) {
      setErrorMessage('يرجى إتمام الدفع عبر زر البطاقة البنكية المدعومة (Visa / Mastercard عبر PayPal) أعلاه؛ لا تُعتبر أي عملية ناجحة قبل تأكيدها من PayPal.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate real-time secure network processing
      await new Promise((resolve) => setTimeout(resolve, 900));

      const cardLast4 = selectedMethod === 'credit_card' 
        ? cardNumber.replace(/\s+/g, '').slice(-4) 
        : undefined;

      const customNotes = [
        isCustomMethod && customMethodObj ? `طريقة الدفع: ${customMethodObj.name}` : null,
        supporterMessage.trim() ? `رسالة التشجيع: ${supporterMessage.trim()}` : null
      ].filter(Boolean).join(' | ');

      let permanentProofUrl = proofDocumentUrl;
      if (proofRawFile || (proofDocumentUrl && proofDocumentUrl.startsWith('data:'))) {
        permanentProofUrl = await ensurePermanentImageUrl(proofRawFile || proofDocumentUrl!, {
          category: 'support_receipts',
          fileName: proofFileName || `support_receipt_${Date.now()}.jpg`,
        });
        if (!permanentProofUrl || permanentProofUrl.startsWith('data:')) {
          setIsSubmitting(false);
          setErrorMessage('تعذر رفع صورة الوصل إلى خدمة التخزين الدائم. يرجى التحقق من الاتصال والمحاولة مرة أخرى.');
          return;
        }
      }

      const result = await submitPlatformSupportDonation({
        supporterName: supporterName.trim() || 'فاعل خير / داعم للمنصة',
        supporterPhone: supporterPhone.trim() || undefined,
        amount: activeAmount,
        currency,
        country: country || (currency === 'MAD' ? 'المغرب' : 'دولي'),
        paymentMethod: isCustomMethod ? (customMethodObj?.name || 'other') : (selectedMethod as PaymentMethod),
        proofDocumentUrl: permanentProofUrl,
        proofFileName,
        cardLast4,
        notes: customNotes || undefined,
      });

      if (result.success && result.donation) {
        setCompletedDonation(result.donation);
        setIsSubmitting(false);

        // Trigger celebratory confetti
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#f97316', '#10b981', '#fbbf24', '#3b82f6', '#ec4899']
          });
        } catch {
          // ignore if confetti fails
        }
      } else {
        setIsSubmitting(false);
        setErrorMessage(result.error || 'تعذر تسجيل عملية الدعم. يرجى المحاولة مرة أخرى.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'حدث خطأ أثناء معالجة عملية الدفع.');
    }
  };

  return (
    <div
      id="modal-platform-support"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in"
      dir="rtl"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white p-5 sm:p-6 shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -mr-20 -mt-20 pointer-events-none" />
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Heart className="w-6 h-6 fill-white/30 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                    دعم syoumax منصة العمل الجمعوي
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                    مساهمة رسمية
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-orange-100 mt-0.5 leading-relaxed">
                  مساهمتكم الكريمة تسهم في استدامة وتطوير المنصة لخدمة الجمعيات والمجتمع
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 transition-colors shrink-0 cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-800">
          
          {/* SUCCESS SCREEN */}
          {completedDonation ? (
            <div className="py-6 text-center space-y-6 animate-fade-in">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-xl shadow-orange-500/30">
                <Heart className="w-10 h-10 fill-white text-white animate-bounce" />
              </div>

              <div className="space-y-3 max-w-lg mx-auto">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                  <CheckCheck className="w-4 h-4" />
                  <span>تم توثيق عملية الدعم بنجاح في حساب دعم المنصة</span>
                </div>

                {/* The Required Specific Thank You Message */}
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                  شكراً جزيلاً لك على دعمك لـ syoumax منصة العمل الجمعوي ❤️
                </h3>
                <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed bg-orange-50/80 p-4 rounded-2xl border border-orange-200/80 text-orange-950">
                  مساهمتك تساعدنا على تطوير المنصة وتحسين خدماتها لخدمة الجمعيات والمجتمع بشكل أفضل.
                </p>
              </div>

              {/* Payment Summary Ticket */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-md mx-auto text-xs text-slate-700 space-y-2 text-right">
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500">رقم العملية المرجعي:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {completedDonation.transactionReference || completedDonation.paypalOrderId || completedDonation.transactionId || completedDonation.id}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500">مبلغ الدعم:</span>
                  <span className="font-black text-orange-600 text-sm">
                    {completedDonation.amount} {completedDonation.currency}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500">طريقة الدفع:</span>
                  <span className="font-bold text-slate-800">
                    {completedDonation.paymentMethod === 'bank_transfer' && 'تحويل بنكي'}
                    {completedDonation.paymentMethod === 'cash_plus' && 'كاش بليس (Cash Plus)'}
                    {completedDonation.paymentMethod === 'credit_card' && 'بطاقة بنكية آمنة'}
                    {completedDonation.paymentMethod === 'paypal' && 'PayPal'}
                    {!['bank_transfer', 'cash_plus', 'credit_card', 'paypal'].includes(completedDonation.paymentMethod) && completedDonation.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500">اسم الداعم / المساهم:</span>
                  <span className="font-bold text-slate-800">{completedDonation.donorName}</span>
                </div>
                {completedDonation.donorNote && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500">رسالة التشجيع:</span>
                    <span className="font-medium text-slate-800 italic">«{completedDonation.donorNote}»</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">حالة الدعم:</span>
                  <span className="font-bold text-emerald-700">
                    {completedDonation.status === 'confirmed' ? '✓ تم التأكيد والاستلام فوراً' : '⏳ قيد المراجعة والتوثيق'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
                >
                  إغلاق والعودة للمنصة
                </button>
              </div>
            </div>
          ) : (
            /* PAYMENT FORM */
            <form onSubmit={handleSubmitPayment} className="space-y-6">
              
              {/* Error banner if any */}
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">تنبيه:</p>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* 1. Platform Support Amount Selection (Strictly for Platform Support) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-orange-600" />
                    <span>تحديد مبلغ دعم المنصة:</span>
                  </label>

                  {/* Currency Switcher */}
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => handleCurrencyChange('MAD')}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        currency === 'MAD' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      درهم مغربي (MAD)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCurrencyChange('USD')}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        currency === 'USD' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      دولار أمريكي (USD)
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  اختر أحد المبالغ المحددة لدعم المنصة، أو اضغط على <strong>«مبلغ آخر»</strong> لتحديد أي مبلغ ترغب به يدوياً:
                </p>

                {/* 12 Presets Grid: 100, 200, 300, 400, 500, 600, 1000, 1500, 2000, 3000, 4000, 5000 */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {presetList.map((amt) => {
                    const isSelected = selectedAmount === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setSelectedAmount(amt);
                          setErrorMessage(null);
                        }}
                        className={`py-3 px-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? 'border-orange-500 bg-gradient-to-b from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-400/40 scale-[1.02]'
                            : 'border-slate-200 hover:border-orange-300 bg-white hover:bg-orange-50/50 text-slate-800'
                        }`}
                      >
                        <span className={`text-base font-black font-mono leading-none ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {amt.toLocaleString()}
                        </span>
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-orange-100' : 'text-slate-500'}`}>
                          {currency === 'MAD' ? 'درهم' : 'USD'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Independent Option: «مبلغ آخر» - Only shown if allowed in admin settings */}
                {settings.allowCustomAmount && (
                  <div className="pt-1">
                    <button
                      id="btn-support-custom-amount"
                      type="button"
                      onClick={() => {
                        setSelectedAmount('custom');
                        setErrorMessage(null);
                      }}
                      className={`w-full p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        selectedAmount === 'custom'
                          ? 'border-orange-500 bg-orange-50/80 shadow-sm ring-2 ring-orange-400/30'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                          selectedAmount === 'custom' ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                        }`}>
                          <Coins className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-slate-900 block">مبلغ آخر</span>
                          <span className="text-[11px] text-slate-500 block">إدخال المبلغ الذي ترغب في دعمه يدوياً</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-black px-3 py-1.5 rounded-xl transition-colors ${
                          selectedAmount === 'custom' ? 'bg-orange-500 text-white' : 'bg-slate-200/80 text-slate-700'
                        }`}>
                          {selectedAmount === 'custom' && customAmount ? `${customAmount} ${currency === 'MAD' ? 'درهم' : 'USD'}` : 'تحديد يدوي'}
                        </span>
                      </div>
                    </button>

                    {/* Custom Amount Input field if «مبلغ آخر» chosen */}
                    {selectedAmount === 'custom' && (
                      <div className="mt-2.5 p-3.5 bg-white rounded-2xl border border-orange-300 space-y-2 animate-fade-in shadow-inner">
                        <label className="text-xs font-bold text-slate-800 block">
                          أدخل المبلغ الذي ترغب في المساهمة به ({currency === 'MAD' ? 'بالدرهم المغربي' : 'بالدولار'}):
                        </label>
                        <div className="relative">
                          <input
                            id="input-custom-support-amount"
                            type="number"
                            min="1"
                            step="1"
                            placeholder="أدخل المبلغ يدوياً، مثلاً: 250"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 font-mono text-base font-bold pl-20 text-slate-900 bg-slate-50 focus:bg-white"
                            autoFocus
                          />
                          <span className="absolute left-3.5 top-3.5 text-xs font-black text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-lg border border-orange-200">
                            {currency === 'MAD' ? 'درهم' : 'USD'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          يمكنك كتابة أي مبلغ تراه مناسباً لدعم المنصة ومشاريعها.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Amount Live Summary Banner */}
                <div className="p-3.5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border border-orange-200/80 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Heart className="w-4 h-4 text-orange-600 fill-orange-500 shrink-0" />
                    <span className="font-bold">المبلغ المحدد لدعم المنصة:</span>
                  </div>
                  <div className="font-black text-base text-orange-700 font-mono bg-white px-3 py-1 rounded-xl border border-orange-200 shadow-sm">
                    {activeAmount > 0 ? activeAmount.toLocaleString() : '0'} {currency === 'MAD' ? 'درهم' : 'USD'}
                  </div>
                </div>
              </div>

              {/* Encouragement message (Optional) */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-xs">
                <label className="block text-slate-800 font-bold mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-orange-600" />
                  <span>رسالة تشجيع أو إهداء (اختياري):</span>
                </label>
                <input
                  id="input-support-message"
                  type="text"
                  placeholder="كلمة دعم لفريق المنصة والجمعيات..."
                  value={supporterMessage}
                  onChange={(e) => setSupporterMessage(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-orange-500 text-slate-900"
                />
              </div>

              {/* 3. Country Selection & Filtered Payment Methods */}
              <div className="space-y-3.5 p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-orange-50/20 border border-slate-200">
                {/* Country Header & Active Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900">تحديد دولتك / بلد الإقامة:</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white border border-orange-300 text-orange-950 shadow-2xs">
                          <span className="text-sm">{getCountryFlagEmoji(country)}</span>
                          <span>{country}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        يتم تحديث وعرض طرق الدفع المتاحة في دولتك تلقائياً وفق إعدادات الإدارة
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                      availableMethods.length > 0 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {availableMethods.length > 0 ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{availableMethods.length} طرق دفع متاحة</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>0 طرق دفع متاحة</span>
                        </>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => setShowCountryPicker(prev => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-600 border border-slate-300 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Globe className="w-3.5 h-3.5 text-orange-600" />
                      <span>{showCountryPicker ? 'إغلاق القائمة' : 'تغيير الدولة...'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCountryPicker ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Popular countries quick chips */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600">اختر دولتك بنقرة واحدة:</span>
                    {country !== 'المغرب' && (
                      <button
                        type="button"
                        onClick={() => handleCountryChange('المغرب')}
                        className="text-orange-600 hover:underline font-bold cursor-pointer"
                      >
                        العودة إلى المغرب 🇲🇦
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_SUPPORT_COUNTRIES.map((c) => {
                      const isSelected = country === c.nameAr || (country === 'أمريكا' && c.nameAr === 'أمريكا') || (country === 'الولايات المتحدة' && c.nameAr === 'أمريكا');
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleCountryChange(c.nameAr)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-orange-600 text-white shadow-sm ring-2 ring-orange-400/40'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <span>{c.flag}</span>
                          <span>{c.nameAr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Full Country Search Dropdown */}
                {showCountryPicker && (
                  <div className="p-3 bg-white rounded-2xl border border-orange-200 shadow-md space-y-2.5 animate-fade-in">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="ابحث بالاسم العربي أو الإنجليزي للدولة..."
                        value={countrySearchTerm}
                        onChange={(e) => setCountrySearchTerm(e.target.value)}
                        className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-500 bg-slate-50 focus:bg-white"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 border border-slate-100 rounded-xl">
                      {filteredCountriesList.map((c) => {
                        const isSelected = country === c.nameAr;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleCountryChange(c.nameAr)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-right cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-orange-500 text-white font-bold'
                                : 'bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-orange-900 border border-slate-100'
                            }`}
                          >
                            <span className="text-sm shrink-0">{c.flag}</span>
                            <span className="truncate flex-1">{c.nameAr}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Methods Grid for Active Country */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>طرق الدفع المعتمدة والمتاحة في دولة</span>
                      <span className="text-orange-600 font-bold">{country}:</span>
                    </label>
                    <span className="text-[10px] text-slate-500">
                      (اختر وسيلة الدفع المناسبة لك)
                    </span>
                  </div>

                  {availableMethods.length === 0 ? (
                    <div className="p-4 text-center bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-amber-900">
                        لا تتوفر طرق دفع مخصصة ومفعلة لدولة «{country}» حالياً
                      </p>
                      <p className="text-[11px] text-slate-600 max-w-md mx-auto">
                        قام مسؤول المنصة بتخصيص ظهور طرق الدفع حسب الدولة. يمكنك التبديل إلى دولة أخرى أو التواصل مع إدارة المنصة.
                      </p>
                      <div className="pt-1 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCountryChange('المغرب')}
                          className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer shadow-2xs"
                        >
                          التبديل إلى المغرب 🇲🇦
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCountryPicker(true)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold cursor-pointer"
                        >
                          اختيار دولة أخرى 🌍
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {availableMethods.map((m) => {
                        const isSelected = selectedMethod === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedMethod(m.id);
                              if (m.hasDirectUrl && m.directUrl) {
                                openPaymentDirectly(m.directUrl);
                              }
                            }}
                            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 relative ${
                              isSelected
                                ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-400/20 shadow-sm'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            {m.hasDirectUrl && (
                              <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-orange-500" title="رابط دفع مباشر"></span>
                            )}
                            {m.iconType === 'bank' && <Building2 className={`w-5 h-5 ${isSelected ? 'text-orange-600' : 'text-slate-500'}`} />}
                            {m.iconType === 'cash_plus' && <Coins className={`w-5 h-5 ${isSelected ? 'text-orange-600' : 'text-slate-500'}`} />}
                            {m.iconType === 'credit_card' && <CreditCard className={`w-5 h-5 ${isSelected ? 'text-orange-600' : 'text-slate-500'}`} />}
                            {m.iconType === 'paypal' && <DollarSign className={`w-5 h-5 ${isSelected ? 'text-orange-600' : 'text-slate-500'}`} />}
                            {m.iconType === 'wallet' && <Wallet className={`w-5 h-5 ${isSelected ? 'text-orange-600' : 'text-slate-500'}`} />}
                            <span className="text-xs font-bold text-slate-800 truncate max-w-[110px]" title={m.name}>
                              {m.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* METHOD 1: Bank Transfer details */}
              {selectedMethod === 'bank_transfer' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-fade-in text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-orange-600" />
                      <span className="font-bold text-slate-800">معلومات الحساب البنكي المعتمد</span>
                    </div>
                    <span className="text-[11px] text-slate-500">{settings.bankAccount.bankName}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[10px]">صاحب الحساب:</span>
                        <span className="font-bold text-slate-900">{settings.bankAccount.accountHolder}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(settings.bankAccount.accountHolder, 'holder')}
                        className="text-slate-500 hover:text-orange-600 p-1"
                        title="نسخ"
                      >
                        {copiedField === 'holder' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[10px]">رقم الحساب (RIB):</span>
                        <span className="font-mono font-bold text-slate-900 tracking-wider" dir="ltr">
                          {settings.bankAccount.rib}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(settings.bankAccount.rib, 'rib')}
                        className="text-slate-500 hover:text-orange-600 p-1"
                        title="نسخ الـ RIB"
                      >
                        {copiedField === 'rib' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {settings.bankAccount.iban && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                        <div>
                          <span className="text-slate-500 block text-[10px]">رقم الحساب الدولي (IBAN):</span>
                          <span className="font-mono font-bold text-slate-900 tracking-wider" dir="ltr">
                            {settings.bankAccount.iban}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(settings.bankAccount.iban, 'iban')}
                          className="text-slate-500 hover:text-orange-600 p-1"
                          title="نسخ الـ IBAN"
                        >
                          {copiedField === 'iban' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {settings.bankAccount.additionalInstructions && (
                    <p className="text-[11px] text-slate-500 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-slate-200">
                      {settings.bankAccount.additionalInstructions}
                    </p>
                  )}

                  {/* Upload Receipt (Gallery / Device Files Only - Camera Disabled) */}
                  <div className="pt-2 border-t border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-slate-800 text-xs">
                        إرفاق وصل أو إشعار التحويل البنكي <span className="text-rose-600">*</span>:
                      </label>
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-orange-600" />
                        <span>معرض الصور والملفات فقط (بدون كاميرا)</span>
                      </span>
                    </div>

                    <input
                      ref={bankSupportInputRef}
                      type="file"
                      accept={getDeviceReceiptAcceptAttribute()}
                      onClick={(e) => {
                        e.currentTarget.removeAttribute('capture');
                        e.currentTarget.value = '';
                      }}
                      onChange={handleFileUpload}
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                    />

                    {proofDocumentUrl ? (
                      <div className="p-3.5 bg-white rounded-2xl border-2 border-emerald-300 shadow-sm space-y-3 animate-fade-in">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {proofDocumentUrl.startsWith('data:application/pdf') || proofDocumentUrl.toLowerCase().includes('.pdf') || proofFileName?.toLowerCase().endsWith('.pdf') ? (
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-rose-50 border border-rose-200 flex flex-col items-center justify-center text-rose-600 shrink-0">
                              <FileText className="w-8 h-8" />
                              <span className="text-[10px] font-bold mt-0.5">PDF</span>
                            </div>
                          ) : (
                            <img
                              src={proofDocumentUrl}
                              alt="معاينة وصل التحويل البنكي"
                              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-slate-200 shadow-xs shrink-0"
                            />
                          )}
                          <div className="text-right overflow-hidden flex-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mb-1 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تم اختيار صورة الوصل بنجاح ✓</span>
                            </span>
                            <p className="text-xs font-bold text-slate-800 truncate" title={proofFileName}>
                              {proofFileName}
                            </p>
                            {proofFileSize && (
                              <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                {proofFileSize}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons: Change image or Remove image */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => openNativeReceiptPicker(bankSupportInputRef.current, processSelectedFile)}
                            className="flex-1 py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs text-center cursor-pointer transition-colors border border-orange-200 flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>تغيير الصورة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setProofDocumentUrl(undefined);
                              setProofFileName(undefined);
                              setProofFileSize(undefined);
                              setProofRawFile(null);
                            }}
                            className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-colors border border-rose-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف الصورة</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => openNativeReceiptPicker(bankSupportInputRef.current, processSelectedFile)}
                        className="border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl p-5 text-center transition-all bg-slate-50/50 hover:bg-orange-50/20 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-2.5 shadow-xs">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNativeReceiptPicker(bankSupportInputRef.current, processSelectedFile);
                          }}
                          className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>رفع صورة الوصل من معرض الهاتف أو الجهاز</span>
                        </button>
                        <span className="text-[11px] text-slate-500 mt-2 block font-medium">
                          اختر صورة الوصل أو الملف المحفوظ من معرض الصور أو مدير الملفات (JPG, JPEG, PNG, WebP, PDF)
                        </span>
                        <div className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 shadow-2xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>يفتح منتقي الملفات ومعرض الصور الأصلي للجهاز مباشرة (دون كاميرا)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* METHOD 2: Cash Plus details */}
              {selectedMethod === 'cash_plus' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-fade-in text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-orange-600" />
                      <span className="font-bold text-slate-800">معلومات التحويل والدفع عبر كاش بليس (Cash Plus)</span>
                    </div>
                  </div>

                  {/* حقول معلومات التحويل والدفع عبر كاش بليس (Cash Plus) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[10px]">اسم المستفيد:</span>
                        <span className="font-bold text-slate-900">{settings.cashPlus.beneficiaryName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(settings.cashPlus.beneficiaryName, 'cashHolder')}
                        className="text-slate-500 hover:text-orange-600 p-1 cursor-pointer"
                        title="نسخ"
                      >
                        {copiedField === 'cashHolder' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-500 block text-[10px]">رقم الهاتف للتحويل:</span>
                        <span className="font-mono font-bold text-slate-900" dir="ltr">
                          {settings.cashPlus.phone}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(settings.cashPlus.phone, 'cashPhone')}
                        className="text-slate-500 hover:text-orange-600 p-1 cursor-pointer"
                        title="نسخ"
                      >
                        {copiedField === 'cashPhone' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {settings.cashPlus.accountOrRef && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                        <div>
                          <span className="text-slate-500 block text-[10px]">رقم الحساب أو المرجع:</span>
                          <span className="font-mono font-bold text-slate-900" dir="ltr">
                            {settings.cashPlus.accountOrRef}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(settings.cashPlus.accountOrRef, 'cashRef')}
                          className="text-slate-500 hover:text-orange-600 p-1 cursor-pointer"
                          title="نسخ"
                        >
                          {copiedField === 'cashRef' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {settings.cashPlus.instructions && (
                    <p className="text-[11px] text-slate-500 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-slate-200">
                      {settings.cashPlus.instructions}
                    </p>
                  )}

                  {/* حقل «الدفع السريع عبر QR Code» (يظهر مباشرةً أسفل حقول معلومات التحويل والدفع عبر كاش بليس) */}
                  {Boolean(settings.cashPlus?.qrCodeEnabled && settings.cashPlus?.qrCodeUrl) && (
                    <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-2xl border-2 border-amber-300 shadow-sm space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                            <QrCode className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">الدفع السريع عبر QR Code</span>
                            <span className="text-[10px] text-amber-800">مسح الرمز ضوئياً عبر تطبيق كاش بليس في الهاتف</span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <span>دفع فوري</span>
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs">
                        {/* QR Code Image Preview */}
                        <div className="relative group shrink-0">
                          <img
                            src={settings.cashPlus.qrCodeUrl}
                            alt="رمز QR Code للدفع عبر كاش بليس"
                            className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-xl border-2 border-amber-100 bg-white p-2 shadow-xs cursor-pointer hover:border-amber-500 transition-colors"
                            onClick={() => setPreviewQrModal(settings.cashPlus.qrCodeUrl || null)}
                          />
                          <button
                            type="button"
                            onClick={() => setPreviewQrModal(settings.cashPlus.qrCodeUrl || null)}
                            className="absolute inset-0 bg-slate-900/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity cursor-pointer gap-1"
                            title="تكبير الرمز"
                          >
                            <Eye className="w-4 h-4" />
                            <span>تكبير</span>
                          </button>
                        </div>

                        {/* Text and Actions */}
                        <div className="flex-1 space-y-2.5 text-right w-full sm:w-auto">
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {settings.cashPlus.qrCodeInstructions || 'امسح رمز الاستجابة السريعة (QR Code) أعلاه عبر تطبيق كاش بليس في هاتفك لإتمام التحويل والدعم فوراً وبكل سهولة.'}
                          </p>

                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setPreviewQrModal(settings.cashPlus.qrCodeUrl || null)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>الاطلاع على الرمز بوضوح وتكبيره</span>
                            </button>

                            <a
                              href={settings.cashPlus.qrCodeUrl}
                              download={settings.cashPlus.qrCodeFileName || 'cashplus-qrcode.png'}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>تحميل الرمز</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Upload Receipt (Cash Plus - Gallery / Device Files Only - Camera Disabled) */}
                  <div className="pt-2 border-t border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-slate-800 text-xs">
                        إرفاق وصل كاش بليس <span className="text-rose-600">*</span>:
                      </label>
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-amber-700" />
                        <span>معرض الصور والملفات فقط (بدون كاميرا)</span>
                      </span>
                    </div>

                    <input
                      ref={cashPlusSupportInputRef}
                      type="file"
                      accept={getDeviceReceiptAcceptAttribute()}
                      onClick={(e) => {
                        e.currentTarget.removeAttribute('capture');
                        e.currentTarget.value = '';
                      }}
                      onChange={handleFileUpload}
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                    />

                    {proofDocumentUrl ? (
                      <div className="p-3.5 bg-white rounded-2xl border-2 border-amber-300 shadow-sm space-y-3 animate-fade-in">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {proofDocumentUrl.startsWith('data:application/pdf') || proofDocumentUrl.toLowerCase().includes('.pdf') || proofFileName?.toLowerCase().endsWith('.pdf') ? (
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-amber-50 border border-amber-200 flex flex-col items-center justify-center text-amber-700 shrink-0">
                              <FileText className="w-8 h-8" />
                              <span className="text-[10px] font-bold mt-0.5">PDF</span>
                            </div>
                          ) : (
                            <img
                              src={proofDocumentUrl}
                              alt="معاينة وصل كاش بليس"
                              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-slate-200 shadow-xs shrink-0"
                            />
                          )}
                          <div className="text-right overflow-hidden flex-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mb-1 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تم اختيار وصل كاش بليس بنجاح ✓</span>
                            </span>
                            <p className="text-xs font-bold text-slate-800 truncate" title={proofFileName}>
                              {proofFileName}
                            </p>
                            {proofFileSize && (
                              <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                {proofFileSize}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons: Change image or Remove image */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => openNativeReceiptPicker(cashPlusSupportInputRef.current, processSelectedFile)}
                            className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs text-center cursor-pointer transition-colors border border-amber-200 flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                            <span>تغيير الصورة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setProofDocumentUrl(undefined);
                              setProofFileName(undefined);
                              setProofFileSize(undefined);
                              setProofRawFile(null);
                            }}
                            className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-colors border border-rose-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف الصورة</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => openNativeReceiptPicker(cashPlusSupportInputRef.current, processSelectedFile)}
                        className="border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-2xl p-5 text-center transition-all bg-amber-50/20 hover:bg-amber-50/40 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2.5 shadow-xs">
                          <ImageIcon className="w-6 h-6 text-amber-700" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNativeReceiptPicker(cashPlusSupportInputRef.current, processSelectedFile);
                          }}
                          className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>رفع صورة الوصل من معرض الهاتف أو الجهاز</span>
                        </button>
                        <span className="text-[11px] text-slate-500 mt-2 block font-medium">
                          اختر صورة وصل كاش بليس من معرض الصور أو مدير الملفات (JPG, JPEG, PNG, WebP, PDF)
                        </span>
                        <div className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold bg-white border border-amber-200 text-amber-900 shadow-2xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>يفتح منتقي الملفات ومعرض الصور الأصلي للجهاز مباشرة (دون كاميرا)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* METHOD 3: Credit Card via PayPal Supported Cards or External Gateway */}
              {selectedMethod === 'credit_card' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-fade-in text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-orange-600" />
                      <span className="font-bold text-slate-800">الدفع الإلكتروني الآمن بالبطاقة البنكية المدعومة (Visa / Mastercard)</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                      <Lock className="w-3.5 h-3.5" />
                      <span>تأكيد رسمي عبر PayPal API</span>
                    </div>
                  </div>

                  {settings.creditCard?.paymentUrl ? (
                    <div className="p-3.5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 rounded-2xl border border-orange-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-orange-950 block text-xs">تم فتح بوابة الدفع الآمنة بالبطاقة البنكية</span>
                          <span className="text-[10px] text-slate-600 block">أكمل عملية الدفع بأمان عبر البوابة المعتمدة ثم قم بتأكيد بياناتك أدناه للمراجعة.</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPaymentDirectly(settings.creditCard.paymentUrl)}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-[11px] transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>إعادة الفتح</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-xs">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-orange-950 block text-xs">الدفع بالبطاقات البنكية المدعومة عبر PayPal:</span>
                            <span className="text-[10px] text-orange-800 block">
                              لا تُعتبر العملية ناجحة إلا بعد تأكيد خصم البطاقة رسمياً من خادم PayPal
                            </span>
                          </div>
                        </div>
                        <div className="text-left font-mono">
                          <span className="text-base font-black text-orange-900 block">
                            {activeAmount} {currency}
                          </span>
                          {currency === 'MAD' && (
                            <span className="text-[10px] text-slate-500 font-bold block">
                              ≈ {(activeAmount / 10).toFixed(2)} USD
                            </span>
                          )}
                        </div>
                      </div>

                      <PayPalCheckoutButton
                        type="card"
                        amount={activeAmount}
                        currency={currency}
                        supporterName={supporterName}
                        supporterPhone={supporterPhone}
                        supporterMessage={supporterMessage}
                        onSuccess={handlePayPalSuccess}
                        onError={(err) => setErrorMessage(err)}
                      />
                    </div>
                  )}

                  {settings.creditCard.instructions && (
                    <p className="text-[11px] text-slate-500 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-slate-200">
                      {settings.creditCard.instructions}
                    </p>
                  )}
                </div>
              )}

              {/* METHOD 4: PayPal & Cards Checkout */}
              {selectedMethod === 'paypal' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-fade-in text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-sky-600" />
                      <span className="font-bold text-slate-800">الدفع الإلكتروني الآمن عبر PayPal أو البطاقة البنكية</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تشفير وتحقق آمن بالخادم</span>
                    </span>
                  </div>

                  {/* Amount summary pill */}
                  <div className="p-3 bg-gradient-to-r from-sky-50 to-indigo-50 rounded-2xl border border-sky-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                        $
                      </div>
                      <div>
                        <span className="font-bold text-sky-950 block text-xs">مبلغ الدعم المحدد:</span>
                        <span className="text-[10px] text-sky-700 block">
                          {currency === 'MAD' ? `يتم التحويل التلقائي بسعر الصرف لـ PayPal` : 'دفع مباشر بالدولار الأمريكي'}
                        </span>
                      </div>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-base font-black text-sky-900 block">
                        {activeAmount} {currency}
                      </span>
                      {currency === 'MAD' && (
                        <span className="text-[10px] text-slate-500 font-bold block">
                          ≈ {(activeAmount / 10).toFixed(2)} USD
                        </span>
                      )}
                    </div>
                  </div>

                  {/* PayPal & Credit/Debit Card Checkout Component */}
                  <PayPalCheckoutButton
                    amount={activeAmount}
                    currency={currency}
                    supporterName={supporterName}
                    supporterPhone={supporterPhone}
                    supporterMessage={supporterMessage}
                    onSuccess={handlePayPalSuccess}
                    onError={(err) => setErrorMessage(err)}
                  />

                  {settings.paypal?.instructions && (
                    <p className="text-[11px] text-slate-500 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-slate-200">
                      {settings.paypal.instructions}
                    </p>
                  )}

                  {settings.paypal?.email && (
                    <div className="flex items-center justify-between p-2.5 bg-white/80 rounded-xl border border-slate-200/80 text-[11px]">
                      <div>
                        <span className="text-slate-500 block text-[10px]">البريد الإلكتروني لحساب PayPal:</span>
                        <span className="font-mono font-bold text-slate-800" dir="ltr">{settings.paypal.email}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(settings.paypal.email, 'paypalEmail')}
                        className="text-slate-500 hover:text-orange-600 p-1 cursor-pointer"
                        title="نسخ"
                      >
                        {copiedField === 'paypalEmail' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* METHOD: Custom Payment Method */}
              {typeof selectedMethod === 'string' && selectedMethod.startsWith('custom_') && (() => {
                const customId = selectedMethod.replace('custom_', '');
                const customMethod = settings.customMethods?.find(m => m.id === customId);
                if (!customMethod) return null;

                return (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-fade-in text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-orange-600" />
                        <span className="font-bold text-slate-800">{customMethod.name}</span>
                      </div>
                      {customMethod.paymentUrl && (
                        <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200 flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          <span>رابط دفع مباشر</span>
                        </span>
                      )}
                    </div>

                    {/* Direct Payment Notice with re-open trigger if needed */}
                    {customMethod.paymentUrl && (
                      <div className="p-3.5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 rounded-2xl border border-orange-200 flex items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                            <Wallet className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-orange-950 block text-xs">تم فتح صفحة الدفع الخاصة بـ ({customMethod.name})</span>
                            <span className="text-[10px] text-slate-600 block">أكمل عملية الدفع بأمان ثم قم بتأكيد بيانات مساهمتك أدناه.</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openPaymentDirectly(customMethod.paymentUrl)}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-[11px] transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>إعادة الفتح</span>
                        </button>
                      </div>
                    )}

                    {customMethod.accountName && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                        <div>
                          <span className="text-slate-500 block text-[10px]">المستفيد / الجهة:</span>
                          <span className="font-bold text-slate-900">{customMethod.accountName}</span>
                        </div>
                      </div>
                    )}

                    {customMethod.accountNumber && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                        <div>
                          <span className="text-slate-500 block text-[10px]">رقم الحساب / الهاتف / المعرّف:</span>
                          <span className="font-mono font-bold text-slate-900 tracking-wider" dir="ltr">
                            {customMethod.accountNumber}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(customMethod.accountNumber!, 'customAccount')}
                          className="text-slate-500 hover:text-orange-600 p-1 cursor-pointer"
                          title="نسخ"
                        >
                          {copiedField === 'customAccount' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

                    {customMethod.instructions && (
                      <p className="text-[11px] text-slate-500 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-slate-200">
                        {customMethod.instructions}
                      </p>
                    )}

                    {customMethod.requiresReceipt && (
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
                        <label className="block text-slate-700 font-bold flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5 text-orange-600" />
                          <span>إرفاق صورة الوصل أو إشعار التحويل من معرض الهاتف أو الجهاز: *</span>
                        </label>

                        <input
                          ref={customSupportInputRef}
                          type="file"
                          accept={getDeviceReceiptAcceptAttribute()}
                          onClick={(e) => {
                            e.currentTarget.removeAttribute('capture');
                            e.currentTarget.value = '';
                          }}
                          onChange={handleFileUpload}
                          className="hidden"
                          tabIndex={-1}
                          aria-hidden="true"
                        />

                        {!proofDocumentUrl ? (
                          <button
                            type="button"
                            onClick={() => openNativeReceiptPicker(customSupportInputRef.current, processSelectedFile)}
                            className="w-full p-4 rounded-xl border-2 border-dashed border-orange-300 hover:border-orange-500 bg-orange-50/40 hover:bg-orange-50 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
                          >
                            <div className="w-10 h-10 rounded-full bg-orange-100 group-hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                            <div className="text-center">
                              <span className="font-bold text-xs text-orange-950 block">
                                رفع صورة الوصل من معرض الهاتف أو الجهاز
                              </span>
                              <span className="text-[10px] text-slate-500 mt-0.5 block">
                                الصيغ المدعومة: JPG, JPEG, PNG, WebP, PDF (دون تشغيل الكاميرا)
                              </span>
                            </div>
                          </button>
                        ) : (
                          <div className="p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/60 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={proofDocumentUrl}
                                alt="معاينة الوصل"
                                className="w-12 h-12 rounded-lg object-cover border border-emerald-400 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-emerald-900 block truncate">
                                  {proofFileName || 'صورة الوصل المرفقة'}
                                </span>
                                <span className="text-[10px] text-emerald-700">تم اختيار الصورة بنجاح وتجهيزها للإرسال</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => openNativeReceiptPicker(customSupportInputRef.current, processSelectedFile)}
                                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 text-[11px] font-bold cursor-pointer"
                              >
                                تغيير الصورة
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setProofDocumentUrl(undefined);
                                  setProofFileName(undefined);
                                  setProofFileSize(undefined);
                                  setProofRawFile(null);
                                }}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action Button */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>معاملة مشفرة وآمنة بنسبة 100%</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>

                  {selectedMethod === 'paypal' || (selectedMethod === 'credit_card' && !settings.creditCard?.paymentUrl) ? (
                    <div className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-3 rounded-2xl bg-sky-50 text-sky-800 font-bold text-xs border border-sky-200 text-center">
                      <span>✓ يرجى الضغط على زر PayPal أو بطاقة الدفع أعلاه لإتمام وتأكيد المساهمة</span>
                    </div>
                  ) : (
                    <button
                      id="btn-confirm-platform-support"
                      type="submit"
                      disabled={isSubmitting || activeAmount <= 0}
                      className="flex-1 sm:flex-none px-7 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-xs shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري معالجة المساهمة...</span>
                        </>
                      ) : (
                        <>
                          <Heart className="w-4 h-4 fill-white/30 text-white" />
                          <span>تأكيد دعم المنصة بمبلغ ({activeAmount.toLocaleString()} {currency === 'MAD' ? 'درهم' : 'USD'})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

            </form>
          )}

        </div>

      </div>

      {/* نافذة معاينة رمز QR Code بالحجم الكامل لمسحه بالهاتف */}
      {previewQrModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewQrModal(null)}
        >
          <div 
            className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-amber-200 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">رمز الدفع عبر Cash Plus</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQrModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 flex items-center justify-center">
              <img
                src={previewQrModal}
                alt="معاينة رمز QR Code كاش بليس"
                className="max-h-72 w-auto object-contain rounded-xl bg-white p-3 shadow-sm border border-amber-100"
              />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
                <span>مسح ضوئي عبر تطبيق كاش بليس</span>
              </span>
              <p className="text-xs text-slate-600 font-medium leading-relaxed pt-1">
                {settings.cashPlus.qrCodeInstructions || 'وجه كاميرا هاتفك أو افتح تطبيق كاش بليس لمسح الرمز ضوئياً وإتمام عملية التحويل والدعم فوراً.'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100">
              <a
                href={previewQrModal}
                download={settings.cashPlus.qrCodeFileName || 'cashplus-qrcode.png'}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-amber-600/20 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>تحميل الرمز</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewQrModal(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
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
