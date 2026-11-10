import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_DONATION_PRESETS,
  type DonationCampaign,
  type CampaignContribution,
  type ContributionTypeConfig,
  type CampaignStatus,
} from '../types';
import { initialCampaigns, initialCampaignContributions, initialContributionTypes } from '../initialData';
import {
  DATA_DIR,
  ensureStorageDirectories,
  normalizeTenantId,
  offloadEmbeddedMediaDeep,
  readJsonFileSync,
  writeJsonFileAtomicSync,
  readLargeJsonBody,
} from './storageEngine';
import { syncTenantCollectionToFirebaseServer } from './firebaseServerStorage';
import { readTenantRecordsFromDisk, writeTenantRecordsToDisk } from './tenantRecordsApiHandler';

export interface CampaignsDatabase {
  campaigns: DonationCampaign[];
  contributions: CampaignContribution[];
  contributionTypes: ContributionTypeConfig[];
  presets?: number[];
  lastUpdated: string;
}

const GLOBAL_TYPES_FILE = path.join(DATA_DIR, 'global_contribution_types.json');
const GLOBAL_PRESETS_FILE = path.join(DATA_DIR, 'global_donation_presets.json');

function getTenantCampaignsFile(tenantId?: string | null): string {
  const clean = normalizeTenantId(tenantId);
  if (clean === 'tenant_nour') {
    return path.join(DATA_DIR, 'campaigns_database.json');
  }
  return path.join(DATA_DIR, `campaigns_database_${clean}.json`);
}

function normalizeContributionType(raw: any, idx = 0): ContributionTypeConfig {
  return {
    id: String(raw?.id || `type-${Date.now()}-${idx}`),
    nameAr: String(raw?.nameAr || raw?.name || 'نوع مساهمة').trim(),
    nameFr: raw?.nameFr ? String(raw.nameFr).trim() : '',
    nameEn: raw?.nameEn ? String(raw.nameEn).trim() : '',
    isFinancial: raw?.isFinancial !== undefined ? Boolean(raw.isFinancial) : true,
    isDefault: Boolean(raw?.isDefault),
    enabled: raw?.enabled !== undefined ? Boolean(raw.enabled) : raw?.isActive !== undefined ? Boolean(raw.isActive) : true,
    order: typeof raw?.order === 'number' ? raw.order : idx + 1,
    showInStore: raw?.showInStore !== false,
    descriptionAr: raw?.descriptionAr ? String(raw.descriptionAr).trim() : raw?.description ? String(raw.description).trim() : '',
    descriptionFr: raw?.descriptionFr ? String(raw.descriptionFr).trim() : '',
    descriptionEn: raw?.descriptionEn ? String(raw.descriptionEn).trim() : '',
    isDeleted: Boolean(raw?.isDeleted),
    deletedAt: raw?.deletedAt || undefined,
  };
}

function isExcludedContributionType(raw: any): boolean {
  if (!raw) return false;
  if (raw.id === 'type-in-kind-materials') return true;
  const name = String(raw.nameAr || raw.name || '').trim();
  if (name.includes('الدعاء بنية الشفاء') || (name.includes('الدعاء') && name.includes('الشفاء'))) {
    return true;
  }
  return false;
}

function getMasterContributionTypes(): ContributionTypeConfig[] {
  try {
    ensureStorageDirectories();
    if (fs.existsSync(GLOBAL_TYPES_FILE)) {
      const parsed = readJsonFileSync<any[]>(GLOBAL_TYPES_FILE, () => []);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((t) => !isExcludedContributionType(t))
          .map((t, i) => normalizeContributionType(t, i));
      }
    }
    const masterFile = path.join(DATA_DIR, 'campaigns_database.json');
    if (fs.existsSync(masterFile)) {
      const parsed = readJsonFileSync<any>(masterFile, null);
      if (Array.isArray(parsed?.contributionTypes) && parsed.contributionTypes.length > 0) {
        return parsed.contributionTypes
          .filter((t: any) => !isExcludedContributionType(t))
          .map((t: any, i: number) => normalizeContributionType(t, i));
      }
    }
  } catch {}
  return initialContributionTypes
    .filter((t) => !isExcludedContributionType(t))
    .map((t, i) => normalizeContributionType(t, i));
}

function getTenantRecordsFileForCampaigns(tenantId?: string | null): string {
  const clean = normalizeTenantId(tenantId);
  if (clean === 'tenant_nour') {
    return path.join(DATA_DIR, 'tenant_records_database.json');
  }
  return path.join(DATA_DIR, `tenant_records_database_${clean}.json`);
}

export function reconcileDeletedContributionTypesAcrossAllTenants(
  allTypesInput?: ContributionTypeConfig[]
): void {
  try {
    ensureStorageDirectories();
    const allTypes = allTypesInput || getMasterContributionTypes();
    const deletedTypeIds = new Set<string>();
    const deletedTypeNames = new Set<string>();

    for (const t of allTypes) {
      if (t && t.isDeleted) {
        if (t.id) deletedTypeIds.add(t.id.trim());
        if (t.nameAr) deletedTypeNames.add(t.nameAr.trim());
      }
    }

    if (!fs.existsSync(DATA_DIR)) return;
    const campFiles = fs
      .readdirSync(DATA_DIR)
      .filter((f) => f.startsWith('campaigns_database') && f.endsWith('.json'));

    for (const file of campFiles) {
      const tenantId =
        file === 'campaigns_database.json'
          ? 'tenant_nour'
          : file.replace(/^campaigns_database_/, '').replace(/\.json$/, '');
      const campPath = path.join(DATA_DIR, file);
      const recordsPath = getTenantRecordsFileForCampaigns(tenantId);

      const campDb = readJsonFileSync<any>(campPath, null);
      if (!campDb || typeof campDb !== 'object') continue;

      const recordsDb = readTenantRecordsFromDisk(tenantId);

      const memberContribs: any[] = Array.isArray(recordsDb?.contributions)
        ? recordsDb.contributions
        : [];
      const memberContribById = new Map<string, any>();
      for (const mc of memberContribs) {
        if (mc && mc.id) memberContribById.set(mc.id, mc);
      }

      const initialSampleCcIds = new Set(['cc-1', 'cc-2', 'cc-3', 'cc-4', 'cc-5', 'cc-6']);
      const deletedContribSet = new Set(recordsDb.deletedContributionIds || []);
      const deletedOpSet = new Set(recordsDb.deletedOperationIds || []);

      let campChanged = false;
      let recordsChanged = false;

      if (Array.isArray(campDb.contributions)) {
        campDb.contributions = campDb.contributions.map((cc: any) => {
          if (!cc || !cc.id) return cc;
          const isTypeDeleted =
            (cc.contributionTypeId && deletedTypeIds.has(String(cc.contributionTypeId).trim())) ||
            (cc.contributionTypeName && deletedTypeNames.has(String(cc.contributionTypeName).trim()));

          const linkedMc =
            memberContribById.get(`contrib-don-${cc.id}`) || memberContribById.get(cc.id);

          const isLinkedMcUnpaid =
            linkedMc &&
            (linkedMc.status === 'unpaid' ||
              linkedMc.status === 'approved' ||
              linkedMc.isNegative === true ||
              linkedMc.amountSign === '-');

          if (
            (cc.status === 'pending' || cc.status === 'unpaid') &&
            (isTypeDeleted || isLinkedMcUnpaid)
          ) {
            if (cc.status !== 'unpaid' || cc.isNegative !== true || cc.amountSign !== '-') {
              campChanged = true;
              return {
                ...cc,
                status: 'unpaid',
                isNegative: true,
                amountSign: '-',
              };
            }
          }

          // Ensure any non-sample financial campaign contribution exists in tenant_records_database.json (contributions & operations)
          const amt = Number(cc.amount) || 0;
          if (amt > 0 && !initialSampleCcIds.has(cc.id)) {
            const memberContribId = `contrib-don-${cc.id}`;
            const newOpId = `op-camp-${cc.id}`;
            if (
              !linkedMc &&
              !deletedContribSet.has(memberContribId) &&
              !deletedOpSet.has(newOpId)
            ) {
              const newMc = {
                id: memberContribId,
                memberId: cc.isAnonymous ? 'anonymous-donor' : `donor-${cc.id}`,
                memberCode: cc.isAnonymous ? 'فاعل خير' : 'متبرع',
                memberName: cc.donorName || 'فاعل خير',
                amount: amt,
                date: cc.date || new Date().toISOString().slice(0, 10),
                time: cc.time || '12:00:00',
                createdAt: cc.createdAt || new Date().toISOString(),
                status: isTypeDeleted || cc.status === 'unpaid' ? 'unpaid' : cc.status || 'pending',
                isNegative: isTypeDeleted || cc.status === 'unpaid' ? true : undefined,
                amountSign: isTypeDeleted || cc.status === 'unpaid' ? '-' : undefined,
                category: 'donation',
                paymentMethod: cc.paymentMethod || 'bank_transfer',
                notes: `تبرع لحملة: ${cc.campaignTitle || ''}${cc.notes ? ` - ${cc.notes}` : ''}`,
                financialOperationId: newOpId,
                contributionTypeId: cc.contributionTypeId,
                contributionTypeName: cc.contributionTypeName,
                tenantId,
                associationId: tenantId,
                campaignId: cc.campaignId,
                campaignTitle: cc.campaignTitle,
                donorPhone: cc.donorPhone || '',
                isAnonymous: Boolean(cc.isAnonymous),
                proofImageUrl: cc.proofImageUrl || cc.receiptUrl || undefined,
                receiptUrl: cc.receiptUrl || cc.proofImageUrl || undefined,
              };
              recordsDb.contributions.unshift(newMc);
              memberContribById.set(memberContribId, newMc);
              recordsChanged = true;
            }
          }

          return cc;
        });
      }

      if (recordsDb && Array.isArray(recordsDb.contributions)) {
        recordsDb.contributions = recordsDb.contributions.map((mc: any) => {
          if (!mc || !mc.id) return mc;
          const isMcTypeDeleted =
            (mc.contributionTypeId && deletedTypeIds.has(String(mc.contributionTypeId).trim())) ||
            (mc.contributionTypeName && deletedTypeNames.has(String(mc.contributionTypeName).trim())) ||
            (mc.category &&
              (deletedTypeIds.has(String(mc.category).trim()) ||
                deletedTypeNames.has(String(mc.category).trim())));

          if (mc.status === 'pending' && isMcTypeDeleted) {
            recordsChanged = true;
            return {
              ...mc,
              status: 'unpaid',
              isNegative: true,
              amountSign: '-',
            };
          }
          return mc;
        });
      }

      if (campChanged) {
        campDb.campaigns = recalculateCampaignTotals(
          campDb.campaigns || [],
          campDb.contributions || []
        );
        campDb.lastUpdated = new Date().toISOString();
        writeJsonFileAtomicSync(campPath, campDb, `campaign_${tenantId}`);
        syncTenantCollectionToFirebaseServer(
          'campaign_contributions',
          tenantId,
          campDb.contributions
        ).catch(() => {});
        syncTenantCollectionToFirebaseServer('campaigns', tenantId, campDb.campaigns).catch(
          () => {}
        );
      }

      if (recordsChanged && recordsDb) {
        writeTenantRecordsToDisk(recordsDb, tenantId, true);
      }
    }
  } catch (err) {
    console.warn('[CampaignsDB] Error reconciling deleted contribution types:', err);
  }
}

function saveGlobalContributionTypesToDisk(types: ContributionTypeConfig[]): void {
  try {
    ensureStorageDirectories();
    // Preserve any existing soft-deleted types so linked pending contributions know their type was deleted
    let existingOnDisk: ContributionTypeConfig[] = [];
    if (fs.existsSync(GLOBAL_TYPES_FILE)) {
      const parsed = readJsonFileSync<any[]>(GLOBAL_TYPES_FILE, () => []);
      if (Array.isArray(parsed)) {
        existingOnDisk = parsed
          .filter((t) => !isExcludedContributionType(t))
          .map((t, i) => normalizeContributionType(t, i));
      }
    }

    const normalizedIncoming = types
      .filter((t) => !isExcludedContributionType(t))
      .map((t, i) => normalizeContributionType(t, i));

    const incomingIds = new Set(normalizedIncoming.map((t) => t.id));
    // Any type that existed previously on disk and is now omitted from `types` was deleted—mark it isDeleted: true!
    for (const prev of existingOnDisk) {
      if (!incomingIds.has(prev.id)) {
        normalizedIncoming.push({
          ...prev,
          isDeleted: true,
          enabled: false,
          deletedAt: prev.deletedAt || new Date().toISOString(),
        });
      }
    }

    writeJsonFileAtomicSync(GLOBAL_TYPES_FILE, normalizedIncoming, 'contrib_types');

    // Propagate to all existing tenant campaign files on disk
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR).filter(
        (f) => f.startsWith('campaigns_database') && f.endsWith('.json')
      );
      for (const file of files) {
        const fullPath = path.join(DATA_DIR, file);
        try {
          const parsed = readJsonFileSync<any>(fullPath, null);
          if (parsed && typeof parsed === 'object') {
            parsed.contributionTypes = normalizedIncoming;
            parsed.lastUpdated = new Date().toISOString();
            writeJsonFileAtomicSync(fullPath, parsed, 'campaign');
          }
        } catch {}
      }
    }

    // Reconcile all pending operations linked to deleted contribution types across all tenants
    reconcileDeletedContributionTypesAcrossAllTenants(normalizedIncoming);
  } catch (err) {
    console.error('[CampaignsDB] Error saving global contribution types:', err);
  }
}

function getGlobalPresetsFromDisk(): number[] {
  try {
    ensureStorageDirectories();
    if (fs.existsSync(GLOBAL_PRESETS_FILE)) {
      const parsed = readJsonFileSync<any[]>(GLOBAL_PRESETS_FILE, () => []);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(Number).filter((n) => !isNaN(n) && n > 0);
      }
    }
  } catch {}
  return [...DEFAULT_DONATION_PRESETS];
}

function saveGlobalPresetsToDisk(presets: number[]): void {
  try {
    ensureStorageDirectories();
    const clean = presets.map(Number).filter((n) => !isNaN(n) && n > 0);
    writeJsonFileAtomicSync(GLOBAL_PRESETS_FILE, clean, 'presets');
  } catch (err) {
    console.error('[CampaignsDB] Error saving global presets:', err);
  }
}

function recalculateCampaignTotals(
  campaigns: DonationCampaign[],
  contributions: CampaignContribution[]
): DonationCampaign[] {
  return (campaigns || []).map((camp) => {
    const campContribs = (contributions || []).filter(
      (c) =>
        c.campaignId === camp.id &&
        c.isFinancial !== false &&
        c.status !== 'pending' &&
        c.status !== 'unpaid' &&
        c.status !== 'rejected' &&
        !c.isNegative &&
        c.amountSign !== '-'
    );
    const collected = campContribs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const target = Number(camp.targetAmount) || 0;
    const progress = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
    return {
      ...camp,
      collectedAmount: collected,
      progressPercentage: progress,
    };
  });
}

let hasRunInitialDeletedTypesReconciliation = false;

export function loadCampaignsDatabase(tenantId?: string | null): CampaignsDatabase {
  ensureStorageDirectories();
  if (!hasRunInitialDeletedTypesReconciliation) {
    hasRunInitialDeletedTypesReconciliation = true;
    reconcileDeletedContributionTypesAcrossAllTenants();
  }
  const cleanTenant = normalizeTenantId(tenantId);
  const dbFile = getTenantCampaignsFile(cleanTenant);

  if (fs.existsSync(dbFile)) {
    const parsed = readJsonFileSync<any>(dbFile, null);
    if (parsed && typeof parsed === 'object') {
      const globalTypes = getMasterContributionTypes();
      return {
        campaigns: Array.isArray(parsed.campaigns)
          ? parsed.campaigns
          : cleanTenant === 'tenant_nour'
          ? [...initialCampaigns]
          : [],
        contributions: Array.isArray(parsed.contributions)
          ? parsed.contributions
          : cleanTenant === 'tenant_nour'
          ? [...initialCampaignContributions]
          : [],
        contributionTypes:
          globalTypes.length > 0
            ? globalTypes
            : Array.isArray(parsed.contributionTypes) && parsed.contributionTypes.length > 0
            ? parsed.contributionTypes.map((t: any, i: number) => normalizeContributionType(t, i))
            : initialContributionTypes.map((t, i) => normalizeContributionType(t, i)),
        presets: Array.isArray(parsed.presets) ? parsed.presets : getGlobalPresetsFromDisk(),
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      };
    }
  }

  const clonedTypes = getMasterContributionTypes();
  const defaultDb: CampaignsDatabase = {
    campaigns: cleanTenant === 'tenant_nour' ? [...initialCampaigns] : [],
    contributions: cleanTenant === 'tenant_nour' ? [...initialCampaignContributions] : [],
    contributionTypes: clonedTypes,
    presets: getGlobalPresetsFromDisk(),
    lastUpdated: new Date().toISOString(),
  };

  saveCampaignsDatabase(defaultDb, cleanTenant);
  return defaultDb;
}

export function saveCampaignsDatabase(db: CampaignsDatabase, tenantId?: string | null): void {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const dbFile = getTenantCampaignsFile(cleanTenant);
  const sanitized = offloadEmbeddedMediaDeep(
    {
      ...db,
      lastUpdated: db.lastUpdated || new Date().toISOString(),
    },
    `campaign_${cleanTenant}`
  );
  writeJsonFileAtomicSync(dbFile, sanitized, `campaign_${cleanTenant}`);
  // Sync campaigns and campaign contributions to Firebase Firestore for real-time transparency
  syncTenantCollectionToFirebaseServer('campaign_contributions', cleanTenant, sanitized.contributions).catch(() => {});
  syncTenantCollectionToFirebaseServer('campaigns', cleanTenant, sanitized.campaigns).catch(() => {});
}

export function initializeTenantCampaigns(tenantId: string): CampaignsDatabase {
  const cleanTenant = normalizeTenantId(tenantId);
  return loadCampaignsDatabase(cleanTenant);
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
  res.end(JSON.stringify(data));
}

export async function handleCampaignsApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  if (
    !url.startsWith('/api/campaigns') &&
    !url.startsWith('/api/contribution-types') &&
    !url.startsWith('/api/donation-presets')
  ) {
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
  const cleanPath = parsedUrl.pathname;
  const method = req.method?.toUpperCase() || 'GET';

  const db = loadCampaignsDatabase(tenantId);

  // ================= 0. GLOBAL CONTRIBUTION TYPES & PRESETS =================
  if (
    cleanPath === '/api/contribution-types' ||
    cleanPath === '/api/campaigns/contribution-types' ||
    cleanPath === '/api/campaigns/types'
  ) {
    if (method === 'GET') {
      const includeAll = parsedUrl.searchParams.get('includeAll') === 'true';
      const allTypes = getMasterContributionTypes();
      const filtered = includeAll ? allTypes : allTypes.filter((t) => !t.isDeleted);
      sendJson(res, 200, {
        success: true,
        tenantId,
        types: filtered,
        contributionTypes: filtered,
        lastUpdated: db.lastUpdated,
      });
      return true;
    }

    if (method === 'POST' || method === 'PUT') {
      try {
        const body = await readLargeJsonBody(req);
        const targetTenant = normalizeTenantId(body?.tenantId || tenantId);
        const targetDb = loadCampaignsDatabase(targetTenant);

        // Bulk array update
        const incomingArray = body?.types || body?.contributionTypes || (Array.isArray(body) ? body : null);
        if (Array.isArray(incomingArray)) {
          const sanitizedTypes = incomingArray.map((t: any, idx: number) => normalizeContributionType(t, idx));
          saveGlobalContributionTypesToDisk(sanitizedTypes);
          targetDb.contributionTypes = sanitizedTypes;
          targetDb.lastUpdated = new Date().toISOString();
          saveCampaignsDatabase(targetDb, targetTenant);

          sendJson(res, 200, {
            success: true,
            tenantId: targetTenant,
            types: sanitizedTypes,
            contributionTypes: sanitizedTypes,
            lastUpdated: targetDb.lastUpdated,
            message: 'تم حفظ وتعميم أنواع المساهمة بنجاح على جميع منصات الجمعيات',
          });
          return true;
        }

        // Single contribution type create/update
        if (body && (body.nameAr || body.name || body.id)) {
          const currentTypes = getMasterContributionTypes();
          const newType = normalizeContributionType(body, currentTypes.length);
          const existingIdx = currentTypes.findIndex((t) => t.id === newType.id);
          if (existingIdx >= 0) {
            currentTypes[existingIdx] = newType;
          } else {
            currentTypes.push(newType);
          }
          saveGlobalContributionTypesToDisk(currentTypes);
          targetDb.contributionTypes = currentTypes;
          targetDb.lastUpdated = new Date().toISOString();
          saveCampaignsDatabase(targetDb, targetTenant);

          sendJson(res, 200, {
            success: true,
            type: newType,
            types: currentTypes,
            contributionTypes: currentTypes,
          });
          return true;
        }

        sendJson(res, 400, { success: false, error: 'بيانات أنواع المساهمة غير صالحة.' });
        return true;
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err?.message || 'فشل حفظ أنواع المساهمة.' });
        return true;
      }
    }
  }

  // Toggle contribution type: PATCH /api/campaigns/types/:typeId/toggle
  const typeToggleMatch = cleanPath.match(/^\/api\/(?:campaigns\/types|contribution-types)\/([^/]+)\/toggle$/);
  if (typeToggleMatch && (method === 'PATCH' || method === 'POST' || method === 'PUT')) {
    const typeId = decodeURIComponent(typeToggleMatch[1]).trim();
    const currentTypes = getMasterContributionTypes();
    const idx = currentTypes.findIndex((t) => t.id === typeId);
    if (idx === -1) {
      sendJson(res, 404, { success: false, error: 'نوع المساهمة غير موجود.' });
      return true;
    }
    currentTypes[idx] = {
      ...currentTypes[idx],
      enabled: !currentTypes[idx].enabled,
    };
    saveGlobalContributionTypesToDisk(currentTypes);
    db.contributionTypes = currentTypes;
    db.lastUpdated = new Date().toISOString();
    saveCampaignsDatabase(db, tenantId);

    sendJson(res, 200, {
      success: true,
      type: currentTypes[idx],
      types: currentTypes,
    });
    return true;
  }

  // Delete contribution type: DELETE /api/campaigns/types/:typeId
  const typeDeleteMatch = cleanPath.match(/^\/api\/(?:campaigns\/types|contribution-types)\/([^/]+)$/);
  if (typeDeleteMatch && method === 'DELETE') {
    const typeId = decodeURIComponent(typeDeleteMatch[1]).trim();
    const currentTypes = getMasterContributionTypes();
    // Always mark as soft-deleted (`isDeleted: true`) so any linked pending contributions across all tenants transition to 'unpaid' with '-' sign
    const updatedTypes: ContributionTypeConfig[] = currentTypes.map((t) =>
      t.id === typeId ? { ...t, isDeleted: true, enabled: false, deletedAt: new Date().toISOString() } : t
    );
    saveGlobalContributionTypesToDisk(updatedTypes);
    const refreshedDb = loadCampaignsDatabase(tenantId);

    sendJson(res, 200, {
      success: true,
      isSoftDeleted: true,
      types: updatedTypes,
      activeTypes: updatedTypes.filter((t) => !t.isDeleted),
      contributions: refreshedDb.contributions,
      campaigns: refreshedDb.campaigns,
      message: 'تم حذف نوع المساهمة وتحديث العمليات المرتبطة به إلى «لم يتم الدفع» بنجاح.',
    });
    return true;
  }

  // Presets: GET / POST /api/campaigns/presets OR /api/donation-presets
  if (cleanPath === '/api/campaigns/presets' || cleanPath === '/api/donation-presets') {
    if (method === 'GET') {
      sendJson(res, 200, {
        success: true,
        presets: getGlobalPresetsFromDisk(),
      });
      return true;
    }
    if (method === 'POST' || method === 'PUT') {
      try {
        const body = await readLargeJsonBody(req);
        const incoming = Array.isArray(body?.presets) ? body.presets : Array.isArray(body) ? body : [];
        const clean = incoming
          .map((item: any) => (typeof item === 'number' ? item : Number(item?.amount)))
          .filter((n: number) => !isNaN(n) && n > 0);
        saveGlobalPresetsToDisk(clean);
        sendJson(res, 200, {
          success: true,
          presets: clean,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err?.message || 'فشل حفظ المبالغ المقترحة.' });
        return true;
      }
    }
  }

  // ================= 1. GET / POST /api/campaigns =================
  if (cleanPath === '/api/campaigns' || cleanPath === '/api/campaigns/') {
    if (method === 'GET') {
      sendJson(res, 200, {
        success: true,
        tenantId,
        campaigns: db.campaigns,
        contributions: db.contributions,
        contributionTypes: db.contributionTypes,
        lastUpdated: db.lastUpdated,
      });
      return true;
    }

    if (method === 'POST') {
      try {
        const body = await readLargeJsonBody(req);
        const rawCamp = body?.campaign || body || {};
        const targetTenant = normalizeTenantId(rawCamp.tenantId || rawCamp.associationId || headerTenant || queryTenant || tenantId);
        const targetDb = loadCampaignsDatabase(targetTenant);
        const newCamp: DonationCampaign = {
          id: rawCamp.id || `camp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: String(rawCamp.title || '').trim(),
          description: String(rawCamp.description || '').trim(),
          targetProject: String(rawCamp.targetProject || '').trim(),
          targetAmount: Number(rawCamp.targetAmount) || 0,
          collectedAmount: Number(rawCamp.collectedAmount) || 0,
          progressPercentage: Number(rawCamp.progressPercentage) || 0,
          coverImage:
            rawCamp.coverImage ||
            'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
          videoUrl:
            rawCamp.videoUrl && typeof rawCamp.videoUrl === 'string' && rawCamp.videoUrl.trim()
              ? rawCamp.videoUrl.trim()
              : undefined,
          startDate: rawCamp.startDate || new Date().toISOString().slice(0, 10),
          endDate: rawCamp.endDate || '',
          status: (rawCamp.status || 'active') as CampaignStatus,
          allowOverfunding: rawCamp.allowOverfunding ?? true,
          isVisibleOnStore: rawCamp.isVisibleOnStore !== false,
          createdAt: rawCamp.createdAt || new Date().toISOString(),
          tenantId: targetTenant,
          associationId: targetTenant,
        };

        targetDb.campaigns = [newCamp, ...targetDb.campaigns.filter((c) => c.id !== newCamp.id)];
        targetDb.lastUpdated = new Date().toISOString();
        saveCampaignsDatabase(targetDb, targetTenant);
        await syncTenantCollectionToFirebaseServer('campaigns', targetTenant, targetDb.campaigns);

        const savedCamp = targetDb.campaigns.find((c) => c.id === newCamp.id) || newCamp;
        sendJson(res, 201, {
          success: true,
          campaign: savedCamp,
          campaigns: targetDb.campaigns,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err?.message || 'فشل إنشاء حملة التبرع.' });
        return true;
      }
    }
  }

  // ================= 2. POST /api/campaigns/sync =================
  if ((method === 'POST' || method === 'PUT') && cleanPath === '/api/campaigns/sync') {
    try {
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body?.tenantId || tenantId);
      const targetDb = loadCampaignsDatabase(targetTenant);

      if (Array.isArray(body?.campaigns)) {
        targetDb.campaigns = body.campaigns;
      }
      if (Array.isArray(body?.contributions)) {
        targetDb.contributions = body.contributions;
      }
      if (Array.isArray(body?.contributionTypes)) {
        const sanitizedTypes = body.contributionTypes.map((t: any, i: number) => normalizeContributionType(t, i));
        targetDb.contributionTypes = sanitizedTypes;
        saveGlobalContributionTypesToDisk(sanitizedTypes);
      }
      targetDb.lastUpdated = new Date().toISOString();
      saveCampaignsDatabase(targetDb, targetTenant);

      sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        campaigns: targetDb.campaigns,
        contributions: targetDb.contributions,
        contributionTypes: targetDb.contributionTypes,
        lastUpdated: targetDb.lastUpdated,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'فشل مزامنة بيانات الحملات' });
      return true;
    }
  }

  // ================= 3. CONTRIBUTIONS (/api/campaigns/contributions*) =================
  if (cleanPath === '/api/campaigns/contributions') {
    if (method === 'GET') {
      const qCampId = parsedUrl.searchParams.get('campaignId');
      const qTypeId = parsedUrl.searchParams.get('typeId');
      const qSearch = (parsedUrl.searchParams.get('search') || '').toLowerCase().trim();

      let list = [...db.contributions];
      if (qCampId && qCampId !== 'all') {
        list = list.filter((c) => c.campaignId === qCampId);
      }
      if (qTypeId && qTypeId !== 'all') {
        list = list.filter((c) => c.contributionTypeId === qTypeId);
      }
      if (qSearch) {
        list = list.filter(
          (c) =>
            (c.donorName || '').toLowerCase().includes(qSearch) ||
            (c.campaignTitle || '').toLowerCase().includes(qSearch) ||
            (c.contributionTypeName || '').toLowerCase().includes(qSearch)
        );
      }

      const totalAmount = list
        .filter((c) => c.isFinancial !== false)
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

      sendJson(res, 200, {
        success: true,
        contributions: list,
        totalContributionsCount: list.length,
        totalAmountCollected: totalAmount,
      });
      return true;
    }

    if (method === 'POST') {
      try {
        const body = await readLargeJsonBody(req);
        const targetTenant = normalizeTenantId(body?.tenantId || body?.associationId || tenantId);
        const targetDb = loadCampaignsDatabase(targetTenant);

        let campaign = targetDb.campaigns.find((c) => c.id === body?.campaignId);
        if (!campaign) {
          const nourDb = loadCampaignsDatabase('tenant_nour');
          campaign = nourDb.campaigns.find((c) => c.id === body?.campaignId);
        }

        const masterTypes = getMasterContributionTypes();
        const matchedType =
          masterTypes.find((t) => t.id === body?.contributionTypeId) ||
          targetDb.contributionTypes.find((t) => t.id === body?.contributionTypeId) || {
            id: body?.contributionTypeId || 'type-charity-donation',
            nameAr: body?.contributionTypeName || 'تبرع ومساعدة خيرية',
            isFinancial: true,
          };

        const now = new Date();
        const cleanProofUrl =
          typeof body?.proofImageUrl === 'string' && body.proofImageUrl.trim()
            ? body.proofImageUrl.trim()
            : typeof body?.receiptUrl === 'string' && body.receiptUrl.trim()
            ? body.receiptUrl.trim()
            : undefined;

        const newContribution: CampaignContribution = {
          id: body?.id || `cc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          campaignId: String(body?.campaignId || campaign?.id || ''),
          campaignTitle: campaign?.title || body?.campaignTitle || 'حملة تبرع',
          donorName: body?.isAnonymous ? 'فاعل خير' : String(body?.donorName || 'فاعل خير').trim(),
          donorPhone: body?.donorPhone ? String(body.donorPhone).trim() : '',
          isAnonymous: Boolean(body?.isAnonymous),
          contributionTypeId: matchedType.id,
          contributionTypeName: matchedType.nameAr,
          isFinancial: matchedType.isFinancial,
          amount: matchedType.isFinancial ? Number(body?.amount) || 0 : 0,
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 8),
          createdAt: now.toISOString(),
          status: (body?.status || 'pending') as any,
          paymentMethod: body?.paymentMethod || 'bank_transfer',
          notes: body?.notes ? String(body.notes).trim() : '',
          proofImageUrl: cleanProofUrl,
          receiptUrl: cleanProofUrl,
          tenantId: targetTenant,
          associationId: targetTenant,
        };

        targetDb.contributions = [
          newContribution,
          ...targetDb.contributions.filter((c) => c.id !== newContribution.id),
        ];
        targetDb.campaigns = recalculateCampaignTotals(targetDb.campaigns, targetDb.contributions);
        targetDb.lastUpdated = now.toISOString();
        saveCampaignsDatabase(targetDb, targetTenant);

        // Immediately persist the linked MemberContribution and FinancialOperation in tenant_records_database & Firestore
        if (newContribution.isFinancial !== false && Number(newContribution.amount) > 0) {
          try {
            const recordsDb = readTenantRecordsFromDisk(targetTenant);
            const newOpId = `op-camp-${newContribution.id}`;
            const memberContribId = `contrib-don-${newContribution.id}`;

            const contribExists = recordsDb.contributions.some(
              (c: any) => c && (c.id === memberContribId || c.financialOperationId === newOpId)
            );
            if (!contribExists) {
              const newMemberContribution = {
                id: memberContribId,
                memberId: newContribution.isAnonymous ? 'anonymous-donor' : `donor-${Date.now().toString(36)}`,
                memberCode: newContribution.isAnonymous ? 'فاعل خير' : 'متبرع',
                memberName: newContribution.donorName || 'فاعل خير',
                amount: Number(newContribution.amount),
                date: newContribution.date,
                time: newContribution.time,
                createdAt: newContribution.createdAt,
                status: newContribution.status || 'pending',
                category: 'donation',
                contributionTypeId: newContribution.contributionTypeId,
                contributionTypeName: newContribution.contributionTypeName,
                paymentMethod: newContribution.paymentMethod || 'bank_transfer',
                notes: `تبرع لحملة: ${newContribution.campaignTitle}${newContribution.notes ? ` - ${newContribution.notes}` : ''}`,
                financialOperationId: newOpId,
                tenantId: targetTenant,
                associationId: targetTenant,
                campaignId: newContribution.campaignId,
                campaignTitle: newContribution.campaignTitle,
                donorPhone: newContribution.donorPhone,
                isAnonymous: newContribution.isAnonymous,
                proofImageUrl: cleanProofUrl,
                receiptUrl: cleanProofUrl,
              };
              recordsDb.contributions = [newMemberContribution, ...recordsDb.contributions];
            }

            const opExists = recordsDb.operations.some((op: any) => op && op.id === newOpId);
            if (!opExists) {
              const newOperation = {
                id: newOpId,
                code: `OP-${now.getFullYear()}-${String(recordsDb.operations.length + 1).padStart(3, '0')}`,
                type: 'income',
                category: 'donation',
                title: `تبرع لحملة: ${newContribution.campaignTitle} (${newContribution.donorName})`,
                description: `مساهمة (${newContribution.contributionTypeName || 'تبرع مالي'}) - طريقة الدفع: ${newContribution.paymentMethod || 'نقداً'}`,
                amount: Number(newContribution.amount),
                date: newContribution.date,
                paymentMethod: newContribution.paymentMethod || 'bank_transfer',
                memberName: newContribution.donorName || 'فاعل خير',
                proofUrls: cleanProofUrl ? [cleanProofUrl] : undefined,
                addedBy: newContribution.donorName || 'فاعل خير',
                createdAt: newContribution.createdAt,
                tenantId: targetTenant,
                associationId: targetTenant,
              };
              recordsDb.operations = [newOperation, ...recordsDb.operations];
            }

            writeTenantRecordsToDisk(recordsDb, targetTenant, true);
          } catch (syncErr) {
            console.warn('[CampaignsDB] Error syncing new contribution to tenant records:', syncErr);
          }
        }

        const updatedCamp = targetDb.campaigns.find((c) => c.id === newContribution.campaignId) || campaign;

        sendJson(res, 201, {
          success: true,
          message: 'تم تسجيل وتوثيق تبرعكم بنجاح! جزاكم الله خيراً.',
          contribution: newContribution,
          campaign: updatedCamp,
          tenantId: targetTenant,
          associationId: targetTenant,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err?.message || 'فشل تسجيل المساهمة.' });
        return true;
      }
    }
  }

  const contribIdMatch = cleanPath.match(/^\/api\/campaigns\/contributions\/([^/]+)$/);
  if (contribIdMatch && method === 'DELETE') {
    const contribId = decodeURIComponent(contribIdMatch[1]).trim();
    // Preserve all original contribution data and transition status from 'pending' to 'unpaid' with '-' sign
    db.contributions = db.contributions.map((c) =>
      c.id === contribId
        ? {
            ...c,
            status: 'unpaid',
            isNegative: true,
            amountSign: '-',
          }
        : c
    );
    db.campaigns = recalculateCampaignTotals(db.campaigns, db.contributions);
    db.lastUpdated = new Date().toISOString();
    saveCampaignsDatabase(db, tenantId);

    // Also update linked record in tenant_records_database so both stay in sync
    try {
      const recordsPath = getTenantRecordsFileForCampaigns(tenantId);
      if (fs.existsSync(recordsPath)) {
        const recordsDb = readJsonFileSync<any>(recordsPath, null);
        if (recordsDb && Array.isArray(recordsDb.contributions)) {
          recordsDb.contributions = recordsDb.contributions.map((mc: any) =>
            mc.id === `contrib-don-${contribId}` || mc.id === contribId
              ? { ...mc, status: 'unpaid', isNegative: true, amountSign: '-' }
              : mc
          );
          recordsDb.lastUpdated = new Date().toISOString();
          writeJsonFileAtomicSync(recordsPath, recordsDb, `records_${tenantId}`);
          syncTenantCollectionToFirebaseServer('contributions', tenantId, recordsDb.contributions).catch(() => {});
        }
      }
    } catch {}

    sendJson(res, 200, {
      success: true,
      contributions: db.contributions,
      campaigns: db.campaigns,
    });
    return true;
  }

  // ================= 4. CAMPAIGN VISIBILITY & STATUS & CRUD =================
  const visMatch = cleanPath.match(/^\/api\/campaigns\/([^/]+)\/visibility$/);
  if (visMatch && (method === 'PATCH' || method === 'PUT' || method === 'POST')) {
    const campaignId = decodeURIComponent(visMatch[1]).trim();
    const body = await readLargeJsonBody(req).catch(() => ({}));
    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) {
      sendJson(res, 404, { success: false, error: 'الحملة غير موجودة.' });
      return true;
    }
    const current = db.campaigns[idx];
    const nextVis =
      typeof body?.isVisibleOnStore === 'boolean'
        ? body.isVisibleOnStore
        : !(current.isVisibleOnStore !== false);
    db.campaigns[idx] = {
      ...current,
      isVisibleOnStore: nextVis,
      updatedAt: new Date().toISOString(),
    };
    db.lastUpdated = new Date().toISOString();
    saveCampaignsDatabase(db, tenantId);
    sendJson(res, 200, {
      success: true,
      campaign: db.campaigns[idx],
      campaigns: db.campaigns,
      message: nextVis ? 'تم تفعيل ظهور الحملة على المتجر.' : 'تم إخفاء الحملة من المتجر.',
    });
    return true;
  }

  const statusMatch = cleanPath.match(/^\/api\/campaigns\/([^/]+)\/status$/);
  if (statusMatch && (method === 'PATCH' || method === 'PUT' || method === 'POST')) {
    const campaignId = decodeURIComponent(statusMatch[1]).trim();
    const body = await readLargeJsonBody(req).catch(() => ({}));
    const idx = db.campaigns.findIndex((c) => c.id === campaignId);
    if (idx === -1) {
      sendJson(res, 404, { success: false, error: 'الحملة غير موجودة.' });
      return true;
    }
    const current = db.campaigns[idx];
    const nextStatus: CampaignStatus =
      body?.status === 'active' || body?.status === 'paused' || body?.status === 'completed'
        ? body.status
        : current.status === 'active'
        ? 'paused'
        : 'active';
    db.campaigns[idx] = {
      ...current,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    db.lastUpdated = new Date().toISOString();
    saveCampaignsDatabase(db, tenantId);
    sendJson(res, 200, {
      success: true,
      campaign: db.campaigns[idx],
      campaigns: db.campaigns,
    });
    return true;
  }

  const campItemMatch = cleanPath.match(/^\/api\/campaigns\/([^/]+)$/);
  if (
    campItemMatch &&
    !['sync', 'contributions', 'contribution-types', 'types', 'presets'].includes(campItemMatch[1])
  ) {
    const campaignId = decodeURIComponent(campItemMatch[1]).trim();

    if (method === 'PUT' || method === 'PATCH') {
      try {
        const body = await readLargeJsonBody(req);
        const incoming = body?.campaign || body || {};
        const targetTenant = normalizeTenantId(incoming.tenantId || incoming.associationId || headerTenant || queryTenant || tenantId);
        const targetDb = loadCampaignsDatabase(targetTenant);

        let idx = targetDb.campaigns.findIndex((c) => c.id === campaignId);
        if (idx === -1 && targetTenant !== 'tenant_nour') {
          const nourDb = loadCampaignsDatabase('tenant_nour');
          const nourCamp = nourDb.campaigns.find((c) => c.id === campaignId);
          if (nourCamp) {
            targetDb.campaigns.push({ ...nourCamp, tenantId: targetTenant, associationId: targetTenant });
            idx = targetDb.campaigns.length - 1;
          }
        }

        if (idx === -1) {
          sendJson(res, 404, { success: false, error: 'الحملة غير موجودة.' });
          return true;
        }

        const currentCamp = targetDb.campaigns[idx];
        let resolvedVideoUrl = currentCamp.videoUrl;
        if (incoming.videoUrl !== undefined) {
          resolvedVideoUrl =
            incoming.videoUrl && typeof incoming.videoUrl === 'string' && incoming.videoUrl.trim()
              ? incoming.videoUrl.trim()
              : undefined;
        }

        const resolvedCoverImage =
          incoming.coverImage && typeof incoming.coverImage === 'string' && incoming.coverImage.trim()
            ? incoming.coverImage.trim()
            : currentCamp.coverImage;

        targetDb.campaigns[idx] = {
          ...currentCamp,
          ...incoming,
          coverImage: resolvedCoverImage,
          videoUrl: resolvedVideoUrl,
          collectedAmount: incoming.collectedAmount !== undefined ? Number(incoming.collectedAmount) : currentCamp.collectedAmount,
          progressPercentage: incoming.progressPercentage !== undefined ? Number(incoming.progressPercentage) : currentCamp.progressPercentage,
          targetAmount: incoming.targetAmount !== undefined ? Number(incoming.targetAmount) : currentCamp.targetAmount,
          id: campaignId,
          tenantId: targetTenant,
          associationId: targetTenant,
          updatedAt: new Date().toISOString(),
        };
        targetDb.lastUpdated = new Date().toISOString();
        saveCampaignsDatabase(targetDb, targetTenant);
        await syncTenantCollectionToFirebaseServer('campaigns', targetTenant, targetDb.campaigns);

        const savedCamp = targetDb.campaigns.find((c) => c.id === campaignId) || targetDb.campaigns[idx];
        sendJson(res, 200, {
          success: true,
          campaign: savedCamp,
          campaigns: targetDb.campaigns,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err?.message || 'فشل تحديث الحملة.' });
        return true;
      }
    }

    if (method === 'DELETE') {
      const targetTenant = normalizeTenantId(headerTenant || queryTenant || tenantId);
      const targetDb = loadCampaignsDatabase(targetTenant);
      targetDb.campaigns = targetDb.campaigns.filter((c) => c.id !== campaignId);
      targetDb.contributions = targetDb.contributions.filter((c) => c.campaignId !== campaignId);
      targetDb.lastUpdated = new Date().toISOString();
      saveCampaignsDatabase(targetDb, targetTenant);
      await syncTenantCollectionToFirebaseServer('campaigns', targetTenant, targetDb.campaigns, [campaignId]);
      sendJson(res, 200, {
        success: true,
        campaigns: targetDb.campaigns,
        message: 'تم حذف الحملة بنجاح.',
      });
      return true;
    }
  }

  sendJson(res, 404, { success: false, error: 'مسار الحملات غير موجود.' });
  return true;
}
