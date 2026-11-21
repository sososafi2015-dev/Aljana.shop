import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initializeTenantCampaigns } from './campaignsApiHandler';
import { initializeTenantActivities } from './activitiesApiHandler';
import { initializeTenantPolls } from './pollsApiHandler';
import { initializeTenantSettings, loadSettingsDatabase, saveSettingsDatabase } from './settingsApiHandler';
import { readTenantRecordsFromDisk, writeTenantRecordsToDisk } from './tenantRecordsApiHandler';
import { loadSubAdminsDatabase, hydrateSubAdminsFromFirestore } from './subAdminsApiHandler';
import { offloadBase64ToDisk, readLargeJsonBody, writeJsonFileAtomicSync } from './storageEngine';
import {
  saveDocToFirebaseServer,
  getDocFromFirebaseServer,
  listCollectionFromFirebaseServer,
  deleteDocFromFirebaseServer,
} from './firebaseServerStorage';
import {
  normalizeLoginUsername,
  generateAuthSalt,
  hashPasswordScrypt,
  hashPasswordLegacySha256,
  legacyClientDjb2Hash,
  verifyPasswordHashServer,
  sanitizePublicTenant,
  sanitizePublicOwner,
} from './authCrypto';

let tenantsCloudReconcileLastTs = 0;
const TENANTS_RECONCILE_TTL_MS = 8000;

const DATA_DIR = path.join(process.cwd(), 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const TENANTS_FILE = path.join(DATA_DIR, 'tenants_database.json');
const OWNERS_FILE = path.join(DATA_DIR, 'owners_database.json');
const SUBADMINS_FILE = path.join(DATA_DIR, 'subadmins_database.json');
const DELETED_TENANTS_FILE = path.join(DATA_DIR, 'deleted_tenants_database.json');

// Track explicitly deleted tenant IDs in memory and on disk so sync never resurrects an intentionally deleted tenant
const explicitlyDeletedTenantIds = new Set<string>();

function loadDeletedTenantIdsFromDisk(): Set<string> {
  ensureDataDir();
  try {
    if (fs.existsSync(DELETED_TENANTS_FILE)) {
      const raw = fs.readFileSync(DELETED_TENANTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === 'string' && id.trim() && id !== 'tenant_nour') {
            explicitlyDeletedTenantIds.add(id.trim());
          }
        }
      }
    }
  } catch (err) {
    console.warn('[tenantsApiHandler] Could not read deleted_tenants_database.json:', err);
  }
  return explicitlyDeletedTenantIds;
}

function saveDeletedTenantIdsToDisk(): void {
  ensureDataDir();
  try {
    const arr = Array.from(explicitlyDeletedTenantIds).filter((id) => id && id !== 'tenant_nour');
    fs.writeFileSync(DELETED_TENANTS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[tenantsApiHandler] Could not write deleted_tenants_database.json:', err);
  }
}

function addDeletedTenantIdOnServer(tenantId: string): void {
  if (!tenantId || tenantId === 'tenant_nour') return;
  loadDeletedTenantIdsFromDisk();
  explicitlyDeletedTenantIds.add(tenantId);
  saveDeletedTenantIdsToDisk();
  saveDocToFirebaseServer('settings', 'deleted_tenants_registry', {
    deletedTenantIds: Array.from(explicitlyDeletedTenantIds),
    _updatedAt: new Date().toISOString(),
  }).catch(() => {});
}

function removeDeletedTenantIdOnServer(tenantId: string): void {
  if (!tenantId) return;
  loadDeletedTenantIdsFromDisk();
  if (explicitlyDeletedTenantIds.delete(tenantId)) {
    saveDeletedTenantIdsToDisk();
  }
}

const INITIAL_SERVER_TENANTS = [
  {
    id: 'tenant_nour',
    name: 'جمعية النور للتنمية والتضامن',
    nameFr: 'Association An-Nour pour le Développement et la Solidarité',
    nameEn: 'An-Nour Association for Development and Solidarity',
    country: 'المغرب',
    city: 'الدار البيضاء',
    slug: 'nour',
    logoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=300&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80',
    ownerId: 'owner_nour_master',
    ownerUsername: 'nour2024',
    ownerName: 'أحمد المنصوري (رئيس الجمعية)',
    ownerPhone: '0661000001',
    status: 'active',
    paymentVerified: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    tier: 'pro',
    monthlyFee: 399,
    isTemplate: true,
    isVisibleOnPublicPortal: true,
    enablePublicDonations: false,
    tagline: 'الشفافية والتكافل والتنمية المجتمعية المستدامة',
    stats: {
      membersCount: 14,
      activitiesCount: 8,
      totalBalance: 46250,
      campaignsCount: 3,
    },
  },
  {
    id: 'tenant_amal',
    name: 'جمعية الأمل لرعاية الأيتام والتنمية الاجتماعية',
    nameFr: 'Association Al Amal pour la Protection des Orphelins',
    nameEn: 'Al Amal Association for Orphan Care',
    country: 'المغرب',
    city: 'الرباط',
    slug: 'amal',
    logoUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=300&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1600&q=80',
    ownerId: 'owner_amal_khadija',
    ownerUsername: 'amal2024',
    ownerName: 'خديجة العلمي',
    ownerPhone: '0662000002',
    status: 'active',
    paymentVerified: true,
    createdAt: '2024-03-15T10:30:00.000Z',
    tier: 'basic',
    monthlyFee: 199,
    isTemplate: false,
    isVisibleOnPublicPortal: false,
    enablePublicDonations: true,
    tagline: 'رعاية الأيتام والنهوض بالتعليم والتكافل المجتمعي وتمويل المشاريع الإنسانية',
    stats: {
      membersCount: 8,
      activitiesCount: 4,
      totalBalance: 24300,
      campaignsCount: 2,
    },
  },
  {
    id: 'tenant_borj_nador',
    name: 'جمعية برج الناضور',
    nameFr: 'Association Borj Nador',
    nameEn: 'Borj Nador Association',
    country: 'المغرب',
    city: 'الناظور',
    slug: 'borj-nador',
    logoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=300&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80',
    ownerId: 'owner_borj_nador',
    ownerName: 'مسؤول جمعية برج الناضور',
    ownerPhone: '0661000101',
    status: 'active',
    paymentVerified: true,
    createdAt: '2026-10-19T18:00:00.000Z',
    tier: 'pro',
    monthlyFee: 299,
    isTemplate: false,
    isVisibleOnPublicPortal: false,
    enablePublicDonations: true,
    tagline: 'العمل الجمعوي التنموي والتكافل الاجتماعي بخدمة ساكنة برج الناضور',
    stats: {
      membersCount: 1,
      activitiesCount: 8,
      totalBalance: 0,
      campaignsCount: 3,
    },
    recoveredAccount: true,
  },
  {
    id: 'tenant_al_istithmar',
    name: 'جمعية الاستثمار',
    nameFr: 'Association Al Istithmar',
    nameEn: 'Al Istithmar Association',
    country: 'المغرب',
    city: 'الدار البيضاء',
    slug: 'al-istithmar',
    logoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=300&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80',
    ownerId: 'owner_al_istithmar',
    ownerName: 'مسؤول جمعية الاستثمار',
    ownerPhone: '0661000202',
    status: 'active',
    paymentVerified: true,
    createdAt: '2026-10-19T18:10:00.000Z',
    tier: 'pro',
    monthlyFee: 299,
    isTemplate: false,
    isVisibleOnPublicPortal: false,
    enablePublicDonations: true,
    tagline: 'دعم المبادرات التنموية والاستثمار الاجتماعي المستدام',
    stats: {
      membersCount: 1,
      activitiesCount: 8,
      totalBalance: 0,
      campaignsCount: 3,
    },
    recoveredAccount: true,
  },
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

/**
 * Offloads any large base64 data: URLs in tenant fields (logoUrl, bannerImageUrl, legalDocument.fileUrl)
 * to disk in data/images/ and returns a lightweight /api/images/<filename> URL.
 */
function offloadBase64DataUrl(dataUrl?: string, prefix = 'doc'): string {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return dataUrl || '';
  }
  return offloadBase64ToDisk(dataUrl, prefix);
}

function sanitizeTenantMedia(tenant: any): any {
  if (!tenant || typeof tenant !== 'object') return tenant;
  const clone = { ...tenant };
  if (typeof clone.logoUrl === 'string' && clone.logoUrl.startsWith('data:')) {
    clone.logoUrl = offloadBase64DataUrl(clone.logoUrl, 'logo');
  }
  if (typeof clone.bannerImageUrl === 'string' && clone.bannerImageUrl.startsWith('data:')) {
    clone.bannerImageUrl = offloadBase64DataUrl(clone.bannerImageUrl, 'banner');
  }
  if (clone.legalDocument && typeof clone.legalDocument === 'object') {
    clone.legalDocument = { ...clone.legalDocument };
    if (typeof clone.legalDocument.fileUrl === 'string' && clone.legalDocument.fileUrl.startsWith('data:')) {
      clone.legalDocument.fileUrl = offloadBase64DataUrl(clone.legalDocument.fileUrl, 'legal-doc');
    }
  }
  return clone;
}

export function readTenantsFromDisk(): any[] {
  ensureDataDir();
  const deletedIds = loadDeletedTenantIdsFromDisk();
  const initialFiltered = INITIAL_SERVER_TENANTS.filter((t) => !deletedIds.has(t.id));

  if (!fs.existsSync(TENANTS_FILE)) {
    try {
      fs.writeFileSync(TENANTS_FILE, JSON.stringify(initialFiltered, null, 2), 'utf-8');
    } catch {}
    return [...initialFiltered];
  }
  try {
    const raw = fs.readFileSync(TENANTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .filter((t) => t && t.id && !deletedIds.has(t.id))
        .map((t) => {
          if (!t.ownerUsername) {
            if (t.id === 'tenant_nour') return { ...t, ownerUsername: 'nour2024' };
            if (t.id === 'tenant_amal') return { ...t, ownerUsername: 'amal2024' };
            if (t.id === 'tenant_al_istithmar') return { ...t, ownerUsername: 'istithmar24' };
            return { ...t, ownerUsername: `admin${String(t.id).replace(/\D/g, '').slice(-4) || '2024'}` };
          }
          return t;
        });
    }
    return [...initialFiltered];
  } catch (err) {
    console.error('[tenantsApiHandler] Error reading tenants_database.json:', err);
    return [...initialFiltered];
  }
}

export function writeTenantsToDisk(tenants: any[], syncFirestore = true): void {
  ensureDataDir();
  try {
    const existingTenants = fs.existsSync(TENANTS_FILE)
      ? (() => {
          try {
            const p = JSON.parse(fs.readFileSync(TENANTS_FILE, 'utf-8'));
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        })()
      : [];

    const uniqueMap = new Map<string, any>();
    for (const rawT of tenants) {
      if (!rawT || !rawT.id) continue;
      let t = sanitizeTenantMedia(rawT);
      if (t.id !== 'tenant_nour' && t.name === 'جمعية الشايف') {
        const existing = existingTenants.find((ex: any) => ex.id === t.id && ex.name && ex.name !== 'جمعية الشايف');
        if (existing) {
          t = {
            ...t,
            name: existing.name,
            nameFr: existing.nameFr || t.nameFr,
            nameEn: existing.nameEn || t.nameEn,
          };
        }
      }
      uniqueMap.set(t.id, t);
    }

    const finalArray = Array.from(uniqueMap.values());
    const tmpFile = `${TENANTS_FILE}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(finalArray, null, 2), 'utf-8');
    fs.renameSync(tmpFile, TENANTS_FILE);
    tenantsCloudReconcileLastTs = Date.now();

    if (syncFirestore) {
      const nowIso = new Date().toISOString();
      Promise.all(
        finalArray.map((t) =>
          saveDocToFirebaseServer('tenants', t.id, {
            ...t,
            _updatedAt: t.updatedAt || nowIso,
          }).catch(() => {})
        )
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[tenantsApiHandler] Error writing tenants_database.json:', err);
  }
}

async function reconcileTenantsFromCloudFirestore(force = false): Promise<any[]> {
  const localTenants = readTenantsFromDisk();
  if (!force && Date.now() - tenantsCloudReconcileLastTs < TENANTS_RECONCILE_TTL_MS) {
    return localTenants;
  }
  tenantsCloudReconcileLastTs = Date.now();

  try {
    const [cloudTenants, deletedRegistry] = await Promise.all([
      listCollectionFromFirebaseServer<any>('tenants'),
      getDocFromFirebaseServer<any>('settings', 'deleted_tenants_registry'),
    ]);

    const deletedIds = loadDeletedTenantIdsFromDisk();
    if (deletedRegistry && Array.isArray(deletedRegistry.deletedTenantIds)) {
      let addedDeleted = false;
      for (const delId of deletedRegistry.deletedTenantIds) {
        if (typeof delId === 'string' && delId.trim() && delId !== 'tenant_nour' && !deletedIds.has(delId.trim())) {
          explicitlyDeletedTenantIds.add(delId.trim());
          addedDeleted = true;
        }
      }
      if (addedDeleted) saveDeletedTenantIdsToDisk();
    }

    if (Array.isArray(cloudTenants) && cloudTenants.length > 0) {
      const mergedMap = new Map<string, any>();
      for (const lt of localTenants) {
        if (lt && lt.id && !explicitlyDeletedTenantIds.has(lt.id)) {
          mergedMap.set(lt.id, lt);
        }
      }

      let changed = false;
      for (const ct of cloudTenants) {
        if (!ct || !ct.id || !ct.name || explicitlyDeletedTenantIds.has(ct.id)) continue;
        const existing = mergedMap.get(ct.id);
        if (!existing) {
          mergedMap.set(ct.id, sanitizeTenantMedia(ct));
          changed = true;
        } else {
          const cloudTs = new Date(ct._updatedAt || ct.updatedAt || ct.createdAt || 0).getTime();
          const localTs = new Date(existing._updatedAt || existing.updatedAt || existing.createdAt || 0).getTime();
          const cloudCredTs = new Date(ct.credentialsUpdatedAt || ct._updatedAt || ct.updatedAt || 0).getTime();
          const localCredTs = new Date(existing.credentialsUpdatedAt || existing.updatedAt || 0).getTime();

          const cloudHasNewerCreds =
            (Boolean(ct.passwordHash) && !existing.passwordHash) ||
            (Boolean(ct.passwordHash) && cloudCredTs >= localCredTs && (ct.passwordHash !== existing.passwordHash || ct.passwordSalt !== existing.passwordSalt)) ||
            (Boolean(ct.ownerUsername) && cloudCredTs >= localCredTs && ct.ownerUsername !== existing.ownerUsername);

          if (cloudTs > localTs || cloudHasNewerCreds) {
            const baseMerged = cloudTs > localTs ? { ...existing, ...ct } : { ...existing };
            // Always prefer authoritative cloud credentials when newer or missing locally
            if (cloudHasNewerCreds) {
              if (ct.ownerUsername) baseMerged.ownerUsername = ct.ownerUsername;
              if (ct.passwordHash) {
                baseMerged.passwordHash = ct.passwordHash;
                baseMerged.passwordSalt = ct.passwordSalt || baseMerged.passwordSalt || '';
                baseMerged.hasCustomPassword = true;
                delete baseMerged.plainPassword;
                delete baseMerged.password;
              }
              if (ct.credentialsUpdatedAt) {
                baseMerged.credentialsUpdatedAt = ct.credentialsUpdatedAt;
              }
            }
            // Never let a cloud doc lacking passwordHash erase a valid local passwordHash
            if (!baseMerged.passwordHash && existing.passwordHash) {
              baseMerged.passwordHash = existing.passwordHash;
              baseMerged.passwordSalt = existing.passwordSalt || '';
            }
            mergedMap.set(ct.id, sanitizeTenantMedia(baseMerged));
            changed = true;
          }
        }
      }

      if (changed) {
        const mergedList = Array.from(mergedMap.values());
        writeTenantsToDisk(mergedList, false);
        // Immediately synchronize owners_database.json so revoked usernames/passwords are purged from disk
        syncOwnersWithTenantsList(mergedList);
        return mergedList;
      }
    }
  } catch (err) {
    console.warn('[tenantsApiHandler] Cloud Firestore reconciliation warning:', err);
  }

  return localTenants;
}

function hashPasswordSha256(password: string, salt: string): string {
  return hashPasswordLegacySha256(password, salt);
}

function generateSalt(length = 16): string {
  return generateAuthSalt(Math.ceil(length / 2)).slice(0, length);
}

/**
 * Verifies an association admin / sub-admin password strictly against the single authoritative
 * credential hash (preferring Cloud Firestore tenant.passwordHash over local owner.passwordHash
 * so revoked passwords can NEVER remain valid).
 */
function verifyOwnerPasswordServer(
  password: string,
  owner: any,
  tenant?: any
): { valid: boolean; needsUpgrade: boolean } {
  if (!password || (!owner && !tenant)) return { valid: false, needsUpgrade: false };
  const cleanPass = String(password).trim();

  // Select ONE authoritative hash/salt pair (tenant from Cloud Firestore wins when present)
  let effectiveHash = '';
  let effectiveSalt = '';

  if (tenant?.passwordHash && String(tenant.passwordHash).trim()) {
    effectiveHash = String(tenant.passwordHash).trim();
    effectiveSalt = String(tenant.passwordSalt || owner?.passwordSalt || '').trim();
  } else if (tenant?.ownerPasswordHash && String(tenant.ownerPasswordHash).trim()) {
    effectiveHash = String(tenant.ownerPasswordHash).trim();
    effectiveSalt = String(tenant.ownerPasswordSalt || owner?.passwordSalt || '').trim();
  } else if (owner?.passwordHash && String(owner.passwordHash).trim()) {
    effectiveHash = String(owner.passwordHash).trim();
    effectiveSalt = String(owner.passwordSalt || '').trim();
  }

  if (effectiveHash) {
    return verifyPasswordHashServer(cleanPass, effectiveHash, effectiveSalt);
  }

  // Fallback ONLY for legacy unhashed records that still have plainPassword or pre-seeded demo accounts
  if (owner?.plainPassword && cleanPass === String(owner.plainPassword).trim()) {
    return { valid: true, needsUpgrade: true };
  }
  if (tenant?.plainPassword && cleanPass === String(tenant.plainPassword).trim()) {
    return { valid: true, needsUpgrade: true };
  }

  // Fallback ONLY for pre-seeded initial sub-admin placeholder or uninitialized demo account without any hash
  const isSeededSubAdminPlaceholder =
    owner?.id === 'subadmin-1' &&
    effectiveHash === 'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2';
  if (
    isSeededSubAdminPlaceholder ||
    (!effectiveHash && !owner?.hasCustomPassword && !tenant?.hasCustomPassword && !owner?.plainPassword && !tenant?.plainPassword)
  ) {
    if (
      cleanPass === 'admin123' ||
      cleanPass === '123456' ||
      (owner?.phone && cleanPass === String(owner.phone).trim())
    ) {
      return { valid: true, needsUpgrade: true };
    }
  }

  return { valid: false, needsUpgrade: false };
}

/**
 * Verifies a member's password against stored SHA-256 salted hash, legacy DJB2 hash,
 * or initial default credentials if no custom password has been set yet.
 */
function verifyMemberPasswordServer(password: string, member: any): boolean {
  if (!password || !member) return false;
  const cleanPass = password.trim();
  const storedHash = member.passwordHash || '';
  const storedSalt = member.passwordSalt || '';

  if (storedHash && storedSalt) {
    if (hashPasswordSha256(cleanPass, storedSalt) === storedHash) return true;
    if (legacyClientDjb2Hash(cleanPass, storedSalt) === storedHash) return true;
    const rawSha = crypto.createHash('sha256').update(cleanPass).digest('hex');
    if (rawSha === storedHash) return true;
    return false;
  }

  // Fallback ONLY for pre-existing initial demo members who haven't set a custom password yet
  if (cleanPass === '123456') return true;
  if (member.phone && phonesMatch(member.phone, cleanPass)) return true;
  if (member.memberCode && cleanPass.toUpperCase() === String(member.memberCode).trim().toUpperCase()) return true;
  if (member.cin && cleanPass.toUpperCase() === String(member.cin).trim().toUpperCase()) return true;
  return false;
}

export function readOwnersFromDisk(): any[] {
  ensureDataDir();
  let parsedOwners: any[] = [];
  if (fs.existsSync(OWNERS_FILE)) {
    try {
      const raw = fs.readFileSync(OWNERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsedOwners = parsed;
      }
    } catch (err) {
      console.error('[tenantsApiHandler] Error reading owners_database.json:', err);
    }
  }

  const defaultOwners = [
    {
      id: 'owner_nour_master',
      username: 'nour2024',
      fullName: 'أحمد المنصوري',
      phone: '0661000001',
      passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
      passwordSalt: 'nour_salt_123',
      tenantId: 'tenant_nour',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'owner_amal_khadija',
      username: 'amal2024',
      fullName: 'خديجة العلمي',
      phone: '0662000002',
      passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
      passwordSalt: 'amal_salt_123',
      tenantId: 'tenant_amal',
      status: 'active',
      createdAt: '2024-03-15T10:30:00.000Z',
    },
  ];

  const deletedIds = loadDeletedTenantIdsFromDisk();
  const ownersMap = new Map<string, any>();
  for (const o of defaultOwners) {
    if (!deletedIds.has(o.tenantId)) {
      ownersMap.set(o.id, o);
    }
  }
  for (const item of parsedOwners) {
    if (item && item.id && !deletedIds.has(item.tenantId)) {
      ownersMap.set(item.id, item);
    }
  }

  // Reconcile any tenants existing in tenants_database.json with owners_database.json
  // CRITICAL: Always synchronize authoritative ownerUsername & passwordHash/passwordSalt from tenants so disk never retains revoked credentials!
  const tenants = readTenantsFromDisk();
  return syncOwnersMapWithTenants(ownersMap, tenants, parsedOwners.length === 0);
}

function syncOwnersWithTenantsList(tenants: any[]): any[] {
  ensureDataDir();
  let parsedOwners: any[] = [];
  if (fs.existsSync(OWNERS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(OWNERS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) parsedOwners = parsed;
    } catch {}
  }
  const deletedIds = loadDeletedTenantIdsFromDisk();
  const ownersMap = new Map<string, any>();
  for (const item of parsedOwners) {
    if (item && item.id && !deletedIds.has(item.tenantId)) {
      ownersMap.set(item.id, item);
    }
  }
  return syncOwnersMapWithTenants(ownersMap, tenants, false);
}

function syncOwnersMapWithTenants(
  ownersMap: Map<string, any>,
  tenants: any[],
  forceWrite: boolean
): any[] {
  let needsWrite = forceWrite;

  for (const t of tenants) {
    if (!t || !t.id) continue;
    const existingOwnerId = t.ownerId || `owner_${t.id}`;
    const allCurrent = Array.from(ownersMap.values());
    const existingOwner = allCurrent.find(
      (o) => o.id === existingOwnerId || o.tenantId === t.id
    );

    if (existingOwner) {
      let ownerChanged = false;
      const authTenantUser = typeof t.ownerUsername === 'string' ? t.ownerUsername.trim() : '';
      if (authTenantUser && existingOwner.username !== authTenantUser) {
        existingOwner.username = authTenantUser;
        ownerChanged = true;
      } else if (!existingOwner.username) {
        existingOwner.username =
          authTenantUser ||
          (t.id === 'tenant_nour'
            ? 'nour2024'
            : `admin${String(t.id).replace(/\D/g, '').slice(-4) || '2024'}`);
        ownerChanged = true;
      }

      const cloudHash = String(t.passwordHash || t.ownerPasswordHash || '').trim();
      const cloudSalt = String(t.passwordSalt || t.ownerPasswordSalt || '').trim();
      if (cloudHash && (existingOwner.passwordHash !== cloudHash || (cloudSalt && existingOwner.passwordSalt !== cloudSalt))) {
        existingOwner.passwordHash = cloudHash;
        if (cloudSalt) existingOwner.passwordSalt = cloudSalt;
        existingOwner.hasCustomPassword = true;
        delete existingOwner.plainPassword;
        existingOwner.recoveredAccount = false;
        ownerChanged = true;
      }

      if (ownerChanged) {
        ownersMap.set(existingOwner.id, existingOwner);
        needsWrite = true;
      }
    } else if (t.ownerPhone || t.ownerName || t.ownerUsername) {
      const cloudHash = String(t.passwordHash || t.ownerPasswordHash || '').trim();
      const cloudSalt = String(t.passwordSalt || t.ownerPasswordSalt || '').trim();
      const plainPass = typeof (t.plainPassword || t.password) === 'string'
        ? String(t.plainPassword || t.password).trim()
        : '';
      const computed = plainPass ? hashPasswordScrypt(plainPass) : null;

      ownersMap.set(existingOwnerId, {
        id: existingOwnerId,
        ...(t.ownerUsername ? { username: String(t.ownerUsername).trim() } : {}),
        fullName: t.ownerName || 'مدير الجمعية',
        phone: t.ownerPhone || '',
        passwordHash: computed ? computed.hash : cloudHash,
        passwordSalt: computed ? computed.salt : cloudSalt,
        hasCustomPassword: Boolean(computed || cloudHash || t.hasCustomPassword || t.ownerUsername),
        tenantId: t.id,
        status: 'active',
        createdAt: t.createdAt || new Date().toISOString(),
        recoveredAccount: !computed && !cloudHash,
      });
      needsWrite = true;
    }
  }

  const finalOwners = Array.from(ownersMap.values());
  if (needsWrite) {
    writeOwnersToDisk(finalOwners);
  }
  return finalOwners;
}

export function writeOwnersToDisk(owners: any[]): void {
  ensureDataDir();
  try {
    const map = new Map<string, any>();
    for (const o of owners) {
      if (o && o.id) {
        map.set(o.id, o);
      }
    }
    const finalOwners = Array.from(map.values());
    const tmpFile = `${OWNERS_FILE}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(finalOwners, null, 2), 'utf-8');
    fs.renameSync(tmpFile, OWNERS_FILE);
  } catch (err) {
    console.error('[tenantsApiHandler] Error writing owners_database.json:', err);
  }
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+212')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('00212')) {
    cleaned = '0' + cleaned.slice(5);
  } else if (cleaned.startsWith('212') && cleaned.length > 9) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
}

function phonesMatch(phoneA?: string, phoneB?: string): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizePhone(phoneA);
  const normB = normalizePhone(phoneB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  const digitsA = normA.replace(/\D/g, '');
  const digitsB = normB.replace(/\D/g, '');
  if (digitsA.length >= 8 && digitsB.length >= 8) {
    const tailA = digitsA.slice(-8);
    const tailB = digitsB.slice(-8);
    if (tailA === tailB) return true;
  }
  return false;
}

function normalizeArabicText(text: string): string {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

function stripAssociationPrefix(text: string): string {
  const norm = normalizeArabicText(text);
  return norm.replace(/^(جمعيه|جمعية|association)\s+/i, '').trim();
}

function namesMatch(candidateName?: string, queryText?: string): boolean {
  if (!candidateName || !queryText) return false;
  const normCandidate = normalizeArabicText(candidateName);
  const normQuery = normalizeArabicText(queryText);
  if (!normCandidate || !normQuery || normQuery.length < 2) return false;
  if (normCandidate === normQuery || normCandidate.includes(normQuery) || normQuery.includes(normCandidate)) {
    return true;
  }
  const strippedCandidate = stripAssociationPrefix(candidateName);
  const strippedQuery = stripAssociationPrefix(queryText);
  if (strippedCandidate && strippedQuery && strippedQuery.length >= 3) {
    if (
      strippedCandidate === strippedQuery ||
      strippedCandidate.includes(strippedQuery) ||
      strippedQuery.includes(strippedCandidate)
    ) {
      return true;
    }
  }
  return false;
}

function normalizeOwnerUsername(username?: string): string {
  return normalizeLoginUsername(username);
}

function validateOwnerUsernameFormatServer(username?: string): { valid: boolean; error?: string } {
  const clean = (username || '').trim();
  if (!clean) {
    return {
      valid: false,
      error: 'يرجى إدخال اسم المستخدم لمدير الجمعية.',
    };
  }
  // Must consist strictly of letters and numbers only (Arabic/English letters and Arabic/Western digits, no spaces or symbols)
  const alphanumericRegex = /^[A-Za-z0-9\u0600-\u06FF\u0660-\u0669\u06F0-\u06F9]+$/;
  if (!alphanumericRegex.test(clean)) {
    return {
      valid: false,
      error: 'يجب أن يتكون اسم المستخدم من حروف وأرقام فقط (دون مسافات أو رموز خاصة).',
    };
  }
  const letterMatches = clean.match(/[A-Za-z\u0600-\u06FF]/g) || [];
  const digitMatches = clean.match(/[0-9\u0660-\u0669\u06F0-\u06F9]/g) || [];
  if (letterMatches.length < 4 || digitMatches.length < 2) {
    return {
      valid: false,
      error: 'يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.',
    };
  }
  return { valid: true };
}

function isOwnerUsernameTakenServer(
  username: string,
  owners: any[],
  tenants: any[],
  excludeTenantId?: string
): boolean {
  const norm = normalizeOwnerUsername(username);
  if (!norm) return false;

  for (const o of owners) {
    if (!o) continue;
    if (excludeTenantId && o.tenantId === excludeTenantId) continue;
    if (o.username && normalizeOwnerUsername(o.username) === norm) {
      return true;
    }
  }

  for (const t of tenants) {
    if (!t) continue;
    if (excludeTenantId && t.id === excludeTenantId) continue;
    if (t.ownerUsername && normalizeOwnerUsername(t.ownerUsername) === norm) {
      return true;
    }
  }

  return false;
}

function sendJson(res: ServerResponse, statusCode: number, data: any): boolean {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
  res.end(JSON.stringify(data));
  return true;
}

function readBody(req: IncomingMessage): Promise<any> {
  return readLargeJsonBody(req, 100 * 1024 * 1024);
}

export async function handleTenantsApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const fullUrl = req.url || '';
  const url = fullUrl;
  const pathname = fullUrl.split('?')[0].replace(/\/$/, '') || '/';

  if (!pathname.startsWith('/api/tenants')) {
    return false;
  }

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
    res.end();
    return true;
  }

  const method = req.method?.toUpperCase();

   try {
    // 0a. POST /api/tenants/check-username -> Validate username format and uniqueness across associations
    if (method === 'POST' && pathname === '/api/tenants/check-username') {
      const body = await readBody(req);
      const username = (body.username || '').trim();
      const excludeTenantId = (body.excludeTenantId || '').trim() || undefined;

      const formatResult = validateOwnerUsernameFormatServer(username);
      if (!formatResult.valid) {
        return sendJson(res, 200, {
          success: true,
          available: false,
          error: formatResult.error,
        });
      }

      const tenants = await reconcileTenantsFromCloudFirestore(true);
      const owners = readOwnersFromDisk();
      const taken = isOwnerUsernameTakenServer(username, owners, tenants, excludeTenantId);

      if (taken) {
        return sendJson(res, 200, {
          success: true,
          available: false,
          error: 'اسم المستخدم هذا مستخدم بالفعل لجمعية أخرى. يرجى اختيار اسم مستخدم فريد.',
        });
      }

      return sendJson(res, 200, {
        success: true,
        available: true,
      });
    }

    // 0b. POST /api/tenants/check-member-username -> Validate member username format and uniqueness across system
    if (method === 'POST' && pathname === '/api/tenants/check-member-username') {
      const body = await readBody(req);
      const username = (body.username || '').trim();
      const excludeMemberId = (body.excludeMemberId || '').trim() || undefined;

      if (!username) {
        return sendJson(res, 200, {
          success: true,
          available: false,
          error: 'يرجى ملء الحقل الإجباري: اسم المستخدم.',
        });
      }

      const alphanumericRegex = /^[A-Za-z0-9\u0600-\u06FF\u0660-\u0669\u06F0-\u06F9]+$/;
      if (!alphanumericRegex.test(username)) {
        return sendJson(res, 200, {
          success: true,
          available: false,
          error: 'يجب أن يتكون اسم المستخدم من حروف وأرقام فقط (دون مسافات أو رموز خاصة).',
        });
      }

      const letterMatches = username.match(/[A-Za-z\u0600-\u06FF]/g) || [];
      const digitMatches = username.match(/[0-9\u0660-\u0669\u06F0-\u06F9]/g) || [];
      if (letterMatches.length < 4 || digitMatches.length < 2) {
        return sendJson(res, 200, {
          success: true,
          available: false,
          error: 'يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.',
        });
      }

      const norm = normalizeOwnerUsername(username);
      const tenants = readTenantsFromDisk();

      for (const t of tenants) {
        if (!t || !t.id) continue;
        try {
          const rec = readTenantRecordsFromDisk(t.id);
          const membersList = Array.isArray(rec.members) ? rec.members : [];
          for (const m of membersList) {
            if (!m) continue;
            if (excludeMemberId && m.id === excludeMemberId) continue;
            if (m.username && normalizeOwnerUsername(m.username) === norm) {
              return sendJson(res, 200, {
                success: true,
                available: false,
                error: 'اسم المستخدم هذا مستخدم بالفعل من طرف منخرط آخر ضمن النظام المعتمد. يرجى اختيار اسم مستخدم فريد.',
              });
            }
          }
        } catch {}
      }

      return sendJson(res, 200, {
        success: true,
        available: true,
      });
    }

    // 0. POST /api/tenants/login -> Authoritative Cloud-backed login endpoint for multi-tenant platform
    if (method === 'POST' && pathname === '/api/tenants/login') {
      const body = await readBody(req);
      const identifier = String(body.loginIdentifier || body.identifier || body.username || '').trim();
      const password = String(body.password || '').trim();
      const expectedTenantId = String(body.tenantId || '').trim();
      const isPinOnly = Boolean(body.pinOnly) && !identifier && Boolean(expectedTenantId);

      if ((!identifier && !isPinOnly) || !password) {
        return sendJson(res, 400, {
          success: false,
          errorCode: 'EMPTY_FIELDS',
          error: 'يرجى إدخال اسم المستخدم وكلمة المرور.',
        });
      }

      // Always reconcile live credentials from Cloud Firestore before authenticating
      const tenants = await reconcileTenantsFromCloudFirestore(true);
      const owners = readOwnersFromDisk();

      // Helper to transparently upgrade legacy hashes or missing cloud hashes to scrypt on valid login
      const persistUpgradedScryptCredentials = async (
        tenantObj: any,
        ownerObj: any,
        plainPass: string
      ) => {
        try {
          const { hash, salt } = hashPasswordScrypt(plainPass);
          const nowIso = new Date().toISOString();
          tenantObj.passwordHash = hash;
          tenantObj.passwordSalt = salt;
          tenantObj.hasCustomPassword = true;
          tenantObj.credentialsUpdatedAt = nowIso;
          tenantObj.updatedAt = nowIso;
          delete tenantObj.plainPassword;
          delete tenantObj.ownerPasswordHash;
          delete tenantObj.ownerPasswordSalt;

          ownerObj.passwordHash = hash;
          ownerObj.passwordSalt = salt;
          ownerObj.hasCustomPassword = true;
          ownerObj.recoveredAccount = false;
          ownerObj.updatedAt = nowIso;
          delete ownerObj.plainPassword;

          const tIdx = tenants.findIndex((item) => item.id === tenantObj.id);
          if (tIdx >= 0) tenants[tIdx] = { ...tenants[tIdx], ...tenantObj };
          writeTenantsToDisk(tenants, false);

          const oIdx = owners.findIndex((o) => o.id === ownerObj.id || o.tenantId === tenantObj.id);
          if (oIdx >= 0) owners[oIdx] = { ...owners[oIdx], ...ownerObj };
          else owners.unshift(ownerObj);
          writeOwnersToDisk(owners);

          await saveDocToFirebaseServer('tenants', tenantObj.id, {
            ...tenantObj,
            _updatedAt: nowIso,
          }).catch(() => {});
        } catch (upgErr) {
          console.warn('[tenantsApiHandler] Credential upgrade notice:', upgErr);
        }
      };

      // Mode A: Password/PIN-only login scoped strictly to an active association (AdminAuthModal without username)
      if (isPinOnly && expectedTenantId) {
        const targetTenant = tenants.find((t) => t && t.id === expectedTenantId);
        if (!targetTenant) {
          return sendJson(res, 404, {
            success: false,
            errorCode: 'USER_NOT_FOUND',
            error: 'لم يتم العثور على الجمعية المطلوبة في قاعدة البيانات.',
          });
        }
        const linkedOwner = owners.find(
          (o) => o && (o.id === targetTenant.ownerId || o.tenantId === targetTenant.id)
        ) || {
          id: targetTenant.ownerId || `owner_${targetTenant.id}`,
          username: targetTenant.ownerUsername || '',
          fullName: targetTenant.ownerName || 'مدير الجمعية',
          phone: targetTenant.ownerPhone || '',
          tenantId: targetTenant.id,
          status: 'active',
        };

        let pinCheck = verifyOwnerPasswordServer(password, linkedOwner, targetTenant);

        // If tenant has no stored hash yet, check legacy Cloud Firestore settings.adminPin once
        if (!pinCheck.valid && !targetTenant.passwordHash && !linkedOwner.passwordHash) {
          try {
            const cloudSettings = await getDocFromFirebaseServer<any>('settings', targetTenant.id);
            const cloudPin = String(cloudSettings?.adminPin || '').trim();
            if (cloudPin && password === cloudPin) {
              pinCheck = { valid: true, needsUpgrade: true };
            }
          } catch {}
        }

        if (!pinCheck.valid) {
          return sendJson(res, 401, {
            success: false,
            errorCode: 'WRONG_PASSWORD',
            error: 'كلمة المرور أو الرمز السري غير صحيح. يرجى التحقق وإعادة المحاولة.',
          });
        }

        if (linkedOwner.status === 'inactive') {
          return sendJson(res, 403, {
            success: false,
            errorCode: 'INACTIVE',
            error: 'هذا الحساب الإداري معطل حالياً.',
          });
        }

        if (pinCheck.needsUpgrade || !targetTenant.passwordHash) {
          await persistUpgradedScryptCredentials(targetTenant, linkedOwner, password);
        }

        const safeTenant = sanitizePublicTenant(targetTenant);
        const safeOwner = sanitizePublicOwner(linkedOwner);
        const session = {
          type: 'super_admin',
          role: 'main_admin',
          id: safeOwner.id,
          ...(safeTenant.ownerUsername || safeOwner.username
            ? { username: safeTenant.ownerUsername || safeOwner.username }
            : {}),
          fullName: safeOwner.fullName,
          phone: safeOwner.phone,
          tenantId: safeTenant.id,
          isMasterPlatformAdmin: false,
          token: `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        };
        return sendJson(res, 200, {
          success: true,
          role: 'admin',
          owner: safeOwner,
          tenant: safeTenant,
          session,
        });
      }

      const isPhoneQuery = /\d{5,}/.test(identifier.replace(/[\s\-\(\)\.]/g, ''));
      const normUsernameQuery = normalizeOwnerUsername(identifier);

      // 1. Search Association Owners strictly against their authoritative username
      // CRITICAL: If tenant.ownerUsername exists, it is the single source of truth — stale owner.username is NEVER matched!
      interface CandidatePair {
        owner: any;
        tenant: any;
        exactUsernameMatch: boolean;
      }
      const candidates: CandidatePair[] = [];
      const seenTenantIds = new Set<string>();

      for (const t of tenants) {
        if (!t || !t.id) continue;
        const linkedOwner = owners.find(
          (o) => o && (o.id === t.ownerId || o.tenantId === t.id)
        );
        const authoritativeUsername =
          (typeof t.ownerUsername === 'string' && t.ownerUsername.trim()) ||
          (typeof linkedOwner?.username === 'string' && linkedOwner.username.trim()) ||
          '';

        if (normUsernameQuery && authoritativeUsername && normalizeOwnerUsername(authoritativeUsername) === normUsernameQuery) {
          seenTenantIds.add(t.id);
          const effectiveOwner = linkedOwner
            ? { ...linkedOwner, username: authoritativeUsername }
            : {
                id: t.ownerId || `owner_${t.id}`,
                username: authoritativeUsername,
                fullName: t.ownerName || 'مدير الجمعية',
                phone: t.ownerPhone || '',
                passwordHash: t.passwordHash || t.ownerPasswordHash || '',
                passwordSalt: t.passwordSalt || t.ownerPasswordSalt || '',
                hasCustomPassword: Boolean(t.hasCustomPassword || t.passwordHash || authoritativeUsername),
                tenantId: t.id,
                status: 'active',
                createdAt: t.createdAt || new Date().toISOString(),
              };
          candidates.push({
            owner: effectiveOwner,
            tenant: t,
            exactUsernameMatch: true,
          });
        }
      }

      if (candidates.length > 0) {
        // Prioritize active/expected tenant first, then newest updatedAt
        candidates.sort((a, b) => {
          if (expectedTenantId) {
            const aMatch = a.tenant.id === expectedTenantId;
            const bMatch = b.tenant.id === expectedTenantId;
            if (aMatch !== bMatch) return aMatch ? -1 : 1;
          }
          const timeA = new Date(a.tenant.updatedAt || a.tenant.createdAt || 0).getTime();
          const timeB = new Date(b.tenant.updatedAt || b.tenant.createdAt || 0).getTime();
          return timeB - timeA;
        });

        let verifiedCandidate: CandidatePair | undefined;
        let verifiedNeedsUpgrade = false;

        for (const c of candidates) {
          const check = verifyOwnerPasswordServer(password, c.owner, c.tenant);
          if (check.valid) {
            verifiedCandidate = c;
            verifiedNeedsUpgrade = check.needsUpgrade || !c.tenant.passwordHash;
            break;
          }
        }

        // Legacy one-time migration ONLY if candidate has NO hash in Cloud Firestore or disk yet
        if (!verifiedCandidate) {
          for (const c of candidates) {
            const hasAnyHash = Boolean(
              c.tenant.passwordHash || c.tenant.ownerPasswordHash || c.owner.passwordHash
            );
            if (!hasAnyHash) {
              try {
                const cloudSettings = await getDocFromFirebaseServer<any>('settings', c.tenant.id);
                const cloudPin = String(cloudSettings?.adminPin || '').trim();
                if (cloudPin && password === cloudPin) {
                  verifiedCandidate = c;
                  verifiedNeedsUpgrade = true;
                  break;
                }
              } catch {}
            }
          }
        }

        if (verifiedCandidate) {
          const { owner: matchedOwner, tenant } = verifiedCandidate;

          // Strict tenant isolation when logging in from inside a specific association's page
          if (expectedTenantId && tenant.id !== expectedTenantId) {
            return sendJson(res, 403, {
              success: false,
              errorCode: 'TENANT_MISMATCH',
              error: `عذراً، هذا الحساب مرتبط بـ «${tenant.name}» ولا يُسمح له بالدخول إلى لوحة تحكم جمعية أخرى.`,
            });
          }

          if (matchedOwner.status === 'inactive') {
            return sendJson(res, 403, {
              success: false,
              errorCode: 'INACTIVE',
              error: 'هذا الحساب الإداري معطل حالياً. يرجى التواصل مع إدارة المنصة.',
            });
          }

          if (verifiedNeedsUpgrade) {
            await persistUpgradedScryptCredentials(tenant, matchedOwner, password);
          }

          const safeTenant = sanitizePublicTenant(tenant);
          const safeOwner = sanitizePublicOwner(matchedOwner);

          const session = {
            type: 'super_admin',
            role: 'main_admin',
            id: safeOwner.id,
            ...(safeTenant.ownerUsername || safeOwner.username
              ? { username: safeTenant.ownerUsername || safeOwner.username }
              : {}),
            fullName: safeOwner.fullName,
            phone: safeOwner.phone,
            tenantId: safeTenant.id,
            isMasterPlatformAdmin: false,
            token: `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          };

          return sendJson(res, 200, {
            success: true,
            role: 'admin',
            owner: safeOwner,
            tenant: safeTenant,
            session,
            message: `مرحباً بك مجدداً يا ${safeOwner.fullName}! جاري توجيهك إلى منصة «${safeTenant.name}»...`,
          });
        }
      }

      // 2. Search Sub-Admins in subadmins_database.json, per-tenant records, and Cloud Firestore
      let hadSubAdminIdentifierMatch = false;
      const collectAllSubAdmins = (): Array<{ sub: any; tenantId: string }> => {
        const list: Array<{ sub: any; tenantId: string }> = [];
        try {
          const subDb = loadSubAdminsDatabase();
          const subAdminsList = Array.isArray(subDb?.subAdmins) ? subDb.subAdmins : [];
          for (const s of subAdminsList) {
            if (s && s.id) {
              list.push({ sub: s, tenantId: s.tenantId || 'tenant_nour' });
            }
          }
        } catch {}
        for (const t of tenants) {
          if (!t || !t.id) continue;
          try {
            const rec = readTenantRecordsFromDisk(t.id);
            if (Array.isArray(rec.subAdmins)) {
              for (const s of rec.subAdmins) {
                if (s && s.id && !list.some((item) => item.sub.id === s.id)) {
                  list.push({ sub: s, tenantId: s.tenantId || t.id });
                }
              }
            }
          } catch {}
        }
        return list;
      };

      const doesSubAdminMatchIdentifier = (sub: any): boolean => {
        if (!sub) return false;
        if (normUsernameQuery && sub.username && normalizeOwnerUsername(sub.username) === normUsernameQuery) {
          return true;
        }
        if (isPhoneQuery && sub.phone && phonesMatch(sub.phone, identifier)) {
          return true;
        }
        return false;
      };

      let allSubAdminsToSearch = collectAllSubAdmins();
      if (!allSubAdminsToSearch.some(({ sub }) => doesSubAdminMatchIdentifier(sub))) {
        await hydrateSubAdminsFromFirestore().catch(() => {});
        allSubAdminsToSearch = collectAllSubAdmins();
      }

      for (const { sub: matchedSubAdmin, tenantId: subTenantId } of allSubAdminsToSearch) {
        if (doesSubAdminMatchIdentifier(matchedSubAdmin)) {
          hadSubAdminIdentifierMatch = true;
          const subCheck = verifyOwnerPasswordServer(password, matchedSubAdmin);
          if (subCheck.valid) {
            if (expectedTenantId && subTenantId && subTenantId !== expectedTenantId) {
              return sendJson(res, 403, {
                success: false,
                errorCode: 'TENANT_MISMATCH',
                error: 'عذراً، هذا الحساب الإداري مرتبط بجمعية أخرى مستقلة.',
              });
            }
            if (matchedSubAdmin.status !== 'active') {
              return sendJson(res, 403, {
                success: false,
                errorCode: 'INACTIVE',
                error: 'تم تعطيل هذا الحساب الإداري من طرف الأدمن الرئيسي. لا يمكنك تسجيل الدخول.',
              });
            }
            const tenant = tenants.find((t) => t.id === subTenantId) || tenants[0];
            return sendJson(res, 200, {
              success: true,
              role: 'admin',
              subAdmin: matchedSubAdmin,
              tenant: sanitizePublicTenant(tenant),
              session: {
                type: 'sub_admin',
                role: 'secondary_admin',
                id: matchedSubAdmin.id,
                username: matchedSubAdmin.username,
                fullName: matchedSubAdmin.fullName,
                phone: matchedSubAdmin.phone,
                tenantId: tenant?.id,
                subAdmin: matchedSubAdmin,
              },
            });
          }
        }
      }

      // 3. Search Association Members across all tenants (strictly when not an admin-only modal login)
      if (!body.adminOnly) {
        interface MemberCandidate {
          member: any;
          tenant: any;
        }
        const memberCandidates: MemberCandidate[] = [];
        const cleanIdLower = identifier.toLowerCase();

        for (const t of tenants) {
          if (!t || !t.id) continue;
          if (expectedTenantId && t.id !== expectedTenantId) continue;
          try {
            const rec = readTenantRecordsFromDisk(t.id);
            const membersList = Array.isArray(rec.members) ? rec.members : [];
            for (const m of membersList) {
              if (!m) continue;
              const matchByUsername =
                Boolean(m.username) &&
                (String(m.username).trim().toLowerCase() === cleanIdLower ||
                  (Boolean(normUsernameQuery) && normalizeOwnerUsername(m.username) === normUsernameQuery));

              if (matchByUsername) {
                memberCandidates.push({ member: m, tenant: t });
              }
            }
          } catch {}
        }

        if (memberCandidates.length > 0) {
          const verifiedMemberCand = memberCandidates.find((mc) => verifyMemberPasswordServer(password, mc.member));

          if (verifiedMemberCand) {
            const { member: matchedMember, tenant: memberTenant } = verifiedMemberCand;

            if (matchedMember.status !== 'active') {
              return sendJson(res, 403, {
                success: false,
                errorCode: 'INACTIVE',
                error: 'حسابك غير مفعل حالياً من طرف إدارة الجمعية (حساب معطل أو قيد المراجعة). يرجى مراجعة إدارة الجمعية لتفعيل العضوية.',
              });
            }

            const finalMember = {
              ...matchedMember,
              lastLoginDate: new Date().toISOString(),
            };
            if (!finalMember.passwordHash || !finalMember.passwordSalt) {
              const salt = generateSalt(16);
              finalMember.passwordSalt = salt;
              finalMember.passwordHash = hashPasswordSha256(password, salt);
            }
            delete finalMember.password;
            delete finalMember.confirmPassword;

            try {
              const rec = readTenantRecordsFromDisk(memberTenant.id);
              rec.members = (rec.members || []).map((m: any) => (m.id === finalMember.id ? finalMember : m));
              writeTenantRecordsToDisk(rec, memberTenant.id);
            } catch {}

            return sendJson(res, 200, {
              success: true,
              role: 'member',
              member: finalMember,
              tenant: sanitizePublicTenant(memberTenant),
              session: null,
              message: `مرحباً بك يا ${finalMember.fullName}! جاري توجيهك إلى واجهة «${memberTenant.name}»...`,
            });
          }

          return sendJson(res, 401, {
            success: false,
            errorCode: 'WRONG_PASSWORD',
            error: 'كلمة المرور غير صحيحة. يرجى التحقق وإعادة المحاولة.',
          });
        }
      }

      if (candidates.length > 0 || hadSubAdminIdentifierMatch) {
        return sendJson(res, 401, {
          success: false,
          errorCode: 'WRONG_PASSWORD',
          error: 'كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور وإعادة المحاولة.',
        });
      }

      return sendJson(res, 404, {
        success: false,
        errorCode: 'USER_NOT_FOUND',
        error: 'اسم المستخدم غير موجود أو غير مسجل في النظام. يرجى التأكد من كتابة اسم المستخدم الصحيح.',
      });
    }

    // POST /api/tenants/lookup -> Live identification check for "نسيت كلمة المرور؟"
    if (method === 'POST' && pathname === '/api/tenants/lookup') {
      const body = await readBody(req);
      const identifier = (body.identifier || '').trim();
      if (!identifier) {
        return sendJson(res, 400, { success: false, error: 'يرجى إدخال رقم الهاتف أو الاسم للبحث.' });
      }

      const tenants = await reconcileTenantsFromCloudFirestore(true);
      const owners = readOwnersFromDisk();
      const isPhoneQuery = /\d{5,}/.test(identifier.replace(/[\s\-\(\)\.]/g, ''));
      const normUser = normalizeOwnerUsername(identifier);

      const matchedTenant = tenants.find((item) => {
        if (!item) return false;
        if (normUser && item.ownerUsername && normalizeOwnerUsername(item.ownerUsername) === normUser) return true;
        if (isPhoneQuery && phonesMatch(item.ownerPhone, identifier)) return true;
        if (!isPhoneQuery && (namesMatch(item.ownerName, identifier) || namesMatch(item.name, identifier) || namesMatch(item.nameFr, identifier))) return true;
        return false;
      });

      if (matchedTenant) {
        return sendJson(res, 200, {
          success: true,
          found: true,
          ownerName: matchedTenant.ownerName,
          ownerPhone: matchedTenant.ownerPhone,
          associationName: matchedTenant.name,
          tenantId: matchedTenant.id,
          city: matchedTenant.city,
        });
      }

      const owner = owners.find((o) => {
        if (!o) return false;
        if (normUser && o.username && normalizeOwnerUsername(o.username) === normUser) return true;
        if (isPhoneQuery && phonesMatch(o.phone, identifier)) return true;
        if (!isPhoneQuery && namesMatch(o.fullName, identifier)) return true;
        return false;
      });

      if (!owner) {
        return sendJson(res, 404, { success: false, found: false, error: 'لم يتم العثور على أي جمعية مسجلة بهذه البيانات.' });
      }

      const tenant = tenants.find((t) => t.id === owner.tenantId);

      return sendJson(res, 200, {
        success: true,
        found: true,
        ownerName: owner.fullName,
        ownerPhone: owner.phone,
        associationName: tenant?.name || 'منصة جمعيتك',
        tenantId: owner.tenantId,
        city: tenant?.city || '',
      });
    }

    // POST /api/tenants/reset-password -> Reset owner password safely & persist to Cloud Firestore
    if (method === 'POST' && pathname === '/api/tenants/reset-password') {
      const body = await readBody(req);
      const identifier = (body.identifier || body.phone || '').trim();
      const ownerId = (body.ownerId || '').trim();
      const tenantId = (body.tenantId || '').trim();
      const newPassword = (body.newPassword || '').trim();

      if ((!identifier && !ownerId && !tenantId) || !newPassword || newPassword.length < 4) {
        return sendJson(res, 400, {
          success: false,
          error: 'يرجى إدخال معرف الحساب وكلمة مرور صالحة (4 أحرف على الأقل).',
        });
      }

      const tenants = await reconcileTenantsFromCloudFirestore(true);
      const owners = readOwnersFromDisk();
      const isPhoneQuery = /\d{5,}/.test(identifier.replace(/[\s\-\(\)\.]/g, ''));
      const normUser = normalizeOwnerUsername(identifier);
      const nowIso = new Date().toISOString();

      let index = owners.findIndex((o) => {
        if (ownerId && o.id === ownerId) return true;
        if (tenantId && o.tenantId === tenantId) return true;
        if (normUser && o.username && normalizeOwnerUsername(o.username) === normUser) return true;
        if (isPhoneQuery && phonesMatch(o.phone, identifier)) return true;
        if (!isPhoneQuery && identifier && namesMatch(o.fullName, identifier)) return true;
        return false;
      });

      let targetTenantIdx = -1;
      if (index >= 0) {
        targetTenantIdx = tenants.findIndex(
          (t) => t.id === owners[index].tenantId || t.ownerId === owners[index].id
        );
      }

      if (index === -1 && (tenantId || ownerId || identifier)) {
        targetTenantIdx = tenants.findIndex(
          (t) =>
            (tenantId && t.id === tenantId) ||
            (ownerId && t.ownerId === ownerId) ||
            (normUser && t.ownerUsername && normalizeOwnerUsername(t.ownerUsername) === normUser) ||
            (isPhoneQuery && phonesMatch(t.ownerPhone, identifier)) ||
            (!isPhoneQuery && identifier && (namesMatch(t.ownerName, identifier) || namesMatch(t.name, identifier) || namesMatch(t.nameFr, identifier)))
        );
        if (targetTenantIdx >= 0) {
          index = owners.findIndex(
            (o) => o.tenantId === tenants[targetTenantIdx].id || o.id === tenants[targetTenantIdx].ownerId
          );
        }
      }

      if (index === -1 && targetTenantIdx === -1) {
        return sendJson(res, 404, { success: false, error: 'لم يتم العثور على الحساب لتحديث كلمة المرور.' });
      }

      const { hash, salt } = hashPasswordScrypt(newPassword);

      let resolvedTenantId = tenantId;
      let resolvedOwnerId = ownerId;

      if (index >= 0) {
        owners[index].passwordSalt = salt;
        owners[index].passwordHash = hash;
        owners[index].hasCustomPassword = true;
        delete owners[index].plainPassword;
        owners[index].recoveredAccount = false;
        owners[index].updatedAt = nowIso;
        resolvedTenantId = owners[index].tenantId;
        resolvedOwnerId = owners[index].id;
      } else if (targetTenantIdx >= 0) {
        const foundTenant = tenants[targetTenantIdx];
        const newOwner = {
          id: foundTenant.ownerId || ownerId || `owner_${foundTenant.id}`,
          ...(foundTenant.ownerUsername ? { username: foundTenant.ownerUsername } : {}),
          fullName: foundTenant.ownerName || 'مدير الجمعية',
          phone: foundTenant.ownerPhone || identifier,
          passwordHash: hash,
          passwordSalt: salt,
          hasCustomPassword: true,
          tenantId: foundTenant.id,
          status: 'active',
          createdAt: foundTenant.createdAt || nowIso,
          updatedAt: nowIso,
        };
        owners.push(newOwner);
        resolvedTenantId = newOwner.tenantId;
        resolvedOwnerId = newOwner.id;
      }

      writeOwnersToDisk(owners);

      if (targetTenantIdx >= 0) {
        const updatedTenant = {
          ...tenants[targetTenantIdx],
          passwordHash: hash,
          passwordSalt: salt,
          hasCustomPassword: true,
          credentialsUpdatedAt: nowIso,
          updatedAt: nowIso,
        };
        delete updatedTenant.plainPassword;
        delete updatedTenant.ownerPasswordHash;
        delete updatedTenant.ownerPasswordSalt;
        tenants[targetTenantIdx] = updatedTenant;
        writeTenantsToDisk(tenants, false);
        await saveDocToFirebaseServer('tenants', updatedTenant.id, {
          ...updatedTenant,
          _updatedAt: nowIso,
        }).catch(() => {});
      }

      return sendJson(res, 200, {
        success: true,
        message: 'تم تحديث كلمة المرور بنجاح وحفظها في قاعدة البيانات السحابية. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
        tenantId: resolvedTenantId,
        ownerId: resolvedOwnerId,
      });
    }

    // GET /api/tenants/owners -> Get all owners (credentials stripped)
    if (method === 'GET' && pathname === '/api/tenants/owners') {
      const owners = readOwnersFromDisk().map((o) => sanitizePublicOwner(o));
      return sendJson(res, 200, { success: true, owners });
    }

    // 1. GET /api/tenants -> List all tenants (support publicOnly & force sync, credentials stripped)
    if (method === 'GET' && pathname === '/api/tenants') {
      const isPublicOnly = fullUrl.includes('public=true') || fullUrl.includes('publicOnly=true');
      const forceSync = fullUrl.includes('force=true') || fullUrl.includes('refresh=true');
      const allTenants = await reconcileTenantsFromCloudFirestore(forceSync);
      const deletedIds = loadDeletedTenantIdsFromDisk();
      const filteredTenants = isPublicOnly
        ? allTenants.filter((t) => (t.isTemplate || t.id === 'tenant_nour') && t.isVisibleOnPublicPortal !== false)
        : allTenants;
      const tenants = filteredTenants.map((t) => sanitizePublicTenant(t));
      return sendJson(res, 200, {
        success: true,
        tenants,
        deletedTenantIds: Array.from(deletedIds),
        total: tenants.length,
      });
    }

    // 2. POST /api/tenants -> Create new tenant (or upsert if ID already exists)
    if (method === 'POST' && pathname === '/api/tenants') {
      const body = await readBody(req);
      if (!body.name || !body.country || !body.city || !body.ownerName || !body.ownerPhone) {
        return sendJson(res, 400, {
          success: false,
          error: 'بيانات الجمعية غير مكتملة (الاسم، الدولة، المدينة، اسم وصاحب الجمعية).',
        });
      }

      const existing = await reconcileTenantsFromCloudFirestore(true);
      const owners = readOwnersFromDisk();
      const isMaster = !!body.isTemplate || body.id === 'tenant_nour';
      const newTenantId = body.id || `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newOwnerId = body.ownerId || `owner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const cleanOwnerUsername = (body.ownerUsername || body.username || '').trim();

      if (cleanOwnerUsername) {
        const formatCheck = validateOwnerUsernameFormatServer(cleanOwnerUsername);
        if (!formatCheck.valid) {
          return sendJson(res, 400, {
            success: false,
            error: formatCheck.error,
          });
        }
        if (isOwnerUsernameTakenServer(cleanOwnerUsername, owners, existing, newTenantId)) {
          return sendJson(res, 409, {
            success: false,
            error: 'اسم المستخدم هذا مستخدم بالفعل لجمعية أخرى. يرجى اختيار اسم مستخدم فريد.',
          });
        }
      }

      removeDeletedTenantIdOnServer(newTenantId);

      // Compute strong scrypt password hash BEFORE persisting tenant so Cloud Firestore holds authoritative credentials
      const plainPassword = String(body.plainPassword || body.password || '').trim();
      let computedHash = '';
      let computedSalt = '';
      if (plainPassword) {
        const hashed = hashPasswordScrypt(plainPassword);
        computedHash = hashed.hash;
        computedSalt = hashed.salt;
      } else if (body.passwordHash && String(body.passwordHash).trim()) {
        computedHash = String(body.passwordHash).trim();
        computedSalt = String(body.passwordSalt || '').trim();
      }

      const nowIso = new Date().toISOString();
      const rawTenant: Record<string, any> = {
        id: newTenantId,
        name: body.name.trim(),
        nameFr: body.nameFr?.trim() || `Association ${body.name.trim()}`,
        nameEn: body.nameEn?.trim() || body.nameFr?.trim() || `Association ${body.name.trim()}`,
        country: body.country.trim(),
        city: body.city.trim(),
        slug: body.slug || `assoc-${Date.now()}`,
        logoUrl: body.logoUrl || 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=300&q=80',
        bannerImageUrl: body.bannerImageUrl || 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80',
        legalDocument: body.legalDocument || undefined,
        ownerId: newOwnerId,
        ...(cleanOwnerUsername ? { ownerUsername: cleanOwnerUsername } : {}),
        ...(computedHash
          ? {
              passwordHash: computedHash,
              passwordSalt: computedSalt,
              hasCustomPassword: true,
              credentialsUpdatedAt: nowIso,
            }
          : {}),
        ownerName: body.ownerName.trim(),
        ownerPhone: body.ownerPhone.trim(),
        status: body.status || (isMaster ? 'active' : 'pending_subscription'),
        paymentVerified: body.paymentVerified ?? (isMaster ? true : false),
        subscriptionStatusHistory: body.subscriptionStatusHistory || [
          {
            status: body.status || (isMaster ? 'active' : 'pending_subscription'),
            label: (body.status || (isMaster ? 'active' : 'pending_subscription')) === 'active' ? 'مفعّلة' : 'في انتظار الدفع',
            timestamp: nowIso,
            actor: body.ownerName.trim(),
            note: 'تم إنشاء المنصة بحالة «في انتظار الدفع» وبانتظار تسديد مبلغ الاشتراك المطلوب وتأكيد التفعيل من الإدارة العامة.',
          },
        ],
        createdAt: body.createdAt || nowIso,
        updatedAt: body.updatedAt || nowIso,
        tier: body.tier || 'pro',
        monthlyFee: Number(body.monthlyFee) || 299,
        isTemplate: isMaster,
        isVisibleOnPublicPortal: isMaster,
        enablePublicDonations: body.enablePublicDonations !== undefined ? body.enablePublicDonations : true,
        tagline: body.tagline || `منصة العمل الجمعوي الشفاف والتنمية المستدامة - ${body.city.trim()}`,
        stats: body.stats || {
          membersCount: 1,
          activitiesCount: 8,
          totalBalance: 0,
          campaignsCount: 3,
        },
      };

      const newTenant = sanitizeTenantMedia(rawTenant);

      const existingIdx = existing.findIndex((t) => t.id === newTenantId);
      if (existingIdx >= 0) {
        existing[existingIdx] = { ...existing[existingIdx], ...newTenant };
      } else {
        existing.unshift(newTenant);
      }
      writeTenantsToDisk(existing, false);
      await saveDocToFirebaseServer('tenants', newTenant.id, {
        ...newTenant,
        _updatedAt: newTenant.updatedAt || nowIso,
      }).catch(() => {});

      // Initialize campaigns database and clone active contribution types from master template
      try {
        initializeTenantCampaigns(newTenantId);
      } catch (campErr) {
        console.warn(`[TenantsAPI] Could not initialize campaigns for ${newTenantId}:`, campErr);
      }

      // Initialize activities database cloned from master template (جمعية النور للتنمية والتضامن)
      try {
        initializeTenantActivities(newTenantId);
      } catch (actErr) {
        console.warn(`[TenantsAPI] Could not initialize activities for ${newTenantId}:`, actErr);
      }

      // Initialize polls & resolutions database cloned from master template (جمعية النور للتنمية والتضامن)
      try {
        initializeTenantPolls(newTenantId, newTenant.name);
      } catch (pollsErr) {
        console.warn(`[TenantsAPI] Could not initialize polls for ${newTenantId}:`, pollsErr);
      }

      // Initialize settings database with the authentic association name & ownerUsername (never storing plaintext password)
      try {
        initializeTenantSettings(newTenant);
      } catch (settingsErr) {
        console.warn(`[TenantsAPI] Could not initialize settings for ${newTenantId}:`, settingsErr);
      }

      const ownerRecord = {
        id: newOwnerId,
        ...(cleanOwnerUsername ? { username: cleanOwnerUsername } : {}),
        fullName: body.ownerName.trim(),
        phone: body.ownerPhone.trim(),
        passwordHash: computedHash,
        passwordSalt: computedSalt,
        hasCustomPassword: Boolean(computedHash || body.hasCustomPassword || cleanOwnerUsername),
        tenantId: newTenantId,
        status: 'active',
        createdAt: newTenant.createdAt,
        updatedAt: nowIso,
      };

      const existingOwnerIdx = owners.findIndex(
        (o) => o.id === newOwnerId || o.tenantId === newTenantId
      );
      if (existingOwnerIdx >= 0) {
        const updatedOwner = {
          ...owners[existingOwnerIdx],
          ...ownerRecord,
        };
        delete updatedOwner.plainPassword;
        owners[existingOwnerIdx] = updatedOwner;
      } else {
        owners.unshift(ownerRecord);
      }
      writeOwnersToDisk(owners);

      return sendJson(res, 201, {
        success: true,
        tenant: sanitizePublicTenant(newTenant),
        owner: sanitizePublicOwner(ownerRecord),
        message: 'تم إنشاء منصة الجمعية وحفظها في قاعدة البيانات السحابية بنجاح.',
      });
    }

    // 6. POST or PUT /api/tenants/sync -> Non-destructive merge sync
    if ((method === 'POST' || method === 'PUT') && pathname === '/api/tenants/sync') {
      const body = await readBody(req);
      loadDeletedTenantIdsFromDisk();
      if (Array.isArray(body.deletedTenantIds)) {
        for (const delId of body.deletedTenantIds) {
          if (typeof delId === 'string' && delId.trim() && delId !== 'tenant_nour') {
            explicitlyDeletedTenantIds.add(delId.trim());
          }
        }
        saveDeletedTenantIdsToDisk();
      }
      const diskTenants = readTenantsFromDisk();
      const diskOwners = readOwnersFromDisk();

      if (Array.isArray(body.tenants)) {
        const mergedTenantsMap = new Map<string, any>();

        // 1. Start with all existing disk tenants (unless explicitly deleted via DELETE /api/tenants/:id)
        for (const dt of diskTenants) {
          if (dt && dt.id && !explicitlyDeletedTenantIds.has(dt.id)) {
            mergedTenantsMap.set(dt.id, dt);
          }
        }

        // 2. Merge incoming client tenants
        for (const rawCt of body.tenants) {
          if (!rawCt || !rawCt.id || explicitlyDeletedTenantIds.has(rawCt.id)) continue;
          const ct = sanitizeTenantMedia(rawCt);

          // Check if this incoming tenant is a real user-created record matching a recovered placeholder by name
          if (ct.id.startsWith('tenant_17')) {
            for (const [existingId, existingT] of mergedTenantsMap.entries()) {
              if (
                existingId !== ct.id &&
                existingT.recoveredAccount &&
                normalizeArabicText(existingT.name) === normalizeArabicText(ct.name)
              ) {
                mergedTenantsMap.delete(existingId);
              }
            }
          }

          const existing = mergedTenantsMap.get(ct.id);
          if (!existing) {
            mergedTenantsMap.set(ct.id, ct);
          } else {
            // Merge preserving non-empty fields and strictly newer updates
            const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            const incomingTime = new Date(ct.updatedAt || ct.createdAt || 0).getTime();
            const preferIncoming = incomingTime > existingTime;
            mergedTenantsMap.set(ct.id, {
              ...existing,
              ...(preferIncoming ? sanitizePublicTenant(ct) : {}),
              // Never allow client sync payload to erase or overwrite authoritative server password hashes
              ...(existing.passwordHash ? { passwordHash: existing.passwordHash, passwordSalt: existing.passwordSalt } : {}),
              ...(existing.credentialsUpdatedAt ? { credentialsUpdatedAt: existing.credentialsUpdatedAt } : {}),
              status: preferIncoming ? (ct.status || existing.status) : (existing.status || ct.status),
              logoUrl: preferIncoming ? (ct.logoUrl || existing.logoUrl) : (existing.logoUrl || ct.logoUrl),
              bannerImageUrl: preferIncoming ? (ct.bannerImageUrl || existing.bannerImageUrl) : (existing.bannerImageUrl || ct.bannerImageUrl),
              legalDocument: preferIncoming ? (ct.legalDocument || existing.legalDocument) : (existing.legalDocument || ct.legalDocument),
            });
          }
        }

        const finalTenants = Array.from(mergedTenantsMap.values());
        writeTenantsToDisk(finalTenants);

        // Also merge owners if provided in body.owners (preserving server credentials when already set)
        if (Array.isArray(body.owners)) {
          const mergedOwnersMap = new Map<string, any>();
          for (const doItem of diskOwners) {
            if (doItem && doItem.id && !explicitlyDeletedTenantIds.has(doItem.tenantId)) {
              mergedOwnersMap.set(doItem.id, doItem);
            }
          }
          for (const co of body.owners) {
            if (!co || !co.id || explicitlyDeletedTenantIds.has(co.tenantId)) continue;
            const existingO = mergedOwnersMap.get(co.id);
            const linkedT = mergedTenantsMap.get(co.tenantId);
            if (!existingO) {
              const plainPass = String(co.plainPassword || co.password || '').trim();
              const hashed = plainPass ? hashPasswordScrypt(plainPass) : null;
              const newItem: any = {
                ...co,
                ...(linkedT?.ownerUsername ? { username: linkedT.ownerUsername } : co.username ? { username: co.username } : {}),
                hasCustomPassword: Boolean(co.hasCustomPassword || hashed || co.username),
                passwordSalt: hashed ? hashed.salt : linkedT?.passwordSalt || co.passwordSalt || '',
                passwordHash: hashed ? hashed.hash : linkedT?.passwordHash || co.passwordHash || '',
              };
              delete newItem.plainPassword;
              delete newItem.password;
              mergedOwnersMap.set(co.id, newItem);
            } else {
              const mergedItem: any = {
                ...existingO,
                ...sanitizePublicOwner(co),
                username: linkedT?.ownerUsername || existingO.username || co.username,
                passwordSalt: linkedT?.passwordSalt || existingO.passwordSalt || '',
                passwordHash: linkedT?.passwordHash || existingO.passwordHash || '',
              };
              delete mergedItem.plainPassword;
              delete mergedItem.password;
              mergedOwnersMap.set(co.id, mergedItem);
            }
          }
          writeOwnersToDisk(Array.from(mergedOwnersMap.values()));
        } else {
          readOwnersFromDisk();
        }

        return sendJson(res, 200, {
          success: true,
          tenants: finalTenants.map((t) => sanitizePublicTenant(t)),
          deletedTenantIds: Array.from(explicitlyDeletedTenantIds),
          count: finalTenants.length,
          message: 'تمت مزامنة جميع الجمعيات مع الخادم بنجاح.',
        });
      }
    }

    // 3. PUT /api/tenants/:id -> Update tenant (reconciled from Cloud Firestore, never exposing or wiping hashes)
    if (method === 'PUT' && pathname.startsWith('/api/tenants/') && pathname !== '/api/tenants/sync') {
      const id = decodeURIComponent(pathname.replace('/api/tenants/', '').split('?')[0]);
      const body = await readBody(req);
      const tenants = await reconcileTenantsFromCloudFirestore(true);
      const index = tenants.findIndex((t) => t.id === id);

      if (index === -1) {
        return sendJson(res, 404, { success: false, error: 'الجمعية المطلوبة غير موجودة.' });
      }

      const existingTenant = tenants[index];
      const nowIso = new Date().toISOString();

      // Strip any raw credential fields from body so accidental overwrite is impossible
      const safeBody = sanitizePublicTenant(body);
      const newPlainPassword = String(body.plainPassword || body.password || '').trim();
      const cleanIncomingUsername =
        typeof body.ownerUsername === 'string' && body.ownerUsername.trim()
          ? body.ownerUsername.trim()
          : undefined;

      if (cleanIncomingUsername) {
        const ownersForCheck = readOwnersFromDisk();
        if (isOwnerUsernameTakenServer(cleanIncomingUsername, ownersForCheck, tenants, id)) {
          return sendJson(res, 409, {
            success: false,
            error: 'اسم المستخدم هذا مستخدم بالفعل لدى جمعية أخرى. يرجى اختيار اسم مستخدم مختلف.',
          });
        }
      }

      let nextPasswordHash = existingTenant.passwordHash;
      let nextPasswordSalt = existingTenant.passwordSalt;
      let credentialsChanged = false;

      if (newPlainPassword) {
        const hashed = hashPasswordScrypt(newPlainPassword);
        nextPasswordHash = hashed.hash;
        nextPasswordSalt = hashed.salt;
        credentialsChanged = true;
      }

      const updatedTenant: Record<string, any> = sanitizeTenantMedia({
        ...existingTenant,
        ...safeBody,
        ...(cleanIncomingUsername ? { ownerUsername: cleanIncomingUsername } : {}),
        ...(nextPasswordHash ? { passwordHash: nextPasswordHash, passwordSalt: nextPasswordSalt, hasCustomPassword: true } : {}),
        ...(credentialsChanged || cleanIncomingUsername ? { credentialsUpdatedAt: nowIso } : {}),
        updatedAt: nowIso,
      });
      delete updatedTenant.plainPassword;
      delete updatedTenant.password;

      tenants[index] = updatedTenant;
      writeTenantsToDisk(tenants, false);
      await saveDocToFirebaseServer('tenants', id, {
        ...updatedTenant,
        _updatedAt: nowIso,
      }).catch(() => {});

      // Synchronize owner details in owners_database.json
      if (
        body.ownerName !== undefined ||
        body.ownerPhone !== undefined ||
        cleanIncomingUsername !== undefined ||
        credentialsChanged
      ) {
        try {
          const owners = readOwnersFromDisk();
          const ownerIdx = owners.findIndex(
            (o) => o.tenantId === id || (updatedTenant.ownerId && o.id === updatedTenant.ownerId)
          );
          if (ownerIdx !== -1) {
            if (body.ownerName) owners[ownerIdx].fullName = body.ownerName.trim();
            if (body.ownerPhone) owners[ownerIdx].phone = body.ownerPhone.trim();
            if (cleanIncomingUsername) owners[ownerIdx].username = cleanIncomingUsername;
            if (credentialsChanged && nextPasswordHash) {
              owners[ownerIdx].passwordSalt = nextPasswordSalt;
              owners[ownerIdx].passwordHash = nextPasswordHash;
              owners[ownerIdx].hasCustomPassword = true;
              delete owners[ownerIdx].plainPassword;
            }
            owners[ownerIdx].updatedAt = nowIso;
            writeOwnersToDisk(owners);
          }
        } catch (ownerSyncErr) {
          console.warn('[tenantsApiHandler] Could not sync owner details:', ownerSyncErr);
        }
      }

      // Synchronize tenant settings database so changes reflect immediately on the association store
      try {
        const settingsDb = loadSettingsDatabase(id);
        const nextSettings = {
          ...settingsDb.settings,
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.nameFr !== undefined ? { nameFr: body.nameFr } : {}),
          ...(body.nameEn !== undefined ? { nameEn: body.nameEn } : {}),
          ...(updatedTenant.logoUrl !== undefined && updatedTenant.logoUrl ? { logoUrl: updatedTenant.logoUrl } : {}),
          ...(updatedTenant.bannerImageUrl !== undefined && updatedTenant.bannerImageUrl ? { bannerImageUrl: updatedTenant.bannerImageUrl } : {}),
          ...(body.tagline !== undefined ? { tagline: body.tagline } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.address !== undefined ? { address: body.address } : {}),
          ...(body.city !== undefined || body.country !== undefined ? {
            address: body.address || (body.city && body.country ? `${body.city}، ${body.country}` : settingsDb.settings?.address)
          } : {}),
          ...(body.ownerPhone !== undefined && body.ownerPhone ? { phone: body.ownerPhone } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.whatsapp !== undefined ? { whatsapp: body.whatsapp } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.rib !== undefined && String(body.rib).trim() ? { ribBank: String(body.rib).trim() } : {}),
          ...(body.ribBank !== undefined && String(body.ribBank).trim() ? { ribBank: String(body.ribBank).trim() } : {}),
          ...(body.bankName !== undefined && String(body.bankName).trim() ? { bankName: String(body.bankName).trim() } : {}),
          ...(body.licenseNumber !== undefined ? { licenseNumber: body.licenseNumber } : {}),
          ...(body.enablePublicDonations !== undefined ? { enablePublicDonations: body.enablePublicDonations } : {}),
          ...(cleanIncomingUsername ? { adminUsername: cleanIncomingUsername } : {}),
        };
        saveSettingsDatabase(
          {
            settings: nextSettings,
            lastUpdated: nowIso,
          },
          id
        );
      } catch (settingsSyncErr) {
        console.warn('[tenantsApiHandler] Could not sync tenant settings:', settingsSyncErr);
      }

      return sendJson(res, 200, {
        success: true,
        tenant: sanitizePublicTenant(updatedTenant),
        message: 'تم تحديث بيانات الجمعية وحفظها بشكل دائم في قاعدة البيانات الرئيسية.',
      });
    }

    // 4. POST /api/tenants/:id/toggle-status -> Activate or Disable tenant
    if (method === 'POST' && pathname.includes('/toggle-status')) {
      const id = decodeURIComponent(pathname.replace('/api/tenants/', '').replace('/toggle-status', '').split('?')[0]);
      const body = await readBody(req).catch(() => ({}));
      const tenants = readTenantsFromDisk();
      const index = tenants.findIndex((t) => t.id === id);

      if (index === -1) {
        return sendJson(res, 404, { success: false, error: 'الجمعية المطلوبة غير موجودة.' });
      }

      const now = new Date().toISOString();
      const currentStatus = tenants[index].status;
      const requestedStatus = body?.status;
      const nextStatus = requestedStatus || (currentStatus === 'active' ? 'inactive' : 'active');
      tenants[index].status = nextStatus;
      if (nextStatus === 'active') {
        tenants[index].paymentVerified = true;
        tenants[index].paymentVerifiedAt = tenants[index].paymentVerifiedAt || now;
      }
      tenants[index].updatedAt = now;
      writeTenantsToDisk(tenants, false);
      await saveDocToFirebaseServer('tenants', tenants[index].id, {
        ...tenants[index],
        _updatedAt: now,
      }).catch(() => {});

      // If activating a tenant, also mark any pending/verified activation payments for this tenant as confirmed
      if (nextStatus === 'active') {
        try {
          const { reconcilePaymentsFromCloudFirestore, writePaymentsToDisk } = await import('./platformPaymentsApiHandler');
          const allPayments = await reconcilePaymentsFromCloudFirestore(true);
          let payChanged = false;
          const updatedPayments = allPayments.map((p: any) => {
            if (p && p.tenantId === id && (!p.type || p.type === 'activation') && (p.status === 'pending' || p.status === 'verified')) {
              payChanged = true;
              return {
                ...p,
                status: 'confirmed',
                paymentVerified: true,
                reviewedAt: now,
                reviewedBy: body?.adminName || 'الإدارة العامة',
                _updatedAt: now,
              };
            }
            return p;
          });
          if (payChanged) {
            writePaymentsToDisk(updatedPayments, true);
          }
        } catch {}
      }

      return sendJson(res, 200, {
        success: true,
        tenant: sanitizePublicTenant(tenants[index]),
        newStatus: tenants[index].status,
        message: tenants[index].status === 'active' ? 'تم تفعيل منصة الجمعية بنجاح.' : 'تم تعطيل منصة الجمعية بنجاح.',
      });
    }

    // 5. DELETE /api/tenants/:id -> Delete tenant permanently (Super Admin Only)
    if (method === 'DELETE' && pathname.startsWith('/api/tenants/')) {
      const id = decodeURIComponent(pathname.replace('/api/tenants/', '').split('?')[0]).trim();

      if (!id || id === 'tenant_nour') {
        return sendJson(res, 403, {
          success: false,
          error: 'لا يمكن حذف القالب الأساسي للمنصة (جمعية النور للتنمية والتضامن).',
        });
      }

      // Enforce Super Admin role check if session header is provided
      const sessionHeader = req.headers['x-admin-session'] as string | undefined;
      if (sessionHeader) {
        try {
          const parsedSession = JSON.parse(decodeURIComponent(sessionHeader));
          if (
            parsedSession &&
            parsedSession.role === 'secondary_admin' &&
            parsedSession.isMaster !== true
          ) {
            return sendJson(res, 403, {
              success: false,
              error: 'عذراً، صلاحية الحذف النهائي للجمعيات محصورة بالأدمن الرئيسي (Super Admin) فقط.',
            });
          }
        } catch {}
      }

      // Persist deleted tenant ID on disk and in Cloud Firestore so it never resurrects
      addDeletedTenantIdOnServer(id);
      await deleteDocFromFirebaseServer('tenants', id).catch(() => {});

      const tenants = readTenantsFromDisk();
      const filtered = tenants.filter((t) => t.id !== id);
      writeTenantsToDisk(filtered, false);

      // Remove only owners linked to this deleted tenant
      const owners = readOwnersFromDisk();
      const filteredOwners = owners.filter((o) => o.tenantId !== id);
      writeOwnersToDisk(filteredOwners);

      // Remove only sub-admins linked to this deleted tenant while preserving all other tenants' sub-admins
      if (fs.existsSync(SUBADMINS_FILE)) {
        try {
          const subData = JSON.parse(fs.readFileSync(SUBADMINS_FILE, 'utf-8'));
          if (subData && Array.isArray(subData.subAdmins)) {
            const nextSubs = subData.subAdmins.filter((s: any) => s && s.tenantId !== id);
            if (nextSubs.length !== subData.subAdmins.length) {
              fs.writeFileSync(
                SUBADMINS_FILE,
                JSON.stringify({ ...subData, subAdmins: nextSubs, lastUpdated: new Date().toISOString() }, null, 2),
                'utf-8'
              );
            }
          }
        } catch {}
      }

      // Safely remove isolated per-tenant database files without touching any other association's data
      const cleanId = id.replace(/[^a-zA-Z0-9_\-]/g, '').trim();
      if (cleanId && cleanId !== 'tenant_nour' && cleanId !== 'portal' && cleanId !== 'default' && cleanId !== 'master') {
        const isolatedFiles = [
          `tenant_records_database_${cleanId}.json`,
          `settings_database_${cleanId}.json`,
          `activities_database_${cleanId}.json`,
          `campaigns_database_${cleanId}.json`,
          `polls_database_${cleanId}.json`,
          `ui_elements_database_${cleanId}.json`,
          `card_settings_database_${cleanId}.json`,
          `visibility_database_${cleanId}.json`,
        ];
        for (const fileName of isolatedFiles) {
          const targetPath = path.join(DATA_DIR, fileName);
          try {
            if (fs.existsSync(targetPath)) {
              fs.unlinkSync(targetPath);
            }
          } catch {}
        }
      }

      return sendJson(res, 200, {
        success: true,
        deletedId: id,
        tenants: filtered,
        deletedTenantIds: Array.from(explicitlyDeletedTenantIds),
        message: 'تم حذف منصة الجمعية وجميع بياناتها نهائياً من قاعدة البيانات بنجاح.',
      });
    }

    return sendJson(res, 404, { success: false, error: 'Endpoint not found' });
  } catch (err: any) {
    console.error('[tenantsApiHandler error]', err);
    return sendJson(res, 500, {
      success: false,
      error: err?.message || 'Server error in tenants handler',
    });
  }
}
