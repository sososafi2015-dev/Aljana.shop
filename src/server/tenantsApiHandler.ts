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

export function writeTenantsToDisk(tenants: any[]): void {
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
  } catch (err) {
    console.error('[tenantsApiHandler] Error writing tenants_database.json:', err);
  }
}

function hashPasswordSha256(password: string, salt: string): string {
  return crypto.createHash('sha256').update(`${password}:${salt}:chayef_assoc_salt_secret`).digest('hex');
}

function legacyClientDjb2Hash(password: string, salt: string): string {
  let hash = 0;
  const str = `${password}:${salt}:chayef_assoc_salt_secret`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

function generateSalt(length = 16): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Verifies a password against any format stored in owners_database.json:
 * - plainPassword
 * - SHA-256 salted hash (`${password}:${salt}:chayef_assoc_salt_secret`)
 * - Plain SHA-256 hex (`crypto.createHash('sha256').update(password).digest('hex')`)
 * - Legacy client DJB2 32-char hash
 */
function verifyOwnerPasswordServer(password: string, owner: any, tenant?: any): boolean {
  if (!password || !owner) return false;
  const cleanPass = password.trim();

  if (owner.plainPassword && cleanPass === String(owner.plainPassword).trim()) {
    return true;
  }
  if (tenant?.plainPassword && cleanPass === String(tenant.plainPassword).trim()) {
    return true;
  }

  const salt = owner.passwordSalt || tenant?.passwordSalt || '';
  const storedHash = owner.passwordHash || tenant?.passwordHash || '';

  if (storedHash) {
    if (hashPasswordSha256(cleanPass, salt) === storedHash) return true;
    if (legacyClientDjb2Hash(cleanPass, salt) === storedHash) return true;
    const rawSha = crypto.createHash('sha256').update(cleanPass).digest('hex');
    if (rawSha === storedHash) return true;
    const aljanaSha = crypto.createHash('sha256').update(cleanPass + 'aljana_salt_2025').digest('hex');
    if (aljanaSha === storedHash) return true;
  }

  // Fallback ONLY for pre-seeded demo accounts that do not have a stored passwordHash or plainPassword yet,
  // OR for the pre-seeded initial sub-admin (subadmin-1) with placeholder hash
  const isSeededSubAdminPlaceholder =
    owner.id === 'subadmin-1' &&
    storedHash === 'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2';
  if (
    isSeededSubAdminPlaceholder ||
    (!storedHash && !owner.hasCustomPassword && !owner.plainPassword && !tenant?.plainPassword)
  ) {
    if (
      cleanPass === 'admin123' ||
      cleanPass === '123456' ||
      (owner.phone && cleanPass === owner.phone.trim())
    ) {
      return true;
    }
  }

  return false;
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

  // Reconcile any tenants existing in tenants_database.json that might not have an owner record yet
  // IMPORTANT: Check by (o.id === existingOwnerId || o.tenantId === t.id) so multiple associations with the same phone each have their own owner record!
  const tenants = readTenantsFromDisk();
  let needsWrite = parsedOwners.length === 0;

  for (const t of tenants) {
    if (!t || !t.id) continue;
    const existingOwnerId = t.ownerId || `owner_${t.id}`;
    const allCurrent = Array.from(ownersMap.values());
    const existingOwner = allCurrent.find(
      (o) => o.id === existingOwnerId || o.tenantId === t.id
    );

    if (existingOwner && !existingOwner.username) {
      existingOwner.username = t.ownerUsername || (t.id === 'tenant_nour' ? 'nour2024' : `admin${String(t.id).replace(/\D/g, '').slice(-4) || '2024'}`);
      ownersMap.set(existingOwner.id, existingOwner);
      needsWrite = true;
    }

    if (!existingOwner && (t.ownerPhone || t.ownerName || t.ownerUsername)) {
      const salt = t.passwordSalt || generateSalt(16);
      const plainPass = t.plainPassword || t.password || undefined;
      ownersMap.set(existingOwnerId, {
        id: existingOwnerId,
        ...(t.ownerUsername ? { username: t.ownerUsername } : {}),
        fullName: t.ownerName || 'مدير الجمعية',
        phone: t.ownerPhone || '',
        passwordHash: plainPass
          ? hashPasswordSha256(plainPass, salt)
          : t.passwordHash || hashPasswordSha256('admin123', salt),
        passwordSalt: salt,
        ...(plainPass || t.hasCustomPassword || t.ownerUsername ? { hasCustomPassword: true } : {}),
        tenantId: t.id,
        status: 'active',
        createdAt: t.createdAt || new Date().toISOString(),
        recoveredAccount: t.recoveredAccount || (!plainPass && !t.passwordHash),
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
  if (!username) return '';
  return String(username)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
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

      const owners = readOwnersFromDisk();
      const tenants = readTenantsFromDisk();
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

    // 0. POST /api/tenants/login -> Dedicated login endpoint for multi-tenant platform
    if (method === 'POST' && pathname === '/api/tenants/login') {
      const body = await readBody(req);
      const identifier = (body.loginIdentifier || body.identifier || '').trim();
      const password = (body.password || '').trim();

      if (!identifier || !password) {
        return sendJson(res, 400, {
          success: false,
          errorCode: 'EMPTY_FIELDS',
          error: 'يرجى إدخال اسم المستخدم وكلمة المرور.',
        });
      }

      const owners = readOwnersFromDisk();
      const tenants = readTenantsFromDisk();
      const isPhoneQuery = /\d{5,}/.test(identifier.replace(/[\s\-\(\)\.]/g, ''));
      const normUsernameQuery = normalizeOwnerUsername(identifier);

      // Build candidate (owner, tenant) pairs matching by username, phone, ownerName, or association name
      interface CandidatePair {
        owner: any;
        tenant: any;
        exactUsernameMatch: boolean;
        exactAssocMatch: boolean;
      }
      const candidates: CandidatePair[] = [];
      const seenTenantIds = new Set<string>();

      for (const t of tenants) {
        if (!t || !t.id) continue;
        const linkedOwner =
          owners.find((o) => o.id === t.ownerId || o.tenantId === t.id);

        const matchesUsername =
          Boolean(normUsernameQuery) &&
          ((t.ownerUsername && normalizeOwnerUsername(t.ownerUsername) === normUsernameQuery) ||
            (linkedOwner?.username && normalizeOwnerUsername(linkedOwner.username) === normUsernameQuery));

        if (matchesUsername) {
          seenTenantIds.add(t.id);
          const effectiveOwner = linkedOwner || {
            id: t.ownerId || `owner_${t.id}`,
            ...(t.ownerUsername ? { username: t.ownerUsername } : {}),
            fullName: t.ownerName || 'مدير الجمعية',
            phone: t.ownerPhone || '',
            passwordHash: t.passwordHash || '',
            passwordSalt: t.passwordSalt || '',
            plainPassword: t.plainPassword || undefined,
            hasCustomPassword: Boolean(t.hasCustomPassword || t.ownerUsername),
            tenantId: t.id,
            status: 'active',
            createdAt: t.createdAt || new Date().toISOString(),
            recoveredAccount: true,
          };
          candidates.push({
            owner: effectiveOwner,
            tenant: t,
            exactUsernameMatch: true,
            exactAssocMatch: false,
          });
        }
      }

      // Also check owners whose tenant might not have been matched above
      for (const o of owners) {
        if (!o || (o.tenantId && seenTenantIds.has(o.tenantId))) continue;
        const matchesUsername =
          Boolean(normUsernameQuery) && Boolean(o.username) && normalizeOwnerUsername(o.username) === normUsernameQuery;
        if (matchesUsername) {
          const t = tenants.find((item) => item.id === o.tenantId || item.ownerId === o.id);
          if (t) {
            seenTenantIds.add(t.id);
            candidates.push({
              owner: o,
              tenant: t,
              exactUsernameMatch: true,
              exactAssocMatch: false,
            });
          }
        }
      }

      if (candidates.length > 0) {
        // Sort candidates: exact username match first, then exact association name match, then newest createdAt first
        candidates.sort((a, b) => {
          if (a.exactUsernameMatch !== b.exactUsernameMatch) return a.exactUsernameMatch ? -1 : 1;
          if (a.exactAssocMatch !== b.exactAssocMatch) return a.exactAssocMatch ? -1 : 1;
          const timeA = new Date(a.tenant.createdAt || 0).getTime();
          const timeB = new Date(b.tenant.createdAt || 0).getTime();
          return timeB - timeA;
        });

        // 1st pass: check for strict password match among owner candidates
        let verifiedCandidate = candidates.find((c) => verifyOwnerPasswordServer(password, c.owner, c.tenant));

        // 2nd pass: if none matched strictly, check if candidate is an uninitialized recovered account without any stored password hash
        if (!verifiedCandidate && password.length >= 4) {
          const recoverableCandidate = candidates.find(
            (c) =>
              (c.owner.recoveredAccount === true || c.tenant.recoveredAccount === true) &&
              !c.owner.passwordHash &&
              !c.tenant.passwordHash &&
              !c.owner.plainPassword &&
              !c.tenant.plainPassword &&
              !c.owner.hasCustomPassword
          );
          if (recoverableCandidate) {
            // Bind the owner's password permanently on first login recovery
            const salt = recoverableCandidate.owner.passwordSalt || generateSalt(16);
            const newHash = hashPasswordSha256(password, salt);
            recoverableCandidate.owner.passwordSalt = salt;
            recoverableCandidate.owner.passwordHash = newHash;
            recoverableCandidate.owner.recoveredAccount = false;
            recoverableCandidate.tenant.recoveredAccount = false;

            const oIdx = owners.findIndex((o) => o.id === recoverableCandidate.owner.id || o.tenantId === recoverableCandidate.tenant.id);
            if (oIdx >= 0) {
              owners[oIdx] = { ...owners[oIdx], ...recoverableCandidate.owner };
            } else {
              owners.push(recoverableCandidate.owner);
            }
            writeOwnersToDisk(owners);
            verifiedCandidate = recoverableCandidate;
          }
        }

        if (verifiedCandidate) {
          const { owner: matchedOwner, tenant } = verifiedCandidate;

          const session = {
            type: 'super_admin',
            role: 'main_admin',
            id: matchedOwner.id,
            ...(matchedOwner.username || tenant.ownerUsername
              ? { username: matchedOwner.username || tenant.ownerUsername }
              : {}),
            fullName: matchedOwner.fullName,
            phone: matchedOwner.phone,
            tenantId: tenant.id,
            isMasterPlatformAdmin: false,
            token: `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          };

          return sendJson(res, 200, {
            success: true,
            role: 'admin',
            owner: matchedOwner,
            tenant,
            session,
            message: `مرحباً بك مجدداً يا ${matchedOwner.fullName}! جاري توجيهك إلى منصة «${tenant.name}»...`,
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
      // If no sub-admin matches on local disk yet, hydrate from Cloud Firestore sub_admins immediately
      if (!allSubAdminsToSearch.some(({ sub }) => doesSubAdminMatchIdentifier(sub))) {
        await hydrateSubAdminsFromFirestore().catch(() => {});
        allSubAdminsToSearch = collectAllSubAdmins();
      }

      for (const { sub: matchedSubAdmin, tenantId: subTenantId } of allSubAdminsToSearch) {
        if (doesSubAdminMatchIdentifier(matchedSubAdmin)) {
          hadSubAdminIdentifierMatch = true;
          const isSubValid = verifyOwnerPasswordServer(password, matchedSubAdmin);
          if (isSubValid) {
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
              tenant,
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

      // 3. Search Association Members across all tenants (جمعية النور للتنمية والتضامن and all registered associations)
      // Members are authenticated strictly with role: 'member' and session: null (strictly by username)
      interface MemberCandidate {
        member: any;
        tenant: any;
      }
      const memberCandidates: MemberCandidate[] = [];
      const cleanIdLower = identifier.toLowerCase();

      for (const t of tenants) {
        if (!t || !t.id) continue;
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

          // Provision salt & hash if member logged in with initial default password and update lastLoginDate
          let finalMember = {
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
            tenant: memberTenant,
            session: null,
            message: `مرحباً بك يا ${finalMember.fullName}! جاري توجيهك إلى واجهة «${memberTenant.name}»...`,
          });
        }

        // Member identifier matched, or earlier owner/subAdmin identifier matched, but password was wrong
        return sendJson(res, 401, {
          success: false,
          errorCode: 'WRONG_PASSWORD',
          error: 'كلمة المرور غير صحيحة. يرجى التحقق وإعادة المحاولة.',
        });
      }

      if (candidates.length > 0 || hadSubAdminIdentifierMatch) {
        return sendJson(res, 401, {
          success: false,
          errorCode: 'WRONG_PASSWORD',
          error: 'كلمة المرور غير صحيحة. يرجى التحقق وإعادة المحاولة.',
        });
      }

      return sendJson(res, 404, {
        success: false,
        errorCode: 'NOT_FOUND',
        error: 'اسم المستخدم غير مسجل في النظام. يرجى التأكد من كتابة اسم المستخدم الصحيح (تسجيل الدخول متاح باسم المستخدم وكلمة المرور فقط).',
      });
    }

    // POST /api/tenants/lookup -> Live identification check for "نسيت كلمة المرور؟"
    if (method === 'POST' && pathname === '/api/tenants/lookup') {
      const body = await readBody(req);
      const identifier = (body.identifier || '').trim();
      if (!identifier) {
        return sendJson(res, 400, { success: false, error: 'يرجى إدخال رقم الهاتف أو الاسم للبحث.' });
      }

      const owners = readOwnersFromDisk();
      const tenants = readTenantsFromDisk();
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

    // POST /api/tenants/reset-password -> Reset owner password safely
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

      const owners = readOwnersFromDisk();
      const tenants = readTenantsFromDisk();
      const isPhoneQuery = /\d{5,}/.test(identifier.replace(/[\s\-\(\)\.]/g, ''));
      const normUser = normalizeOwnerUsername(identifier);

      let index = owners.findIndex((o) => {
        if (ownerId && o.id === ownerId) return true;
        if (tenantId && o.tenantId === tenantId) return true;
        if (normUser && o.username && normalizeOwnerUsername(o.username) === normUser) return true;
        if (isPhoneQuery && phonesMatch(o.phone, identifier)) return true;
        if (!isPhoneQuery && identifier && namesMatch(o.fullName, identifier)) return true;
        return false;
      });

      if (index === -1 && identifier && !isPhoneQuery) {
        const byAssocName = tenants.find(
          (t) =>
            (normUser && t.ownerUsername && normalizeOwnerUsername(t.ownerUsername) === normUser) ||
            namesMatch(t.name, identifier) ||
            namesMatch(t.nameFr, identifier)
        );
        if (byAssocName) {
          index = owners.findIndex((o) => o.tenantId === byAssocName.id || o.id === byAssocName.ownerId);
        }
      }

      if (index === -1 && (tenantId || ownerId || identifier)) {
        const foundTenant = tenants.find(
          (t) =>
            (tenantId && t.id === tenantId) ||
            (ownerId && t.ownerId === ownerId) ||
            (normUser && t.ownerUsername && normalizeOwnerUsername(t.ownerUsername) === normUser) ||
            (isPhoneQuery && phonesMatch(t.ownerPhone, identifier)) ||
            (!isPhoneQuery && identifier && (namesMatch(t.ownerName, identifier) || namesMatch(t.name, identifier)))
        );
        if (foundTenant) {
          const salt = generateSalt(16);
          const newOwner = {
            id: foundTenant.ownerId || ownerId || `owner_${foundTenant.id}`,
            ...(foundTenant.ownerUsername ? { username: foundTenant.ownerUsername } : {}),
            fullName: foundTenant.ownerName || 'مدير الجمعية',
            phone: foundTenant.ownerPhone || identifier,
            passwordHash: hashPasswordSha256(newPassword, salt),
            passwordSalt: salt,
            hasCustomPassword: true,
            tenantId: foundTenant.id,
            status: 'active',
            createdAt: foundTenant.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          owners.push(newOwner);
          writeOwnersToDisk(owners);
          return sendJson(res, 200, {
            success: true,
            message: 'تم تحديث كلمة المرور بنجاح وحفظها في قاعدة البيانات الرئيسية.',
            tenantId: newOwner.tenantId,
            ownerId: newOwner.id,
          });
        }
      }

      if (index === -1) {
        return sendJson(res, 404, { success: false, error: 'لم يتم العثور على الحساب لتحديث كلمة المرور.' });
      }

      const salt = generateSalt(16);
      const hash = hashPasswordSha256(newPassword, salt);

      owners[index].passwordSalt = salt;
      owners[index].passwordHash = hash;
      owners[index].hasCustomPassword = true;
      delete owners[index].plainPassword;
      owners[index].recoveredAccount = false;
      owners[index].updatedAt = new Date().toISOString();

      writeOwnersToDisk(owners);

      return sendJson(res, 200, {
        success: true,
        message: 'تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
        tenantId: owners[index].tenantId,
        ownerId: owners[index].id,
      });
    }

    // GET /api/tenants/owners -> Get all owners
    if (method === 'GET' && pathname === '/api/tenants/owners') {
      const owners = readOwnersFromDisk();
      return sendJson(res, 200, { success: true, owners });
    }

    // 1. GET /api/tenants -> List all tenants (support publicOnly filter)
    if (method === 'GET' && pathname === '/api/tenants') {
      const isPublicOnly = fullUrl.includes('public=true') || fullUrl.includes('publicOnly=true');
      const deletedIds = loadDeletedTenantIdsFromDisk();
      const allTenants = readTenantsFromDisk();
      const tenants = isPublicOnly
        ? allTenants.filter((t) => (t.isTemplate || t.id === 'tenant_nour') && t.isVisibleOnPublicPortal !== false)
        : allTenants;
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

      const existing = readTenantsFromDisk();
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

      const rawTenant = {
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
        ownerName: body.ownerName.trim(),
        ownerPhone: body.ownerPhone.trim(),
        status: body.status || (isMaster ? 'active' : 'pending_subscription'),
        paymentVerified: body.paymentVerified ?? (isMaster ? true : false),
        subscriptionStatusHistory: body.subscriptionStatusHistory || [
          {
            status: body.status || (isMaster ? 'active' : 'pending_subscription'),
            label: (body.status || (isMaster ? 'active' : 'pending_subscription')) === 'active' ? 'مفعّلة' : 'في انتظار الدفع',
            timestamp: new Date().toISOString(),
            actor: body.ownerName.trim(),
            note: 'تم إنشاء المنصة بحالة «في انتظار الدفع» وبانتظار تسديد مبلغ الاشتراك المطلوب وتأكيد التفعيل من الإدارة العامة.',
          },
        ],
        createdAt: body.createdAt || new Date().toISOString(),
        updatedAt: body.updatedAt || new Date().toISOString(),
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
      writeTenantsToDisk(existing);

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

      // Initialize settings database with the authentic association name provided by the user
      try {
        initializeTenantSettings(newTenant);
      } catch (settingsErr) {
        console.warn(`[TenantsAPI] Could not initialize settings for ${newTenantId}:`, settingsErr);
      }

      // Persist owner to owners_database.json with encrypted salted SHA-256 hash (no cleartext password persisted)
      const plainPassword = (body.plainPassword || body.password || '').trim();
      const salt = body.passwordSalt || generateSalt(16);
      const computedHash = plainPassword
        ? hashPasswordSha256(plainPassword, salt)
        : body.passwordHash || hashPasswordSha256('admin123', salt);

      const ownerRecord = {
        id: newOwnerId,
        ...(cleanOwnerUsername ? { username: cleanOwnerUsername } : {}),
        fullName: body.ownerName.trim(),
        phone: body.ownerPhone.trim(),
        passwordHash: computedHash,
        passwordSalt: salt,
        hasCustomPassword: Boolean(plainPassword || body.hasCustomPassword || cleanOwnerUsername),
        tenantId: newTenantId,
        status: 'active',
        createdAt: newTenant.createdAt,
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
        tenant: newTenant,
        owner: ownerRecord,
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
              ...(preferIncoming ? ct : {}),
              status: preferIncoming ? (ct.status || existing.status) : (existing.status || ct.status),
              logoUrl: preferIncoming ? (ct.logoUrl || existing.logoUrl) : (existing.logoUrl || ct.logoUrl),
              bannerImageUrl: preferIncoming ? (ct.bannerImageUrl || existing.bannerImageUrl) : (existing.bannerImageUrl || ct.bannerImageUrl),
              legalDocument: preferIncoming ? (ct.legalDocument || existing.legalDocument) : (existing.legalDocument || ct.legalDocument),
            });
          }
        }

        const finalTenants = Array.from(mergedTenantsMap.values());
        writeTenantsToDisk(finalTenants);

        // Also merge owners if provided in body.owners
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
            if (!existingO) {
              const salt = co.passwordSalt || generateSalt(16);
              const plainPass = co.plainPassword || co.password;
              const newItem: any = {
                ...co,
                ...(co.username ? { username: co.username } : {}),
                hasCustomPassword: Boolean(co.hasCustomPassword || plainPass || co.username),
                passwordSalt: salt,
                passwordHash: plainPass ? hashPasswordSha256(plainPass, salt) : co.passwordHash,
              };
              delete newItem.plainPassword;
              delete newItem.password;
              mergedOwnersMap.set(co.id, newItem);
            } else {
              const plainPass = co.plainPassword || co.password;
              const salt = co.passwordSalt || existingO.passwordSalt || generateSalt(16);
              const mergedItem: any = {
                ...existingO,
                ...co,
                username: co.username || existingO.username,
                hasCustomPassword: Boolean(
                  co.hasCustomPassword ?? existingO.hasCustomPassword ?? (plainPass || co.username || existingO.username)
                ),
                passwordSalt: salt,
                passwordHash: plainPass
                  ? hashPasswordSha256(plainPass, salt)
                  : existingO.passwordHash || co.passwordHash,
              };
              delete mergedItem.plainPassword;
              delete mergedItem.password;
              mergedOwnersMap.set(co.id, mergedItem);
            }
          }
          writeOwnersToDisk(Array.from(mergedOwnersMap.values()));
        } else {
          // Ensure owners are reconciled with any newly synced tenants
          readOwnersFromDisk();
        }

        return sendJson(res, 200, {
          success: true,
          tenants: finalTenants,
          deletedTenantIds: Array.from(explicitlyDeletedTenantIds),
          count: finalTenants.length,
          message: 'تمت مزامنة جميع الجمعيات مع الخادم بنجاح.',
        });
      }
    }

    // 3. PUT /api/tenants/:id -> Update tenant (and synchronize owners_database.json & settings_database)
    if (method === 'PUT' && pathname.startsWith('/api/tenants/') && pathname !== '/api/tenants/sync') {
      const id = decodeURIComponent(pathname.replace('/api/tenants/', '').split('?')[0]);
      const body = await readBody(req);
      const tenants = readTenantsFromDisk();
      const index = tenants.findIndex((t) => t.id === id);

      if (index === -1) {
        return sendJson(res, 404, { success: false, error: 'الجمعية المطلوبة غير موجودة.' });
      }

      const updatedTenant = sanitizeTenantMedia({
        ...tenants[index],
        ...body,
        updatedAt: new Date().toISOString(),
      });
      tenants[index] = updatedTenant;
      writeTenantsToDisk(tenants);

      // Synchronize owner details in owners_database.json if ownerName or ownerPhone changed
      if (body.ownerName !== undefined || body.ownerPhone !== undefined || body.plainPassword !== undefined) {
        try {
          const owners = readOwnersFromDisk();
          const ownerIdx = owners.findIndex(
            (o) => o.tenantId === id || (updatedTenant.ownerId && o.id === updatedTenant.ownerId)
          );
          if (ownerIdx !== -1) {
            if (body.ownerName) owners[ownerIdx].fullName = body.ownerName.trim();
            if (body.ownerPhone) owners[ownerIdx].phone = body.ownerPhone.trim();
            if (body.plainPassword) {
              const salt = owners[ownerIdx].passwordSalt || generateSalt(16);
              owners[ownerIdx].passwordSalt = salt;
              owners[ownerIdx].passwordHash = hashPasswordSha256(body.plainPassword.trim(), salt);
              owners[ownerIdx].plainPassword = body.plainPassword.trim();
            }
            owners[ownerIdx].updatedAt = new Date().toISOString();
            writeOwnersToDisk(owners);
          }
        } catch (ownerSyncErr) {
          console.warn('[tenantsApiHandler] Could not sync owner details:', ownerSyncErr);
        }
      }

      // Synchronize tenant settings database so changes from Super Admin reflect immediately on the association store
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
          ...(body.rib !== undefined ? { ribBank: body.rib } : {}),
          ...(body.ribBank !== undefined ? { ribBank: body.ribBank } : {}),
          ...(body.bankName !== undefined ? { bankName: body.bankName } : {}),
          ...(body.licenseNumber !== undefined ? { licenseNumber: body.licenseNumber } : {}),
          ...(body.enablePublicDonations !== undefined ? { enablePublicDonations: body.enablePublicDonations } : {}),
        };
        saveSettingsDatabase(
          {
            settings: nextSettings,
            lastUpdated: new Date().toISOString(),
          },
          id
        );
      } catch (settingsSyncErr) {
        console.warn('[tenantsApiHandler] Could not sync tenant settings:', settingsSyncErr);
      }

      return sendJson(res, 200, {
        success: true,
        tenant: updatedTenant,
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

      const currentStatus = tenants[index].status;
      const requestedStatus = body?.status;
      tenants[index].status = requestedStatus || (currentStatus === 'active' ? 'inactive' : 'active');
      tenants[index].updatedAt = new Date().toISOString();
      writeTenantsToDisk(tenants);

      return sendJson(res, 200, {
        success: true,
        tenant: tenants[index],
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

      // Persist deleted tenant ID on disk so it never resurrects
      addDeletedTenantIdOnServer(id);

      const tenants = readTenantsFromDisk();
      const filtered = tenants.filter((t) => t.id !== id);
      writeTenantsToDisk(filtered);

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
