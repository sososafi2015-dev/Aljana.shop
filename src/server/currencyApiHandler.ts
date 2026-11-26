import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_USD_RATES,
  convertCurrencyAmount,
  getCurrencyByCode,
} from '../utils/currencyEngine';
import { DATA_DIR, ensureStorageDirectories, readJsonFileSync, writeJsonFileAtomicSync } from './storageEngine';

const RATES_CACHE_FILE = path.join(DATA_DIR, 'currency_rates_cache.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Strict allowlist of trusted public exchange-rate HTTPS endpoints (SSRF protection)
const ALLOWED_RATE_ENDPOINTS = [
  'https://open.er-api.com/v6/latest/USD',
  'https://api.frankfurter.app/latest?from=USD',
] as const;

interface CachedRatesPayload {
  base: 'USD';
  rates: Record<string, number>;
  updatedAt: string;
  fetchedAtMs: number;
  source: string;
}

let memoryRatesCache: CachedRatesPayload | null = null;
let inflightRefresh: Promise<CachedRatesPayload> | null = null;

function sanitizeRatesMap(rawRates: unknown): Record<string, number> {
  const sanitized: Record<string, number> = { ...DEFAULT_USD_RATES };
  if (!rawRates || typeof rawRates !== 'object' || Array.isArray(rawRates)) {
    return sanitized;
  }
  for (const [k, v] of Object.entries(rawRates as Record<string, unknown>)) {
    const cleanCode = String(k || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cleanCode)) continue;
    const num = Number(v);
    if (typeof num === 'number' && Number.isFinite(num) && num > 0 && num < 1_000_000) {
      sanitized[cleanCode] = num;
    }
  }
  sanitized.USD = 1;
  return sanitized;
}

async function fetchLiveRatesFromAllowlist(): Promise<CachedRatesPayload> {
  for (const endpoint of ALLOWED_RATE_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;

      const data: any = await res.json();
      const rawRates = data?.rates || data?.conversion_rates;
      if (rawRates && typeof rawRates === 'object') {
        const sanitized = sanitizeRatesMap(rawRates);
        const nowIso = new Date().toISOString();
        const payload: CachedRatesPayload = {
          base: 'USD',
          rates: sanitized,
          updatedAt: nowIso,
          fetchedAtMs: Date.now(),
          source: endpoint.includes('open.er-api.com') ? 'open.er-api' : 'frankfurter',
        };
        try {
          ensureStorageDirectories();
          writeJsonFileAtomicSync(RATES_CACHE_FILE, payload, 'currency');
        } catch {}
        memoryRatesCache = payload;
        return payload;
      }
    } catch {
      // Try next allowlisted provider
    }
  }

  // Fallback to persisted disk cache or static baseline
  if (memoryRatesCache) return memoryRatesCache;
  try {
    if (fs.existsSync(RATES_CACHE_FILE)) {
      const disk = readJsonFileSync<CachedRatesPayload | null>(RATES_CACHE_FILE, () => null);
      if (disk && disk.rates) {
        const restored: CachedRatesPayload = {
          base: 'USD',
          rates: sanitizeRatesMap(disk.rates),
          updatedAt: disk.updatedAt || new Date().toISOString(),
          fetchedAtMs: Number(disk.fetchedAtMs) || Date.now(),
          source: 'disk_cache',
        };
        memoryRatesCache = restored;
        return restored;
      }
    }
  } catch {}

  const fallback: CachedRatesPayload = {
    base: 'USD',
    rates: { ...DEFAULT_USD_RATES },
    updatedAt: new Date().toISOString(),
    fetchedAtMs: Date.now(),
    source: 'baseline_fallback',
  };
  memoryRatesCache = fallback;
  return fallback;
}

export async function getExchangeRatesPayload(forceRefresh = false): Promise<CachedRatesPayload> {
  if (!memoryRatesCache) {
    try {
      ensureStorageDirectories();
      if (fs.existsSync(RATES_CACHE_FILE)) {
        const disk = readJsonFileSync<CachedRatesPayload | null>(RATES_CACHE_FILE, () => null);
        if (disk && disk.rates) {
          memoryRatesCache = {
            base: 'USD',
            rates: sanitizeRatesMap(disk.rates),
            updatedAt: disk.updatedAt || new Date().toISOString(),
            fetchedAtMs: Number(disk.fetchedAtMs) || 0,
            source: disk.source || 'disk_cache',
          };
        }
      }
    } catch {}
  }

  if (
    !forceRefresh &&
    memoryRatesCache &&
    Date.now() - memoryRatesCache.fetchedAtMs < CACHE_TTL_MS
  ) {
    return memoryRatesCache;
  }

  if (!inflightRefresh) {
    inflightRefresh = fetchLiveRatesFromAllowlist().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export async function handleCurrencyApi(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const fullUrl = req.url || '';
  if (!fullUrl.startsWith('/api/currency')) {
    return false;
  }

  const urlObj = new URL(fullUrl, 'http://localhost:3000');
  const pathname = urlObj.pathname;
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET' && pathname === '/api/currency/rates') {
    const force = urlObj.searchParams.get('force') === 'true';
    const payload = await getExchangeRatesPayload(force);
    sendJson(res, 200, {
      success: true,
      base: payload.base,
      rates: payload.rates,
      updatedAt: payload.updatedAt,
      source: payload.source,
    });
    return true;
  }

  if (method === 'GET' && pathname === '/api/currency/convert') {
    const rawAmount = Number(urlObj.searchParams.get('amount') || '0');
    const fromRaw = (urlObj.searchParams.get('from') || 'MAD').trim().toUpperCase();
    const toRaw = (urlObj.searchParams.get('to') || 'MAD').trim().toUpperCase();

    if (!Number.isFinite(rawAmount) || rawAmount < 0 || rawAmount > 1_000_000_000_000) {
      sendJson(res, 400, {
        success: false,
        error: 'يرجى إدخال مبلغ مالي صالح للتحويل.',
      });
      return true;
    }

    const fromDef = getCurrencyByCode(fromRaw);
    const toDef = getCurrencyByCode(toRaw);
    const payload = await getExchangeRatesPayload(false);
    const converted = convertCurrencyAmount(rawAmount, fromDef.code, toDef.code, payload.rates);
    const unitRate = convertCurrencyAmount(1, fromDef.code, toDef.code, payload.rates);

    sendJson(res, 200, {
      success: true,
      amount: rawAmount,
      from: fromDef.code,
      to: toDef.code,
      convertedAmount: Number(converted.toFixed(toDef.decimals)),
      rate: Number(unitRate.toFixed(6)),
      updatedAt: payload.updatedAt,
    });
    return true;
  }

  return false;
}
