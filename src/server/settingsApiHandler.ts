import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import type { AssociationSettings } from '../types';
import { initialSettings } from '../initialData';
import {
  DATA_DIR,
  ensureStorageDirectories,
  normalizeTenantId,
  offloadBase64ToDisk,
  offloadEmbeddedMediaDeep,
  readJsonFileSync,
  writeJsonFileAtomicSync,
  readLargeJsonBody,
} from './storageEngine';

export interface SettingsDatabase {
  settings: AssociationSettings;
  lastUpdated: string;
}

const TENANTS_DB_FILE = path.join(DATA_DIR, 'tenants_database.json');

function getTenantSettingsFile(tenantId?: string | null): string {
  const clean = normalizeTenantId(tenantId);
  if (clean === 'tenant_nour') {
    return path.join(DATA_DIR, 'settings_database.json');
  }
  return path.join(DATA_DIR, `settings_database_${clean}.json`);
}

function getTenantRecordFromDisk(tenantId: string): any | null {
  try {
    if (fs.existsSync(TENANTS_DB_FILE)) {
      const parsed = readJsonFileSync<any[]>(TENANTS_DB_FILE, () => []);
      if (Array.isArray(parsed)) {
        return parsed.find((t) => t && t.id === tenantId) || null;
      }
    }
  } catch {}
  return null;
}

function buildDefaultTenantSettings(tenantId: string, tenantRecord?: any): AssociationSettings {
  if (tenantId === 'tenant_nour') {
    return { ...initialSettings };
  }
  const assocName =
    tenantRecord?.name && tenantRecord.name !== 'جمعية الشايف'
      ? tenantRecord.name
      : 'منصة الجمعية';
  const assocNameFr =
    tenantRecord?.nameFr && !tenantRecord.nameFr.includes('Chayef')
      ? tenantRecord.nameFr
      : `Association ${assocName}`;
  const assocNameEn =
    tenantRecord?.nameEn && !tenantRecord.nameEn.includes('Chayef')
      ? tenantRecord.nameEn
      : assocNameFr;
  const city = tenantRecord?.city || 'المغرب';

  return {
    ...initialSettings,
    name: assocName,
    nameFr: assocNameFr,
    nameEn: assocNameEn,
    tagline:
      tenantRecord?.tagline ||
      `الشفافية والتكافل والتنمية المجتمعية المستدامة - ${city}`,
    taglineFr: `Transparence, Solidarité et Développement Durable - ${city}`,
    taglineEn: `Transparency, Solidarity and Sustainable Community Development - ${city}`,
    description: `جمعية تنموية واجتماعية غير ربحية تهدف إلى خدمة الصالح العام وتنمية المبادرات التضامنية بمدينة ${city}.`,
    descriptionFr: `Association à but non lucratif œuvrant pour l'intérêt général et le développement solidaire à ${city}.`,
    descriptionEn: `Non-profit association dedicated to public benefit and community solidarity in ${city}.`,
    address: `${city} - ${tenantRecord?.country || 'المغرب'}`,
    addressFr: `${city} - ${tenantRecord?.country || 'Maroc'}`,
    addressEn: `${city} - ${tenantRecord?.country || 'Morocco'}`,
    phone: tenantRecord?.phone || tenantRecord?.ownerPhone || initialSettings.phone,
    whatsapp: tenantRecord?.whatsapp || tenantRecord?.ownerPhone || initialSettings.whatsapp || '0661000001',
    logoUrl: tenantRecord?.logoUrl || initialSettings.logoUrl,
    bannerImageUrl: tenantRecord?.bannerImageUrl || initialSettings.bannerImageUrl,
    heroTitle: `معًا لخدمة وتنمية المجتمع مع ${assocName}`,
    heroTitleFr: `Ensemble pour le développement solidaire avec ${assocNameFr}`,
    heroTitleEn: `Together for community development with ${assocNameEn}`,
    heroSubtitle: `منصة رقمية شفافة تتيح لكل منخرط ومتبرع الاطلاع اللحظي على المداخيل، المصاريف، والأنشطة الميدانية الخاصة بـ ${assocName}.`,
    heroBadgeText: '',
    heroBadgeTextFr: '',
    heroBadgeTextEn: '',
    aboutText: `تأسست ${assocName} لتكون نموذجًا للعمل الجمعوي المؤسساتي القائم على الشفافية المالية الكاملة وتوثيق الأنشطة الميدانية.`,
    enablePublicDonations:
      tenantRecord?.enablePublicDonations !== undefined
        ? tenantRecord.enablePublicDonations
        : true,
  } as unknown as AssociationSettings;
}

function sanitizeSettingsMedia(settings: AssociationSettings): AssociationSettings {
  if (!settings || typeof settings !== 'object') return settings;
  const clone: AssociationSettings = offloadEmbeddedMediaDeep({ ...settings }, 'branding');
  if (typeof clone.logoUrl === 'string' && clone.logoUrl.startsWith('data:')) {
    clone.logoUrl = offloadBase64ToDisk(clone.logoUrl, 'branding_logo');
  }
  if (typeof clone.bannerImageUrl === 'string' && clone.bannerImageUrl.startsWith('data:')) {
    clone.bannerImageUrl = offloadBase64ToDisk(clone.bannerImageUrl, 'branding_banner');
  }
  return clone;
}

export function loadSettingsDatabase(tenantId?: string | null): SettingsDatabase {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const dbFile = getTenantSettingsFile(cleanTenant);
  const tenantRecord = cleanTenant !== 'tenant_nour' ? getTenantRecordFromDisk(cleanTenant) : null;
  const baseDefaults = buildDefaultTenantSettings(cleanTenant, tenantRecord);

  if (fs.existsSync(dbFile)) {
    const parsed = readJsonFileSync<any>(dbFile, () => null);
    if (parsed && parsed.settings && typeof parsed.settings === 'object') {
      const merged: AssociationSettings = sanitizeSettingsMedia({
        ...baseDefaults,
        ...parsed.settings,
      });

      if (
        cleanTenant !== 'tenant_nour' &&
        (merged.name === 'جمعية الشايف' || merged.name === 'جمعية النور للتنمية والتضامن') &&
        tenantRecord?.name &&
        tenantRecord.name !== 'جمعية الشايف'
      ) {
        merged.name = tenantRecord.name;
        merged.nameFr = tenantRecord.nameFr || `Association ${tenantRecord.name}`;
        merged.nameEn = tenantRecord.nameEn || merged.nameFr;
      }

      return {
        settings: merged,
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      };
    }
  }

  const defaultDb: SettingsDatabase = {
    settings: baseDefaults,
    lastUpdated: new Date().toISOString(),
  };

  if (cleanTenant === 'tenant_nour' || tenantRecord) {
    saveSettingsDatabase(defaultDb, cleanTenant);
  }
  return defaultDb;
}

export function saveSettingsDatabase(db: SettingsDatabase, tenantId?: string | null): void {
  const cleanTenant = normalizeTenantId(tenantId);
  const dbFile = getTenantSettingsFile(cleanTenant);
  const sanitizedSettings = sanitizeSettingsMedia(db.settings);

  const cleanDb: SettingsDatabase = {
    settings: sanitizedSettings,
    lastUpdated: db.lastUpdated || new Date().toISOString(),
  };

  writeJsonFileAtomicSync(dbFile, cleanDb, 'branding');

  // Synchronize association branding, identity & whatsapp back into tenants_database.json
  try {
    if (fs.existsSync(TENANTS_DB_FILE)) {
      const tenants = readJsonFileSync<any[]>(TENANTS_DB_FILE, () => []);
      if (Array.isArray(tenants)) {
        const idx = tenants.findIndex((t) => t && t.id === cleanTenant);
        if (idx >= 0) {
          const s = sanitizedSettings;
          tenants[idx] = {
            ...tenants[idx],
            ...(s.name && (cleanTenant === 'tenant_nour' || s.name !== 'جمعية الشايف') ? { name: s.name } : {}),
            ...(s.nameFr ? { nameFr: s.nameFr } : {}),
            ...(s.nameEn ? { nameEn: s.nameEn } : {}),
            ...(s.logoUrl ? { logoUrl: s.logoUrl } : {}),
            ...(s.bannerImageUrl ? { bannerImageUrl: s.bannerImageUrl } : {}),
            ...(s.tagline ? { tagline: s.tagline } : {}),
            ...(s.whatsapp ? { whatsapp: s.whatsapp } : {}),
            ...(s.phone ? { phone: s.phone } : {}),
            ...(s.enablePublicDonations !== undefined ? { enablePublicDonations: s.enablePublicDonations } : {}),
            updatedAt: new Date().toISOString(),
          };
          writeJsonFileAtomicSync(TENANTS_DB_FILE, tenants, 'tenant');
        }
      }
    }
  } catch (syncErr) {
    console.warn('[SettingsDB] Could not sync tenant record:', syncErr);
  }
}

export function initializeTenantSettings(tenantRecord: any): SettingsDatabase {
  const cleanTenant = normalizeTenantId(tenantRecord?.id);
  const initial = buildDefaultTenantSettings(cleanTenant, tenantRecord);
  const db: SettingsDatabase = {
    settings: initial,
    lastUpdated: new Date().toISOString(),
  };
  saveSettingsDatabase(db, cleanTenant);
  return db;
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
  res.end(JSON.stringify(data));
}

export async function handleSettingsApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  if (!url.startsWith('/api/settings')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return true;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    parsedUrl = new URL('http://localhost' + url);
  }
  const headerTenant = (req.headers['x-tenant-id'] as string | undefined)?.trim();
  const queryTenant = parsedUrl.searchParams.get('tenantId')?.trim();
  const tenantId = normalizeTenantId(headerTenant || queryTenant);

  const db = loadSettingsDatabase(tenantId);
  const cleanPath = url.split('?')[0];

  // 1. GET /api/settings
  if (req.method === 'GET' && cleanPath === '/api/settings') {
    sendJson(res, 200, {
      success: true,
      tenantId,
      settings: db.settings,
      lastUpdated: db.lastUpdated,
    });
    return true;
  }

  // 2. POST /api/settings/sync or PUT /api/settings or POST /api/settings
  if (
    (req.method === 'POST' && cleanPath === '/api/settings/sync') ||
    (req.method === 'PUT' && cleanPath === '/api/settings') ||
    (req.method === 'POST' && cleanPath === '/api/settings')
  ) {
    try {
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body.tenantId || tenantId);
      const targetDb = loadSettingsDatabase(targetTenant);

      const incomingSettings = body.settings || body;
      if (!incomingSettings || typeof incomingSettings !== 'object') {
        sendJson(res, 400, { success: false, error: 'Invalid settings object' });
        return true;
      }

      const sanitizedIncoming = sanitizeSettingsMedia({
        ...targetDb.settings,
        ...incomingSettings,
      });

      targetDb.settings = sanitizedIncoming;
      targetDb.lastUpdated = new Date().toISOString();

      saveSettingsDatabase(targetDb, targetTenant);

      sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        settings: targetDb.settings,
        lastUpdated: targetDb.lastUpdated,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'Failed to sync settings' });
      return true;
    }
  }

  return false;
}
