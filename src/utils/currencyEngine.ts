import { AssociationSettings, AssociationTenant, Language, SupportedCurrency } from '../types';
import { findCountryItem, normalizeCountryString, SUPPORTED_PAYMENT_COUNTRIES } from '../data/countriesData';

export interface CurrencyDefinition {
  code: SupportedCurrency;
  nameAr: string;
  nameFr: string;
  nameEn: string;
  shortAr: string;
  shortFr: string;
  shortEn: string;
  symbol: string;
  decimals: number;
  countryCode: string;
  localeAr: string;
  localeFr: string;
  localeEn: string;
}

export const CURRENCY_DEFINITIONS: Record<string, CurrencyDefinition> = {
  MAD: {
    code: 'MAD',
    nameAr: 'درهم مغربي',
    nameFr: 'Dirham marocain',
    nameEn: 'Moroccan Dirham',
    shortAr: 'د.م',
    shortFr: 'DH',
    shortEn: 'MAD',
    symbol: 'د.م',
    decimals: 2,
    countryCode: 'MA',
    localeAr: 'ar-MA',
    localeFr: 'fr-MA',
    localeEn: 'en-US',
  },
  SAR: {
    code: 'SAR',
    nameAr: 'ريال سعودي',
    nameFr: 'Riyal saoudien',
    nameEn: 'Saudi Riyal',
    shortAr: 'ر.س',
    shortFr: 'SAR',
    shortEn: 'SAR',
    symbol: 'ر.س',
    decimals: 2,
    countryCode: 'SA',
    localeAr: 'ar-SA-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  AED: {
    code: 'AED',
    nameAr: 'درهم إماراتي',
    nameFr: 'Dirham des Émirats',
    nameEn: 'UAE Dirham',
    shortAr: 'د.إ',
    shortFr: 'AED',
    shortEn: 'AED',
    symbol: 'د.إ',
    decimals: 2,
    countryCode: 'AE',
    localeAr: 'ar-AE-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  QAR: {
    code: 'QAR',
    nameAr: 'ريال قطري',
    nameFr: 'Riyal qatarien',
    nameEn: 'Qatari Riyal',
    shortAr: 'ر.ق',
    shortFr: 'QAR',
    shortEn: 'QAR',
    symbol: 'ر.ق',
    decimals: 2,
    countryCode: 'QA',
    localeAr: 'ar-QA-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  KWD: {
    code: 'KWD',
    nameAr: 'دينار كويتي',
    nameFr: 'Dinar koweïtien',
    nameEn: 'Kuwaiti Dinar',
    shortAr: 'د.ك',
    shortFr: 'KWD',
    shortEn: 'KWD',
    symbol: 'د.ك',
    decimals: 3,
    countryCode: 'KW',
    localeAr: 'ar-KW-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  BHD: {
    code: 'BHD',
    nameAr: 'دينار بحريني',
    nameFr: 'Dinar bahreïni',
    nameEn: 'Bahraini Dinar',
    shortAr: 'د.ب',
    shortFr: 'BHD',
    shortEn: 'BHD',
    symbol: 'د.ب',
    decimals: 3,
    countryCode: 'BH',
    localeAr: 'ar-BH-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  OMR: {
    code: 'OMR',
    nameAr: 'ريال عُماني',
    nameFr: 'Rial omanais',
    nameEn: 'Omani Rial',
    shortAr: 'ر.ع',
    shortFr: 'OMR',
    shortEn: 'OMR',
    symbol: 'ر.ع',
    decimals: 3,
    countryCode: 'OM',
    localeAr: 'ar-OM-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  JOD: {
    code: 'JOD',
    nameAr: 'دينار أردني',
    nameFr: 'Dinar jordanien',
    nameEn: 'Jordanian Dinar',
    shortAr: 'د.أ',
    shortFr: 'JOD',
    shortEn: 'JOD',
    symbol: 'د.أ',
    decimals: 3,
    countryCode: 'JO',
    localeAr: 'ar-JO-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  EGP: {
    code: 'EGP',
    nameAr: 'جنيه مصري',
    nameFr: 'Livre égyptienne',
    nameEn: 'Egyptian Pound',
    shortAr: 'ج.م',
    shortFr: 'EGP',
    shortEn: 'EGP',
    symbol: 'ج.م',
    decimals: 2,
    countryCode: 'EG',
    localeAr: 'ar-EG-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  DZD: {
    code: 'DZD',
    nameAr: 'دينار جزائري',
    nameFr: 'Dinar algérien',
    nameEn: 'Algerian Dinar',
    shortAr: 'د.ج',
    shortFr: 'DA',
    shortEn: 'DZD',
    symbol: 'د.ج',
    decimals: 2,
    countryCode: 'DZ',
    localeAr: 'ar-DZ',
    localeFr: 'fr-DZ',
    localeEn: 'en-US',
  },
  TND: {
    code: 'TND',
    nameAr: 'دينار تونسي',
    nameFr: 'Dinar tunisien',
    nameEn: 'Tunisian Dinar',
    shortAr: 'د.ت',
    shortFr: 'DT',
    shortEn: 'TND',
    symbol: 'د.ت',
    decimals: 3,
    countryCode: 'TN',
    localeAr: 'ar-TN',
    localeFr: 'fr-TN',
    localeEn: 'en-US',
  },
  LYD: {
    code: 'LYD',
    nameAr: 'دينار ليبي',
    nameFr: 'Dinar libyen',
    nameEn: 'Libyan Dinar',
    shortAr: 'د.ل',
    shortFr: 'LYD',
    shortEn: 'LYD',
    symbol: 'د.ل',
    decimals: 3,
    countryCode: 'LY',
    localeAr: 'ar-LY-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  MRU: {
    code: 'MRU',
    nameAr: 'أوقية موريتانية',
    nameFr: 'Ouguiya mauritanienne',
    nameEn: 'Mauritanian Ouguiya',
    shortAr: 'أ.م',
    shortFr: 'MRU',
    shortEn: 'MRU',
    symbol: 'أ.م',
    decimals: 2,
    countryCode: 'MR',
    localeAr: 'ar-MR-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  LBP: {
    code: 'LBP',
    nameAr: 'ليرة لبنانية',
    nameFr: 'Livre libanaise',
    nameEn: 'Lebanese Pound',
    shortAr: 'ل.ل',
    shortFr: 'LBP',
    shortEn: 'LBP',
    symbol: 'ل.ل',
    decimals: 0,
    countryCode: 'LB',
    localeAr: 'ar-LB-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  IQD: {
    code: 'IQD',
    nameAr: 'دينار عراقي',
    nameFr: 'Dinar irakien',
    nameEn: 'Iraqi Dinar',
    shortAr: 'د.ع',
    shortFr: 'IQD',
    shortEn: 'IQD',
    symbol: 'د.ع',
    decimals: 0,
    countryCode: 'IQ',
    localeAr: 'ar-IQ-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  SDG: {
    code: 'SDG',
    nameAr: 'جنيه سوداني',
    nameFr: 'Livre soudanaise',
    nameEn: 'Sudanese Pound',
    shortAr: 'ج.س',
    shortFr: 'SDG',
    shortEn: 'SDG',
    symbol: 'ج.س',
    decimals: 2,
    countryCode: 'SD',
    localeAr: 'ar-SD-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  YER: {
    code: 'YER',
    nameAr: 'ريال يمني',
    nameFr: 'Rial yéménite',
    nameEn: 'Yemeni Rial',
    shortAr: 'ر.ي',
    shortFr: 'YER',
    shortEn: 'YER',
    symbol: 'ر.ي',
    decimals: 2,
    countryCode: 'YE',
    localeAr: 'ar-YE-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  ILS: {
    code: 'ILS',
    nameAr: 'شيكل',
    nameFr: 'Shekel',
    nameEn: 'New Shekel',
    shortAr: '₪',
    shortFr: 'ILS',
    shortEn: 'ILS',
    symbol: '₪',
    decimals: 2,
    countryCode: 'PS',
    localeAr: 'ar-PS-u-nu-latn',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  EUR: {
    code: 'EUR',
    nameAr: 'يورو',
    nameFr: 'Euro',
    nameEn: 'Euro',
    shortAr: '€',
    shortFr: '€',
    shortEn: 'EUR',
    symbol: '€',
    decimals: 2,
    countryCode: 'FR',
    localeAr: 'ar-MA',
    localeFr: 'fr-FR',
    localeEn: 'en-IE',
  },
  GBP: {
    code: 'GBP',
    nameAr: 'جنيه إسترليني',
    nameFr: 'Livre sterling',
    nameEn: 'British Pound',
    shortAr: '£',
    shortFr: '£',
    shortEn: 'GBP',
    symbol: '£',
    decimals: 2,
    countryCode: 'GB',
    localeAr: 'ar-MA',
    localeFr: 'fr-FR',
    localeEn: 'en-GB',
  },
  CHF: {
    code: 'CHF',
    nameAr: 'فرنك سويسري',
    nameFr: 'Franc suisse',
    nameEn: 'Swiss Franc',
    shortAr: 'CHF',
    shortFr: 'CHF',
    shortEn: 'CHF',
    symbol: 'CHF',
    decimals: 2,
    countryCode: 'CH',
    localeAr: 'ar-MA',
    localeFr: 'fr-CH',
    localeEn: 'en-US',
  },
  SEK: {
    code: 'SEK',
    nameAr: 'كرونة سويدية',
    nameFr: 'Couronne suédoise',
    nameEn: 'Swedish Krona',
    shortAr: 'SEK',
    shortFr: 'kr',
    shortEn: 'SEK',
    symbol: 'kr',
    decimals: 2,
    countryCode: 'SE',
    localeAr: 'ar-MA',
    localeFr: 'sv-SE',
    localeEn: 'en-US',
  },
  USD: {
    code: 'USD',
    nameAr: 'دولار أمريكي',
    nameFr: 'Dollar américain',
    nameEn: 'US Dollar',
    shortAr: '$',
    shortFr: '$',
    shortEn: 'USD',
    symbol: '$',
    decimals: 2,
    countryCode: 'US',
    localeAr: 'ar-MA',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
  CAD: {
    code: 'CAD',
    nameAr: 'دولار كندي',
    nameFr: 'Dollar canadien',
    nameEn: 'Canadian Dollar',
    shortAr: 'C$',
    shortFr: 'C$',
    shortEn: 'CAD',
    symbol: 'C$',
    decimals: 2,
    countryCode: 'CA',
    localeAr: 'ar-MA',
    localeFr: 'fr-CA',
    localeEn: 'en-CA',
  },
  TRY: {
    code: 'TRY',
    nameAr: 'ليرة تركية',
    nameFr: 'Livre turque',
    nameEn: 'Turkish Lira',
    shortAr: '₺',
    shortFr: '₺',
    shortEn: 'TRY',
    symbol: '₺',
    decimals: 2,
    countryCode: 'TR',
    localeAr: 'ar-MA',
    localeFr: 'fr-FR',
    localeEn: 'en-US',
  },
};

export const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  MA: 'MAD',
  SA: 'SAR',
  AE: 'AED',
  QA: 'QAR',
  KW: 'KWD',
  BH: 'BHD',
  OM: 'OMR',
  JO: 'JOD',
  EG: 'EGP',
  DZ: 'DZD',
  TN: 'TND',
  LY: 'LYD',
  MR: 'MRU',
  PS: 'JOD',
  LB: 'LBP',
  IQ: 'IQD',
  SD: 'SDG',
  YE: 'YER',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  BE: 'EUR',
  DE: 'EUR',
  NL: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  LU: 'EUR',
  GB: 'GBP',
  UK: 'GBP',
  CH: 'CHF',
  SE: 'SEK',
  US: 'USD',
  CA: 'CAD',
  TR: 'TRY',
};

const EXTRA_COUNTRY_ALIASES: Array<{ aliases: string[]; iso: string }> = [
  { aliases: ['المملكة المغربية', 'المغرب', 'morocco', 'maroc', 'ma'], iso: 'MA' },
  { aliases: ['السعودية', 'المملكة العربية السعودية', 'saudi arabia', 'arabie saoudite', 'ksa', 'sa'], iso: 'SA' },
  { aliases: ['الامارات', 'الإمارات', 'الإمارات العربية المتحدة', 'uae', 'emirates', 'ae'], iso: 'AE' },
  { aliases: ['قطر', 'qatar', 'qa'], iso: 'QA' },
  { aliases: ['الكويت', 'kuwait', 'koweit', 'kw'], iso: 'KW' },
  { aliases: ['البحرين', 'bahrain', 'bahrein', 'bh'], iso: 'BH' },
  { aliases: ['عمان', 'عُمان', 'سلطنة عمان', 'oman', 'om'], iso: 'OM' },
  { aliases: ['الاردن', 'الأردن', 'jordan', 'jordanie', 'jo'], iso: 'JO' },
  { aliases: ['مصر', 'جمهورية مصر العربية', 'egypt', 'egypte', 'eg'], iso: 'EG' },
  { aliases: ['الجزائر', 'algeria', 'algerie', 'dz'], iso: 'DZ' },
  { aliases: ['تونس', 'tunisia', 'tunisie', 'tn'], iso: 'TN' },
  { aliases: ['ليبيا', 'libya', 'libye', 'ly'], iso: 'LY' },
  { aliases: ['موريتانيا', 'mauritania', 'mauritanie', 'mr'], iso: 'MR' },
  { aliases: ['فلسطين', 'palestine', 'ps'], iso: 'PS' },
  { aliases: ['لبنان', 'lebanon', 'liban', 'lb'], iso: 'LB' },
  { aliases: ['العراق', 'iraq', 'irak', 'iq'], iso: 'IQ' },
  { aliases: ['السودان', 'sudan', 'soudan', 'sd'], iso: 'SD' },
  { aliases: ['اليمن', 'yemen', 'ye'], iso: 'YE' },
  { aliases: ['فرنسا', 'france', 'fr'], iso: 'FR' },
  { aliases: ['اسبانيا', 'إسبانيا', 'spain', 'espagne', 'es'], iso: 'ES' },
  { aliases: ['ايطاليا', 'إيطاليا', 'italy', 'italie', 'it'], iso: 'IT' },
  { aliases: ['بلجيكا', 'belgium', 'belgique', 'be'], iso: 'BE' },
  { aliases: ['المانيا', 'ألمانيا', 'germany', 'allemagne', 'de'], iso: 'DE' },
  { aliases: ['هولندا', 'netherlands', 'pays bas', 'nl'], iso: 'NL' },
  { aliases: ['المملكة المتحدة', 'بريطانيا', 'انجلترا', 'uk', 'united kingdom', 'great britain', 'gb'], iso: 'GB' },
  { aliases: ['سويسرا', 'switzerland', 'suisse', 'ch'], iso: 'CH' },
  { aliases: ['السويد', 'sweden', 'suede', 'se'], iso: 'SE' },
  { aliases: ['الولايات المتحدة', 'امريكا', 'أمريكا', 'usa', 'united states', 'us'], iso: 'US' },
  { aliases: ['كندا', 'canada', 'ca'], iso: 'CA' },
  { aliases: ['تركيا', 'turkey', 'turkiye', 'turquie', 'tr'], iso: 'TR' },
];

/**
 * Reliable baseline exchange rates relative to 1 USD (used as immediate fallback before /api/currency/rates responds).
 */
export const DEFAULT_USD_RATES: Record<string, number> = {
  USD: 1,
  MAD: 9.85,
  SAR: 3.75,
  AED: 3.6725,
  QAR: 3.64,
  KWD: 0.307,
  BHD: 0.376,
  OMR: 0.3845,
  JOD: 0.709,
  EGP: 49.5,
  DZD: 133.5,
  TND: 3.12,
  LYD: 4.86,
  MRU: 39.7,
  LBP: 89500,
  IQD: 1310,
  SDG: 601,
  YER: 250,
  ILS: 3.68,
  EUR: 0.92,
  GBP: 0.79,
  CHF: 0.88,
  SEK: 10.65,
  CAD: 1.39,
  TRY: 34.4,
};

export function resolveCountryIsoCode(countryNameOrIso?: string): string {
  if (!countryNameOrIso) return 'MA';
  const raw = countryNameOrIso.trim();
  const upper = raw.toUpperCase();
  if (COUNTRY_TO_CURRENCY[upper]) return upper;

  const matchedItem = findCountryItem(raw);
  if (matchedItem?.id && COUNTRY_TO_CURRENCY[matchedItem.id]) {
    return matchedItem.id;
  }

  const norm = normalizeCountryString(raw);
  for (const entry of EXTRA_COUNTRY_ALIASES) {
    if (entry.aliases.some((alias) => {
      const aNorm = normalizeCountryString(alias);
      return aNorm === norm || norm.includes(aNorm) || aNorm.includes(norm);
    })) {
      return entry.iso;
    }
  }
  return 'MA';
}

export function getCountryDisplayName(countryCodeOrName?: string, lang: Language = 'ar'): string {
  const iso = resolveCountryIsoCode(countryCodeOrName);
  const found = SUPPORTED_PAYMENT_COUNTRIES.find((c) => c.id === iso);
  if (!found) return countryCodeOrName || 'المغرب';
  return lang === 'ar' ? found.nameAr : found.nameEn;
}

export function getCurrencyByCode(code?: string): CurrencyDefinition {
  const upper = (code || '').trim().toUpperCase();
  return CURRENCY_DEFINITIONS[upper] || CURRENCY_DEFINITIONS.MAD;
}

export function getCurrencyForCountry(countryNameOrIso?: string): CurrencyDefinition {
  const iso = resolveCountryIsoCode(countryNameOrIso);
  const currencyCode = COUNTRY_TO_CURRENCY[iso] || 'MAD';
  return getCurrencyByCode(currencyCode);
}

/**
 * Resolves the official accounting currency for an association with 100% backwards-compatibility
 * for existing Moroccan associations and legacy non-Moroccan associations whose cloned settings defaulted to MAD.
 */
export function resolveAssociationCurrency(
  settings?: Partial<AssociationSettings> | null,
  tenantOrCountry?: Partial<AssociationTenant> | string | null
): CurrencyDefinition {
  const countryQuery =
    (typeof tenantOrCountry === 'string' ? tenantOrCountry : tenantOrCountry?.country) ||
    settings?.country ||
    '';

  const tenantExplicitCurrency =
    typeof tenantOrCountry === 'object' && tenantOrCountry?.currency
      ? String(tenantOrCountry.currency).trim().toUpperCase()
      : '';

  // 1. Explicit ISO code on settings
  if (settings?.currencyCode && CURRENCY_DEFINITIONS[String(settings.currencyCode).toUpperCase()]) {
    return getCurrencyByCode(settings.currencyCode);
  }

  // 2. Explicit ISO code on tenant
  if (tenantExplicitCurrency && CURRENCY_DEFINITIONS[tenantExplicitCurrency]) {
    return getCurrencyByCode(tenantExplicitCurrency);
  }

  // 3. Country-based official currency overrides legacy cloned MAD defaults when country != MA
  if (countryQuery) {
    const countryCurrency = getCurrencyForCountry(countryQuery);
    const settingsEnUpper = (settings?.currencyEn || '').trim().toUpperCase();
    const isDefaultMoroccanClone =
      !settingsEnUpper || settingsEnUpper === 'MAD';
    if (countryCurrency.code !== 'MAD' && isDefaultMoroccanClone) {
      return countryCurrency;
    }
  }

  // 4. Valid currencyEn in settings (e.g. 'SAR', 'EGP', 'EUR', 'USD')
  if (settings?.currencyEn) {
    const enUpper = settings.currencyEn.trim().toUpperCase();
    if (CURRENCY_DEFINITIONS[enUpper]) {
      return getCurrencyByCode(enUpper);
    }
  }

  // 5. Match Arabic or French short symbols if explicitly customized
  const shortCandidates = [settings?.currency, settings?.currencyFr].filter(Boolean).map((v) => String(v).trim());
  for (const candidate of shortCandidates) {
    const found = Object.values(CURRENCY_DEFINITIONS).find(
      (def) =>
        def.shortAr === candidate ||
        def.shortFr === candidate ||
        def.shortEn === candidate ||
        def.nameAr === candidate
    );
    if (found) return found;
  }

  // 6. Country resolution fallback
  if (countryQuery) {
    return getCurrencyForCountry(countryQuery);
  }

  return CURRENCY_DEFINITIONS.MAD;
}

export function getCurrencyLabel(def: CurrencyDefinition, lang: Language = 'ar'): string {
  if (lang === 'fr') return def.shortFr;
  if (lang === 'en') return def.shortEn;
  return def.shortAr;
}

export function getCurrencyFullName(def: CurrencyDefinition, lang: Language = 'ar'): string {
  if (lang === 'fr') return def.nameFr;
  if (lang === 'en') return def.nameEn;
  return def.nameAr;
}

/**
 * Converts an amount strictly for display using USD-anchored rates table.
 */
export function convertCurrencyAmount(
  amount: number,
  fromCode: string,
  toCode: string,
  rates: Record<string, number> = DEFAULT_USD_RATES
): number {
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;
  const from = (fromCode || 'MAD').toUpperCase();
  const to = (toCode || 'MAD').toUpperCase();
  if (from === to) return num;

  const rateFrom = rates[from] ?? DEFAULT_USD_RATES[from] ?? 1;
  const rateTo = rates[to] ?? DEFAULT_USD_RATES[to] ?? 1;
  if (!rateFrom || !rateTo) return num;

  const usdAmount = num / rateFrom;
  return usdAmount * rateTo;
}

export interface FormatCurrencyOptions {
  showSymbol?: boolean;
  forceDecimals?: boolean;
  compactZeroDecimals?: boolean;
}

export function formatCurrencyValue(
  amount: number,
  currencyCode: string,
  lang: Language = 'ar',
  options: FormatCurrencyOptions = {}
): string {
  const { showSymbol = true, forceDecimals = false, compactZeroDecimals = true } = options;
  const def = getCurrencyByCode(currencyCode);
  const num = Number(amount);
  const safeNum = Number.isFinite(num) ? num : 0;

  const isWhole = Math.abs(safeNum - Math.round(safeNum)) < 1e-6;
  const maxFrac = def.decimals;
  const minFrac = forceDecimals ? def.decimals : (isWhole && compactZeroDecimals ? 0 : Math.min(2, def.decimals));

  const locale = lang === 'fr' ? def.localeFr : lang === 'en' ? def.localeEn : def.localeAr;

  let formattedNumber: string;
  try {
    formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac,
    }).format(safeNum);
  } catch {
    formattedNumber = safeNum.toFixed(isWhole && compactZeroDecimals ? 0 : maxFrac);
  }

  if (!showSymbol) return formattedNumber;

  const label = getCurrencyLabel(def, lang);
  // Put prefix symbol ($ / € / £) before number in Latin locales, or cleanly formatted in Arabic
  if (lang !== 'ar' && (label === '$' || label === '€' || label === '£' || label === 'C$' || label === '₺')) {
    return `${label}${formattedNumber}`;
  }
  return `${formattedNumber} ${label}`;
}

/**
 * Timezone -> ISO Country mapping for reliable privacy-safe client-side visitor detection
 */
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Africa/Casablanca': 'MA',
  'Africa/El_Aaiun': 'MA',
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Asia/Qatar': 'QA',
  'Asia/Kuwait': 'KW',
  'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM',
  'Asia/Amman': 'JO',
  'Africa/Cairo': 'EG',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Tripoli': 'LY',
  'Africa/Nouakchott': 'MR',
  'Asia/Gaza': 'PS',
  'Asia/Hebron': 'PS',
  'Asia/Beirut': 'LB',
  'Asia/Baghdad': 'IQ',
  'Africa/Khartoum': 'SD',
  'Asia/Aden': 'YE',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Africa/Ceuta': 'ES',
  'Atlantic/Canary': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Brussels': 'BE',
  'Europe/Berlin': 'DE',
  'Europe/Amsterdam': 'NL',
  'Europe/London': 'GB',
  'Europe/Zurich': 'CH',
  'Europe/Stockholm': 'SE',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Montreal': 'CA',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'Europe/Istanbul': 'TR',
  'Asia/Istanbul': 'TR',
};

export function detectClientCountryCode(): string {
  try {
    // 1. User saved preference override if any
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('syomax_visitor_country_override');
      if (saved && COUNTRY_TO_CURRENCY[saved.toUpperCase()]) {
        return saved.toUpperCase();
      }
    }

    // 2. Browser IANA Timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      return TIMEZONE_TO_COUNTRY[tz];
    }

    // 3. Navigator languages region subtag (e.g. ar-SA, fr-FR, en-GB)
    if (typeof navigator !== 'undefined') {
      const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
      for (const localeStr of langs) {
        if (!localeStr) continue;
        const parts = localeStr.replace('_', '-').split('-');
        if (parts.length >= 2) {
          const region = parts[parts.length - 1].toUpperCase();
          if (region.length === 2 && COUNTRY_TO_CURRENCY[region]) {
            return region;
          }
        }
      }
    }
  } catch {}
  return 'MA';
}
