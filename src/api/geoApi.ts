import { 
  CityInfo, 
  getCitiesForCountry, 
  isCityValidForCountry, 
  searchCitiesInCountry, 
  resolveCountryGeoData,
  normalizeGeoText
} from '../data/geoCitiesDatabase';

export interface FetchCitiesResult {
  success: boolean;
  country: string;
  countryCode: string;
  flag: string;
  total: number;
  cities: CityInfo[];
  source: 'network' | 'cache' | 'local_fallback';
  error?: string;
}

// In-memory cache for fast responsive tab switching
const citiesCache = new Map<string, FetchCitiesResult>();

/**
 * Loads cities for a selected country with network-first and instant local geographical database fallback
 */
export async function apiFetchCitiesForCountry(countryName: string): Promise<FetchCitiesResult> {
  const cleanCountry = countryName.trim();
  const cacheKey = cleanCountry.toLowerCase();

  // Check in-memory cache
  if (citiesCache.has(cacheKey)) {
    return citiesCache.get(cacheKey)!;
  }

  // Pre-resolve from local geo database
  const localGeo = resolveCountryGeoData(cleanCountry);
  const fallbackCities: CityInfo[] = localGeo ? localGeo.cities : [];
  const countryAr = localGeo ? localGeo.nameAr : cleanCountry;
  const countryCode = localGeo ? localGeo.id : '';
  const flag = localGeo ? localGeo.flag : '🌐';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(`/api/geo/cities?country=${encodeURIComponent(cleanCountry)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.cities)) {
        const result: FetchCitiesResult = {
          success: true,
          country: data.country || countryAr,
          countryCode: data.countryCode || countryCode,
          flag: data.flag || flag,
          total: data.total || data.cities.length,
          cities: data.cities,
          source: 'network',
        };
        citiesCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    // Network error or timeout - fall through to local geographical database
    console.warn(`[geoApi] Network fetch for cities of "${cleanCountry}" fell back to local database:`, err);
  }

  // Use local geographical database
  const result: FetchCitiesResult = {
    success: true,
    country: countryAr,
    countryCode,
    flag,
    total: fallbackCities.length,
    cities: fallbackCities,
    source: 'local_fallback',
  };

  if (fallbackCities.length > 0) {
    citiesCache.set(cacheKey, result);
  }

  return result;
}

export { 
  getCitiesForCountry, 
  isCityValidForCountry, 
  searchCitiesInCountry, 
  resolveCountryGeoData,
  normalizeGeoText 
};
export type { CityInfo };
