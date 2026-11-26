import type { IncomingMessage, ServerResponse } from 'http';
import { 
  GEO_DATABASE, 
  resolveCountryGeoData, 
  getCitiesForCountry, 
  searchCitiesInCountry, 
  isCityValidForCountry 
} from '../data/geoCitiesDatabase';

import {
  COUNTRY_TO_CURRENCY,
  getCountryDisplayName,
  getCurrencyForCountry,
} from '../utils/currencyEngine';

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

function detectCountryFromRequestHeaders(req: IncomingMessage): { countryCode: string; source: string } {
  const geoHeaderNames = [
    'cf-ipcountry',
    'x-vercel-ip-country',
    'x-appengine-country',
    'cloudfront-viewer-country',
    'x-country-code',
    'x-geo-country',
  ];

  for (const hName of geoHeaderNames) {
    const raw = req.headers[hName];
    const val = (Array.isArray(raw) ? raw[0] : raw || '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(val) && val !== 'XX' && val !== 'T1' && COUNTRY_TO_CURRENCY[val]) {
      return { countryCode: val, source: `header:${hName}` };
    }
  }

  // Fallback to Accept-Language region subtag (e.g. ar-SA, fr-FR)
  const acceptLang = String(req.headers['accept-language'] || '');
  const parts = acceptLang.split(',');
  for (const part of parts) {
    const tag = part.split(';')[0].trim().replace('_', '-');
    const subParts = tag.split('-');
    if (subParts.length >= 2) {
      const region = subParts[subParts.length - 1].toUpperCase();
      if (/^[A-Z]{2}$/.test(region) && COUNTRY_TO_CURRENCY[region]) {
        return { countryCode: region, source: 'accept-language' };
      }
    }
  }

  return { countryCode: 'MA', source: 'default' };
}

export async function handleGeoApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const fullUrl = req.url || '';
  if (!fullUrl.startsWith('/api/geo')) {
    return false;
  }

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return true;
  }

  const urlObj = new URL(fullUrl, 'http://localhost:3000');
  const pathname = urlObj.pathname;
  const method = req.method || 'GET';

  // 0. GET /api/geo/detect -> Detect visitor country and official currency
  if (method === 'GET' && pathname === '/api/geo/detect') {
    const { countryCode, source } = detectCountryFromRequestHeaders(req);
    const currency = getCurrencyForCountry(countryCode);
    const geoData = resolveCountryGeoData(countryCode);
    sendJson(res, 200, {
      success: true,
      countryCode,
      countryNameAr: geoData?.nameAr || getCountryDisplayName(countryCode, 'ar'),
      countryNameEn: geoData?.nameEn || getCountryDisplayName(countryCode, 'en'),
      flag: geoData?.flag || '🌐',
      currencyCode: currency.code,
      currencyShortAr: currency.shortAr,
      currencyShortFr: currency.shortFr,
      currencyShortEn: currency.shortEn,
      source,
    });
    return true;
  }

  // 1. GET /api/geo/cities?country=...&q=...
  if (method === 'GET' && pathname === '/api/geo/cities') {
    const countryParam = urlObj.searchParams.get('country') || '';
    const queryParam = urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || '';

    if (!countryParam.trim()) {
      sendJson(res, 400, {
        success: false,
        error: 'يرجى تحديد اسم أو رمز الدولة (مثال: country=المغرب أو country=MA).',
      });
      return true;
    }

    const geoData = resolveCountryGeoData(countryParam);
    if (!geoData) {
      sendJson(res, 404, {
        success: false,
        error: `عذراً، لم يتم العثور على قاعدة بيانات مدن للدولة المحددة: «${countryParam}».`,
        cities: [],
      });
      return true;
    }

    const matchedCities = queryParam.trim()
      ? searchCitiesInCountry(geoData.id, queryParam.trim())
      : geoData.cities;

    sendJson(res, 200, {
      success: true,
      country: geoData.nameAr,
      countryCode: geoData.id,
      flag: geoData.flag,
      total: matchedCities.length,
      cities: matchedCities,
    });
    return true;
  }

  // 2. GET /api/geo/validate-city?country=...&city=...
  if (method === 'GET' && pathname === '/api/geo/validate-city') {
    const countryParam = urlObj.searchParams.get('country') || '';
    const cityParam = urlObj.searchParams.get('city') || '';

    if (!countryParam || !cityParam) {
      sendJson(res, 400, {
        success: false,
        error: 'يرجى تزويد الدولة والمدينة للتحقق.',
      });
      return true;
    }

    const isValid = isCityValidForCountry(cityParam, countryParam);
    sendJson(res, 200, {
      success: true,
      isValid,
      city: cityParam,
      country: countryParam,
    });
    return true;
  }

  // 3. GET /api/geo/countries -> returns list of all available countries
  if (method === 'GET' && pathname === '/api/geo/countries') {
    const countries = Object.values(GEO_DATABASE).map(c => ({
      id: c.id,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      nameFr: c.nameFr,
      flag: c.flag,
      citiesCount: c.cities.length,
      currencyCode: getCurrencyForCountry(c.id).code,
    }));

    sendJson(res, 200, {
      success: true,
      total: countries.length,
      countries,
    });
    return true;
  }

  return false;
}
