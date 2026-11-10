import React, { useState, useMemo } from 'react';
import { 
  Globe, 
  MapPin, 
  Search, 
  Check, 
  X, 
  Sparkles, 
  AlertCircle,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { 
  SUPPORTED_PAYMENT_COUNTRIES, 
  SupportedCountryItem,
  normalizeCountryString 
} from '../data/countriesData';

interface PaymentMethodCountrySelectorProps {
  methodName: string;
  countriesMode: 'all' | 'specific';
  allowedCountries: string[];
  onChange: (countriesMode: 'all' | 'specific', allowedCountries: string[]) => void;
  disabled?: boolean;
}

export const PaymentMethodCountrySelector: React.FC<PaymentMethodCountrySelectorProps> = ({
  methodName,
  countriesMode,
  allowedCountries = [],
  onChange,
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Normalize allowed list for fast lookup
  const allowedSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of allowedCountries) {
      if (c) {
        set.add(c.trim());
        set.add(normalizeCountryString(c));
      }
    }
    return set;
  }, [allowedCountries]);

  const isCountrySelected = (country: SupportedCountryItem) => {
    return (
      allowedSet.has(country.nameAr) ||
      allowedSet.has(country.id) ||
      allowedSet.has(normalizeCountryString(country.nameAr))
    );
  };

  const handleToggleCountry = (country: SupportedCountryItem) => {
    if (disabled) return;
    const currentlySelected = isCountrySelected(country);
    let updated: string[];

    if (currentlySelected) {
      // Remove country
      updated = allowedCountries.filter(
        (c) =>
          c !== country.nameAr &&
          c !== country.id &&
          normalizeCountryString(c) !== normalizeCountryString(country.nameAr)
      );
    } else {
      // Add country
      updated = [...allowedCountries, country.nameAr];
    }

    onChange('specific', updated);
  };

  const handleSelectPreset = (preset: 'morocco_only' | 'maghreb' | 'gulf' | 'europe' | 'all' | 'clear') => {
    if (disabled) return;
    let newCountries: string[] = [];

    switch (preset) {
      case 'morocco_only':
        newCountries = ['المغرب'];
        break;
      case 'maghreb':
        newCountries = SUPPORTED_PAYMENT_COUNTRIES.filter(
          (c) => c.group === 'maghreb'
        ).map((c) => c.nameAr);
        break;
      case 'gulf':
        newCountries = SUPPORTED_PAYMENT_COUNTRIES.filter(
          (c) => c.group === 'gulf'
        ).map((c) => c.nameAr);
        break;
      case 'europe':
        newCountries = SUPPORTED_PAYMENT_COUNTRIES.filter(
          (c) => c.group === 'europe' || c.group === 'americas'
        ).map((c) => c.nameAr);
        break;
      case 'all':
        newCountries = SUPPORTED_PAYMENT_COUNTRIES.map((c) => c.nameAr);
        break;
      case 'clear':
        newCountries = [];
        break;
    }

    onChange('specific', newCountries);
  };

  // Filter countries by search query
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return SUPPORTED_PAYMENT_COUNTRIES;
    const q = normalizeCountryString(searchQuery);
    return SUPPORTED_PAYMENT_COUNTRIES.filter(
      (c) =>
        normalizeCountryString(c.nameAr).includes(q) ||
        normalizeCountryString(c.nameEn).includes(q) ||
        c.id.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }, [searchQuery]);

  const selectedCount = SUPPORTED_PAYMENT_COUNTRIES.filter(isCountrySelected).length;

  return (
    <div className="mt-3.5 pt-3 border-t border-slate-200/80 text-xs space-y-3" dir="rtl">
      
      {/* Title & Mode Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-slate-800 block text-xs">
              تخصيص ظهور طريقة الدفع حسب الدولة
            </span>
            <span className="text-[10px] text-slate-500 block">
              تحديد الدول التي تظهر فيها ({methodName}) للمستخدمين والداعمين
            </span>
          </div>
        </div>

        {/* Mode Selector Buttons */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/90 text-xs font-bold shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('all', allowedCountries)}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              countriesMode === 'all'
                ? 'bg-white text-orange-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-orange-600" />
            <span>جميع الدول (عالمي)</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const currentAllowed = allowedCountries.length > 0 ? allowedCountries : ['المغرب'];
              onChange('specific', currentAllowed);
              setIsExpanded(true);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              countriesMode === 'specific'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>تخصيص دول محددة</span>
            {countriesMode === 'specific' && (
              <span className="px-1.5 py-0.2 rounded-md bg-white/25 text-[10px] font-mono">
                {selectedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Info indicator when Mode === 'all' */}
      {countriesMode === 'all' && (
        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-emerald-900 text-[11px]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>طريقة الدفع هذه تظهر تلقائياً لجميع المستخدمين في كافة الدول حول العالم.</span>
          </div>
          <span className="font-bold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-md text-emerald-800">
            متاحة عالمياً
          </span>
        </div>
      )}

      {/* Specific Countries Selection Panel */}
      {countriesMode === 'specific' && (
        <div className="p-3.5 bg-white rounded-2xl border border-orange-200 shadow-2xs space-y-3 animate-fade-in">
          
          {/* Header Summary & Preset Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-xs">
                الدول المختارة للظهور:
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                selectedCount > 0 ? 'bg-orange-100 text-orange-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {selectedCount} من أصل {SUPPORTED_PAYMENT_COUNTRIES.length} دولة
              </span>
            </div>

            {/* Quick Action Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectPreset('morocco_only')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-slate-200 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="تفعيل المغرب فقط (شائع للتحويلات البنكية المحلية وكاش بليس)"
              >
                <span>🇲🇦 المغرب فقط</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('maghreb')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-slate-200 text-[10px] font-bold transition-colors cursor-pointer"
              >
                <span>المغرب العربي</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('gulf')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-slate-200 text-[10px] font-bold transition-colors cursor-pointer"
              >
                <span>الخليج العربي</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('europe')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-slate-200 text-[10px] font-bold transition-colors cursor-pointer"
              >
                <span>أوروبا وأمريكا</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('all')}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold transition-colors cursor-pointer"
              >
                <span>تحديد الكل</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('clear')}
                className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 text-[10px] transition-colors cursor-pointer"
                title="إلغاء تحديد جميع الدول"
              >
                <span>مسح</span>
              </button>
            </div>
          </div>

          {/* Warning banner if zero countries selected */}
          {selectedCount === 0 && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-center gap-2 font-bold animate-pulse">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                تنبيه: لم يتم تحديد أي دولة. لن تظهر طريقة الدفع هذه لأي مستخدم حتى تقوم باختيار دولة واحدة على الأقل.
              </span>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              placeholder="ابحث عن دولة (مثلاً: المغرب، السعودية، الجزائر، فرنسا، كندا...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Countries Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-56 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/40">
            {filteredCountries.map((country) => {
              const selected = isCountrySelected(country);
              return (
                <button
                  key={country.id}
                  type="button"
                  onClick={() => handleToggleCountry(country)}
                  className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                    selected
                      ? 'bg-orange-50 border-orange-400 text-orange-950 font-bold shadow-2xs ring-1 ring-orange-300/60'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base leading-none shrink-0">{country.flag}</span>
                    <span className="truncate text-xs">{country.nameAr}</span>
                  </div>
                  <span
                    className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 text-[10px] ${
                      selected
                        ? 'bg-orange-600 text-white font-bold'
                        : 'border border-slate-300 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                </button>
              );
            })}
          </div>

          {filteredCountries.length === 0 && (
            <div className="text-center py-4 text-xs text-slate-400">
              لا توجد دولة مطابقة للبحث «{searchQuery}»
            </div>
          )}

          {/* Active countries summary pill */}
          {selectedCount > 0 && (
            <div className="pt-1 text-[11px] text-slate-600 flex items-center flex-wrap gap-1">
              <span className="font-bold text-slate-700">الدول المفعلة حالياً:</span>
              {SUPPORTED_PAYMENT_COUNTRIES.filter(isCountrySelected).slice(0, 8).map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100/70 text-orange-900 font-bold text-[10px]"
                >
                  <span>{c.flag}</span>
                  <span>{c.nameAr}</span>
                </span>
              ))}
              {selectedCount > 8 && (
                <span className="text-[10px] text-slate-400 font-bold">
                  + {selectedCount - 8} دول أخرى
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
