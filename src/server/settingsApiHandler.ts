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
import {
  saveDocToFirebaseServer,
  getDocFromFirebaseServer,
  awaitPendingOffloadBackups,
} from './firebaseServerStorage';

const settingsCloudReconcileCache = new Map<string, number>();
const SETTINGS_RECONCILE_TTL_MS = 2000;
const COLD_SEED_EPOCH = '1970-01-01T00:00:00.000Z';

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
    ribBank:
      (tenantRecord?.ribBank && String(tenantRecord.ribBank).trim()) ||
      (tenantRecord?.rib && String(tenantRecord.rib).trim()) ||
      initialSettings.ribBank,
    bankName:
      (tenantRecord?.bankName && String(tenantRecord.bankName).trim()) ||
      initialSettings.bankName,
    enablePublicDonations:
      tenantRecord?.enablePublicDonations !== undefined
        ? tenantRecord.enablePublicDonations
        : true,
  } as unknown as AssociationSettings;
}

function ensureBankDefaults(
  settings: AssociationSettings,
  fallbackSource?: Partial<AssociationSettings> | null,
  tenantRecord?: any
): AssociationSettings {
  const ribBank =
    (settings?.ribBank && String(settings.ribBank).trim()) ||
    (fallbackSource?.ribBank && String(fallbackSource.ribBank).trim()) ||
    (tenantRecord?.ribBank && String(tenantRecord.ribBank).trim()) ||
    (tenantRecord?.rib && String(tenantRecord.rib).trim()) ||
    initialSettings.ribBank;
  const bankName =
    (settings?.bankName && String(settings.bankName).trim()) ||
    (fallbackSource?.bankName && String(fallbackSource.bankName).trim()) ||
    (tenantRecord?.bankName && String(tenantRecord.bankName).trim()) ||
    initialSettings.bankName;
  return {
    ...settings,
    ribBank,
    bankName,
  };
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
      const merged: AssociationSettings = ensureBankDefaults(
        sanitizeSettingsMedia({
          ...baseDefaults,
          ...parsed.settings,
        }),
        baseDefaults,
        tenantRecord
      );

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
        lastUpdated: parsed.lastUpdated || COLD_SEED_EPOCH,
      };
    }
  }

  // Cold start / missing disk file: never overwrite Cloud Firestore with defaults!
  const defaultDb: SettingsDatabase = {
    settings: baseDefaults,
    lastUpdated: COLD_SEED_EPOCH,
  };

  if (cleanTenant === 'tenant_nour' || tenantRecord) {
    saveSettingsDatabase(defaultDb, cleanTenant, false);
  }
  return defaultDb;
}

export function saveSettingsDatabase(
  db: SettingsDatabase,
  tenantId?: string | null,
  syncFirestore = true
): void {
  const cleanTenant = normalizeTenantId(tenantId);
  const dbFile = getTenantSettingsFile(cleanTenant);
  const tenantRecord = cleanTenant !== 'tenant_nour' ? getTenantRecordFromDisk(cleanTenant) : null;
  const sanitizedSettings = ensureBankDefaults(sanitizeSettingsMedia(db.settings), null, tenantRecord);
  const nowIso = db.lastUpdated || new Date().toISOString();

  const cleanDb: SettingsDatabase = {
    settings: sanitizedSettings,
    lastUpdated: nowIso,
  };

  writeJsonFileAtomicSync(dbFile, cleanDb, 'branding');
  if (nowIso !== COLD_SEED_EPOCH) {
    settingsCloudReconcileCache.set(cleanTenant, Date.now());
  }

  // Mirror association settings permanently to Cloud Firestore (`settings/{cleanTenant}`)
  if (syncFirestore) {
    saveDocToFirebaseServer('settings', cleanTenant, {
      ...sanitizedSettings,
      tenantId: cleanTenant,
      lastUpdated: nowIso,
      _updatedAt: nowIso,
    }).catch(() => {});
  }

  // Synchronize association branding, identity, bank info & whatsapp back into tenants_database.json & Firestore `tenants/{cleanTenant}`
  try {
    if (fs.existsSync(TENANTS_DB_FILE)) {
      const tenants = readJsonFileSync<any[]>(TENANTS_DB_FILE, () => []);
      if (Array.isArray(tenants)) {
        const idx = tenants.findIndex((t) => t && t.id === cleanTenant);
        if (idx >= 0) {
          const s = sanitizedSettings;
          const updatedTenantRecord = {
            ...tenants[idx],
            ...(s.name && (cleanTenant === 'tenant_nour' || s.name !== 'جمعية الشايف') ? { name: s.name } : {}),
            ...(s.nameFr ? { nameFr: s.nameFr } : {}),
            ...(s.nameEn ? { nameEn: s.nameEn } : {}),
            ...(s.logoUrl ? { logoUrl: s.logoUrl } : {}),
            ...(s.bannerImageUrl ? { bannerImageUrl: s.bannerImageUrl } : {}),
            ...(s.tagline ? { tagline: s.tagline } : {}),
            ...(s.whatsapp ? { whatsapp: s.whatsapp } : {}),
            ...(s.phone ? { phone: s.phone } : {}),
            ...(s.ribBank ? { rib: s.ribBank, ribBank: s.ribBank } : {}),
            ...(s.bankName ? { bankName: s.bankName } : {}),
            ...(s.enablePublicDonations !== undefined ? { enablePublicDonations: s.enablePublicDonations } : {}),
            updatedAt: nowIso,
          };
          tenants[idx] = updatedTenantRecord;
          writeJsonFileAtomicSync(TENANTS_DB_FILE, tenants, 'tenant');

          if (syncFirestore) {
            saveDocToFirebaseServer('tenants', cleanTenant, {
              ...updatedTenantRecord,
              _updatedAt: nowIso,
            }).catch(() => {});
          }
        }
      }
    }
  } catch (syncErr) {
    console.warn('[SettingsDB] Could not sync tenant record:', syncErr);
  }
}

async function reconcileSettingsFromCloudFirestore(
  tenantId: string,
  force = false
): Promise<SettingsDatabase> {
  const cleanTenant = normalizeTenantId(tenantId);
  const localDb = loadSettingsDatabase(cleanTenant);
  const isColdLocal = localDb.lastUpdated === COLD_SEED_EPOCH;
  const lastCheck = settingsCloudReconcileCache.get(cleanTenant) || 0;
  if (!force && !isColdLocal && Date.now() - lastCheck < SETTINGS_RECONCILE_TTL_MS) {
    return localDb;
  }
  settingsCloudReconcileCache.set(cleanTenant, Date.now());

  try {
    const cloudDoc = await getDocFromFirebaseServer<any>('settings', cleanTenant);
    if (cloudDoc && typeof cloudDoc === 'object') {
      const cloudTs = new Date(cloudDoc._updatedAt || cloudDoc.lastUpdated || 0).getTime();
      const localTs = isColdLocal ? 0 : new Date(localDb.lastUpdated || 0).getTime();
      if (isColdLocal || cloudTs > localTs) {
        const { _updatedAt, lastUpdated, tenantId: _tid, ...cloudSettingsFields } = cloudDoc;
        const mergedSettings = ensureBankDefaults(
          sanitizeSettingsMedia({
            ...localDb.settings,
            ...cloudSettingsFields,
          }),
          localDb.settings
        );
        const reconciledDb: SettingsDatabase = {
          settings: mergedSettings,
          lastUpdated: cloudDoc._updatedAt || cloudDoc.lastUpdated || new Date().toISOString(),
        };
        saveSettingsDatabase(reconciledDb, cleanTenant, false);
        return reconciledDb;
      }
    }
  } catch {}
  return localDb;
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

  const cleanPath = url.split('?')[0];

  const forceCloud = parsedUrl.searchParams.get('force') === 'true';

  // 1. GET /api/settings
  if (req.method === 'GET' && cleanPath === '/api/settings') {
    const db = await reconcileSettingsFromCloudFirestore(tenantId, forceCloud);
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

      // Strict tenant-isolation guard: association admin can only edit their own tenant settings
      const adminSessionHeader = (req.headers['x-admin-session'] as string | undefined)?.trim();
      if (adminSessionHeader) {
        try {
          const parsedAdmin = JSON.parse(decodeURIComponent(adminSessionHeader));
          const isMaster =
            parsedAdmin?.isMaster === true ||
            parsedAdmin?.isMasterPlatformAdmin === true ||
            parsedAdmin?.role === 'master_super_admin';
          const sessionTenant = parsedAdmin?.tenantId ? normalizeTenantId(parsedAdmin.tenantId) : '';
          if (!isMaster && sessionTenant && sessionTenant !== targetTenant) {
            sendJson(res, 403, {
              success: false,
              error: 'غير مصرح لمدير جمعية بتعديل إعدادات جمعية أخرى.',
            });
            return true;
          }
        } catch {}
      }

      const targetDb = await reconcileSettingsFromCloudFirestore(targetTenant, true);

      const incomingSettings = body.settings || body;
      if (!incomingSettings || typeof incomingSettings !== 'object') {
        sendJson(res, 400, { success: false, error: 'Invalid settings object' });
        return true;
      }

      const sanitizedIncoming = ensureBankDefaults(
        sanitizeSettingsMedia({
          ...targetDb.settings,
          ...incomingSettings,
        }),
        targetDb.settings
      );

      const nowIso = new Date().toISOString();
      targetDb.settings = sanitizedIncoming;
      targetDb.lastUpdated = nowIso;

      saveSettingsDatabase(targetDb, targetTenant, false);

      // Await primary Firestore persistence + tenant doc + offloaded logo/banner media BEFORE responding
      const tenantRec = getTenantRecordFromDisk(targetTenant);
      await Promise.all([
        awaitPendingOffloadBackups(),
        saveDocToFirebaseServer('settings', targetTenant, {
          ...targetDb.settings,
          tenantId: targetTenant,
          lastUpdated: nowIso,
          _updatedAt: nowIso,
        }).catch(() => {}),
        tenantRec
          ? saveDocToFirebaseServer('tenants', targetTenant, {
              ...tenantRec,
              _updatedAt: nowIso,
            }).catch(() => {})
          : Promise.resolve(),
      ]);

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
