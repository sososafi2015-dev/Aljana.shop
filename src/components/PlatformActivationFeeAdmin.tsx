import React, { useState, useEffect } from 'react';
import {
  Banknote,
  DollarSign,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Globe,
  ShieldCheck,
  Eye,
  Sparkles,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Lock,
  Layers,
  HelpCircle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import {
  getPlatformPaymentSettings,
  savePlatformPaymentSettings,
  syncPlatformPaymentSettingsFromBackend,
  updatePlatformActivationFee,
  updatePlatformActivationNoticeText,
  getActivationFeeForCountry,
  DEFAULT_ACTIVATION_NOTICE_TEXT,
} from '../paymentStorage';
import { PlatformPaymentSettings, MasterAdminSession } from '../types';

interface PlatformActivationFeeAdminProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  currentSession?: MasterAdminSession | null;
}

const PRESET_AMOUNTS_MAD = [99, 149, 199, 249, 299, 349, 399, 499];

export const PlatformActivationFeeAdmin: React.FC<PlatformActivationFeeAdminProps> = ({
  onShowToast,
  currentSession,
}) => {
  const [settings, setSettings] = useState<PlatformPaymentSettings>(() => getPlatformPaymentSettings());
  const [amountMad, setAmountMad] = useState<number>(settings.activationFeeMad || 199);
  const [amountUsd, setAmountUsd] = useState<number>(settings.activationFeeUsd || 20);
  const [exchangeRate, setExchangeRate] = useState<number>(settings.exchangeRate || 9.95);
  const [isAutoCalcUsd, setIsAutoCalcUsd] = useState<boolean>(true);
  const [noticeText, setNoticeText] = useState<string>(
    settings.activationNoticeText || DEFAULT_ACTIVATION_NOTICE_TEXT
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSavingNotice, setIsSavingNotice] = useState<boolean>(false);
  const [saveNoticeSuccess, setSaveNoticeSuccess] = useState<boolean>(false);
  const [activePreviewCountry, setActivePreviewCountry] = useState<string>('المغرب');

  // Load and sync settings from server on mount
  useEffect(() => {
    let isMounted = true;
    syncPlatformPaymentSettingsFromBackend().then((synced) => {
      if (isMounted && synced) {
        setSettings(synced);
        setAmountMad(synced.activationFeeMad || 199);
        setAmountUsd(synced.activationFeeUsd || 20);
        setExchangeRate(synced.exchangeRate || 9.95);
        if (synced.activationNoticeText) {
          setNoticeText(synced.activationNoticeText);
        }
      }
    });

    const handleSettingsUpdate = (e: any) => {
      const updated = e?.detail || getPlatformPaymentSettings();
      setSettings(updated);
      setAmountMad(updated.activationFeeMad || 199);
      setAmountUsd(updated.activationFeeUsd || 20);
      setExchangeRate(updated.exchangeRate || 9.95);
      if (updated.activationNoticeText) {
        setNoticeText(updated.activationNoticeText);
      }
    };

    window.addEventListener('platform-payment-settings-updated', handleSettingsUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('platform-payment-settings-updated', handleSettingsUpdate);
    };
  }, []);

  // Update USD automatically when MAD or rate changes if auto-calc is on
  const handleMadChange = (val: number) => {
    const num = isNaN(val) ? 0 : Math.max(0, val);
    setAmountMad(num);
    if (isAutoCalcUsd) {
      const calculatedUsd = Math.max(1, Math.round(num / (exchangeRate || 9.95)));
      setAmountUsd(calculatedUsd);
    }
  };

  const handleRateChange = (val: number) => {
    const rate = isNaN(val) ? 9.95 : Math.max(0.1, val);
    setExchangeRate(rate);
    if (isAutoCalcUsd) {
      const calculatedUsd = Math.max(1, Math.round(amountMad / rate));
      setAmountUsd(calculatedUsd);
    }
  };

  const handlePresetSelect = (preset: number) => {
    handleMadChange(preset);
  };

  // Save changes permanently to database & disk
  const handleSave = async () => {
    if (amountMad <= 0) {
      onShowToast('يرجى إدخال مبلغ تفعيل صحيح أكبر من الصفر', 'error');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const adminName = currentSession?.fullName || 'المدير العام للمنصة';
      const updated = await updatePlatformActivationFee(amountMad, amountUsd, adminName);

      // Also persist exchangeRate and noticeText
      const finalSettings: PlatformPaymentSettings = {
        ...updated,
        activationNoticeText: noticeText.trim() || DEFAULT_ACTIVATION_NOTICE_TEXT,
        exchangeRate: exchangeRate,
      };
      savePlatformPaymentSettings(finalSettings);
      setSettings(finalSettings);

      setSaveSuccess(true);
      onShowToast(`تم حفظ وتحديث مبلغ تفعيل المنصة بنجاح (${amountMad} درهم مغربي) مع اعتماد كافة التعديلات في قاعدة البيانات.`, 'success');
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Error saving activation fee:', err);
      onShowToast('حدث خطأ أثناء حفظ مبلغ التفعيل، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Dedicated save for activation notice text
  const handleSaveNotice = async () => {
    const trimmed = noticeText.trim();
    if (!trimmed) {
      onShowToast('يرجى كتابة نص التنبيه قبل الحفظ (لا يمكن تركه فارغاً)', 'error');
      return;
    }

    setIsSavingNotice(true);
    setSaveNoticeSuccess(false);

    try {
      const adminName = currentSession?.fullName || 'المدير العام للمنصة';
      const updated = await updatePlatformActivationNoticeText(trimmed, adminName);
      setSettings(updated);
      setNoticeText(updated.activationNoticeText || trimmed);
      setSaveNoticeSuccess(true);
      onShowToast('تم حفظ واعتماد نص تنبيه تسديد الاشتراك بنجاح في قاعدة البيانات.', 'success');
      setTimeout(() => setSaveNoticeSuccess(false), 4000);
    } catch (err) {
      console.error('Error saving activation notice text:', err);
      onShowToast('حدث خطأ أثناء حفظ نص التنبيه، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      setIsSavingNotice(false);
    }
  };

  // Restore default notice text
  const handleResetNoticeToDefault = () => {
    setNoticeText(DEFAULT_ACTIVATION_NOTICE_TEXT);
  };

  // Restore default fee (199 MAD)
  const handleResetToDefault = () => {
    handleMadChange(199);
    setExchangeRate(9.95);
    setAmountUsd(20);
    setIsAutoCalcUsd(true);
  };

  // Calculate preview fee based on currently entered values
  const previewSettings: PlatformPaymentSettings = {
    ...settings,
    activationFeeMad: amountMad,
    activationFeeUsd: amountUsd,
    exchangeRate,
  };
  const previewFee = getActivationFeeForCountry(activePreviewCountry, previewSettings);

  const previewCountriesList = [
    { country: 'المغرب', label: 'المغرب 🇲🇦' },
    { country: 'فرنسا', label: 'أوروبا (فرنسا) 🇫🇷' },
    { country: 'السعودية', label: 'السعودية 🇸🇦' },
    { country: 'الإمارات', label: 'الإمارات 🇦🇪' },
    { country: 'قطر', label: 'قطر 🇶🇦' },
    { country: 'الكويت', label: 'الكويت 🇰🇼' },
    { country: 'الجزائر', label: 'الجزائر 🇩🇿' },
    { country: 'تونس', label: 'تونس 🇹🇳' },
    { country: 'موريتانيا', label: 'موريتانيا 🇲🇷' },
    { country: 'مصر', label: 'مصر 🇪🇬' },
    { country: 'بريطانيا', label: 'بريطانيا 🇬🇧' },
    { country: 'كندا', label: 'كندا 🇨🇦' },
    { country: 'أخرى', label: 'دولي (USD) 🌍' },
  ];

  return (
    <div className="space-y-8" dir="rtl">
      {/* 1. Header Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
              <Banknote className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  مبلغ تفعيل المنصة
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Lock className="w-3.5 h-3.5" />
                  صلاحية المدير العام فقط (Super Admin)
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  حفظ دائم في قاعدة البيانات
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
                النظام المركزي المعتمد لإدارة وتعديل مبلغ تفعيل المنصات المستقلة للجمعيات. أي تعديل يتم حفظه هنا ينعكس فورياً وتلقائياً على جميع الجمعيات الجديدة فور إنشائها وينتقل بها إلى صفحة الدفع بالمبلغ المحدّث.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              id="save-activation-fee-btn-top"
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSaving ? 'جارٍ الحفظ في قاعدة البيانات...' : 'حفظ واعتماد التعديلات'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Prominent Current Active Fee Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Card: Current Active Fee */}
        <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                مبلغ التفعيل المعتمد حالياً في النظام
              </span>
              <span className="text-xs text-slate-400 font-mono">
                آخر تحديث: {settings.lastUpdated ? new Date(settings.lastUpdated).toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'افتراضي'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline gap-4 sm:gap-6 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl sm:text-6xl font-black text-white font-mono tracking-tight text-emerald-300 drop-shadow">
                  {(settings.activationFeeMad || 199).toLocaleString()}
                </span>
                <span className="text-xl sm:text-2xl font-bold text-slate-200">
                  درهم مغربي
                </span>
                <span className="text-sm font-mono text-emerald-400 font-bold bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                  MAD
                </span>
              </div>

              <div className="flex items-center gap-3 sm:border-r sm:border-slate-700 sm:pr-6">
                <div className="text-sm text-slate-300">
                  المعادل الدولي:
                  <span className="font-mono font-bold text-white text-lg mx-1.5">
                    ${settings.activationFeeUsd || 20}
                  </span>
                  USD
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>مطبق تلقائياً على كافة المنصات الجديدة بعد الإنشاء</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>المنصات المفعلة سابقاً وسجلات الدفع لا تتأثر</span>
              </div>
            </div>
          </div>
        </div>

        {/* Side Card: Platform Guarantee & Info */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-bold mb-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>ضمانات النظام والدفع</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              عند إنشاء أي جمعية جديدة لمنصتها الاحترافية، يقوم النظام بجلب هذا المبلغ ديناميكياً وعرضه في صفحة الدفع والتفعيل مع طرق الدفع المعتمدة (تحويل بنكي، كاش بلس، بطاقة بنكية، بايبال).
            </p>
          </div>

          <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-700">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">المشرف المسؤول:</span>
              <span className="font-bold text-slate-900">{settings.updatedBy || currentSession?.fullName || 'المدير العام'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">سعر الصرف الداخلي:</span>
              <span className="font-mono font-bold text-slate-900">1 USD = {exchangeRate} MAD</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">مقر التخزين:</span>
              <span className="font-mono text-emerald-700 font-bold">قاعدة بيانات النظام (Disk/API)</span>
            </div>
          </div>

          <button
            onClick={handleResetToDefault}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold transition-all text-center cursor-pointer"
          >
            استعادة المبلغ الافتراضي للمنصة (199 د.م)
          </button>
        </div>
      </div>

      {/* 3. Interactive Management Form (إضافة وتعديل مبلغ التفعيل) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" />
              تعديل مبلغ التفعيل للمنصات الجديدة
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              أدخل المبلغ المرغوب بالدرهم المغربي أو اختر من المبالغ السريعة المقترحة أدناه
            </p>
          </div>
          {saveSuccess && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              تم حفظ التعديلات في قاعدة البيانات!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Controls Column */}
          <div className="space-y-6">
            {/* Primary Currency Input: MAD */}
            <div>
              <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                مبلغ تفعيل المنصة الأساسي (بالدرهم المغربي MAD) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amountMad || ''}
                  onChange={(e) => handleMadChange(parseFloat(e.target.value) || 0)}
                  id="activation-fee-mad-input"
                  className="w-full text-2xl font-black text-slate-900 font-mono pl-4 pr-14 py-3.5 bg-slate-50 hover:bg-white focus:bg-white border-2 border-slate-200 focus:border-emerald-600 rounded-xl outline-none transition-all"
                  placeholder="199"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-sm text-slate-600 pointer-events-none">
                  د.م
                </span>
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-400 bg-slate-200/80 px-2 py-1 rounded">
                  MAD
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                هذا هو المبلغ الذي سيظهر لجميع الجمعيات داخل المغرب في صفحة الدفع والتفعيل فور اكتمال الإنشاء.
              </p>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">
                مبالغ سريعة مقترحة (بنقرة واحدة):
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS_MAD.map((preset) => {
                  const isSelected = amountMad === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                      className={`py-2 px-3 rounded-xl text-xs font-mono font-bold transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-300'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset} د.م
                    </button>
                  );
                })}
              </div>
            </div>

            {/* International USD & Exchange Rate Controls */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  مبلغ التفعيل للجمعيات الدولية (USD)
                </span>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAutoCalcUsd}
                    onChange={(e) => {
                      setIsAutoCalcUsd(e.target.checked);
                      if (e.target.checked) {
                        setAmountUsd(Math.max(1, Math.round(amountMad / (exchangeRate || 9.95))));
                      }
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>حساب تلقائي حسب سعر الصرف</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    المبلغ بالدولار الأمريكي (USD)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={amountUsd || ''}
                      disabled={isAutoCalcUsd}
                      onChange={(e) => setAmountUsd(parseFloat(e.target.value) || 1)}
                      className={`w-full font-mono font-bold pl-4 pr-10 py-2.5 rounded-lg border text-slate-900 outline-none transition-all ${
                        isAutoCalcUsd
                          ? 'bg-slate-100 border-slate-200 text-slate-500'
                          : 'bg-white border-slate-300 focus:border-indigo-600'
                      }`}
                    />
                    <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    سعر الصرف (درهم لكل 1 دولار)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      min="1"
                      value={exchangeRate || ''}
                      onChange={(e) => handleRateChange(parseFloat(e.target.value) || 9.95)}
                      className="w-full font-mono font-bold px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Save Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                id="save-platform-activation-fee-btn"
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-base shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span>
                  {isSaving
                    ? 'جارٍ الحفظ والاعتماد في قاعدة البيانات...'
                    : 'حفظ واعتماد مبلغ التفعيل الجديد في قاعدة البيانات'}
                </span>
              </button>
            </div>
          </div>

          {/* Real-Time Live Preview Column (معاينة حية لشاشة صفحة دفع الجمعية) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" />
                معاينة حية لشاشة دفع الجمعية الجديدة:
              </span>
              <span className="text-[11px] text-slate-400">
                هكذا تظهر للجمعية فور اكتمال الإنشاء
              </span>
            </div>

            {/* Country Selector for preview */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {previewCountriesList.map((item) => (
                <button
                  key={item.country}
                  type="button"
                  onClick={() => setActivePreviewCountry(item.country)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activePreviewCountry === item.country
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Simulated Payment Screen Card */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-bold text-slate-300">
                    صفحة دفع وتفعيل المنصة (جمعية تجريبية جديدة)
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  {activePreviewCountry}
                </span>
              </div>

              {/* Activation fee card preview */}
              <div className="bg-slate-800/80 rounded-xl p-5 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    مبلغ التفعيل المعتمد للمنصة:
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    دفعة تفعيل موحدة
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white font-mono tracking-tight">
                    {previewFee.amount.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-slate-300">
                    {previewFee.currencyNameAr} ({previewFee.currency})
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  تفعيل فوري لمنصة الجمعية بكافة صلاحيات الإدارة المستقلة، دومين مخصص، إدارة تبرعات، أعضاء، وتقارير رقمية.
                </p>

                {/* Simulated notice banner */}
                <div className="bg-amber-950/60 border border-amber-500/40 rounded-lg p-2.5 text-[11px] text-amber-200 leading-relaxed font-medium">
                  {noticeText || DEFAULT_ACTIVATION_NOTICE_TEXT}
                </div>

                {/* Simulated payment button */}
                <div className="pt-2">
                  <div className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm text-center flex items-center justify-center gap-2 shadow-md opacity-90 cursor-default">
                    <CreditCard className="w-4 h-4" />
                    <span>تسديد المبلغ وتفعيل المنصة ({previewFee.formatted})</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                <span>طرق الدفع: تحويل بنكي / كاش بلس / بطاقة / بايبال</span>
                <span className="text-emerald-400 font-bold">جاهز ومربوط تلقائياً ✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Dedicated Section: تعديل نص تنبيه تسديد الاشتراك والتفعيل (Required Feature) */}
      <div className="bg-white rounded-2xl border-2 border-emerald-200/90 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900">
                  تعديل نص تنبيه تسديد الاشتراك والتفعيل
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                  يظهر في أعلى صفحة تسديد الاشتراك
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  حفظ دائم في قاعدة البيانات
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                يظهر هذا النص التوضيحي للمستخدم في أعلى صفحة تسديد الاشتراك وتفعيل المنصة، مباشرة بعد الضغط على زر «تأكيد إنشاء المنصة».
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {saveNoticeSuccess && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 animate-bounce">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                تم حفظ النص في قاعدة البيانات!
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveNotice}
              disabled={isSavingNotice}
              id="save-activation-notice-btn"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSavingNotice ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSavingNotice ? 'جارٍ الحفظ في قاعدة البيانات...' : 'حفظ نص التنبيه'}</span>
            </button>
          </div>
        </div>

        {/* Informational Guidance Alert */}
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-900">موقع عرض النص في الواجهة:</span>
            <p className="text-amber-800 leading-relaxed">
              يظهر هذا النص المعتمد في أعلى صفحة تسديد الاشتراك تحت العنوان مباشرة وفي صندوق شروط الدفع، لإعلام الجمعية بعدم السماح بالدخول للوحة التحكم أو عرض المنصة للعموم قبل تسديد مبلغ الاشتراك والحصول على موافقة الإدارة العامة.
            </p>
          </div>
        </div>

        {/* Textarea Editor & Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="activation-notice-textarea"
              className="block text-xs font-black uppercase text-slate-800"
            >
              نص التنبيه المعروض بأعلى صفحة تسديد الاشتراك *
            </label>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-slate-400">
                {noticeText.length} حرف
              </span>
              <button
                type="button"
                onClick={handleResetNoticeToDefault}
                className="text-[11px] text-slate-500 hover:text-emerald-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="استعادة النص الافتراضي الأصلي"
              >
                <RotateCcw className="w-3 h-3" />
                <span>استعادة النص الافتراضي</span>
              </button>
            </div>
          </div>

          <textarea
            id="activation-notice-textarea"
            rows={3}
            value={noticeText}
            onChange={(e) => setNoticeText(e.target.value)}
            placeholder="اكتب هنا النص المراد عرضه للمستخدم في أعلى صفحة تسديد الاشتراك وتفعيل المنصة..."
            className="w-full text-sm font-medium text-slate-800 p-4 bg-slate-50 hover:bg-white focus:bg-white border-2 border-slate-200 focus:border-emerald-600 rounded-xl outline-none transition-all leading-relaxed resize-y shadow-inner"
          />
        </div>

        {/* Live Preview of the Notice */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              معاينة فورية لطريقة ظهور النص في أعلى صفحة تسديد الاشتراك:
            </span>
            <span className="text-[10px] text-slate-400">مباشر ومطابق لواجهة المستخدم</span>
          </div>

          <div className="bg-slate-900 rounded-2xl p-5 text-white border border-slate-800 space-y-3 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                <span className="w-1.5 h-1.5 rounded-full animate-ping bg-amber-600" />
                حالة المنصة: في انتظار الدفع
              </span>
              <span className="text-[10px] text-slate-400">أعلى الصفحة المعروضة للمستخدم</span>
            </div>

            <h4 className="text-base font-extrabold text-slate-100">
              تم إنشاء منصتك بنجاح — الحالة الحالية: «في انتظار الدفع»
            </h4>

            {/* The Live Notice Preview */}
            <div className="bg-slate-800/90 rounded-xl p-4 border border-emerald-500/40 text-xs text-emerald-100 leading-relaxed font-medium">
              {noticeText || DEFAULT_ACTIVATION_NOTICE_TEXT}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-400 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                يتم حفظ النص والتعديلات بشكل دائم في قاعدة البيانات
              </span>
              <button
                type="button"
                onClick={handleSaveNotice}
                disabled={isSavingNotice}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-3 h-3" />
                <span>حفظ النص الآن</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Supported Currencies & Country Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              جدول مبالغ التفعيل التلقائية حسب الدول والعملات
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            مبني على مبلغ: {amountMad} MAD (نسبة ديناميكية)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                <th className="py-3 px-4">الدولة / النطاق الجغرافي</th>
                <th className="py-3 px-4">العملة</th>
                <th className="py-3 px-4">المبلغ المحسوب تلقائياً</th>
                <th className="py-3 px-4">الصيغة المعروضة في صفحة الدفع</th>
                <th className="py-3 px-4 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {previewCountriesList.map((c) => {
                const info = getActivationFeeForCountry(c.country, previewSettings);
                return (
                  <tr key={c.country} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{c.label}</td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">{info.currency}</td>
                    <td className="py-3 px-4 font-mono font-black text-slate-900 text-sm">
                      {info.amount.toLocaleString()} {info.currencySymbol}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-600">{info.formatted}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        نشط
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
