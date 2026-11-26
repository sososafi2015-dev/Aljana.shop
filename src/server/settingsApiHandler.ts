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
  listCollectionFromFirebaseServer,
  awaitPendingOffloadBackups,
} from './firebaseServerStorage';
import {
  normalizeLoginUsername,
  validateSettingsAdminUsername,
  hashPasswordScrypt,
} from './authCrypto';
import { normalizeAssociationDomains } from '../utils/associationDomains';
import { getCurrencyForCountry, resolveAssociationCurrency } from '../utils/currencyEngine';

const settingsCloudReconcileCache = new Map<string, number>();
const SETTINGS_RECONCILE_TTL_MS = 2000;
const COLD_SEED_EPOCH = '1970-01-01T00:00:00.000Z';

export interface SettingsDatabase {
  settings: AssociationSettings;
  lastUpdated: string;
}

const TENANTS_DB_FILE = path.join(DATA_DIR, 'tenants_database.json');
const OWNERS_DB_FILE = path.join(DATA_DIR, 'owners_database.json');

function normalizeUsernameKey(raw?: string | null): string {
  return normalizeLoginUsername(raw);
}

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

function getOwnerUsernameFromDisk(tenantId: string, tenantRecord?: any): string {
  const fromTenant = String(tenantRecord?.ownerUsername || '').trim();
  if (fromTenant) return fromTenant;
  try {
    if (fs.existsSync(OWNERS_DB_FILE)) {
      const owners = readJsonFileSync<any[]>(OWNERS_DB_FILE, () => []);
      if (Array.isArray(owners)) {
        const matched = owners.find(
          (o) =>
            o &&
            (o.tenantId === tenantId ||
              (tenantRecord?.ownerId && o.id === tenantRecord.ownerId))
        );
        if (matched?.username && String(matched.username).trim()) {
          return String(matched.username).trim();
        }
      }
    }
  } catch {}
  if (tenantId === 'tenant_nour') return 'nour2024';
  if (tenantId === 'tenant_amal') return 'amal2024';
  if (tenantId === 'tenant_atlas_khenifra') return 'atlas2024';
  if (tenantId === 'tenant_al_istithmar') return 'istithmar24';
  return '';
}

function syncOwnerCredentialsOnDisk(
  tenantId: string,
  updates: {
    username?: string;
    passwordHash?: string;
    passwordSalt?: string;
    fullName?: string;
    phone?: string;
  },
  nowIso: string
): void {
  const cleanUsername = typeof updates.username === 'string' ? updates.username.trim() : '';
  const hasPasswordUpdate = Boolean(updates.passwordHash && updates.passwordSalt);
  if (!cleanUsername && !hasPasswordUpdate) return;
  try {
    const owners = fs.existsSync(OWNERS_DB_FILE)
      ? readJsonFileSync<any[]>(OWNERS_DB_FILE, () => [])
      : [];
    const safeOwners = Array.isArray(owners) ? owners : [];
    const tenantRec = getTenantRecordFromDisk(tenantId);
    const ownerIdx = safeOwners.findIndex(
      (o) =>
        o &&
        (o.tenantId === tenantId ||
          (tenantRec?.ownerId && o.id === tenantRec.ownerId))
    );
    if (ownerIdx >= 0) {
      const updatedOwner: Record<string, any> = {
        ...safeOwners[ownerIdx],
        ...(cleanUsername ? { username: cleanUsername } : {}),
        ...(hasPasswordUpdate
          ? {
              passwordHash: updates.passwordHash,
              passwordSalt: updates.passwordSalt,
              hasCustomPassword: true,
              recoveredAccount: false,
            }
          : {}),
        updatedAt: nowIso,
      };
      delete updatedOwner.plainPassword;
      safeOwners[ownerIdx] = updatedOwner;
      writeJsonFileAtomicSync(OWNERS_DB_FILE, safeOwners, 'owner');
    } else if (tenantRec || cleanUsername || hasPasswordUpdate) {
      const newOwner: Record<string, any> = {
        id: tenantRec?.ownerId || `owner_${tenantId}`,
        ...(cleanUsername ? { username: cleanUsername } : {}),
        fullName: updates.fullName || tenantRec?.ownerName || 'مدير الجمعية',
        phone: updates.phone || tenantRec?.ownerPhone || '',
        passwordHash: updates.passwordHash || tenantRec?.passwordHash || '',
        passwordSalt: updates.passwordSalt || tenantRec?.passwordSalt || '',
        hasCustomPassword: Boolean(hasPasswordUpdate || tenantRec?.passwordHash || cleanUsername),
        tenantId,
        status: 'active',
        createdAt: tenantRec?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      safeOwners.unshift(newOwner);
      writeJsonFileAtomicSync(OWNERS_DB_FILE, safeOwners, 'owner');
    }
  } catch (err) {
    console.warn('[SettingsDB] Could not sync owner credentials on disk:', err);
  }
}

function sanitizePublicSettingsResponse(settings: AssociationSettings, hasHashedCredential: boolean): AssociationSettings {
  if (!settings) return settings;
  if (hasHashedCredential) {
    return {
      ...settings,
      adminPin: '',
    };
  }
  return settings;
}

function buildDefaultTenantSettings(tenantId: string, tenantRecord?: any): AssociationSettings {
  const resolvedOwnerUsername = getOwnerUsernameFromDisk(tenantId, tenantRecord);
  if (tenantId === 'tenant_nour') {
    return {
      ...initialSettings,
      adminUsername: resolvedOwnerUsername || initialSettings.adminUsername || 'nour2024',
    };
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
  const countryName = tenantRecord?.country || 'المغرب';
  const autoCurrency = getCurrencyForCountry(countryName);

  return {
    ...initialSettings,
    name: assocName,
    nameFr: assocNameFr,
    nameEn: assocNameEn,
    country: countryName,
    city,
    currency: autoCurrency.shortAr,
    currencyFr: autoCurrency.shortFr,
    currencyEn: autoCurrency.code,
    currencyCode: autoCurrency.code,
    tagline:
      tenantRecord?.tagline ||
      `الشفافية والتكافل والتنمية المجتمعية المستدامة - ${city}`,
    taglineFr: `Transparence, Solidarité et Développement Durable - ${city}`,
    taglineEn: `Transparency, Solidarity and Sustainable Community Development - ${city}`,
    description: `جمعية تنموية واجتماعية غير ربحية تهدف إلى خدمة الصالح العام وتنمية المبادرات التضامنية بمدينة ${city}.`,
    descriptionFr: `Association à but non lucratif œuvrant pour l'intérêt général et le développement solidaire à ${city}.`,
    descriptionEn: `Non-profit association dedicated to public benefit and community solidarity in ${city}.`,
    address: `${city} - ${countryName}`,
    addressFr: `${city} - ${countryName}`,
    addressEn: `${city} - ${countryName}`,
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
    adminPin: tenantRecord?.passwordHash ? '' : initialSettings.adminPin,
    adminUsername: resolvedOwnerUsername,
    associationDomains: normalizeAssociationDomains(tenantRecord?.associationDomains),
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
  const effectiveCountry = settings?.country || tenantRecord?.country || fallbackSource?.country || 'المغرب';
  const resolvedCurr = resolveAssociationCurrency(
    {
      ...settings,
      country: effectiveCountry,
    },
    tenantRecord || effectiveCountry
  );
  return {
    ...settings,
    country: effectiveCountry,
    city: settings?.city || tenantRecord?.city || fallbackSource?.city,
    currency: resolvedCurr.shortAr,
    currencyFr: resolvedCurr.shortFr,
    currencyEn: resolvedCurr.code,
    currencyCode: resolvedCurr.code,
    ribBank,
    bankName,
    associationDomains: normalizeAssociationDomains(
      settings?.associationDomains ?? fallbackSource?.associationDomains ?? tenantRecord?.associationDomains
    ),
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
  const tenantRecord = getTenantRecordFromDisk(cleanTenant);
  const baseDefaults = buildDefaultTenantSettings(cleanTenant, tenantRecord);
  const authoritativeDiskUsername = getOwnerUsernameFromDisk(cleanTenant, tenantRecord);

  if (fs.existsSync(dbFile)) {
    const parsed = readJsonFileSync<any>(dbFile, () => null);
    if (parsed && parsed.settings && typeof parsed.settings === 'object') {
      const merged: AssociationSettings = ensureBankDefaults(
        sanitizeSettingsMedia({
          ...baseDefaults,
          ...parsed.settings,
          adminUsername:
            (typeof parsed.settings.adminUsername === 'string' && parsed.settings.adminUsername.trim()) ||
            authoritativeDiskUsername ||
            baseDefaults.adminUsername ||
            '',
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

  // Synchronize association branding, identity, bank info, whatsapp & adminUsername back into tenants_database.json, owners_database.json & Firestore `tenants/{cleanTenant}`
  try {
    const cleanAdminUsername = typeof sanitizedSettings.adminUsername === 'string'
      ? sanitizedSettings.adminUsername.trim()
      : '';
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
            ...(cleanAdminUsername ? { ownerUsername: cleanAdminUsername } : {}),
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
    if (cleanAdminUsername) {
      syncOwnerCredentialsOnDisk(cleanTenant, { username: cleanAdminUsername }, nowIso);
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
    const [cloudDoc, cloudTenantDoc] = await Promise.all([
      getDocFromFirebaseServer<any>('settings', cleanTenant),
      getDocFromFirebaseServer<any>('tenants', cleanTenant),
    ]);
    const cloudTenantUsername =
      typeof cloudTenantDoc?.ownerUsername === 'string' && cloudTenantDoc.ownerUsername.trim()
        ? cloudTenantDoc.ownerUsername.trim()
        : '';

    if (cloudDoc && typeof cloudDoc === 'object') {
      const cloudTs = new Date(cloudDoc._updatedAt || cloudDoc.lastUpdated || 0).getTime();
      const localTs = isColdLocal ? 0 : new Date(localDb.lastUpdated || 0).getTime();
      const cloudSettingsUsername =
        typeof cloudDoc.adminUsername === 'string' && cloudDoc.adminUsername.trim()
          ? cloudDoc.adminUsername.trim()
          : '';
      const resolvedUsername =
        cloudTenantUsername ||
        cloudSettingsUsername ||
        (typeof localDb.settings.adminUsername === 'string' ? localDb.settings.adminUsername.trim() : '') ||
        getOwnerUsernameFromDisk(cleanTenant, cloudTenantDoc);

      if (isColdLocal || cloudTs > localTs || (resolvedUsername && localDb.settings.adminUsername !== resolvedUsername)) {
        const { _updatedAt, lastUpdated, tenantId: _tid, ...cloudSettingsFields } = cloudDoc;
        const baseForMerge = isColdLocal || cloudTs > localTs
          ? { ...localDb.settings, ...cloudSettingsFields }
          : { ...localDb.settings };
        const mergedSettings = ensureBankDefaults(
          sanitizeSettingsMedia({
            ...baseForMerge,
            ...(resolvedUsername ? { adminUsername: resolvedUsername } : {}),
            ...(cloudTenantDoc?.passwordHash ? { adminPin: '' } : {}),
          }),
          localDb.settings,
          cloudTenantDoc
        );
        const reconciledDb: SettingsDatabase = {
          settings: mergedSettings,
          lastUpdated: (isColdLocal || cloudTs > localTs)
            ? (cloudDoc._updatedAt || cloudDoc.lastUpdated || new Date().toISOString())
            : localDb.lastUpdated,
        };
        saveSettingsDatabase(reconciledDb, cleanTenant, false);
        return reconciledDb;
      }
    } else if (cloudTenantUsername && localDb.settings.adminUsername !== cloudTenantUsername) {
      localDb.settings = {
        ...localDb.settings,
        adminUsername: cloudTenantUsername,
        ...(cloudTenantDoc?.passwordHash ? { adminPin: '' } : {}),
      };
      saveSettingsDatabase(localDb, cleanTenant, false);
      return localDb;
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
    const [db, cloudTenant] = await Promise.all([
      reconcileSettingsFromCloudFirestore(tenantId, forceCloud),
      getDocFromFirebaseServer<any>('tenants', tenantId).catch(() => null),
    ]);
    const localTenant = getTenantRecordFromDisk(tenantId);
    const hasHash = Boolean(cloudTenant?.passwordHash || localTenant?.passwordHash);
    const authoritativeUsername =
      (typeof cloudTenant?.ownerUsername === 'string' && cloudTenant.ownerUsername.trim()) ||
      (typeof db.settings.adminUsername === 'string' && db.settings.adminUsername.trim()) ||
      getOwnerUsernameFromDisk(tenantId, localTenant);
    const publicSettings = sanitizePublicSettingsResponse(
      {
        ...db.settings,
        ...(authoritativeUsername ? { adminUsername: authoritativeUsername } : {}),
      },
      hasHash
    );
    sendJson(res, 200, {
      success: true,
      tenantId,
      settings: publicSettings,
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

      const [targetDb, cloudTenantCurrent, allCloudTenants] = await Promise.all([
        reconcileSettingsFromCloudFirestore(targetTenant, true),
        getDocFromFirebaseServer<any>('tenants', targetTenant).catch(() => null),
        listCollectionFromFirebaseServer<any>('tenants').catch(() => []),
      ]);

      const incomingSettings = body.settings || body;
      if (!incomingSettings || typeof incomingSettings !== 'object') {
        sendJson(res, 400, { success: false, error: 'Invalid settings object' });
        return true;
      }

      const diskTenantCurrent = getTenantRecordFromDisk(targetTenant);
      const currentTenantRecord: Record<string, any> = {
        ...(diskTenantCurrent || {}),
        ...(cloudTenantCurrent || {}),
        id: targetTenant,
      };
      // Preserve local passwordHash if Cloud doc did not yet have one
      if (!currentTenantRecord.passwordHash && diskTenantCurrent?.passwordHash) {
        currentTenantRecord.passwordHash = diskTenantCurrent.passwordHash;
        currentTenantRecord.passwordSalt = diskTenantCurrent.passwordSalt || '';
      }

      const currentAuthUsername =
        (typeof currentTenantRecord.ownerUsername === 'string' && currentTenantRecord.ownerUsername.trim()) ||
        (typeof targetDb.settings.adminUsername === 'string' && targetDb.settings.adminUsername.trim()) ||
        getOwnerUsernameFromDisk(targetTenant, currentTenantRecord);

      // 1. Validate & check Cloud-wide uniqueness for adminUsername when provided
      let finalAdminUsername = currentAuthUsername;
      let usernameChanged = false;
      if (typeof incomingSettings.adminUsername === 'string') {
        const rawIncomingUsername = incomingSettings.adminUsername.trim();
        if (rawIncomingUsername && normalizeUsernameKey(rawIncomingUsername) !== normalizeUsernameKey(currentAuthUsername)) {
          const formatCheck = validateSettingsAdminUsername(rawIncomingUsername);
          if (!formatCheck.valid) {
            sendJson(res, 400, {
              success: false,
              error: formatCheck.error || 'صيغة اسم المستخدم غير صالحة.',
            });
            return true;
          }

          const normIncoming = normalizeUsernameKey(formatCheck.clean);
          const localTenantsList = fs.existsSync(TENANTS_DB_FILE)
            ? readJsonFileSync<any[]>(TENANTS_DB_FILE, () => [])
            : [];
          const combinedTenants = [...(Array.isArray(allCloudTenants) ? allCloudTenants : []), ...(Array.isArray(localTenantsList) ? localTenantsList : [])];

          const conflictingTenant = combinedTenants.find(
            (t) =>
              t &&
              t.id &&
              t.id !== targetTenant &&
              t.ownerUsername &&
              normalizeUsernameKey(t.ownerUsername) === normIncoming
          );
          if (conflictingTenant) {
            sendJson(res, 409, {
              success: false,
              error: 'اسم المستخدم هذا مستخدم بالفعل لدى جمعية أخرى. يرجى اختيار اسم مستخدم مختلف.',
            });
            return true;
          }

          finalAdminUsername = formatCheck.clean;
          usernameChanged = true;
        } else if (rawIncomingUsername) {
          finalAdminUsername = rawIncomingUsername;
        }
      }

      // 2. Detect explicit password/PIN update and hash strongly with scrypt
      const prevStoredPin = String(targetDb.settings.adminPin || '').trim();
      const rawIncomingPin =
        typeof incomingSettings.newAdminPassword === 'string' && incomingSettings.newAdminPassword.trim()
          ? incomingSettings.newAdminPassword.trim()
          : typeof incomingSettings.adminPin === 'string'
          ? incomingSettings.adminPin.trim()
          : '';
      const isMaskedPlaceholder = /^[•*]+$/.test(rawIncomingPin);
      const isPasswordChanged = Boolean(
        rawIncomingPin &&
        !isMaskedPlaceholder &&
        rawIncomingPin !== prevStoredPin
      );

      let nextPasswordHash = String(currentTenantRecord.passwordHash || '').trim();
      let nextPasswordSalt = String(currentTenantRecord.passwordSalt || '').trim();

      if (isPasswordChanged) {
        if (rawIncomingPin.length < 4) {
          sendJson(res, 400, {
            success: false,
            error: 'يجب أن تتكون كلمة المرور أو الرمز السري الجديد من 4 أحرف أو أرقام على الأقل.',
          });
          return true;
        }
        const hashed = hashPasswordScrypt(rawIncomingPin);
        nextPasswordHash = hashed.hash;
        nextPasswordSalt = hashed.salt;
      }

      const nowIso = new Date().toISOString();
      const hasAnyHashedPassword = Boolean(nextPasswordHash);

      const sanitizedIncoming = ensureBankDefaults(
        sanitizeSettingsMedia({
          ...targetDb.settings,
          ...incomingSettings,
          // Never store plaintext password in public settings when hashed credential exists
          adminPin: hasAnyHashedPassword ? '' : prevStoredPin,
          ...(finalAdminUsername ? { adminUsername: finalAdminUsername } : {}),
        }),
        targetDb.settings
      );
      delete (sanitizedIncoming as any).newAdminPassword;

      targetDb.settings = sanitizedIncoming;
      targetDb.lastUpdated = nowIso;

      // Save settings locally (without triggering an un-awaited duplicate tenant write)
      writeJsonFileAtomicSync(getTenantSettingsFile(targetTenant), targetDb, 'branding');
      settingsCloudReconcileCache.set(targetTenant, Date.now());

      // Build authoritative updated tenant record preserving/updating credentials atomically
      const s = sanitizedIncoming;
      const updatedTenantRecord: Record<string, any> = {
        ...currentTenantRecord,
        id: targetTenant,
        ...(s.name && (targetTenant === 'tenant_nour' || s.name !== 'جمعية الشايف') ? { name: s.name } : {}),
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
        associationDomains: normalizeAssociationDomains(s.associationDomains),
        ...(finalAdminUsername ? { ownerUsername: finalAdminUsername } : {}),
        ...(nextPasswordHash
          ? {
              passwordHash: nextPasswordHash,
              passwordSalt: nextPasswordSalt,
              hasCustomPassword: true,
            }
          : {}),
        ...(usernameChanged || isPasswordChanged ? { credentialsUpdatedAt: nowIso } : {}),
        updatedAt: nowIso,
        _updatedAt: nowIso,
      };
      delete updatedTenantRecord.plainPassword;
      delete updatedTenantRecord.password;
      delete updatedTenantRecord.ownerPasswordHash;
      delete updatedTenantRecord.ownerPasswordSalt;

      // Update local tenants_database.json immediately
      try {
        const allTenantsDisk = fs.existsSync(TENANTS_DB_FILE)
          ? readJsonFileSync<any[]>(TENANTS_DB_FILE, () => [])
          : [];
        const safeTenants = Array.isArray(allTenantsDisk) ? allTenantsDisk : [];
        const idx = safeTenants.findIndex((t) => t && t.id === targetTenant);
        if (idx >= 0) {
          safeTenants[idx] = { ...safeTenants[idx], ...updatedTenantRecord };
          writeJsonFileAtomicSync(TENANTS_DB_FILE, safeTenants, 'tenant');
        }
      } catch (diskTenantErr) {
        console.warn('[SettingsDB] Could not update local tenants_database.json:', diskTenantErr);
      }

      // Synchronize local owners_database.json immediately so old username & old password are revoked on disk too
      if (finalAdminUsername || isPasswordChanged) {
        syncOwnerCredentialsOnDisk(
          targetTenant,
          {
            ...(finalAdminUsername ? { username: finalAdminUsername } : {}),
            ...(isPasswordChanged ? { passwordHash: nextPasswordHash, passwordSalt: nextPasswordSalt } : {}),
          },
          nowIso
        );
      }

      // Await primary Cloud Firestore persistence for settings + authoritative tenant credentials + offloaded media BEFORE responding
      const [, settingsSavedOk, tenantSavedOk] = await Promise.all([
        awaitPendingOffloadBackups(),
        saveDocToFirebaseServer('settings', targetTenant, {
          ...targetDb.settings,
          tenantId: targetTenant,
          lastUpdated: nowIso,
          _updatedAt: nowIso,
        }).catch(() => false),
        saveDocToFirebaseServer('tenants', targetTenant, updatedTenantRecord).catch(() => false),
      ]);

      if ((usernameChanged || isPasswordChanged) && !tenantSavedOk) {
        sendJson(res, 503, {
          success: false,
          error: 'تعذر حفظ بيانات الدخول الجديدة في قاعدة البيانات السحابية. يرجى المحاولة مرة أخرى.',
        });
        return true;
      }

      sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        settings: sanitizePublicSettingsResponse(targetDb.settings, hasAnyHashedPassword),
        credentialsUpdated: usernameChanged || isPasswordChanged,
        usernameUpdated: usernameChanged,
        passwordUpdated: isPasswordChanged,
        cloudSynced: Boolean(settingsSavedOk && tenantSavedOk),
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
