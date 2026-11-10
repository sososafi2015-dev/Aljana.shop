import type { IncomingMessage, ServerResponse } from 'http';
import { 
  GEO_DATABASE, 
  resolveCountryGeoData, 
  getCitiesForCountry, 
  searchCitiesInCountry, 
  isCityValidForCountry 
} from '../data/geoCitiesDatabase';

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
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
