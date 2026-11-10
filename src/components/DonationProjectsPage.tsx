import React, { useState, useEffect, useMemo } from 'react';
import {
  HeartHandshake,
  Search,
  MapPin,
  Globe,
  Building2,
  ArrowLeft,
  ArrowRight,
  Filter,
  CheckCircle2,
  RotateCcw,
  FolderHeart,
  Award,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { AssociationTenant } from '../types';
import { getAllTenants } from '../tenantStorage';
import { DEFAULT_DONATIONS_COVER_IMAGE } from '../portalSettingsStorage';
import {
  applyAdCampaignPriorityToTenants,
  getAdCampaignForTenant,
  AD_CAMPAIGNS_EVENT,
  fetchAdCampaignsFromServer,
} from '../adCampaignStorage';

interface DonationProjectsPageProps {
  onBackToHome: () => void;
  onSelectTenant: (tenantId: string, fromDonations?: boolean) => void;
  onDirectDonate?: (assoc: AssociationTenant) => void;
  customTitle?: string;
  customDescription?: string;
  coverImage?: string;
  coverOverlayOpacity?: number;
}

/**
 * Normalizes Arabic text for flexible, diacritic-tolerant and letter-variant partial search.
 */
function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '');
}

/**
 * Automatically detects the user's country using browser timezone and locale.
 */
function detectUserCountry(availableCountries: string[]): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tzLower = tz.toLowerCase();

    const tzMap: Record<string, string> = {
      casablanca: 'المغرب',
      morocco: 'المغرب',
      rabat: 'المغرب',
      riyadh: 'السعودية',
      saudi: 'السعودية',
      cairo: 'مصر',
      egypt: 'مصر',
      dubai: 'الإمارات',
      uae: 'الإمارات',
      tunis: 'تونس',
      algiers: 'الجزائر',
      tripoli: 'ليبيا',
      amman: 'الأردن',
      kuwait: 'الكويت',
      doha: 'قطر',
      paris: 'فرنسا',
      madrid: 'إسبانيا',
      london: 'المملكة المتحدة',
    };

    for (const [key, countryName] of Object.entries(tzMap)) {
      if (tzLower.includes(key)) {
        if (availableCountries.includes(countryName)) {
          return countryName;
        }
      }
    }

    const navLang = (
      navigator.language ||
      (navigator.languages && navigator.languages[0]) ||
      ''
    ).toLowerCase();

    if (navLang.includes('-ma') || navLang.includes('morocco')) {
      if (availableCountries.includes('المغرب')) return 'المغرب';
    }
    if (navLang.includes('-sa') || navLang.includes('saudi')) {
      if (availableCountries.includes('السعودية')) return 'السعودية';
    }
    if (navLang.includes('-eg') || navLang.includes('egypt')) {
      if (availableCountries.includes('مصر')) return 'مصر';
    }
    if (navLang.includes('-ae')) {
      if (availableCountries.includes('الإمارات')) return 'الإمارات';
    }
  } catch (err) {
    console.warn('[DonationProjectsPage] Country detection warning:', err);
  }

  // Default to 'المغرب' if present, otherwise first country
  if (availableCountries.includes('المغرب')) {
    return 'المغرب';
  }
  return availableCountries[0] || 'المغرب';
}

export const DonationProjectsPage: React.FC<DonationProjectsPageProps> = ({
  onBackToHome,
  onSelectTenant,
  onDirectDonate,
  customTitle,
  customDescription,
  coverImage,
  coverOverlayOpacity,
}) => {
  const [tenants, setTenants] = useState<AssociationTenant[]>(() => {
    try {
      return getAllTenants().filter(
        (t) => t.status === 'active' && t.enablePublicDonations !== false
      );
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => tenants.length === 0);

  const targetImage = coverImage?.trim() || DEFAULT_DONATIONS_COVER_IMAGE;
  const [currentImgSrc, setCurrentImgSrc] = useState<string>(targetImage);

  // Synchronize image whenever prop updates
  useEffect(() => {
    setCurrentImgSrc(targetImage);
  }, [targetImage]);

  const opacityPercent =
    typeof coverOverlayOpacity === 'number'
      ? Math.max(0, Math.min(100, coverOverlayOpacity))
      : 80;
  const overlayAlpha = opacityPercent / 100;

  // Filter States
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hasInitializedCountry, setHasInitializedCountry] = useState<boolean>(false);
  const [campaignsVersion, setCampaignsVersion] = useState<number>(0);

  // Sync campaigns on mount and when campaigns change or time passes
  useEffect(() => {
    fetchAdCampaignsFromServer().then(() => {
      setCampaignsVersion((v) => v + 1);
    });

    const handleCampaignsEvent = () => {
      setCampaignsVersion((v) => v + 1);
    };

    window.addEventListener(AD_CAMPAIGNS_EVENT, handleCampaignsEvent);
    // 30s timer to re-evaluate active campaign validity in real time
    const timer = setInterval(() => {
      setCampaignsVersion((v) => v + 1);
    }, 30000);

    return () => {
      window.removeEventListener(AD_CAMPAIGNS_EVENT, handleCampaignsEvent);
      clearInterval(timer);
    };
  }, []);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Fetch active associations from database ONLY on mount of this dedicated page
  useEffect(() => {
    let isMounted = true;

    const fetchTenants = async (showLoadingSpinner = false) => {
      try {
        if (showLoadingSpinner && isMounted) {
          setIsLoading(true);
        }
        const res = await fetch('/api/tenants');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.success && Array.isArray(data.tenants)) {
              // Filter out non-active associations and associations with donations disabled
              const activeOnly = data.tenants.filter(
                (t: AssociationTenant) => t.status === 'active' && t.enablePublicDonations !== false
              );
              setTenants(activeOnly);
            } else {
              const localTenants = getAllTenants().filter(
                (t) => t.status === 'active' && t.enablePublicDonations !== false
              );
              setTenants(localTenants);
            }
          }
        } else {
          if (isMounted) {
            const localTenants = getAllTenants().filter(
              (t) => t.status === 'active' && t.enablePublicDonations !== false
            );
            setTenants(localTenants);
          }
        }
      } catch (err) {
        console.warn('[DonationProjectsPage] Error loading tenants from server:', err);
        if (isMounted) {
          const localTenants = getAllTenants().filter(
            (t) => t.status === 'active' && t.enablePublicDonations !== false
          );
          setTenants(localTenants);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTenants(tenants.length === 0);

    const handleTenantsChange = () => {
      fetchTenants(false);
    };

    window.addEventListener('chayef-tenants-changed', handleTenantsChange);
    return () => {
      isMounted = false;
      window.removeEventListener('chayef-tenants-changed', handleTenantsChange);
    };
  }, []);

  // Available countries derived from active associations
  const availableCountries = useMemo(() => {
    const countriesSet = new Set<string>();
    tenants.forEach((t) => {
      if (t.country && t.country.trim()) {
        countriesSet.add(t.country.trim());
      }
    });
    const list = Array.from(countriesSet);
    list.sort((a, b) => {
      if (a === 'المغرب') return -1;
      if (b === 'المغرب') return 1;
      return a.localeCompare(b, 'ar');
    });
    return list;
  }, [tenants]);

  // Automatically detect and set the user's country on initial load
  useEffect(() => {
    if (availableCountries.length > 0 && !hasInitializedCountry) {
      const detected = detectUserCountry(availableCountries);
      setSelectedCountry(detected);
      setHasInitializedCountry(true);
    }
  }, [availableCountries, hasInitializedCountry]);

  // Available cities in the chosen country
  const availableCities = useMemo(() => {
    if (!selectedCountry) return [];
    const citiesSet = new Set<string>();
    tenants
      .filter((t) => t.country === selectedCountry)
      .forEach((t) => {
        if (t.city && t.city.trim()) {
          citiesSet.add(t.city.trim());
        }
      });
    return Array.from(citiesSet).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [tenants, selectedCountry]);

  // Country change handler: resets city to 'all'
  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setSelectedCity('all');
  };

  // Reset filters
  const handleResetFilters = () => {
    if (availableCountries.length > 0) {
      setSelectedCountry(detectUserCountry(availableCountries));
    }
    setSelectedCity('all');
    setSearchQuery('');
  };

  // Combined Filtering: Country + City + Search Query + Advertising Campaign Priority Sorting
  const filteredAssociations = useMemo(() => {
    const normalizedQuery = normalizeArabic(searchQuery);

    const filtered = tenants.filter((assoc) => {
      // 1. Strict Country Filter (defaults to user country)
      if (selectedCountry && assoc.country !== selectedCountry) {
        return false;
      }

      // 2. City Filter
      if (selectedCity !== 'all' && assoc.city !== selectedCity) {
        return false;
      }

      // 3. Name Search Filter (partial match)
      if (normalizedQuery) {
        const nameArNorm = normalizeArabic(assoc.name || '');
        const nameFrNorm = (assoc.nameFr || '').toLowerCase();
        const nameEnNorm = (assoc.nameEn || '').toLowerCase();
        const taglineNorm = normalizeArabic(assoc.tagline || '');
        const cityNorm = normalizeArabic(assoc.city || '');

        const matches =
          nameArNorm.includes(normalizedQuery) ||
          nameFrNorm.includes(normalizedQuery) ||
          nameEnNorm.includes(normalizedQuery) ||
          taglineNorm.includes(normalizedQuery) ||
          cityNorm.includes(normalizedQuery);

        if (!matches) {
          return false;
        }
      }

      return true;
    });

    // Apply ad campaign priority (1, 2, 3...) to promote sponsored associations to the top
    return applyAdCampaignPriorityToTenants(filtered);
  }, [tenants, selectedCountry, selectedCity, searchQuery, campaignsVersion]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col" dir="rtl">
      {/* ================= STICKY TOP NAVIGATION BAR ================= */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Brand & Page Context */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20 shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>تبرع وشارك في مشاريع التنمية</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                  بوابة النفع العام
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                استكشف مبادرات ومشاريع الجمعيات المعتمدة وساهم في صناعة الأثر الإيجابي
              </p>
            </div>
          </div>

          {/* Return to Main Portal Button */}
          <button
            id="btn-back-to-home-portal"
            onClick={onBackToHome}
            className="px-4 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-xs shrink-0"
            title="العودة إلى الواجهة الرئيسية للمنصة"
          >
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <span>العودة للواجهة الرئيسية</span>
          </button>
        </div>
      </header>

      {/* ================= PAGE BODY CONTENT ================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* ================= HERO HEADER BANNER ================= */}
        <div
          id="donations-page-banner"
          className="relative rounded-3xl overflow-hidden shadow-xl border border-emerald-900/10 bg-slate-950 text-white"
        >
          <div className="absolute inset-0 z-0">
            <img
              src={currentImgSrc}
              alt="التبرع والمساهمة في مشاريع الجمعيات التنموية"
              referrerPolicy="no-referrer"
              onError={() => {
                if (currentImgSrc !== DEFAULT_DONATIONS_COVER_IMAGE) {
                  setCurrentImgSrc(DEFAULT_DONATIONS_COVER_IMAGE);
                }
              }}
              className="w-full h-full object-cover object-center scale-100 transition-transform duration-700"
            />
            {/* Dynamic Gradient Overlay */}
            <div
              className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
              style={{
                background: `linear-gradient(to right, rgba(2, 44, 34, ${Math.min(0.98, overlayAlpha * 1.05)}), rgba(4, 47, 46, ${overlayAlpha * 0.85}), rgba(2, 6, 23, ${overlayAlpha * 0.65}))`,
              }}
            />
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -top-20 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
          </div>

          <div className="relative z-10 p-6 sm:p-10 lg:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black shadow-sm backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>دليل الجمعيات المعتمدة • التبرع والمساهمة المباشرة</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
                {customTitle || 'تبرع وشارك في مشاريع التنمية'}
              </h1>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl font-medium">
                {customDescription ||
                  'ساهم وشارك في الخير. تبرع وساهم في دعم مشاريع الجمعيات ومبادراتها الخيرية والتنموية، وكن جزءًا من صناعة أثر إيجابي في المجتمع.'}
              </p>

              <div className="pt-2 flex items-center flex-wrap gap-4 sm:gap-6 text-xs text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>تحويل مباشر لمشاريع الجمعيات</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>شفافية رقمية وتوثيق ميداني</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>تصفية ذكية حسب دولتك ومدينتك</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= SMART FILTER BAR ================= */}
        <div
          id="donations-smart-filters-bar"
          className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  البحث والتصفية الذكية للجمعيات والمشاريع
                </h2>
                <p className="text-[11px] text-slate-500">
                  تم تحديد دولتك تلقائيًا لتسهيل الوصول للمبادرات والجمعيات الأقرب إليك
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end lg:self-auto">
              {(selectedCity !== 'all' || searchQuery.trim() !== '') && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 transition-colors cursor-pointer"
                  title="إعادة ضبط الفلاتر"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط</span>
                </button>
              )}
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {filteredAssociations.length} جمعية متاحة
              </span>
            </div>
          </div>

          {/* Filters Controls Grid: Country + City + Search Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2">
            {/* 1. Country Filter */}
            <div className="sm:col-span-1 lg:col-span-3">
              <label htmlFor="donations-country-select" className="block text-[11px] font-black text-slate-700 mb-1.5">
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <span>فلتر الدولة (تحديد تلقائي):</span>
                </span>
              </label>
              <div className="relative">
                <select
                  id="donations-country-select"
                  value={selectedCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 text-xs font-bold bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-800 transition-all cursor-pointer shadow-xs appearance-none"
                >
                  {availableCountries.map((c) => (
                    <option key={c} value={c}>
                      {c} {c === selectedCountry ? '📍 (الدولة المحددة)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 2. City Filter */}
            <div className="sm:col-span-1 lg:col-span-3">
              <label htmlFor="donations-city-select" className="block text-[11px] font-black text-slate-700 mb-1.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>فلتر المدينة:</span>
                </span>
              </label>
              <div className="relative">
                <select
                  id="donations-city-select"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 text-xs font-bold bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-800 transition-all cursor-pointer shadow-xs appearance-none"
                >
                  <option value="all">كل المدن ({availableCities.length} مدينة)</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 3. Search by Association Name */}
            <div className="sm:col-span-2 lg:col-span-6">
              <label htmlFor="donations-search-name-input" className="block text-[11px] font-black text-slate-700 mb-1.5">
                <span className="flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-emerald-600" />
                  <span>البحث باسم الجمعية (بحث فوري جزئي):</span>
                </span>
              </label>
              <div className="relative">
                <input
                  id="donations-search-name-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="اكتب اسم الجمعية (مثال: النور، الأمل، أطلس، البر...)"
                  className="w-full pl-9 pr-9 py-2.5 text-xs font-medium bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 transition-all shadow-xs placeholder:text-slate-400"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold px-1 py-0.5 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= ASSOCIATIONS CARDS LIST ================= */}
        <div id="donations-active-associations-container">
          {isLoading ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">جاري تحميل الجمعيات والمشاريع التنموية المعتمدة...</p>
            </div>
          ) : filteredAssociations.length === 0 ? (
            /* ================= EMPTY STATE ================= */
            <div
              id="donations-no-results-state"
              className="py-16 text-center bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xs space-y-4"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Building2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-800">
                  لم يتم العثور على جمعيات مطابقة لبحثك.
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  لا توجد جمعيات تطابق معايير التصفية الحالية (
                  {selectedCountry && `الدولة: ${selectedCountry}`}
                  {selectedCity !== 'all' && ` • المدينة: ${selectedCity}`}
                  {searchQuery && ` • البحث: "${searchQuery}"`}
                  ).
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة ضبط معايير البحث</span>
                </button>
              </div>
            </div>
          ) : (
            /* ================= ASSOCIATION CARDS GRID ================= */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssociations.map((assoc) => {
                const isTemplate = assoc.isTemplate || assoc.id === 'tenant_nour';
                const activeCampaign = getAdCampaignForTenant(assoc.id);
                const stats = assoc.stats || {
                  membersCount: 12,
                  activitiesCount: 5,
                  totalBalance: 35000,
                  campaignsCount: 2,
                };

                return (
                  <div
                    key={assoc.id}
                    id={`donation-card-${assoc.id}`}
                    className={`bg-white rounded-3xl border overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group ${
                      activeCampaign
                        ? 'border-amber-400 ring-2 ring-amber-400/30'
                        : isTemplate
                        ? 'border-amber-300/80 ring-2 ring-amber-400/20'
                        : 'border-slate-200/90 hover:border-emerald-300'
                    }`}
                  >
                    {/* Card Banner Image Header */}
                    <div className="h-36 bg-slate-900 relative overflow-hidden">
                      <img
                        src={
                          assoc.bannerImageUrl ||
                          'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80'
                        }
                        alt={assoc.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
                        {activeCampaign && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm flex items-center gap-1 animate-in fade-in">
                            <Sparkles className="w-3 h-3 text-amber-200" />
                            <span>{activeCampaign.title || 'مبادرة متميزة'}</span>
                          </span>
                        )}
                        {isTemplate && !activeCampaign && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-sm flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            <span>النموذج الأساسي</span>
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm bg-emerald-600 text-white">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span>جمعية نشطة</span>
                        </span>
                      </div>

                      {/* Location Badge */}
                      <div className="absolute bottom-3 right-3 text-white text-xs font-bold flex items-center gap-1.5 z-10 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          {assoc.city}، {assoc.country}
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        {/* Name */}
                        <h3 className="text-base font-black text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors">
                          {assoc.name}
                        </h3>

                        {/* Tagline / Mission */}
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 min-h-[36px]">
                          {assoc.tagline ||
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

                      {/* Owner Info */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-700 truncate max-w-[170px]">
                          المسؤول: {assoc.ownerName || 'إدارة الجمعية'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-800 text-[10px]">
                          تبرع ومساهمة
                        </span>
                      </div>

                      {/* Action CTA Buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          id={`donate-direct-btn-${assoc.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onDirectDonate) {
                              onDirectDonate(assoc);
                            } else {
                              onSelectTenant(assoc.id, true);
                            }
                          }}
                          className="w-full py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 shadow-xs active:scale-[0.98] select-none touch-manipulation"
                          title={`تبرع الآن لمشاريع وحملات ${assoc.name}`}
                          aria-label={`تبرع الآن لمشاريع وحملات ${assoc.name}`}
                        >
                          <HeartHandshake className="w-3.5 h-3.5 text-amber-300" />
                          <span>تبرع الآن</span>
                        </button>

                        <button
                          type="button"
                          id={`visit-association-btn-${assoc.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelectTenant(assoc.id, true);
                          }}
                          className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border active:scale-[0.98] select-none touch-manipulation ${
                            isTemplate
                              ? 'border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100'
                              : 'border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100'
                          }`}
                          title={`تصفح مشاريع وحملات ${assoc.name}`}
                          aria-label={`تصفح مشاريع وحملات ${assoc.name}`}
                        >
                          <FolderHeart className="w-3.5 h-3.5 text-emerald-600" />
                          <span>تصفح المشاريع</span>
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Back to Home Portal Bottom Banner */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>syoumax منصة العمل الجمعوي • منظومة موحدة للتنمية والتضامن</span>
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>الرجوع إلى الصفحة الرئيسية للمنصة</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default DonationProjectsPage;
