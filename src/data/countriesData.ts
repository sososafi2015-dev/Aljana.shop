/**
 * Centralized Countries Database and Availability Rules for Platform Support Payments
 */

export interface SupportedCountryItem {
  id: string; // ISO 2-letter code e.g. "MA", "SA"
  nameAr: string;
  nameEn: string;
  flag: string;
  group: 'maghreb' | 'gulf' | 'middle_east' | 'europe' | 'americas' | 'other';
}

export const SUPPORTED_PAYMENT_COUNTRIES: SupportedCountryItem[] = [
  // المغرب العربي وشمال أفريقيا
  { id: 'MA', nameAr: 'المغرب', nameEn: 'Morocco', flag: '🇲🇦', group: 'maghreb' },
  { id: 'DZ', nameAr: 'الجزائر', nameEn: 'Algeria', flag: '🇩🇿', group: 'maghreb' },
  { id: 'TN', nameAr: 'تونس', nameEn: 'Tunisia', flag: '🇹🇳', group: 'maghreb' },
  { id: 'MR', nameAr: 'موريتانيا', nameEn: 'Mauritania', flag: '🇲🇷', group: 'maghreb' },
  { id: 'LY', nameAr: 'ليبيا', nameEn: 'Libya', flag: '🇱🇾', group: 'maghreb' },
  { id: 'EG', nameAr: 'مصر', nameEn: 'Egypt', flag: '🇪🇬', group: 'maghreb' },

  // دول الخليج العربي
  { id: 'SA', nameAr: 'السعودية', nameEn: 'Saudi Arabia', flag: '🇸🇦', group: 'gulf' },
  { id: 'AE', nameAr: 'الإمارات', nameEn: 'United Arab Emirates', flag: '🇦🇪', group: 'gulf' },
  { id: 'QA', nameAr: 'قطر', nameEn: 'Qatar', flag: '🇶🇦', group: 'gulf' },
  { id: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait', flag: '🇰🇼', group: 'gulf' },
  { id: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain', flag: '🇧🇭', group: 'gulf' },
  { id: 'OM', nameAr: 'عُمان', nameEn: 'Oman', flag: '🇴🇲', group: 'gulf' },

  // بقية الدول العربية والشرق الأوسط
  { id: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', flag: '🇯🇴', group: 'middle_east' },
  { id: 'PS', nameAr: 'فلسطين', nameEn: 'Palestine', flag: '🇵🇸', group: 'middle_east' },
  { id: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon', flag: '🇱🇧', group: 'middle_east' },
  { id: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', flag: '🇮🇶', group: 'middle_east' },
  { id: 'SD', nameAr: 'السودان', nameEn: 'Sudan', flag: '🇸🇩', group: 'middle_east' },
  { id: 'YE', nameAr: 'اليمن', nameEn: 'Yemen', flag: '🇾🇪', group: 'middle_east' },

  // أوروبا
  { id: 'FR', nameAr: 'فرنسا', nameEn: 'France', flag: '🇫🇷', group: 'europe' },
  { id: 'ES', nameAr: 'إسبانيا', nameEn: 'Spain', flag: '🇪🇸', group: 'europe' },
  { id: 'IT', nameAr: 'إيطاليا', nameEn: 'Italy', flag: '🇮🇹', group: 'europe' },
  { id: 'BE', nameAr: 'بلجيكا', nameEn: 'Belgium', flag: '🇧🇪', group: 'europe' },
  { id: 'DE', nameAr: 'ألمانيا', nameEn: 'Germany', flag: '🇩🇪', group: 'europe' },
  { id: 'NL', nameAr: 'هولندا', nameEn: 'Netherlands', flag: '🇳🇱', group: 'europe' },
  { id: 'GB', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', flag: '🇬🇧', group: 'europe' },
  { id: 'CH', nameAr: 'سويسرا', nameEn: 'Switzerland', flag: '🇨🇭', group: 'europe' },
  { id: 'SE', nameAr: 'السويد', nameEn: 'Sweden', flag: '🇸🇪', group: 'europe' },

  // الأمريكتان ودول أخرى
  { id: 'US', nameAr: 'الولايات المتحدة', nameEn: 'United States', flag: '🇺🇸', group: 'americas' },
  { id: 'CA', nameAr: 'كندا', nameEn: 'Canada', flag: '🇨🇦', group: 'americas' },
  { id: 'TR', nameAr: 'تركيا', nameEn: 'Turkey', flag: '🇹🇷', group: 'other' },
];

export const COUNTRY_GROUPS_LABELS: Record<SupportedCountryItem['group'], string> = {
  maghreb: 'المغرب وشمال أفريقيا',
  gulf: 'دول الخليج العربي',
  middle_east: 'الشرق الأوسط وبقية الدول العربية',
  europe: 'الدول الأوروبية',
  americas: 'أمريكا الشمالية',
  other: 'دول أخرى',
};

/**
 * Normalizes country string for robust matching across Arabic and Latin aliases
 */
export function normalizeCountryString(nameOrCode?: string): string {
  if (!nameOrCode) return '';
  return nameOrCode
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[-_.]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Finds country metadata by name, ID, or alias
 */
export function findCountryItem(query?: string): SupportedCountryItem | undefined {
  if (!query) return undefined;
  const clean = normalizeCountryString(query);
  const upper = query.trim().toUpperCase();

  // 1. Exact ID match (e.g. "MA", "SA")
  const byId = SUPPORTED_PAYMENT_COUNTRIES.find(c => c.id === upper);
  if (byId) return byId;

  // 2. Exact Arabic or English match
  const byName = SUPPORTED_PAYMENT_COUNTRIES.find(
    c => normalizeCountryString(c.nameAr) === clean || normalizeCountryString(c.nameEn) === clean
  );
  if (byName) return byName;

  // 3. Partial inclusion (e.g. "المملكة المغربية" -> "المغرب", "السعودية" -> "المملكة العربية السعودية")
  return SUPPORTED_PAYMENT_COUNTRIES.find(c => {
    const norm = normalizeCountryString(c.nameAr);
    return clean.includes(norm) || norm.includes(clean);
  });
}

/**
 * Returns the flag for any country query or default globe
 */
export function getCountryFlagEmoji(query?: string): string {
  const item = findCountryItem(query);
  return item ? item.flag : '🌐';
}

/**
 * Checks whether a given payment method configuration allows display in the specified user country.
 */
export function isPaymentMethodAllowedInCountry(
  methodConfig: {
    enabled?: boolean;
    countriesMode?: 'all' | 'specific';
    allowedCountries?: string[];
  } | undefined,
  userCountry: string
): boolean {
  if (!methodConfig) return false;
  if (methodConfig.enabled === false) return false;

  // Mode 'all' or undefined defaults to available everywhere
  if (!methodConfig.countriesMode || methodConfig.countriesMode === 'all') {
    return true;
  }

  // Specific country mode: check membership
  const allowed = Array.isArray(methodConfig.allowedCountries) ? methodConfig.allowedCountries : [];
  if (allowed.length === 0) {
    return false;
  }

  const userNorm = normalizeCountryString(userCountry);
  const userItem = findCountryItem(userCountry);
  const userCode = userItem?.id;
  const userName = userItem?.nameAr;

  return allowed.some(a => {
    const cleanAllowed = normalizeCountryString(a);
    if (cleanAllowed === userNorm) return true;
    const allowedItem = findCountryItem(a);
    if (allowedItem && userItem) {
      return allowedItem.id === userItem.id;
    }
    if (userCode && a.trim().toUpperCase() === userCode) return true;
    if (userName && cleanAllowed === normalizeCountryString(userName)) return true;
    return false;
  });
}
