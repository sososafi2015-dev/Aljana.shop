import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Coins,
  DollarSign,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Globe,
  ShieldCheck,
  Eye,
  Sparkles,
  Lock,
  ArrowRight,
  Layers,
  HelpCircle,
  Building2,
  Calendar,
  Check
} from 'lucide-react';
import {
  getPlatformPaymentSettings,
  savePlatformPaymentSettings,
  syncPlatformPaymentSettingsFromBackend,
  updateAdCreationFee,
  getAdCreationFeeForCountry,
} from '../paymentStorage';
import { PlatformPaymentSettings, MasterAdminSession } from '../types';

interface PlatformAdCreationFeeAdminProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  currentSession?: MasterAdminSession | null;
}

const PRESET_AMOUNTS_MAD = [99, 149, 199, 249, 299, 349, 399, 499];

export const PlatformAdCreationFeeAdmin: React.FC<PlatformAdCreationFeeAdminProps> = ({
  onShowToast,
  currentSession,
}) => {
  const [settings, setSettings] = useState<PlatformPaymentSettings>(() => getPlatformPaymentSettings());
  const [amountMad, setAmountMad] = useState<number>(() => settings.adCreationFeeMad !== undefined ? settings.adCreationFeeMad : 199);
  const [amountUsd, setAmountUsd] = useState<number>(() => settings.adCreationFeeUsd !== undefined ? settings.adCreationFeeUsd : 20);
  const [exchangeRate, setExchangeRate] = useState<number>(() => settings.exchangeRate || 9.95);
  const [isAutoCalcUsd, setIsAutoCalcUsd] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [activePreviewCountry, setActivePreviewCountry] = useState<string>('المغرب');

  // Load and sync settings from server on mount
  useEffect(() => {
    let isMounted = true;
    syncPlatformPaymentSettingsFromBackend().then((synced) => {
      if (isMounted && synced) {
        setSettings(synced);
        setAmountMad(synced.adCreationFeeMad !== undefined ? synced.adCreationFeeMad : 199);
        setAmountUsd(synced.adCreationFeeUsd !== undefined ? synced.adCreationFeeUsd : 20);
        setExchangeRate(synced.exchangeRate || 9.95);
      }
    });

    const handleSettingsUpdate = (e: any) => {
      const updated = e?.detail || getPlatformPaymentSettings();
      setSettings(updated);
      setAmountMad(updated.adCreationFeeMad !== undefined ? updated.adCreationFeeMad : 199);
      setAmountUsd(updated.adCreationFeeUsd !== undefined ? updated.adCreationFeeUsd : 20);
      setExchangeRate(updated.exchangeRate || 9.95);
    };

    window.addEventListener('platform-payment-settings-updated', handleSettingsUpdate);
    window.addEventListener('ad-creation-fee-updated', handleSettingsUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('platform-payment-settings-updated', handleSettingsUpdate);
      window.removeEventListener('ad-creation-fee-updated', handleSettingsUpdate);
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
      onShowToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const adminName = currentSession?.fullName || 'الإدارة العامة للمنصة';
      const updated = await updateAdCreationFee(amountMad, amountUsd, adminName);

      // Also persist exchangeRate if modified
      const finalSettings: PlatformPaymentSettings = {
        ...updated,
        exchangeRate: exchangeRate,
      };
      savePlatformPaymentSettings(finalSettings);
      setSettings(finalSettings);

      setSaveSuccess(true);
      onShowToast(`تم حفظ وتحديث مبلغ إنشاء إعلان وترويج الجمعية بنجاح (${amountMad} درهم مغربي). تم اعتماده وتطبيقه تلقائيًا لجميع الجمعيات.`, 'success');
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.error('Error saving ad creation fee:', err);
      onShowToast('حدث خطأ أثناء حفظ مبلغ إنشاء الإعلان، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      setIsSaving(false);
    }
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
    adCreationFeeMad: amountMad,
    adCreationFeeUsd: amountUsd,
    exchangeRate,
  };

  const previewFee = getAdCreationFeeForCountry(activePreviewCountry, previewSettings);

  const previewCountriesList = [
    { country: 'المغرب', label: 'المغرب 🇲🇦', note: 'المبلغ المحلي المعتمد' },
    { country: 'السعودية', label: 'السعودية 🇸🇦', note: 'الخليج العربي' },
    { country: 'الإمارات', label: 'الإمارات 🇦🇪', note: 'الخليج العربي' },
    { country: 'قطر', label: 'قطر 🇶🇦', note: 'الخليج العربي' },
    { country: 'الكويت', label: 'الكويت 🇰🇼', note: 'الخليج العربي' },
    { country: 'الجزائر', label: 'الجزائر 🇩🇿', note: 'شمال إفريقيا' },
    { country: 'تونس', label: 'تونس 🇹🇳', note: 'شمال إفريقيا' },
    { country: 'فرنسا', label: 'فرنسا / الاتحاد الأوروبي 🇫🇷🇪🇺', note: 'أوروبا' },
    { country: 'بريطانيا', label: 'بريطانيا 🇬🇧', note: 'المملكة المتحدة' },
    { country: 'كندا', label: 'كندا 🇨🇦', note: 'أمريكا الشمالية' },
    { country: 'الولايات المتحدة', label: 'الولايات المتحدة / دولي 🇺🇸', note: 'الدولار العالمي' },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* ================= HEADER BANNER ================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-amber-100 text-xs font-bold border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>نظام مركزي موحد - الإدارة العامة فقط</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Megaphone className="w-8 h-8 text-amber-300 shrink-0" />
              <span>مبلغ إنشاء الإعلان وترويج الجمعية</span>
            </h2>
            <p className="text-amber-100/90 text-sm sm:text-base leading-relaxed">
              هذا القسم مخصص للإدارة العامة حصريًا لتحديد وتعديل مبلغ إنشاء وترويج الإعلانات لجميع الجمعيات المشتركة في المنصة (بما في ذلك النموذج المعتمد لجمعية النور للتنمية والتضامن وكافة الجمعيات الأخرى). المبلغ المحفوظ هنا يطبّق تلقائيًا ومباشرة على لوحات تحكم الجمعيات فور حفظه.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center">
              <div className="text-xs text-amber-200 font-semibold mb-1">المبلغ المعتمد حالياً</div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono flex items-center justify-center gap-1.5">
                <span>{settings.adCreationFeeMad !== undefined ? settings.adCreationFeeMad : 199}</span>
                <span className="text-sm font-normal text-amber-200">درهم / شهر</span>
              </div>
              <div className="text-[11px] text-amber-100/80 mt-1 font-medium">
                يعادل ~{settings.adCreationFeeUsd !== undefined ? settings.adCreationFeeUsd : 20} دولار أمريكي
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SUCCESS BANNER ================= */}
      {saveSuccess && (
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 flex items-start gap-4 shadow-md animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-base font-black text-emerald-900">تم حفظ التعديلات بنجاح في قاعدة البيانات</h4>
            <p className="text-sm text-emerald-800 mt-1 leading-relaxed">
              تم اعتماد مبلغ <strong>{amountMad} درهم مغربي</strong> شهرياً لإنشاء إعلان وترويج الجمعية. تم تحديث المبلغ وتطبيقه تلقائياً على لوحة التحكم الإدارية لجمعية النور للتنمية والتضامن وكافة الجمعيات الأخرى دون الحاجة لأي تعديل يدوي.
            </p>
          </div>
        </div>
      )}

      {/* ================= STATS / SUMMARY OVERVIEW ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">المبلغ الأساسي (المغرب)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              MAD
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {amountMad} <span className="text-sm font-bold text-slate-500">درهم</span>
          </div>
          <div className="text-xs text-amber-700 mt-1 flex items-center gap-1 font-semibold">
            <Check className="w-3.5 h-3.5 text-amber-600" />
            <span>يطبق على الجمعيات داخل المغرب</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">المبلغ الدولي المعادل</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ${amountUsd} <span className="text-sm font-bold text-slate-500">USD</span>
          </div>
          <div className="text-xs text-blue-700 mt-1 flex items-center gap-1 font-semibold">
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>للجمعيات خارج المغرب</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">نطاق التطبيق التلقائي</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-black text-emerald-800 mt-1">
            جميع الجمعيات بلا استثناء
          </div>
          <div className="text-xs text-slate-500 mt-1">
            جمعية النور + كل الجمعيات الحالية والجديدة
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">صلاحية التعديل</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-black text-rose-800 mt-1">
            الإدارة العامة فقط
          </div>
          <div className="text-xs text-slate-500 mt-1">
            محمي ومقفل أمام الجمعيات
          </div>
        </div>
      </div>

      {/* ================= MAIN EDITING SECTION ================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
              <Coins className="w-5 h-5 text-amber-600" />
              <span>تعديل وتحديد مبلغ إنشاء إعلان وترويج الجمعية</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              قم بضبط المبلغ بالدرهم المغربي أو استعن بالمبالغ الجاهزة، ثم اضغط على زر «حفظ التعديلات» لحفظه بشكل دائم في قاعدة البيانات.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
            title="استعادة القيمة الافتراضية (199 درهم)"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>استعادة الافتراضي (199 د.م)</span>
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* 1. Main Amount Field (MAD) */}
          <div className="space-y-4">
            <label className="block text-sm font-black text-slate-900">
              المبلغ الشهري لإنشاء الإعلان (بالدرهم المغربي MAD) <span className="text-rose-500">*</span>
            </label>

            <div className="relative max-w-md">
              <input
                id="input-ad-creation-fee-mad"
                type="number"
                min="1"
                step="1"
                value={amountMad || ''}
                onChange={(e) => handleMadChange(parseInt(e.target.value, 10))}
                className="w-full text-2xl font-black font-mono px-5 py-4 rounded-2xl border-2 border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 outline-none transition-all text-slate-900 bg-amber-50/20"
                placeholder="199"
              />
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-sm font-bold text-amber-800 bg-amber-100/80 px-3 py-1.5 rounded-xl border border-amber-300">
                  درهم مغربي / شهر
                </span>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-600">اختيار سريع لمبالغ مقترحة:</div>
              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS_MAD.map((preset) => {
                  const isSelected = amountMad === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {preset} د.م
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Foreign currency & exchange rate */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-black text-slate-900">المبلغ المعادل للدول الأجنبية وسعر الصرف</h4>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutoCalcUsd}
                  onChange={(e) => setIsAutoCalcUsd(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700">حساب تلقائي وفق سعر الصرف</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  سعر الصرف التقديري (1 دولار أمريكي = X درهم مغربي)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    value={exchangeRate || ''}
                    onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
                    placeholder="9.95"
                  />
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400 pointer-events-none">
                    د.م / $
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المبلغ بالدولار الأمريكي (USD)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    disabled={isAutoCalcUsd}
                    value={amountUsd || ''}
                    onChange={(e) => setAmountUsd(parseInt(e.target.value, 10) || 1)}
                    className={`w-full px-4 py-2.5 rounded-xl border font-mono font-bold text-slate-900 outline-none ${
                      isAutoCalcUsd
                        ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                        : 'border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                    }`}
                    placeholder="20"
                  />
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400 pointer-events-none">
                    دولار / شهر
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Primary Action: Save Button */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                الحفظ يتم بشكل دائم ومؤمن في الخادم وقاعدة البيانات، مع تحديث فوري لجميع الجمعيات.
              </span>
            </div>

            <button
              id="btn-save-ad-creation-fee"
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 text-white font-black text-sm sm:text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>جاري حفظ التعديلات...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 text-amber-200" />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ================= LIVE SIMULATION PREVIEW: HOW ASSOCIATIONS SEE IT ================= */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 text-xs font-bold border border-amber-400/20 mb-2">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>معاينة حية وتفاعلية</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <span>كيف يظهر هذا المبلغ للجمعيات في قسم «إنشاء إعلان وترويج الجمعية»؟</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              مقارنة بصرية دقيقة لما ستراه الجمعيات (بما فيها جمعية النور للتنمية والتضامن) داخل لوحة التحكم الإدارية.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700 text-xs">
            <span className="text-slate-400 pr-2">الدولة للمعاينة:</span>
            <select
              value={activePreviewCountry}
              onChange={(e) => setActivePreviewCountry(e.target.value)}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold focus:outline-none"
            >
              {previewCountriesList.map((c) => (
                <option key={c.country} value={c.country}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Association Mock Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 p-6 rounded-2xl border border-indigo-700/50 shadow-inner space-y-4">
            <div className="flex items-center justify-between text-xs text-indigo-300 border-b border-indigo-800/60 pb-3">
              <div className="flex items-center gap-2 font-bold">
                <Building2 className="w-4 h-4 text-amber-400" />
                <span>نموذج: جمعية النور للتنمية والتضامن</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 text-[10px]">
                لوحة التحكم الإدارية
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-black text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-amber-400" />
                  <span>إنشاء إعلان وترويج الجمعية</span>
                </h4>
                <p className="text-xs text-indigo-200/80 mt-1">
                  سيتم إظهار جمعيتك في الصفحة الأولى بواجهة المنصة في قسم تلقي التبرعات
                </p>
              </div>

              {/* Read-only monthly fee badge */}
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-right shrink-0 w-full sm:w-auto">
                <div className="text-[11px] text-indigo-200 font-semibold mb-0.5">سعر الإعلان الشهري المعتمد:</div>
                <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                  {previewFee.amount} {previewFee.currency === 'MAD' ? 'درهم مغربي' : previewFee.currency} <span className="text-xs text-indigo-200 font-normal">/ شهر</span>
                </div>
                <div className="text-[10px] text-amber-300/90 font-medium mt-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 inline" />
                  <span>محدد من الإدارة العامة (غير قابل للتعديل)</span>
                </div>
              </div>
            </div>

            {/* Quick calculations according to months count */}
            <div className="bg-black/30 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <div className="text-slate-400 text-[10px]">1 شهر (30 يوماً)</div>
                <div className="font-mono font-black text-amber-300 mt-0.5">{previewFee.amount * 1} {previewFee.currency}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <div className="text-slate-400 text-[10px]">3 أشهر</div>
                <div className="font-mono font-black text-amber-300 mt-0.5">{previewFee.amount * 3} {previewFee.currency}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <div className="text-slate-400 text-[10px]">6 أشهر</div>
                <div className="font-mono font-black text-amber-300 mt-0.5">{previewFee.amount * 6} {previewFee.currency}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <div className="text-slate-400 text-[10px]">12 شهر (سنة)</div>
                <div className="font-mono font-black text-amber-300 mt-0.5">{previewFee.amount * 12} {previewFee.currency}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>قواعد الحماية والصلاحيات</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                الجمعيات لا تمتلك أي حقل لإدخال أو تعديل سعر الإعلان. يتم جلب السعر مباشرة من الإعداد المركزي، وتقتصر خيارات الجمعية على تحديد عنوان الحملة، ومدة الإعلان بالشهور، وتواريخ البداية والنهاية.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>التحديث الفوري الشامل</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                عند قيامك بالضغط على «حفظ التعديلات»، يتم إرسال إشعار تحديث فوري (Broadcast Event) لجميع التبويبات المفتوحة، ويتم تحديث السعر في قاعدة البيانات على الخادم ليكون متاحاً عند أي تحديث للصفحة.
              </p>
            </div>
          </div>
        </div>

        {/* Multi-Country Currency Table */}
        <div className="pt-4 border-t border-slate-800">
          <div className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>جدول المبالغ المعتمدة لإنشاء الإعلانات بحسب عملة بلد الجمعية:</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="pb-2 pr-2">البلد / المنطقة</th>
                  <th className="pb-2">العملة المعتمدة</th>
                  <th className="pb-2">المبلغ الشهري المحسوب</th>
                  <th className="pb-2">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {previewCountriesList.map((item) => {
                  const cFee = getAdCreationFeeForCountry(item.country, previewSettings);
                  return (
                    <tr key={item.country} className="hover:bg-slate-800/40">
                      <td className="py-2.5 pr-2 font-bold text-white">{item.label}</td>
                      <td className="py-2.5 font-mono text-amber-400 font-bold">{cFee.currency}</td>
                      <td className="py-2.5 font-mono font-black text-emerald-400">
                        {cFee.formatted}
                      </td>
                      <td className="py-2.5 text-slate-400">{item.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
