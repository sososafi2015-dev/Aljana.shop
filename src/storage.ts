import { Member, FinancialOperation, ActivityItem, AuditLog, AssociationSettings, MemberRegistrationField, UIElementConfig, Poll, PollVote, MemberCardSettings, MemberContribution, BoardMember, SubAdmin, CurrentAdminSession, DonationCampaign, CampaignContribution, ContributionTypeConfig, DEFAULT_DONATION_PRESETS } from './types';
import { initialMembers, initialOperations, initialActivities, initialAuditLogs, initialSettings, initialRegistrationFields, initialUIElements, initialPolls, initialMemberCardSettings, initialContributions, initialBoardMembers, initialSubAdmins, defaultStoreThemeColors, initialCampaigns, initialCampaignContributions, initialContributionTypes } from './initialData';
import { applyStoreTheme } from './utils/themeEngine';
import { 
  cloneReferenceActivitiesForNewTenant, 
  publishNewReferenceVersion, 
  getMasterReferenceActivities 
} from './utils/referenceContentVersioning';
import {
  getGlobalContributionTypes,
  saveGlobalContributionTypes,
  getGlobalActivePresetAmounts,
  saveGlobalDonationPresets
} from './contributionTypesStorage';
import { firestoreSyncService } from './services/firestoreSyncService';

export const KEYS = {
  MEMBERS: 'chayef_assoc_members_v1',
  BOARD_MEMBERS: 'chayef_assoc_board_members_v1',
  CONTRIBUTIONS: 'chayef_assoc_contributions_v1',
  OPERATIONS: 'chayef_assoc_operations_v1',
  ACTIVITIES: 'chayef_assoc_activities_v1',
  AUDIT_LOGS: 'chayef_assoc_audit_logs_v1',
  SETTINGS: 'chayef_assoc_settings_v1',
  FIELDS: 'chayef_assoc_registration_fields_v1',
  UI_ELEMENTS: 'chayef_assoc_ui_elements_v1',
  POLLS: 'chayef_assoc_polls_v1',
  MEMBER_CARD_SETTINGS: 'chayef_assoc_member_card_settings_v1',
  ROLE: 'chayef_assoc_role_v1',
  LANG: 'chayef_assoc_lang_v1',
  LOGGED_IN_MEMBER_ID: 'chayef_assoc_logged_in_member_id_v1',
  SUB_ADMINS: 'chayef_assoc_sub_admins_v1',
  CURRENT_ADMIN_SESSION: 'chayef_assoc_current_admin_session_v1',
  CAMPAIGNS: 'chayef_assoc_campaigns_v1',
  CAMPAIGN_CONTRIBUTIONS: 'chayef_assoc_campaign_contributions_v1',
  CONTRIBUTION_TYPES: 'chayef_assoc_contribution_types_v1',
  DONATION_PRESETS: 'chayef_assoc_donation_presets_v1',
};

// In-memory fallback cache when localStorage quota is exceeded or unavailable
const memoryStorageFallback: Record<string, string> = {};

// Helper to sanitize large base64/dataURL strings in object hierarchies when quota is tight
function sanitizeLargePayload<T>(data: T, aggressive = false): T {
  try {
    if (!data) return data;
    const threshold = aggressive ? 10000 : 60000;
    if (Array.isArray(data)) {
      return data.map((item) => sanitizeLargePayload(item, aggressive)) as unknown as T;
    }
    if (typeof data === 'object' && data !== null) {
      const clone: Record<string, any> = { ...data };
      for (const k of Object.keys(clone)) {
        const val = clone[k];
        if (typeof val === 'string' && val.startsWith('data:') && val.length > threshold) {
          clone[k] = '';
        } else if (typeof val === 'object' && val !== null) {
          clone[k] = sanitizeLargePayload(val, aggressive);
        }
      }
      return clone as unknown as T;
    }
    return data;
  } catch {
    return data;
  }
}

// Safe LocalStorage helpers with automatic QuotaExceeded recovery and strict type validation
export const loadData = <T>(key: string, fallback: T): T => {
  const validateParsed = (parsed: any): T => {
    if (parsed === null || parsed === undefined) {
      return fallback;
    }
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      return fallback;
    }
    if (typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback)) {
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        return fallback;
      }
    }
    return parsed as T;
  };

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = localStorage.getItem(key);
      if (item) return validateParsed(JSON.parse(item));
    }

    // Check sessionStorage fallback
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const sItem = sessionStorage.getItem(key);
        if (sItem) return validateParsed(JSON.parse(sItem));
      }
    } catch {}

    // Check memory fallback
    if (memoryStorageFallback[key]) {
      return validateParsed(JSON.parse(memoryStorageFallback[key]));
    }

    return fallback;
  } catch (error) {
    console.error(`Error loading key ${key} from storage:`, error);
    return fallback;
  }
};

export const saveData = <T>(key: string, data: T): void => {
  const json = JSON.stringify(data);
  memoryStorageFallback[key] = json;

  try {
    localStorage.setItem(key, json);
  } catch (error: any) {
    console.warn(`Storage quota or write issue for key "${key}", attempting recovery...`, error);

    // Attempt 1: Sanitize oversized payloads (including nested dataUrls like legalDocument.fileUrl)
    try {
      const sanitized = sanitizeLargePayload(data, false);
      const sanitizedJson = JSON.stringify(sanitized);
      localStorage.setItem(key, sanitizedJson);
      return;
    } catch {}

    // Attempt 2: Clear old temporary or audit log keys if any, and strip large dataUrls from non-critical keys
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes('audit_logs') || k.includes('temp') || k.includes('_cache_'))) {
          if (!k.includes('deleted_activity') && !k.includes('deleted_campaign') && !k.includes('all_tenants') && !k.includes('all_owners')) {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });

      const aggressiveSanitized = sanitizeLargePayload(data, true);
      const aggressiveJson = JSON.stringify(aggressiveSanitized);
      localStorage.setItem(key, aggressiveJson);
      return;
    } catch {}

    // Attempt 3: Fallback to sessionStorage
    try {
      const aggressiveSanitized = sanitizeLargePayload(data, true);
      sessionStorage.setItem(key, JSON.stringify(aggressiveSanitized));
    } catch {}
  }
};

// Multi-Tenant Isolation Helpers
export const getActiveTenantIdFromStorage = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const paramTenant = params.get('tenant');
      if (paramTenant && paramTenant !== 'portal') {
        return paramTenant;
      }
      if (params.get('portal') === 'true' || params.get('view') === 'portal') {
        const raw = localStorage.getItem('chayef_active_tenant_id_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed !== 'portal') return parsed;
        }
        return 'portal';
      }
    } catch {}
  }
  try {
    const raw = localStorage.getItem('chayef_active_tenant_id_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) return parsed;
    }
  } catch {}
  return 'tenant_nour';
};

export const getScopedKey = (baseKey: string, tenantId?: string): string => {
  const current = tenantId || getActiveTenantIdFromStorage();
  if (!current || current === 'tenant_nour' || current === 'portal') {
    return baseKey;
  }
  return `chayef_tenant_${current}_${baseKey}`;
};

// Tombstone / Deleted IDs tracking for absolute deletion persistence across refreshes and syncs
export const getDeletedActivityIds = (tenantId?: string): string[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const key = `chayef_tenant_${current}_deleted_activity_ids`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

export const recordDeletedActivityId = (activityId: string, tenantId?: string): void => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const key = `chayef_tenant_${current}_deleted_activity_ids`;
  const existing = getDeletedActivityIds(current);
  if (!existing.includes(activityId)) {
    existing.push(activityId);
    try {
      localStorage.setItem(key, JSON.stringify(existing));
    } catch {}
  }
};

export const getDeletedCampaignIds = (tenantId?: string): string[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const key = `chayef_tenant_${current}_deleted_campaign_ids`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

export const recordDeletedCampaignId = (campaignId: string, tenantId?: string): void => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const key = `chayef_tenant_${current}_deleted_campaign_ids`;
  const existing = getDeletedCampaignIds(current);
  if (!existing.includes(campaignId)) {
    existing.push(campaignId);
    try {
      localStorage.setItem(key, JSON.stringify(existing));
    } catch {}
  }
};

// Calculate real-time balance from operations list with absolute isolation from platform support funds
export const calculateFinancials = (operations: FinancialOperation[]) => {
  let totalIncomes = 0;
  let totalExpenses = 0;

  // Strict separation: platform support payments belong exclusively to the Platform Support Account
  // and must never be included in any association's ledger, income records, or balance (including Noor Association).
  const associationOps = (operations || []).filter((op) => {
    if (!op) return false;
    if ((op as any).category === 'platform_support' || (op as any).category === 'support') return false;
    if ((op as any).type === 'platform_support' || (op as any).type === 'support') return false;
    if (op.title && (op.title.includes('دعم المنصة') || op.title.includes('دعم وتطوير المنصة'))) return false;
    return true;
  });

  // Sort operations chronologically to compute running balance
  const sorted = [...associationOps].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  const processedOperations = sorted.map((op) => {
    if (op.type === 'income') {
      totalIncomes += Number(op.amount) || 0;
      runningBalance += Number(op.amount) || 0;
    } else {
      totalExpenses += Number(op.amount) || 0;
      runningBalance -= Number(op.amount) || 0;
    }
    return {
      ...op,
      balanceAfter: runningBalance,
    };
  });

  const currentBalance = totalIncomes - totalExpenses;

  // Breakdown by category
  const expenseByCategory: Record<string, number> = {};
  associationOps.forEach((op) => {
    if (op.type === 'expense') {
      const cat = op.category || 'other';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (Number(op.amount) || 0);
    }
  });

  return {
    totalIncomes,
    totalExpenses,
    currentBalance,
    processedOperations,
    expenseByCategory,
  };
};

const COLLECTION_KEY_TO_STORAGE_KEY: Record<string, string> = {
  members: KEYS.MEMBERS,
  boardMembers: KEYS.BOARD_MEMBERS,
  contributions: KEYS.CONTRIBUTIONS,
  operations: KEYS.OPERATIONS,
  registrationFields: KEYS.FIELDS,
  auditLogs: KEYS.AUDIT_LOGS,
  subAdmins: KEYS.SUB_ADMINS,
};

export async function persistTenantCollectionToBackend(
  key: string,
  data: any,
  tenantId?: string
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return true;
  const target = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !target || target === 'portal' ? 'tenant_nour' : target;

  // Mirror to Cloud Firestore
  try {
    if (key === 'members' && Array.isArray(data)) {
      firestoreSyncService.syncMembersToFirestore(cleanTenant, data).catch(() => {});
    } else if (key === 'boardMembers' && Array.isArray(data)) {
      firestoreSyncService.syncBoardMembersToFirestore(cleanTenant, data).catch(() => {});
    } else if (key === 'contributions' && Array.isArray(data)) {
      firestoreSyncService.syncContributionsToFirestore(cleanTenant, data).catch(() => {});
    } else if (key === 'operations' && Array.isArray(data)) {
      firestoreSyncService.syncOperationsToFirestore(cleanTenant, data).catch(() => {});
    } else if (key === 'subAdmins' && Array.isArray(data)) {
      firestoreSyncService.syncSubAdminsToFirestore(cleanTenant, data).catch(() => {});
    } else if (key === 'registrationFields' && Array.isArray(data)) {
      const isMaster = cleanTenant === 'tenant_nour';
      firestoreSyncService.saveRegistrationFieldsToFirestore(cleanTenant, data, isMaster).catch(() => {});
    }
  } catch (syncErr) {
    console.warn('[Storage] Firestore background sync notice:', syncErr);
  }

  try {
    const currentRole = loadData<string>(KEYS.ROLE, 'member');
    let adminSession: any = getStoredCurrentAdminSession(cleanTenant);
    if (!adminSession) {
      const masterSession =
        loadData<any>('chayef_master_admin_session_v2', null) ||
        loadData<any>('chayef_master_admin_session_v1', null);
      if (masterSession) {
        adminSession = {
          type: 'super_admin',
          role: 'main_admin',
          id: masterSession.id || 'master_admin',
          fullName: masterSession.fullName || 'الإدارة العامة للمنصة',
          phone: masterSession.phone || '',
          tenantId: cleanTenant,
          isMasterPlatformAdmin: true,
        };
      }
    }
    const isEffectiveAdmin = Boolean(adminSession) || currentRole === 'admin';
    const loggedInMemberId = getStoredLoggedInMemberId(cleanTenant);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': cleanTenant,
      'x-user-role': isEffectiveAdmin ? 'admin' : (currentRole || 'member'),
    };
    if (adminSession) {
      headers['x-admin-session'] = encodeURIComponent(JSON.stringify(adminSession));
    } else if (isEffectiveAdmin) {
      headers['x-admin-session'] = encodeURIComponent(
        JSON.stringify({
          type: 'super_admin',
          role: 'main_admin',
          id: 'admin_session',
          tenantId: cleanTenant,
        })
      );
    }
    if (loggedInMemberId) {
      headers['x-member-id'] = loggedInMemberId;
    }

    const res = await fetch(`/api/tenant-records?tenantId=${encodeURIComponent(cleanTenant)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenantId: cleanTenant,
        collection: key,
        key,
        data,
        callerRole: isEffectiveAdmin ? 'admin' : (currentRole || 'member'),
        callerMemberId: loggedInMemberId || undefined,
      }),
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    if (json?.success && json.records && Array.isArray(json.records[key])) {
      const storageKey = COLLECTION_KEY_TO_STORAGE_KEY[key];
      if (storageKey) {
        saveData(getScopedKey(storageKey, cleanTenant), json.records[key]);
      }
    }
    return Boolean(json?.success);
  } catch (err) {
    console.warn(`[Storage] Background sync warning for ${key}:`, err);
    return false;
  }
}

const sanitizeMemberRecord = (member: Member): Member => {
  const clone: Record<string, any> = { ...member };
  delete clone.password;
  delete clone.confirmPassword;
  if (clone.customFields && typeof clone.customFields === 'object') {
    const cf = { ...clone.customFields };
    delete cf.password;
    delete cf.confirmPassword;
    clone.customFields = Object.keys(cf).length > 0 ? cf : undefined;
  }
  return clone as Member;
};

export const getStoredMembers = (tenantId?: string): Member[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';
  const rawMembers = loadData<Member[]>(getScopedKey(KEYS.MEMBERS, current), isMaster ? initialMembers : []);
  const initialMap = new Map(initialMembers.map((m) => [m.id, m]));
  return (rawMembers || []).map((m) => {
    if (!m) return m;
    if (!m.username) {
      const initM = initialMap.get(m.id);
      if (initM?.username) {
        return { ...m, username: initM.username };
      }
      return { ...m, username: `member${m.id.replace(/\D/g, '') || '01'}24` };
    }
    return m;
  });
};
export const getMembersTimestamp = (tenantId?: string): number => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const clean = !current || current === 'portal' ? 'tenant_nour' : current;
  try {
    return Number(localStorage.getItem(`chayef_tenant_${clean}_members_ts_v1`)) || 0;
  } catch {
    return 0;
  }
};

export const setMembersTimestamp = (ts: number = Date.now(), tenantId?: string): void => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const clean = !current || current === 'portal' ? 'tenant_nour' : current;
  try {
    localStorage.setItem(`chayef_tenant_${clean}_members_ts_v1`, String(ts));
  } catch {}
};

export const saveMembers = (members: Member[], tenantId?: string, syncBackend: boolean = true): Promise<boolean> => {
  const target = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !target || target === 'portal' ? 'tenant_nour' : target;
  const sanitized = (members || []).map(sanitizeMemberRecord);
  saveData(getScopedKey(KEYS.MEMBERS, cleanTenant), sanitized);
  if (syncBackend) {
    setMembersTimestamp(Date.now(), cleanTenant);
    return persistTenantCollectionToBackend('members', sanitized, cleanTenant);
  }
  return Promise.resolve(true);
};

export const getStoredBoardMembers = (tenantId?: string): BoardMember[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';
  return loadData<BoardMember[]>(getScopedKey(KEYS.BOARD_MEMBERS, current), isMaster ? initialBoardMembers : []);
};
export const saveBoardMembers = (boardMembers: BoardMember[], tenantId?: string, syncBackend: boolean = true): Promise<boolean> => {
  saveData(getScopedKey(KEYS.BOARD_MEMBERS, tenantId), boardMembers);
  if (syncBackend) {
    return persistTenantCollectionToBackend('boardMembers', boardMembers, tenantId);
  }
  return Promise.resolve(true);
};

export const getDeletedOperationIds = (tenantId?: string): string[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const clean = !current || current === 'portal' ? 'tenant_nour' : current;
  return loadData<string[]>(`chayef_tenant_${clean}_deleted_ops_v1`, []);
};

export const recordDeletedOperationId = (id: string, tenantId?: string): void => {
  if (!id) return;
  const current = tenantId || getActiveTenantIdFromStorage();
  const clean = !current || current === 'portal' ? 'tenant_nour' : current;
  const existing = getDeletedOperationIds(clean);
  if (!existing.includes(id)) {
    saveData(`chayef_tenant_${clean}_deleted_ops_v1`, [...existing, id]);
  }
};

export const getDeletedContributionIds = (tenantId?: string): string[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const clean = !current || current === 'portal' ? 'tenant_nour' : current;
  return loadData<string[]>(`chayef_tenant_${clean}_deleted_contribs_v1`, []);
};

export const recordDeletedContributionId = (id: string, tenantId?: string): void => {
  if (!id) return;
  const current = tenantId || getActiveTenantIdFromStorage();
  const clean = !current || current === 'portal' ? 'tenant_nour' : current;
  const existing = getDeletedContributionIds(clean);
  if (!existing.includes(id)) {
    saveData(`chayef_tenant_${clean}_deleted_contribs_v1`, [...existing, id]);
  }
};

export const getStoredContributions = (tenantId?: string): MemberContribution[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';
  const list = loadData<MemberContribution[]>(getScopedKey(KEYS.CONTRIBUTIONS, current), isMaster ? initialContributions : []);
  const targetTenant = current === 'portal' ? 'tenant_nour' : current;
  const deletedContribIds = new Set(getDeletedContributionIds(targetTenant));
  // Strict tenant isolation: contributions tied to an association must NEVER leak to other associations
  return (list || []).filter((c) => {
    if (!c || !c.id) return false;
    if (deletedContribIds.has(c.id)) return false;
    if (c.tenantId && targetTenant && c.tenantId !== targetTenant) return false;
    if (c.associationId && targetTenant && c.associationId !== targetTenant) return false;
    return true;
  });
};
export const saveContributions = (contributions: MemberContribution[], tenantId?: string, syncBackend: boolean = true): Promise<boolean> => {
  const target = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !target || target === 'portal' ? 'tenant_nour' : target;
  const deletedContribIds = new Set(getDeletedContributionIds(cleanTenant));
  const tagged = (contributions || [])
    .filter((c) => c && c.id && !deletedContribIds.has(c.id))
    .map((c) => ({
      ...c,
      tenantId: c.tenantId || cleanTenant,
      associationId: c.associationId || cleanTenant,
    }));
  saveData(getScopedKey(KEYS.CONTRIBUTIONS, cleanTenant), tagged);
  if (syncBackend) {
    return persistTenantCollectionToBackend('contributions', tagged, cleanTenant);
  }
  return Promise.resolve(true);
};

export const getStoredOperations = (tenantId?: string): FinancialOperation[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';
  const loaded = loadData<FinancialOperation[]>(getScopedKey(KEYS.OPERATIONS, current), isMaster ? initialOperations : []);
  const targetTenant = current === 'portal' ? 'tenant_nour' : current;
  const deletedOpIds = new Set(getDeletedOperationIds(targetTenant));
  // Ensure strict isolation: association operations NEVER contain platform support funds, and NEVER leak across associations
  return (loaded || []).filter((op) => {
    if (!op || !op.id) return false;
    if (deletedOpIds.has(op.id)) return false;
    if ((op as any).category === 'platform_support' || (op as any).category === 'support') return false;
    if ((op as any).type === 'platform_support' || (op as any).type === 'support') return false;
    if (op.title && (op.title.includes('دعم المنصة') || op.title.includes('دعم وتطوير المنصة'))) return false;
    if (op.tenantId && targetTenant && op.tenantId !== targetTenant) return false;
    if (op.associationId && targetTenant && op.associationId !== targetTenant) return false;
    return true;
  });
};
export const saveOperations = (operations: FinancialOperation[], tenantId?: string, syncBackend: boolean = true): Promise<boolean> => {
  const target = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !target || target === 'portal' ? 'tenant_nour' : target;
  const deletedOpIds = new Set(getDeletedOperationIds(cleanTenant));
  const sanitized = (operations || [])
    .filter((op) => {
      if (!op || !op.id) return false;
      if (deletedOpIds.has(op.id)) return false;
      if ((op as any).category === 'platform_support' || (op as any).category === 'support') return false;
      if ((op as any).type === 'platform_support' || (op as any).type === 'support') return false;
      if (op.title && (op.title.includes('دعم المنصة') || op.title.includes('دعم وتطوير المنصة'))) return false;
      return true;
    })
    .map((op) => ({
      ...op,
      tenantId: op.tenantId || cleanTenant,
      associationId: op.associationId || cleanTenant,
    }));
  saveData(getScopedKey(KEYS.OPERATIONS, cleanTenant), sanitized);
  if (syncBackend) {
    return persistTenantCollectionToBackend('operations', sanitized, cleanTenant);
  }
  return Promise.resolve(true);
};

export const isUnpaidContributionStatus = (status?: string | null): boolean => {
  return status === 'approved' || status === 'unpaid';
};

/**
 * Reconciles contributions and financial operations bidirectionally so that:
 * 1. Every financial contribution (amount > 0, not rejected) has a linked income operation in `operations` (included in `currentBalance`).
 * 2. Every income operation (resources, financial aid, donations, fees) has a linked contribution in `contributions` («سجل المساهمات والانخراطات»).
 * 3. Any contribution marked as «لم يتم الدفع» (`approved` / `unpaid`) has a single deduction operation (`op-unpaid-deduction-<id>`).
 * 4. Recalculates `balanceAfter`, `totalIncomes`, `totalExpenses`, and `currentBalance` via `calculateFinancials`.
 */
export const reconcileUnpaidContributionDeductions = (
  contributions: MemberContribution[],
  operations: FinancialOperation[],
  tenantId?: string
): {
  reconciledContributions: MemberContribution[];
  reconciledOperations: FinancialOperation[];
  removedOperationIds: string[];
  didChange: boolean;
} => {
  const target = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !target || target === 'portal' ? 'tenant_nour' : target;
  const deletedOpSet = new Set(getDeletedOperationIds(cleanTenant));
  const deletedContribSet = new Set(getDeletedContributionIds(cleanTenant));

  let didChange = false;
  const removedOperationIds: string[] = [];

  // 1. Deduplicate and tag contributions
  const baseContribs: MemberContribution[] = [];
  const seenContribIds = new Set<string>();
  for (const c of contributions || []) {
    if (!c || !c.id) continue;
    if (deletedContribSet.has(c.id)) {
      didChange = true;
      continue;
    }
    if (seenContribIds.has(c.id)) continue;
    seenContribIds.add(c.id);
    if (c.tenantId !== cleanTenant || c.associationId !== cleanTenant) {
      didChange = true;
    }
    baseContribs.push({
      ...c,
      tenantId: c.tenantId || cleanTenant,
      associationId: c.associationId || cleanTenant,
    });
  }

  // 2. Deduplicate and tag operations
  const baseOps: FinancialOperation[] = [];
  const seenOpIds = new Set<string>();
  for (const op of operations || []) {
    if (!op || !op.id) continue;
    if (deletedOpSet.has(op.id)) {
      didChange = true;
      removedOperationIds.push(op.id);
      continue;
    }
    if (seenOpIds.has(op.id)) continue;
    seenOpIds.add(op.id);
    if (op.tenantId !== cleanTenant || op.associationId !== cleanTenant) {
      didChange = true;
    }
    baseOps.push({
      ...op,
      tenantId: op.tenantId || cleanTenant,
      associationId: op.associationId || cleanTenant,
    });
  }

  // 3. Ensure every financial contribution has its corresponding income FinancialOperation in baseOps
  for (let i = 0; i < baseContribs.length; i++) {
    const c = baseContribs[i];
    const amt = Number(c.amount) || 0;
    if (amt <= 0 || c.status === 'rejected') continue;
    if (c.financialOperationId === 'op-inc-1' || c.financialOperationId === 'op-inc-2') continue;

    const expectedOpId =
      c.financialOperationId ||
      (String(c.id).startsWith('contrib-don-')
        ? `op-camp-${String(c.id).replace(/^contrib-don-/, '')}`
        : String(c.id).startsWith('contrib-op-')
        ? String(c.id).replace(/^contrib-op-/, '')
        : `op-contrib-${c.id}`);

    if (deletedOpSet.has(expectedOpId)) continue;

    if (!c.financialOperationId) {
      baseContribs[i] = { ...c, financialOperationId: expectedOpId };
      didChange = true;
    }

    if (!seenOpIds.has(expectedOpId)) {
      seenOpIds.add(expectedOpId);
      didChange = true;
      baseOps.unshift({
        id: expectedOpId,
        code: `OP-${new Date().getFullYear()}-${String(expectedOpId).slice(-4).toUpperCase()}`,
        type: 'income',
        category: c.category === 'membership_fee' ? 'membership_fee' : 'donation',
        title:
          c.category === 'membership_fee'
            ? `واجب انخراط: ${c.memberName || 'منخرط'} (${c.memberCode || ''})`
            : `مساهمة مالية: ${c.campaignTitle || c.contributionTypeName || c.notes || c.memberName || 'تبرع'}`,
        description: c.notes || `مساهمة (${c.contributionTypeName || 'مساهمة مالية'}) - ${c.memberName || 'فاعل خير'}`,
        amount: amt,
        date: c.date || new Date().toISOString().slice(0, 10),
        paymentMethod: c.paymentMethod || 'bank_transfer',
        memberId: c.memberId,
        memberName: c.memberName,
        addedBy: c.memberName || 'إدارة الجمعية',
        createdAt: c.createdAt || new Date().toISOString(),
        tenantId: cleanTenant,
        associationId: cleanTenant,
      });
    }
  }

  // 4. Ensure every income FinancialOperation (resources, financial aid, donations, fees) has a corresponding MemberContribution in baseContribs
  for (const op of baseOps) {
    if (!op || op.type !== 'income') continue;
    const amt = Number(op.amount) || 0;
    if (amt <= 0) continue;
    if (op.id === 'op-inc-1' || op.id === 'op-inc-2') continue;
    if (
      op.isUnpaidContributionDeduction ||
      op.linkedContributionId ||
      String(op.id).startsWith('op-unpaid-deduction-')
    ) {
      continue;
    }

    const hasLinkedContrib = baseContribs.some(
      (c) =>
        c.financialOperationId === op.id ||
        c.id === `contrib-op-${op.id}` ||
        (String(op.id).startsWith('op-camp-') &&
          c.id === `contrib-don-${String(op.id).replace(/^op-camp-/, '')}`) ||
        (String(op.id).startsWith('op-fee-') &&
          c.id === `contrib-fee-${String(op.id).replace(/^op-fee-/, '')}`)
    );

    if (!hasLinkedContrib) {
      const derivedContribId = String(op.id).startsWith('op-camp-')
        ? `contrib-don-${String(op.id).replace(/^op-camp-/, '')}`
        : String(op.id).startsWith('op-fee-')
        ? `contrib-fee-${String(op.id).replace(/^op-fee-/, '')}`
        : `contrib-op-${op.id}`;

      if (!deletedContribSet.has(derivedContribId) && !seenContribIds.has(derivedContribId)) {
        seenContribIds.add(derivedContribId);
        didChange = true;
        baseContribs.unshift({
          id: derivedContribId,
          memberId: op.memberId || `donor-${op.id}`,
          memberCode: op.memberId ? op.code || 'منخرط' : 'موارد ومساعدات',
          memberName: op.memberName || op.addedBy || op.title || 'موارد ومساعدات مالية',
          amount: amt,
          date: op.date || new Date().toISOString().slice(0, 10),
          time: op.createdAt ? new Date(op.createdAt).toTimeString().slice(0, 8) : '12:00:00',
          createdAt: op.createdAt || new Date().toISOString(),
          status: op.category === 'membership_fee' ? 'pending' : 'completed',
          category: op.category === 'membership_fee' ? 'membership_fee' : 'donation',
          paymentMethod: op.paymentMethod || 'bank_transfer',
          notes: op.description ? `${op.title} - ${op.description}` : op.title || 'موارد ومساعدات مالية للجمعية',
          financialOperationId: op.id,
          contributionTypeName:
            op.category === 'aid'
              ? 'مساهمة مالية في موارد ومساعدات مالية للجمعية'
              : op.category === 'membership_fee'
              ? 'واجب الانخراط السنوي'
              : op.title || 'مساهمة مالية للجمعية',
          tenantId: cleanTenant,
          associationId: cleanTenant,
        });
      }
    }
  }

  const unpaidContribMap = new Map<string, MemberContribution>();
  const reconciledContributions: MemberContribution[] = baseContribs.map((c) => {
    if (!c) return c;
    const deductionOpId = `op-unpaid-deduction-${c.id}`;
    if (isUnpaidContributionStatus(c.status) && Number(c.amount) > 0) {
      unpaidContribMap.set(c.id, c);
      if (c.unpaidDeductionOperationId !== deductionOpId) {
        didChange = true;
        return { ...c, unpaidDeductionOperationId: deductionOpId };
      }
      return c;
    } else {
      if (c.unpaidDeductionOperationId) {
        didChange = true;
        const clone = { ...c };
        delete clone.unpaidDeductionOperationId;
        return clone;
      }
      return c;
    }
  });

  // Filter existing operations: keep non-deduction operations, and keep at most one valid deduction op per unpaid contribution
  const seenDeductionForContrib = new Set<string>();
  const nextOps: FinancialOperation[] = [];

  for (const op of baseOps) {
    if (!op) continue;
    const isDeductionOp =
      Boolean(op.isUnpaidContributionDeduction) ||
      Boolean(op.linkedContributionId) ||
      String(op.id || '').startsWith('op-unpaid-deduction-');

    if (!isDeductionOp) {
      nextOps.push(op);
      continue;
    }

    const linkedId =
      op.linkedContributionId ||
      String(op.id || '').replace(/^op-unpaid-deduction-/, '');

    const matchingUnpaidContrib = unpaidContribMap.get(linkedId);

    if (!matchingUnpaidContrib || seenDeductionForContrib.has(linkedId)) {
      // Either contribution is no longer 'لم يتم الدفع' or this is a duplicate deduction -> remove it
      didChange = true;
      if (op.id) removedOperationIds.push(op.id);
      continue;
    }

    seenDeductionForContrib.add(linkedId);
    const expectedAmount = Number(matchingUnpaidContrib.amount) || 0;
    const expectedTitle = `خصم مساهمة لم يتم دفعها: ${matchingUnpaidContrib.memberName} (${matchingUnpaidContrib.memberCode})`;
    const expectedDesc = `خصم تلقائي من الرصيد المالي للجمعية بسبب تغيير حالة المساهمة (${matchingUnpaidContrib.id}) إلى «لم يتم الدفع» للمنخرط ${matchingUnpaidContrib.memberName}`;

    if (
      Number(op.amount) !== expectedAmount ||
      op.type !== 'expense' ||
      op.linkedContributionId !== linkedId ||
      !op.isUnpaidContributionDeduction
    ) {
      didChange = true;
      nextOps.push({
        ...op,
        id: `op-unpaid-deduction-${linkedId}`,
        title: op.title || expectedTitle,
        description: op.description || expectedDesc,
        type: 'expense',
        category: 'membership_fee',
        amount: expectedAmount,
        linkedContributionId: linkedId,
        isUnpaidContributionDeduction: true,
        tenantId: op.tenantId || cleanTenant,
        associationId: op.associationId || cleanTenant,
      });
    } else {
      nextOps.push(op);
    }
  }

  // Create deduction operations for any unpaid contribution that doesn't have one yet
  for (const [contribId, c] of unpaidContribMap.entries()) {
    if (!seenDeductionForContrib.has(contribId)) {
      didChange = true;
      const deductionOpId = `op-unpaid-deduction-${contribId}`;
      const shortCode = String(contribId).replace(/^contrib-/, '').slice(-6).toUpperCase();
      const newDeductionOp: FinancialOperation = {
        id: deductionOpId,
        code: `DED-${shortCode}`,
        title: `خصم مساهمة لم يتم دفعها: ${c.memberName} (${c.memberCode})`,
        description: `خصم تلقائي من الرصيد المالي للجمعية بسبب تغيير حالة المساهمة (${c.id}) إلى «لم يتم الدفع» للمنخرط ${c.memberName}`,
        type: 'expense',
        category: 'membership_fee',
        amount: Number(c.amount) || 0,
        date: c.date || new Date().toISOString().slice(0, 10),
        paymentMethod: c.paymentMethod,
        memberId: c.memberId,
        memberName: c.memberName,
        addedBy: 'إدارة الجمعية',
        createdAt: new Date().toISOString(),
        tenantId: c.tenantId || cleanTenant,
        associationId: c.associationId || cleanTenant,
        linkedContributionId: c.id,
        isUnpaidContributionDeduction: true,
      };
      nextOps.unshift(newDeductionOp);
    }
  }

  const calculated = calculateFinancials(nextOps);

  return {
    reconciledContributions,
    reconciledOperations: calculated.processedOperations,
    removedOperationIds,
    didChange,
  };
};

/**
 * Atomically saves both contributions and operations to localStorage, Cloud Firestore,
 * and the backend `/api/tenant-records` database in a single request so no race condition can occur.
 */
export const saveContributionsAndOperations = async (
  contributions: MemberContribution[],
  operations: FinancialOperation[],
  tenantId?: string,
  removedOperationIds: string[] = [],
  removedContributionIds: string[] = []
): Promise<boolean> => {
  const target = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !target || target === 'portal' ? 'tenant_nour' : target;

  for (const opId of removedOperationIds) {
    recordDeletedOperationId(opId, cleanTenant);
  }
  for (const cId of removedContributionIds) {
    recordDeletedContributionId(cId, cleanTenant);
  }

  const {
    reconciledContributions,
    reconciledOperations,
    removedOperationIds: autoRemovedIds,
  } = reconcileUnpaidContributionDeductions(contributions, operations, cleanTenant);

  const allRemovedIds = Array.from(new Set([...removedOperationIds, ...autoRemovedIds, ...getDeletedOperationIds(cleanTenant)]));
  const allRemovedContribIds = Array.from(new Set([...removedContributionIds, ...getDeletedContributionIds(cleanTenant)]));

  saveData(getScopedKey(KEYS.CONTRIBUTIONS, cleanTenant), reconciledContributions);
  saveData(getScopedKey(KEYS.OPERATIONS, cleanTenant), reconciledOperations);

  if (typeof window === 'undefined' || typeof fetch === 'undefined') return true;

  // Mirror to Cloud Firestore (including deleting any removed deduction operations)
  try {
    firestoreSyncService.syncContributionsToFirestore(cleanTenant, reconciledContributions).catch(() => {});
    firestoreSyncService.syncOperationsToFirestore(cleanTenant, reconciledOperations).catch(() => {});
    for (const opId of allRemovedIds) {
      firestoreSyncService.deleteOperationFromFirestore(cleanTenant, opId).catch(() => {});
    }
  } catch (syncErr) {
    console.warn('[Storage] Firestore sync notice in saveContributionsAndOperations:', syncErr);
  }

  try {
    const currentRole = loadData<string>(KEYS.ROLE, 'member');
    let adminSession: any = getStoredCurrentAdminSession(cleanTenant);
    if (!adminSession) {
      const masterSession =
        loadData<any>('chayef_master_admin_session_v2', null) ||
        loadData<any>('chayef_master_admin_session_v1', null);
      if (masterSession) {
        adminSession = {
          type: 'super_admin',
          role: 'main_admin',
          id: masterSession.id || 'master_admin',
          fullName: masterSession.fullName || 'الإدارة العامة للمنصة',
          phone: masterSession.phone || '',
          tenantId: cleanTenant,
          isMasterPlatformAdmin: true,
        };
      }
    }
    const isEffectiveAdmin = Boolean(adminSession) || currentRole === 'admin';
    const loggedInMemberId = getStoredLoggedInMemberId(cleanTenant);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': cleanTenant,
      'x-user-role': isEffectiveAdmin ? 'admin' : (currentRole || 'member'),
    };
    if (adminSession) {
      headers['x-admin-session'] = encodeURIComponent(JSON.stringify(adminSession));
    } else if (isEffectiveAdmin) {
      headers['x-admin-session'] = encodeURIComponent(
        JSON.stringify({
          type: 'super_admin',
          role: 'main_admin',
          id: 'admin_session',
          tenantId: cleanTenant,
        })
      );
    }
    if (loggedInMemberId) {
      headers['x-member-id'] = loggedInMemberId;
    }

    const res = await fetch(`/api/tenant-records?tenantId=${encodeURIComponent(cleanTenant)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenantId: cleanTenant,
        records: {
          contributions: reconciledContributions,
          operations: reconciledOperations,
        },
        removedOperationIds: allRemovedIds,
        removedContributionIds: allRemovedContribIds,
        callerRole: isEffectiveAdmin ? 'admin' : (currentRole || 'member'),
        callerMemberId: loggedInMemberId || undefined,
      }),
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    if (json?.success && json.records) {
      if (Array.isArray(json.records.contributions)) {
        saveData(getScopedKey(KEYS.CONTRIBUTIONS, cleanTenant), json.records.contributions);
      }
      if (Array.isArray(json.records.operations)) {
        saveData(getScopedKey(KEYS.OPERATIONS, cleanTenant), json.records.operations);
      }
    }
    return Boolean(json?.success);
  } catch (err) {
    console.warn('[Storage] saveContributionsAndOperations warning:', err);
    return false;
  }
};

/**
 * Automatically reconciles member annual subscription fees with financial operations and contributions.
 * - Ensures any registered member with annualFee > 0 has an associated FinancialOperation and MemberContribution.
 * - Never duplicates operations (checks op.id and op.memberId).
 * - Avoids double-counting initial master template members (m1..m8 whose fees are already included in initialOperations).
 * - Reconciles unpaid contribution deductions («لم يتم الدفع») and updates balances consistently.
 */
export const reconcileMemberFinancialOperations = (
  members: Member[],
  operations: FinancialOperation[],
  contributions: MemberContribution[],
  tenantId?: string
): {
  reconciledOperations: FinancialOperation[];
  reconciledContributions: MemberContribution[];
  didUpdate: boolean;
} => {
  const initialMasterMemberIds = new Set(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']);
  let didUpdate = false;
  let newOps = [...operations];
  let newContribs = [...contributions];

  for (const member of members) {
    if (initialMasterMemberIds.has(member.id)) continue;
    const fee = Number(member.annualFee) || 0;
    if (fee <= 0) continue;

    const feeOpId = `op-fee-${member.id}`;
    const feeContribId = `contrib-fee-${member.id}`;

    const hasOp = newOps.some(
      (op) =>
        op.id === feeOpId ||
        (op.memberId === member.id &&
          op.category === 'membership_fee' &&
          op.type === 'income' &&
          !op.isUnpaidContributionDeduction &&
          !String(op.id || '').startsWith('op-unpaid-deduction-'))
    );

    const hasContrib = newContribs.some(
      (c) => c.id === feeContribId || (c.memberId === member.id && c.category === 'membership_fee')
    );

    const feeDate = member.joinDate || new Date().toISOString().slice(0, 10);

    if (!hasOp) {
      const newOp: FinancialOperation = {
        id: feeOpId,
        code: `REC-${new Date().getFullYear()}-${member.memberCode}`,
        title: `واجب انخراط سنوي: ${member.fullName} (${member.memberCode})`,
        description: `استخلاص واجب الانخراط السنوي للمنخرط ${member.fullName} (${member.memberCode}) بتاريخ التسجيل ${feeDate}`,
        type: 'income',
        category: 'membership_fee',
        amount: fee,
        date: feeDate,
        memberId: member.id,
        memberName: member.fullName,
        addedBy: 'إدارة الجمعية',
        createdAt: new Date().toISOString(),
      };
      newOps = [newOp, ...newOps];
      didUpdate = true;
    }

    if (!hasContrib) {
      const newContrib: MemberContribution = {
        id: feeContribId,
        memberId: member.id,
        memberCode: member.memberCode,
        memberName: member.fullName,
        amount: fee,
        date: feeDate,
        time: '12:00:00',
        createdAt: new Date().toISOString(),
        status: 'completed',
        category: 'membership_fee',
        paymentMethod: 'bank_transfer',
        notes: `واجب الانخراط السنوي عند التسجيل (${feeDate})`,
        financialOperationId: feeOpId,
      };
      newContribs = [newContrib, ...newContribs];
      didUpdate = true;
    }
  }

  const unpaidReconciled = reconcileUnpaidContributionDeductions(newContribs, newOps, tenantId);
  newContribs = unpaidReconciled.reconciledContributions;
  newOps = unpaidReconciled.reconciledOperations;
  if (unpaidReconciled.didChange) {
    didUpdate = true;
  } else if (didUpdate) {
    const calculated = calculateFinancials(newOps);
    newOps = calculated.processedOperations;
  }

  return {
    reconciledOperations: newOps,
    reconciledContributions: newContribs,
    didUpdate,
  };
};

export const getStoredActivities = (tenantId?: string): ActivityItem[] => {
  const rawTenant = tenantId || getActiveTenantIdFromStorage();
  const current = !rawTenant || rawTenant === 'portal' ? 'tenant_nour' : rawTenant;
  const isMaster = current === 'tenant_nour';
  const initKey = `chayef_tenant_${current}_activities_initialized`;
  const deletedIds = getDeletedActivityIds(current);

  const primaryKey = getScopedKey(KEYS.ACTIVITIES, current);
  const secondaryKey = `chayef_tenant_${current}_activities`;

  let loaded = loadData<any[]>(primaryKey, []);
  if (!Array.isArray(loaded) || loaded.length === 0) {
    loaded = loadData<any[]>(secondaryKey, []);
  }

  // If master and empty, load master reference activities
  if (isMaster && (!Array.isArray(loaded) || loaded.length === 0)) {
    loaded = getMasterReferenceActivities();
  }

  // If child tenant has no activities in storage and no deleted activities recorded,
  // automatically clone from approved master Nour template
  if (!isMaster && (!Array.isArray(loaded) || loaded.length === 0) && deletedIds.length === 0) {
    const cloned = cloneReferenceActivitiesForNewTenant(current);
    loaded = cloned;
    if (typeof window !== 'undefined') {
      localStorage.setItem(initKey, 'true');
      localStorage.setItem(primaryKey, JSON.stringify(cloned));
      localStorage.setItem(secondaryKey, JSON.stringify(cloned));
    }
  }

  if (!Array.isArray(loaded)) return isMaster ? getMasterReferenceActivities() : [];

  return loaded
    .filter((act) => act && act.id && !deletedIds.includes(act.id))
    .map((act) => {
      // Reconcile and unify videoUrl from any potential legacy property name
      let resolvedVideoUrl =
        (typeof act.videoUrl === 'string' && act.videoUrl.trim() ? act.videoUrl.trim() : undefined) ||
        (typeof act.video_url === 'string' && act.video_url.trim() ? act.video_url.trim() : undefined) ||
        (typeof act.video === 'string' && act.video.trim() ? act.video.trim() : undefined) ||
        (typeof act.videoEmbedUrl === 'string' && act.videoEmbedUrl.trim() ? act.videoEmbedUrl.trim() : undefined);

      // Prevent any obsolete test rickroll links
      if (resolvedVideoUrl && resolvedVideoUrl.includes('dQw4w9WgXcQ')) {
        resolvedVideoUrl = undefined;
      }

      let resolvedVideoUrls: string[] = [];
      if (Array.isArray(act.videoUrls)) {
        resolvedVideoUrls = act.videoUrls
          .filter((u) => typeof u === 'string' && u.trim() && !u.includes('dQw4w9WgXcQ'))
          .map((u) => u.trim());
      }
      if (resolvedVideoUrl && !resolvedVideoUrls.includes(resolvedVideoUrl)) {
        resolvedVideoUrls.unshift(resolvedVideoUrl);
      }

      return {
        ...act,
        isActive: act.isActive !== false && (act as any).isActive !== 'false',
        videoUrl: resolvedVideoUrls[0] || resolvedVideoUrl,
        videoUrls: resolvedVideoUrls,
      };
    });
};
export const getSettingsTimestamp = (tenantId?: string): number => {
  try {
    const key = tenantId ? `chayef_tenant_${tenantId}_settings_ts_v1` : 'chayef_assoc_settings_ts_v1';
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

export const setSettingsTimestamp = (ts: number = Date.now(), tenantId?: string): void => {
  try {
    const key = tenantId ? `chayef_tenant_${tenantId}_settings_ts_v1` : 'chayef_assoc_settings_ts_v1';
    localStorage.setItem(key, String(ts));
  } catch {}
};

export const getActivitiesTimestamp = (tenantId?: string): number => {
  try {
    const key = tenantId ? `chayef_tenant_${tenantId}_activities_ts_v1` : 'chayef_assoc_activities_ts_v1';
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

export const setActivitiesTimestamp = (ts: number = Date.now(), tenantId?: string): void => {
  try {
    const key = tenantId ? `chayef_tenant_${tenantId}_activities_ts_v1` : 'chayef_assoc_activities_ts_v1';
    localStorage.setItem(key, String(ts));
  } catch {}
};

export const saveActivities = (activities: ActivityItem[], updateTimestamp: boolean = true, tenantId?: string) => {
  const rawTenant = tenantId || getActiveTenantIdFromStorage();
  const current = !rawTenant || rawTenant === 'portal' ? 'tenant_nour' : rawTenant;
  const normalizedActivities = Array.isArray(activities)
    ? activities.map((act) => ({
        ...act,
        isActive: act.isActive !== false && (act as any).isActive !== 'false',
      }))
    : [];
  if (typeof window !== 'undefined') {
    localStorage.setItem(`chayef_tenant_${current}_activities_initialized`, 'true');
  }
  const primaryKey = getScopedKey(KEYS.ACTIVITIES, current);
  const secondaryKey = `chayef_tenant_${current}_activities`;
  saveData(primaryKey, normalizedActivities);
  saveData(secondaryKey, normalizedActivities);
  if (updateTimestamp) {
    setActivitiesTimestamp(Date.now(), current);
    // Mirror activities permanently in Cloud Firestore on explicit updates
    firestoreSyncService.syncActivitiesToFirestore(current, normalizedActivities).catch((err) => {
      console.warn('[Storage] Firestore sync activities notice:', err);
    });
  }
};

export const getStoredAuditLogs = (tenantId?: string): AuditLog[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';
  return loadData<AuditLog[]>(getScopedKey(KEYS.AUDIT_LOGS, current), isMaster ? initialAuditLogs : []);
};
export const saveAuditLogs = (logs: AuditLog[], tenantId?: string, syncBackend: boolean = true) => {
  saveData(getScopedKey(KEYS.AUDIT_LOGS, tenantId), logs);
  if (syncBackend) {
    persistTenantCollectionToBackend('auditLogs', logs, tenantId);
  }
};

export const getStoredSettings = (tenantId?: string): AssociationSettings => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const loaded = loadData<AssociationSettings>(getScopedKey(KEYS.SETTINGS, current), initialSettings);

  // If current is an isolated tenant, verify tenant meta from the registry so custom name & nameFr are always strictly preserved
  let tenantMeta: any = null;
  if (current && current !== 'tenant_nour' && current !== 'portal') {
    try {
      const allTenantsRaw = localStorage.getItem('chayef_all_tenants_v2');
      if (allTenantsRaw) {
        const allTenants = JSON.parse(allTenantsRaw);
        if (Array.isArray(allTenants)) {
          tenantMeta = allTenants.find((t: any) => t.id === current);
        }
      }
    } catch {}
  }

  let resolvedName: string;
  let resolvedNameFr: string;
  let resolvedNameEn: string;

  if (current && current !== 'tenant_nour' && current !== 'portal') {
    // For isolated tenants, tenantMeta.name is the gold-standard source of truth from registration
    if (tenantMeta?.name) {
      resolvedName = (loaded?.name && loaded.name !== 'جمعية الشايف' && loaded.name !== initialSettings.name)
        ? loaded.name
        : tenantMeta.name;
    } else if (loaded?.name && loaded.name !== 'جمعية الشايف') {
      resolvedName = loaded.name;
    } else {
      resolvedName = 'الجمعية';
    }

    resolvedNameFr = (loaded?.nameFr && loaded.nameFr !== 'Association El Chayef' && loaded.nameFr !== initialSettings.nameFr)
      ? loaded.nameFr
      : (tenantMeta?.nameFr || `Association ${resolvedName}`);

    resolvedNameEn = (loaded?.nameEn && loaded.nameEn !== 'El Chayef Association' && loaded.nameEn !== initialSettings.nameEn)
      ? loaded.nameEn
      : (tenantMeta?.nameEn || resolvedNameFr);
  } else {
    resolvedName = loaded?.name || initialSettings.name;
    resolvedNameFr = loaded?.nameFr || initialSettings.nameFr;
    resolvedNameEn = loaded?.nameEn || initialSettings.nameEn;
  }

  const withAccessControl: AssociationSettings = {
    ...initialSettings,
    ...loaded,
    name: resolvedName,
    nameFr: resolvedNameFr,
    nameEn: resolvedNameEn,
    tagline: (loaded?.tagline && loaded.tagline !== initialSettings.tagline)
      ? loaded.tagline
      : ((current && current !== 'tenant_nour' && current !== 'portal' && tenantMeta?.tagline)
          ? tenantMeta.tagline
          : (loaded?.tagline || initialSettings.tagline)),
    logoUrl: (loaded?.logoUrl && loaded.logoUrl !== initialSettings.logoUrl)
      ? loaded.logoUrl
      : ((current && current !== 'tenant_nour' && current !== 'portal' && tenantMeta?.logoUrl)
          ? tenantMeta.logoUrl
          : (loaded?.logoUrl || initialSettings.logoUrl)),
    bannerImageUrl: (loaded?.bannerImageUrl && loaded.bannerImageUrl !== initialSettings.bannerImageUrl)
      ? loaded.bannerImageUrl
      : ((current && current !== 'tenant_nour' && current !== 'portal' && tenantMeta?.bannerImageUrl)
          ? tenantMeta.bannerImageUrl
          : (loaded?.bannerImageUrl || initialSettings.bannerImageUrl)),
    showAdminLoginButton: loaded?.showAdminLoginButton ?? false,
    enableTripleClickLogoLogin: loaded?.enableTripleClickLogoLogin ?? true,
    bannerDarknessOverlay: loaded?.bannerDarknessOverlay !== undefined ? loaded.bannerDarknessOverlay : (initialSettings.bannerDarknessOverlay ?? 40),
    heroBadgeText: loaded?.heroBadgeText || '',
    heroBadgeTextFr: loaded?.heroBadgeTextFr || '',
    heroBadgeTextEn: loaded?.heroBadgeTextEn || '',
    whatsapp: (loaded?.whatsapp !== undefined && loaded.whatsapp !== null && String(loaded.whatsapp).trim() !== '')
      ? loaded.whatsapp
      : (tenantMeta?.whatsapp || tenantMeta?.ownerPhone || initialSettings.whatsapp || '0661000001'),
    phone: (loaded?.phone !== undefined && loaded.phone !== null && String(loaded.phone).trim() !== '')
      ? loaded.phone
      : (tenantMeta?.ownerPhone || initialSettings.phone || '0661000001'),
    themeColors: {
      ...defaultStoreThemeColors,
      ...(loaded?.themeColors || {}),
    },
  };
  if (withAccessControl && withAccessControl.featuredActivityId === 'act-1' && !localStorage.getItem('achayef_featured_manually_selected')) {
    const migrated = { ...withAccessControl, featuredActivityId: undefined };
    saveData(getScopedKey(KEYS.SETTINGS, current), migrated);
    return migrated;
  }
  return withAccessControl;
};
export const saveSettings = (settings: AssociationSettings, updateTimestamp: boolean = true, tenantId?: string) => {
  const current = tenantId || getActiveTenantIdFromStorage();
  saveData(getScopedKey(KEYS.SETTINGS, current), settings);
  if (updateTimestamp) {
    setSettingsTimestamp(Date.now(), current);
    // Mirror to Cloud Firestore on explicit updates
    firestoreSyncService.saveSettingsToFirestore(current, settings).catch((err) => {
      console.warn('[Storage] Firestore sync settings notice:', err);
    });
  }
  if (settings?.themeColors) {
    applyStoreTheme(settings.themeColors);
  }
  // Keep tenant registry in sync for any association (including tenant_nour and isolated tenants)
  if (current && current !== 'portal') {
    try {
      const allTenantsRaw = localStorage.getItem('chayef_all_tenants_v2');
      if (allTenantsRaw) {
        const allTenants = JSON.parse(allTenantsRaw);
        if (Array.isArray(allTenants)) {
          const idx = allTenants.findIndex((t: any) => t.id === current);
          if (idx !== -1) {
            const isIsolated = current !== 'tenant_nour';
            // Guard: Never allow 'جمعية الشايف' or Nour template default to overwrite an isolated tenant's name
            const cleanNewName = isIsolated
              ? ((settings.name && settings.name.trim() !== 'جمعية الشايف' && settings.name.trim() !== initialSettings.name)
                  ? settings.name.trim()
                  : allTenants[idx].name)
              : (settings.name?.trim() || allTenants[idx].name);

            const cleanNewNameFr = isIsolated
              ? ((settings.nameFr && settings.nameFr.trim() !== 'Association El Chayef' && settings.nameFr.trim() !== initialSettings.nameFr)
                  ? settings.nameFr.trim()
                  : allTenants[idx].nameFr)
              : (settings.nameFr?.trim() || allTenants[idx].nameFr);

            const cleanNewNameEn = isIsolated
              ? ((settings.nameEn && settings.nameEn.trim() !== 'El Chayef Association' && settings.nameEn.trim() !== initialSettings.nameEn)
                  ? settings.nameEn.trim()
                  : (cleanNewNameFr || allTenants[idx].nameEn))
              : (settings.nameEn?.trim() || allTenants[idx].nameEn);

            allTenants[idx] = {
              ...allTenants[idx],
              name: cleanNewName,
              nameFr: cleanNewNameFr,
              nameEn: cleanNewNameEn,
              tagline: settings.tagline !== undefined ? settings.tagline : allTenants[idx].tagline,
              whatsapp: settings.whatsapp !== undefined ? settings.whatsapp : allTenants[idx].whatsapp,
              phone: settings.phone !== undefined ? settings.phone : allTenants[idx].phone,
              ownerPhone: settings.phone !== undefined ? settings.phone : allTenants[idx].ownerPhone,
              logoUrl: settings.logoUrl || allTenants[idx].logoUrl,
              bannerImageUrl: settings.bannerImageUrl || allTenants[idx].bannerImageUrl,
              updatedAt: new Date().toISOString(),
            };
            localStorage.setItem('chayef_all_tenants_v2', JSON.stringify(allTenants));
          }
        }
      }
    } catch {}
  }
};

export const ensureMandatoryPasswordFields = (
  fields: MemberRegistrationField[]
): MemberRegistrationField[] => {
  const baseList = Array.isArray(fields) && fields.length > 0 ? [...fields] : [...initialRegistrationFields];
  const usernameTemplate = initialRegistrationFields.find((f) => f.id === 'username')!;
  const passwordTemplate = initialRegistrationFields.find((f) => f.id === 'password')!;
  const confirmPasswordTemplate = initialRegistrationFields.find((f) => f.id === 'confirmPassword')!;

  const hasUsername = baseList.some((f) => f && (f.id === 'username' || f.name === 'username'));
  const hasPassword = baseList.some((f) => f && (f.id === 'password' || f.name === 'password'));
  const hasConfirmPassword = baseList.some((f) => f && (f.id === 'confirmPassword' || f.name === 'confirmPassword'));

  const toStrictBool = (val: any, fallback: boolean): boolean => {
    if (typeof val === 'boolean') return val;
    if (val === 'false' || val === 0 || val === '0') return false;
    if (val === 'true' || val === 1 || val === '1') return true;
    return fallback;
  };

  let result = baseList
    .filter((f) => Boolean(f))
    .map((f) => {
      const strictEnabled = toStrictBool(f.enabled, true);
      const strictRequired = toStrictBool(f.required, false);

      if (f.id === 'username' || f.name === 'username') {
        return {
          ...usernameTemplate,
          ...f,
          id: 'username',
          name: 'username',
          labelAr: f.labelAr && String(f.labelAr).trim() ? f.labelAr : 'اسم المستخدم',
          helpTextAr:
            f.helpTextAr && String(f.helpTextAr).trim()
              ? f.helpTextAr
              : 'يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.',
          type: (f.type || 'text') as any,
          required: toStrictBool(f.required, true),
          enabled: strictEnabled,
          isSystem: true,
        };
      }
      if (f.id === 'password' || f.name === 'password') {
        return {
          ...passwordTemplate,
          ...f,
          id: 'password',
          name: 'password',
          type: (f.type || 'password') as any,
          required: toStrictBool(f.required, true),
          enabled: strictEnabled,
          isSystem: true,
        };
      }
      if (f.id === 'confirmPassword' || f.name === 'confirmPassword') {
        return {
          ...confirmPasswordTemplate,
          ...f,
          id: 'confirmPassword',
          name: 'confirmPassword',
          type: (f.type || 'password') as any,
          required: toStrictBool(f.required, true),
          enabled: strictEnabled,
          isSystem: true,
        };
      }
      return {
        ...f,
        enabled: strictEnabled,
        required: strictRequired,
      };
    });

  if (!hasUsername && usernameTemplate) {
    const fullNameIdx = result.findIndex((f) => f.id === 'fullName');
    const insertIdx = fullNameIdx >= 0 ? fullNameIdx + 1 : 0;
    result.splice(insertIdx, 0, { ...usernameTemplate });
  }

  if (!hasPassword || !hasConfirmPassword) {
    const phoneIdx = result.findIndex((f) => f.id === 'phone');
    const insertIdx = phoneIdx >= 0 ? phoneIdx + 1 : result.length;
    const toInsert: MemberRegistrationField[] = [];
    if (!hasPassword && passwordTemplate) toInsert.push({ ...passwordTemplate });
    if (!hasConfirmPassword && confirmPasswordTemplate) toInsert.push({ ...confirmPasswordTemplate });
    result.splice(insertIdx, 0, ...toInsert);
  }

  if (!hasUsername || !hasPassword || !hasConfirmPassword) {
    result = result.map((f, idx) => ({ ...f, order: idx + 1 }));
  }

  return result;
};

export const GLOBAL_REGISTRATION_FIELDS_KEY = 'chayef_global_registration_fields_v1';
export const GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT = 'chayef-registration-fields-updated';

export const getRegistrationFieldsTimestamp = (tenantId?: string): number => {
  try {
    const current = tenantId || getActiveTenantIdFromStorage();
    const cleanTenant = !current || current === 'portal' ? 'tenant_nour' : current;
    const key = `chayef_tenant_${cleanTenant}_reg_fields_ts_v1`;
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

export const setRegistrationFieldsTimestamp = (ts: number = Date.now(), tenantId?: string): void => {
  try {
    const current = tenantId || getActiveTenantIdFromStorage();
    const cleanTenant = !current || current === 'portal' ? 'tenant_nour' : current;
    const key = `chayef_tenant_${cleanTenant}_reg_fields_ts_v1`;
    localStorage.setItem(key, String(ts));
  } catch {}
};

export const getGlobalRegistrationFields = (): MemberRegistrationField[] => {
  const globalSaved = loadData<MemberRegistrationField[] | null>(GLOBAL_REGISTRATION_FIELDS_KEY, null);
  if (Array.isArray(globalSaved) && globalSaved.length > 0) {
    return ensureMandatoryPasswordFields(globalSaved);
  }
  const masterSaved = loadData<MemberRegistrationField[] | null>(getScopedKey(KEYS.FIELDS, 'tenant_nour'), null);
  if (Array.isArray(masterSaved) && masterSaved.length > 0) {
    return ensureMandatoryPasswordFields(masterSaved);
  }
  return ensureMandatoryPasswordFields(initialRegistrationFields);
};

export const getStoredRegistrationFields = (tenantId?: string): MemberRegistrationField[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !current || current === 'portal' ? 'tenant_nour' : current;

  // 1. Respect the specific association's saved registration fields first
  const tenantSaved = loadData<MemberRegistrationField[] | null>(getScopedKey(KEYS.FIELDS, cleanTenant), null);
  if (Array.isArray(tenantSaved) && tenantSaved.length > 0) {
    return ensureMandatoryPasswordFields(tenantSaved);
  }

  // 2. Fallback to global registration fields if this association has not customized its fields yet
  const globalFields = getGlobalRegistrationFields();
  if (Array.isArray(globalFields) && globalFields.length > 0) {
    return ensureMandatoryPasswordFields(globalFields);
  }

  return ensureMandatoryPasswordFields(initialRegistrationFields);
};

export const saveRegistrationFields = (
  fields: MemberRegistrationField[],
  tenantId?: string,
  syncBackend: boolean = true
): Promise<boolean> => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !current || current === 'portal' ? 'tenant_nour' : current;
  const normalized = ensureMandatoryPasswordFields(fields || []);

  saveData(getScopedKey(KEYS.FIELDS, cleanTenant), normalized);
  if (cleanTenant === 'tenant_nour') {
    saveData(GLOBAL_REGISTRATION_FIELDS_KEY, normalized);
  }

  if (syncBackend) {
    setRegistrationFieldsTimestamp(Date.now(), cleanTenant);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT, {
          detail: { fields: normalized, tenantId: cleanTenant },
        })
      );
    }
    return persistTenantCollectionToBackend('registrationFields', normalized, cleanTenant);
  }
  return Promise.resolve(true);
};

export const saveGlobalRegistrationFieldsForAllTenants = async (
  fields: MemberRegistrationField[]
): Promise<boolean> => {
  const normalized = ensureMandatoryPasswordFields(fields || []);
  const nowTs = Date.now();
  saveData(GLOBAL_REGISTRATION_FIELDS_KEY, normalized);
  saveData(getScopedKey(KEYS.FIELDS, 'tenant_nour'), normalized);
  setRegistrationFieldsTimestamp(nowTs, 'tenant_nour');

  // Update all known tenants in localStorage so switching associations reflects changes immediately
  if (typeof window !== 'undefined') {
    try {
      const rawTenants = localStorage.getItem('chayef_all_tenants_v2');
      if (rawTenants) {
        const parsedTenants = JSON.parse(rawTenants);
        if (Array.isArray(parsedTenants)) {
          for (const t of parsedTenants) {
            if (t && t.id) {
              saveData(getScopedKey(KEYS.FIELDS, t.id), normalized);
              setRegistrationFieldsTimestamp(nowTs, t.id);
            }
          }
        }
      }
      // Also update any existing tenant field keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.endsWith(`_${KEYS.FIELDS}`)) {
          saveData(k, normalized);
        }
      }
    } catch {}

    window.dispatchEvent(
      new CustomEvent(GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT, {
        detail: { fields: normalized, isGlobal: true },
      })
    );
  }

  // Sync to Cloud Firestore (both global_registration_fields and tenant_nour_registration_fields)
  firestoreSyncService.saveRegistrationFieldsToFirestore('tenant_nour', normalized, true).catch(() => {});

  if (typeof window === 'undefined' || typeof fetch === 'undefined') return true;

  try {
    const masterSession =
      loadData<any>('chayef_master_admin_session_v2', null) ||
      loadData<any>('chayef_master_admin_session_v1', null) ||
      getStoredCurrentAdminSession('tenant_nour');

    const adminHeaderPayload = {
      type: 'super_admin',
      role: 'main_admin',
      id: masterSession?.id || 'master_admin',
      fullName: masterSession?.fullName || 'الإدارة العامة للمنصة',
      phone: masterSession?.phone || '',
      tenantId: 'tenant_nour',
      isMaster: true,
      isMasterPlatformAdmin: true,
    };

    const res = await fetch('/api/tenant-records?tenantId=tenant_nour', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'tenant_nour',
        'x-user-role': 'admin',
        'x-admin-session': encodeURIComponent(JSON.stringify(adminHeaderPayload)),
      },
      body: JSON.stringify({
        tenantId: 'tenant_nour',
        collection: 'registrationFields',
        key: 'registrationFields',
        data: normalized,
        propagateToAllTenants: true,
        callerRole: 'admin',
      }),
    });

    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    return Boolean(json?.success);
  } catch (err) {
    console.warn('[Storage] saveGlobalRegistrationFieldsForAllTenants error:', err);
    return false;
  }
};

export const getStoredUIElements = (tenantId?: string): UIElementConfig[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const loaded = loadData<UIElementConfig[]>(getScopedKey(KEYS.UI_ELEMENTS, current), initialUIElements);
  const cleanInitial = initialUIElements
    .filter((el) => el.id !== 'pillars_section' && el.id !== 'gateway_financials')
    .map((el) =>
      el.id === 'current_financial_balance'
        ? { ...el, enabled: true, visibleToNonMembers: false }
        : el
    );
  if (!Array.isArray(loaded) || loaded.length === 0) return cleanInitial;

  // Filter out any deprecated elements and ensure current_financial_balance is hidden from visitors
  return loaded
    .filter((el) => el && el.id && el.id !== 'pillars_section' && el.id !== 'gateway_financials')
    .map((el) =>
      el.id === 'current_financial_balance'
        ? { ...el, enabled: true, visibleToNonMembers: false }
        : el
    );
};
export const getUIElementsTimestamp = (tenantId?: string): number => {
  try {
    const key = tenantId ? `chayef_tenant_${tenantId}_ui_elements_ts_v1` : 'chayef_assoc_ui_elements_ts_v1';
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

export const setUIElementsTimestamp = (ts: number = Date.now(), tenantId?: string): void => {
  try {
    const key = tenantId ? `chayef_tenant_${tenantId}_ui_elements_ts_v1` : 'chayef_assoc_ui_elements_ts_v1';
    localStorage.setItem(key, String(ts));
  } catch {}
};

export const saveUIElements = (elements: UIElementConfig[], tenantId?: string, updateTimestamp: boolean = true) => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const cleanElements = elements
    .filter((el) => el && el.id !== 'pillars_section' && el.id !== 'gateway_financials')
    .map((el) =>
      el.id === 'current_financial_balance'
        ? { ...el, enabled: true, visibleToNonMembers: false }
        : el
    );
  saveData(getScopedKey(KEYS.UI_ELEMENTS, current), cleanElements);
  if (updateTimestamp) {
    setUIElementsTimestamp(Date.now(), current);
    firestoreSyncService.saveUIElementsToFirestore(current, cleanElements).catch(() => {});
  }
};

export const clonePollsFromMasterForTenant = (tenantId: string, associationName?: string): Poll[] => {
  const cleanTenant = !tenantId || tenantId === 'portal' ? 'tenant_nour' : tenantId;
  let masterPolls: Poll[] = initialPolls;

  if (typeof window !== 'undefined') {
    try {
      const masterKey = getScopedKey(KEYS.POLLS, 'tenant_nour');
      const rawMaster = localStorage.getItem(masterKey);
      if (rawMaster) {
        const parsedMaster = JSON.parse(rawMaster);
        if (Array.isArray(parsedMaster) && parsedMaster.length > 0) {
          masterPolls = parsedMaster;
        }
      }
    } catch {}
  }

  if (cleanTenant === 'tenant_nour') {
    return masterPolls.map((p) => ({
      ...p,
      votes: Array.isArray(p.votes) ? p.votes.map((v) => ({ ...v })) : [],
    }));
  }

  return masterPolls.map((poll, idx) => ({
    ...poll,
    id: `poll_${cleanTenant}_${idx + 1}`,
    createdBy: associationName
      ? `المكتب التنفيذي لـ ${associationName}`
      : poll.createdBy || 'إدارة الجمعية',
    status: poll.status || 'active',
    isVisibleInApp: poll.isVisibleInApp !== false,
    allowVoteChange: poll.allowVoteChange !== false,
    votes: Array.isArray(poll.votes) ? poll.votes.map((v) => ({ ...v })) : [],
  }));
};

export const getStoredPolls = (tenantId?: string): Poll[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';
  const key = getScopedKey(KEYS.POLLS, current);
  const legacyKey = !isMaster ? `chayef_tenant_${current}_polls` : null;
  const explicitEmptyKey = `chayef_tenant_${current}_polls_explicit_empty`;

  if (typeof window !== 'undefined') {
    const item = localStorage.getItem(key);
    if (item !== null) {
      try {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 || localStorage.getItem(explicitEmptyKey) === 'true') {
            return parsed;
          }
        }
      } catch (err) {
        console.error('Error parsing stored polls:', err);
      }
    }

    if (legacyKey) {
      const legacyItem = localStorage.getItem(legacyKey);
      if (legacyItem !== null) {
        try {
          const parsedLegacy = JSON.parse(legacyItem);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            saveData(key, parsedLegacy);
            return parsedLegacy;
          }
        } catch {}
      }
    }
  }

  // If never initialized in storage (or previously overwritten by empty uninitialized response), seed from master template
  const fallback = isMaster
    ? clonePollsFromMasterForTenant('tenant_nour')
    : clonePollsFromMasterForTenant(current);
  saveData(key, fallback);
  if (legacyKey) {
    saveData(legacyKey, fallback);
  }
  return fallback;
};

export const savePolls = (polls: Poll[], tenantId?: string, isExplicitUserChange: boolean = false) => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';
  const key = getScopedKey(KEYS.POLLS, current);
  const legacyKey = !isMaster ? `chayef_tenant_${current}_polls` : null;
  const explicitEmptyKey = `chayef_tenant_${current}_polls_explicit_empty`;

  saveData(key, polls);
  if (legacyKey) {
    saveData(legacyKey, polls);
  }

  if (typeof window !== 'undefined') {
    try {
      if (polls.length > 0) {
        localStorage.removeItem(explicitEmptyKey);
      } else if (isExplicitUserChange) {
        localStorage.setItem(explicitEmptyKey, 'true');
      }
    } catch {}
  }

  firestoreSyncService.syncPollsToFirestore(current, polls).catch((err) => {
    console.warn('[Storage] Firestore sync polls notice:', err);
  });
};

export const getStoredMemberCardSettings = (tenantId?: string): MemberCardSettings => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const loaded = loadData<MemberCardSettings>(getScopedKey(KEYS.MEMBER_CARD_SETTINGS, current), initialMemberCardSettings);
  // For master template (tenant_nour), ensure default template official signature & stamp if not customized
  if (current === 'tenant_nour' || !current || current === 'portal') {
    if (loaded.signatureImageUrl === undefined) {
      loaded.signatureImageUrl = initialMemberCardSettings.signatureImageUrl;
    }
    if (loaded.stampImageUrl === undefined) {
      loaded.stampImageUrl = initialMemberCardSettings.stampImageUrl;
    }
    if (loaded.showSignature === undefined) {
      loaded.showSignature = true;
    }
  }
  return loaded;
};
export const saveMemberCardSettings = (cardSettings: MemberCardSettings, tenantId?: string, syncBackend: boolean = true): Promise<boolean> => {
  const current = tenantId || getActiveTenantIdFromStorage();
  saveData(getScopedKey(KEYS.MEMBER_CARD_SETTINGS, current), cardSettings);
  const cleanTenant = !current || current === 'portal' ? 'tenant_nour' : current;
  if (syncBackend) {
    firestoreSyncService.saveMemberCardSettingsToFirestore(cleanTenant, cardSettings).catch(() => {});
  }
  // Synchronize with server backend database
  if (syncBackend && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    return fetch(`/api/card-settings?tenantId=${encodeURIComponent(cleanTenant)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': cleanTenant,
      },
      body: JSON.stringify({ tenantId: cleanTenant, settings: cardSettings }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        if (data?.success && data.settings) {
          saveData(getScopedKey(KEYS.MEMBER_CARD_SETTINGS, cleanTenant), data.settings);
        }
        return Boolean(data?.success);
      })
      .catch((err) => {
        console.warn('[CardSettings] Background sync warning:', err);
        return false;
      });
  }
  return Promise.resolve(true);
};

export const syncTenantRecordsFromBackend = async (tenantId?: string): Promise<{
  members?: Member[];
  boardMembers?: BoardMember[];
  contributions?: MemberContribution[];
  operations?: FinancialOperation[];
  registrationFields?: MemberRegistrationField[];
  auditLogs?: AuditLog[];
  memberCardSettings?: MemberCardSettings;
} | null> => {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return null;
  const current = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !current || current === 'portal' ? 'tenant_nour' : current;

  const result: {
    members?: Member[];
    boardMembers?: BoardMember[];
    contributions?: MemberContribution[];
    operations?: FinancialOperation[];
    registrationFields?: MemberRegistrationField[];
    auditLogs?: AuditLog[];
    memberCardSettings?: MemberCardSettings;
  } = {};

  try {
    const [recordsRes, cardRes] = await Promise.all([
      fetch(`/api/tenant-records?tenantId=${encodeURIComponent(cleanTenant)}`, {
        headers: { 'x-tenant-id': cleanTenant },
        cache: 'no-store',
      }).catch(() => null),
      fetch(`/api/card-settings?tenantId=${encodeURIComponent(cleanTenant)}`, {
        headers: { 'x-tenant-id': cleanTenant },
        cache: 'no-store',
      }).catch(() => null),
    ]);

    if (recordsRes && recordsRes.ok) {
      const data = await recordsRes.json();
      if (data?.success && data.records) {
        const rec = data.records;
        if (rec.updatedBy === 'System Init') {
          // If server DB was just initialized with defaults, push existing local records if any
          const localMembers = getStoredMembers(cleanTenant);
          const localBoard = getStoredBoardMembers(cleanTenant);
          const localContribs = getStoredContributions(cleanTenant);
          const localOps = getStoredOperations(cleanTenant);
          const localFields = getStoredRegistrationFields(cleanTenant);
          const localLogs = getStoredAuditLogs(cleanTenant);

          fetch(`/api/tenant-records?tenantId=${encodeURIComponent(cleanTenant)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': cleanTenant },
            body: JSON.stringify({
              tenantId: cleanTenant,
              records: {
                members: localMembers,
                boardMembers: localBoard,
                contributions: localContribs,
                operations: localOps,
                registrationFields: localFields,
                auditLogs: localLogs,
              },
              updatedBy: 'مزامنة تلقائية',
            }),
          }).catch(() => {});
        } else {
          if (Array.isArray(rec.members)) {
            const localMembersTs = getMembersTimestamp(cleanTenant);
            const remoteMembersTs = rec.updatedAt ? new Date(rec.updatedAt).getTime() : 0;
            if (localMembersTs > remoteMembersTs + 2000) {
              const localMembers = getStoredMembers(cleanTenant);
              result.members = localMembers;
              persistTenantCollectionToBackend('members', localMembers, cleanTenant).catch(() => {});
            } else {
              saveMembers(rec.members, cleanTenant, false);
              if (remoteMembersTs > 0) {
                setMembersTimestamp(remoteMembersTs, cleanTenant);
              }
              result.members = rec.members;
            }
          }
          if (Array.isArray(rec.boardMembers)) {
            saveBoardMembers(rec.boardMembers, cleanTenant, false);
            result.boardMembers = rec.boardMembers;
          }
          if (Array.isArray(rec.contributions) || Array.isArray(rec.operations)) {
            // Sync server-tracked deleted IDs first
            if (Array.isArray(rec.deletedOperationIds)) {
              for (const delOpId of rec.deletedOperationIds) {
                recordDeletedOperationId(delOpId, cleanTenant);
              }
            }
            if (Array.isArray(rec.deletedContributionIds)) {
              for (const delCId of rec.deletedContributionIds) {
                recordDeletedContributionId(delCId, cleanTenant);
              }
            }

            const deletedOpSet = new Set(getDeletedOperationIds(cleanTenant));
            const deletedContribSet = new Set(getDeletedContributionIds(cleanTenant));

            const localContribs = getStoredContributions(cleanTenant);
            const remoteContribs: MemberContribution[] = Array.isArray(rec.contributions) ? rec.contributions : [];
            const remoteContribIds = new Set(remoteContribs.map((c) => c?.id).filter(Boolean));

            // Merge remote and local contributions without losing any newly added local contribution
            const mergedContribsMap = new Map<string, MemberContribution>();
            for (const c of localContribs) {
              if (c && c.id && !deletedContribSet.has(c.id)) {
                mergedContribsMap.set(c.id, c);
              }
            }
            for (const c of remoteContribs) {
              if (c && c.id && !deletedContribSet.has(c.id)) {
                const prev = mergedContribsMap.get(c.id);
                mergedContribsMap.set(c.id, prev ? { ...prev, ...c } : c);
              }
            }
            // Place local-only (newly added) items first, followed by remote items in order
            const localOnlyContribs = localContribs.filter(
              (c) => c && c.id && !deletedContribSet.has(c.id) && !remoteContribIds.has(c.id)
            );
            const mergedContribs: MemberContribution[] = [
              ...localOnlyContribs,
              ...remoteContribs
                .filter((c) => c && c.id && !deletedContribSet.has(c.id))
                .map((c) => mergedContribsMap.get(c.id) || c),
            ];

            const localOps = getStoredOperations(cleanTenant);
            const remoteOps: FinancialOperation[] = Array.isArray(rec.operations) ? rec.operations : [];
            const remoteOpIds = new Set(remoteOps.map((o) => o?.id).filter(Boolean));

            const mergedOpsMap = new Map<string, FinancialOperation>();
            for (const o of localOps) {
              if (o && o.id && !deletedOpSet.has(o.id)) {
                mergedOpsMap.set(o.id, o);
              }
            }
            for (const o of remoteOps) {
              if (o && o.id && !deletedOpSet.has(o.id)) {
                const prev = mergedOpsMap.get(o.id);
                mergedOpsMap.set(o.id, prev ? { ...prev, ...o } : o);
              }
            }
            const localOnlyOps = localOps.filter(
              (o) =>
                o &&
                o.id &&
                !deletedOpSet.has(o.id) &&
                !remoteOpIds.has(o.id) &&
                !o.isUnpaidContributionDeduction &&
                !String(o.id).startsWith('op-unpaid-deduction-')
            );
            const mergedOps: FinancialOperation[] = [
              ...localOnlyOps,
              ...remoteOps
                .filter((o) => o && o.id && !deletedOpSet.has(o.id))
                .map((o) => mergedOpsMap.get(o.id) || o),
            ];

            const reconciled = reconcileUnpaidContributionDeductions(mergedContribs, mergedOps, cleanTenant);
            saveContributions(reconciled.reconciledContributions, cleanTenant, false);
            saveOperations(reconciled.reconciledOperations, cleanTenant, false);
            result.contributions = reconciled.reconciledContributions;
            result.operations = reconciled.reconciledOperations;

            // If local had unsynced items or reconciliation created missing links, persist back to backend & Firestore
            if (localOnlyContribs.length > 0 || localOnlyOps.length > 0 || reconciled.didChange) {
              saveContributionsAndOperations(
                reconciled.reconciledContributions,
                reconciled.reconciledOperations,
                cleanTenant
              ).catch(() => {});
            }
          }
          if (Array.isArray(rec.registrationFields)) {
            const localFieldsTs = getRegistrationFieldsTimestamp(cleanTenant);
            const remoteFieldsTs = rec.updatedAt ? new Date(rec.updatedAt).getTime() : 0;
            if (localFieldsTs > remoteFieldsTs + 2000) {
              const localFields = getStoredRegistrationFields(cleanTenant);
              result.registrationFields = localFields;
              persistTenantCollectionToBackend('registrationFields', localFields, cleanTenant).catch(() => {});
            } else {
              const normalizedRemoteFields = ensureMandatoryPasswordFields(rec.registrationFields);
              saveRegistrationFields(normalizedRemoteFields, cleanTenant, false);
              if (remoteFieldsTs > 0) {
                setRegistrationFieldsTimestamp(remoteFieldsTs, cleanTenant);
              }
              result.registrationFields = normalizedRemoteFields;
            }
          }
          if (Array.isArray(data.globalRegistrationFields)) {
            const localMasterTs = getRegistrationFieldsTimestamp('tenant_nour');
            const remoteTs = rec.updatedAt ? new Date(rec.updatedAt).getTime() : 0;
            if (localMasterTs <= remoteTs + 2000) {
              saveData(GLOBAL_REGISTRATION_FIELDS_KEY, ensureMandatoryPasswordFields(data.globalRegistrationFields));
            }
          }
          if (Array.isArray(rec.auditLogs)) {
            saveAuditLogs(rec.auditLogs, cleanTenant, false);
            result.auditLogs = rec.auditLogs;
          }
          if (Array.isArray(rec.subAdmins)) {
            const localSubs = getStoredSubAdmins(cleanTenant);
            const subMap = new Map<string, SubAdmin>();
            for (const s of [...localSubs, ...rec.subAdmins]) {
              if (s && s.id) {
                const prev = subMap.get(s.id);
                subMap.set(s.id, prev ? { ...prev, ...s } : s);
              }
            }
            const mergedSubs = Array.from(subMap.values());
            saveSubAdmins(mergedSubs, false, cleanTenant);
            (result as any).subAdmins = mergedSubs;
          }
        }
      }
    }

    if (cardRes && cardRes.ok) {
      const cardData = await cardRes.json();
      if (cardData?.success && cardData.settings) {
        const mergedCard: MemberCardSettings = {
          ...getStoredMemberCardSettings(cleanTenant),
          ...cardData.settings,
        };
        saveMemberCardSettings(mergedCard, cleanTenant, false);
        result.memberCardSettings = mergedCard;
      }
    }
  } catch (err) {
    console.warn('[Storage] syncTenantRecordsFromBackend warning:', err);
  }

  return result;
};

export const getStoredLoggedInMemberId = (tenantId?: string): string | null => {
  const current = tenantId || getActiveTenantIdFromStorage();
  return loadData<string | null>(getScopedKey(KEYS.LOGGED_IN_MEMBER_ID, current), null);
};
export const saveLoggedInMemberId = (memberId: string | null, tenantId?: string) => 
  saveData(getScopedKey(KEYS.LOGGED_IN_MEMBER_ID, tenantId), memberId);
export const clearLoggedInMemberId = (tenantId?: string) => 
  localStorage.removeItem(getScopedKey(KEYS.LOGGED_IN_MEMBER_ID, tenantId));

export const getSubAdminsTimestamp = (): number => {
  try {
    return Number(localStorage.getItem('chayef_assoc_subadmins_ts_v1')) || 0;
  } catch {
    return 0;
  }
};

export const setSubAdminsTimestamp = (ts: number = Date.now()): void => {
  try {
    localStorage.setItem('chayef_assoc_subadmins_ts_v1', String(ts));
  } catch {}
};

export const getDeletedSubAdminIds = (tenantId?: string): string[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !current || current === 'portal' ? 'tenant_nour' : current;
  return loadData<string[]>(`chayef_deleted_subadmins_${cleanTenant}_v1`, []);
};

export const recordDeletedSubAdminId = (adminId: string, tenantId?: string): void => {
  if (!adminId) return;
  const current = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !current || current === 'portal' ? 'tenant_nour' : current;
  const existing = getDeletedSubAdminIds(cleanTenant);
  if (!existing.includes(adminId)) {
    saveData(`chayef_deleted_subadmins_${cleanTenant}_v1`, [...existing, adminId]);
  }
};

export const getStoredSubAdmins = (tenantId?: string): SubAdmin[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !current || current === 'portal' ? 'tenant_nour' : current;
  const isMaster = cleanTenant === 'tenant_nour';
  const deletedSet = new Set(getDeletedSubAdminIds(cleanTenant));
  const primary = loadData<SubAdmin[]>(getScopedKey(KEYS.SUB_ADMINS, cleanTenant), isMaster ? initialSubAdmins : []);
  const altKey = `chayef_tenant_${cleanTenant}_sub_admins`;
  const secondary = loadData<SubAdmin[]>(altKey, []);

  const map = new Map<string, SubAdmin>();
  const baseSeed = isMaster ? initialSubAdmins : [];
  for (const item of [...baseSeed, ...(secondary || []), ...(primary || [])]) {
    if (item && item.id && !deletedSet.has(item.id)) {
      let enriched = item;
      if (!enriched.username && isMaster) {
        const seedMatch = initialSubAdmins.find((s) => s.id === enriched.id);
        if (seedMatch?.username) {
          enriched = { ...enriched, username: seedMatch.username };
        }
      }
      const existing = map.get(enriched.id);
      map.set(enriched.id, existing ? { ...existing, ...enriched } : enriched);
    }
  }
  return Array.from(map.values());
};

export const saveSubAdmins = (subAdmins: SubAdmin[], updateTimestamp: boolean = true, tenantId?: string) => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !current || current === 'portal' ? 'tenant_nour' : current;
  saveData(getScopedKey(KEYS.SUB_ADMINS, cleanTenant), subAdmins);
  try {
    saveData(`chayef_tenant_${cleanTenant}_sub_admins`, subAdmins);
  } catch {}
  if (updateTimestamp) {
    setSubAdminsTimestamp();
    persistTenantCollectionToBackend('subAdmins', subAdmins, cleanTenant).catch(() => {});
  }
};

export const saveStoredSubAdmins = saveSubAdmins;

export const getStoredCurrentAdminSession = (tenantId?: string): CurrentAdminSession | null => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const direct = loadData<CurrentAdminSession | null>(getScopedKey(KEYS.CURRENT_ADMIN_SESSION, current), null);
  if (direct) return direct;
  try {
    const altKey = (!current || current === 'tenant_nour' || current === 'portal')
      ? 'chayef_assoc_current_admin_session_v1'
      : `chayef_tenant_${current}_current_admin_session`;
    return loadData<CurrentAdminSession | null>(altKey, null);
  } catch {
    return null;
  }
};

export const saveCurrentAdminSession = (session: CurrentAdminSession | null, tenantId?: string) => {
  const current = tenantId || getActiveTenantIdFromStorage();
  saveData(getScopedKey(KEYS.CURRENT_ADMIN_SESSION, current), session);
  try {
    const altKey = (!current || current === 'tenant_nour' || current === 'portal')
      ? 'chayef_assoc_current_admin_session_v1'
      : `chayef_tenant_${current}_current_admin_session`;
    saveData(altKey, session);
  } catch {}
};

export const clearCurrentAdminSession = (tenantId?: string) => {
  const activeTenant = getActiveTenantIdFromStorage();
  const targets = Array.from(
    new Set([tenantId, activeTenant, 'tenant_nour'].filter(Boolean) as string[])
  );
  try {
    for (const t of targets) {
      localStorage.removeItem(getScopedKey(KEYS.CURRENT_ADMIN_SESSION, t));
      localStorage.removeItem(`chayef_tenant_${t}_current_admin_session`);
      localStorage.removeItem(`chayef_assoc_current_admin_session_v1__${t}`);
    }
    localStorage.removeItem('chayef_assoc_current_admin_session_v1');
    localStorage.setItem(KEYS.ROLE, JSON.stringify('member'));
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('chayef_assoc_current_admin_session_v1');
    }
  } catch {}
};

// ==================== CAMPAIGNS & CONTRIBUTIONS STORAGE ====================

export const recalculateCampaignsFromContributions = (
  campaigns: DonationCampaign[],
  contributions: CampaignContribution[]
): DonationCampaign[] => {
  return campaigns.map((camp) => {
    // Filter contributions for this campaign that are financial and approved/completed (not pending, unpaid, or negative)
    const campContribs = contributions.filter(
      (c) =>
        c.campaignId === camp.id &&
        c.isFinancial &&
        c.status !== 'pending' &&
        c.status !== 'unpaid' &&
        c.status !== 'rejected' &&
        !c.isNegative &&
        c.amountSign !== '-'
    );
    const collected = campContribs.reduce(
      (sum, c) => sum + (Number(c.amount) || 0),
      0
    );
    const rawPct = camp.targetAmount > 0 ? (collected / camp.targetAmount) * 100 : 0;
    // Calculate progress percentage precisely (rounded to 1 decimal place)
    const progressPercentage = Math.round(rawPct * 10) / 10;

    // Automatic status update if completed and not allowed overfunding
    let status = camp.status;
    if (status === 'active' && collected >= camp.targetAmount && !camp.allowOverfunding) {
      status = 'completed';
    }

    return {
      ...camp,
      isVisibleOnStore: camp.isVisibleOnStore !== false,
      collectedAmount: collected,
      progressPercentage,
      status,
    };
  });
};

export const getStoredContributionTypes = (tenantId?: string): ContributionTypeConfig[] => {
  // 1. Prioritize globally managed Contribution Types from Global Platform Admin
  const globalTypes = getGlobalContributionTypes();
  if (globalTypes && globalTypes.length > 0) {
    return globalTypes;
  }

  const current = tenantId || getActiveTenantIdFromStorage();
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';

  // Read the approved model's latest contribution types from tenant_nour as the reference
  const masterKey = getScopedKey(KEYS.CONTRIBUTION_TYPES, 'tenant_nour');
  const masterTypes = loadData<ContributionTypeConfig[]>(masterKey, initialContributionTypes);

  const key = getScopedKey(KEYS.CONTRIBUTION_TYPES, current);
  const loaded = loadData<ContributionTypeConfig[]>(key, isMaster ? initialContributionTypes : masterTypes);

  return (loaded || []).filter((t) => !t.isDeleted);
};

export const saveContributionTypes = (types: ContributionTypeConfig[], tenantId?: string) => {
  // Sync globally to ensure central platform management reflects across all tenants
  saveGlobalContributionTypes(types);
  const current = tenantId || getActiveTenantIdFromStorage();
  return saveData(getScopedKey(KEYS.CONTRIBUTION_TYPES, current), types);
};

export const getStoredDonationPresets = (tenantId?: string): number[] => {
  // 1. Prioritize globally managed active donation preset amounts from Global Platform Admin
  const globalActive = getGlobalActivePresetAmounts();
  if (globalActive && globalActive.length > 0) {
    return globalActive;
  }

  const current = tenantId || getActiveTenantIdFromStorage();
  return loadData<number[]>(getScopedKey(KEYS.DONATION_PRESETS, current), DEFAULT_DONATION_PRESETS);
};

export const saveDonationPresets = (presets: number[], tenantId?: string) => {
  const current = tenantId || getActiveTenantIdFromStorage();
  return saveData(getScopedKey(KEYS.DONATION_PRESETS, current), presets);
};

export const getStoredCampaignContributions = (tenantId?: string): CampaignContribution[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';
  const list = loadData<CampaignContribution[]>(getScopedKey(KEYS.CAMPAIGN_CONTRIBUTIONS, current), isMaster ? initialCampaignContributions : []);
  const targetTenant = current === 'portal' ? 'tenant_nour' : current;
  return (list || []).filter((c) => {
    if (!c) return false;
    if (c.tenantId && targetTenant && c.tenantId !== targetTenant) return false;
    if (c.associationId && targetTenant && c.associationId !== targetTenant) return false;
    return true;
  });
};

export const saveCampaignContributions = (contributions: CampaignContribution[], tenantId?: string) => {
  const current = tenantId || getActiveTenantIdFromStorage();
  saveData(getScopedKey(KEYS.CAMPAIGN_CONTRIBUTIONS, current), contributions);
  // Auto-sync campaigns amounts when contributions change
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';
  const currentCampaigns = loadData<DonationCampaign[]>(getScopedKey(KEYS.CAMPAIGNS, current), isMaster ? initialCampaigns : []);
  const updatedCampaigns = recalculateCampaignsFromContributions(currentCampaigns, contributions);
  saveData(getScopedKey(KEYS.CAMPAIGNS, current), updatedCampaigns);
};

export const getStoredCampaigns = (tenantId?: string): DonationCampaign[] => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const isMaster = !current || current === 'tenant_nour' || current === 'portal';
  const initKey = `chayef_tenant_${current}_campaigns_initialized`;
  const wasInitialized = typeof window !== 'undefined' && localStorage.getItem(initKey) === 'true';
  const key = getScopedKey(KEYS.CAMPAIGNS, current);

  let loaded: DonationCampaign[] | null = null;
  if (typeof window !== 'undefined') {
    const item = localStorage.getItem(key);
    if (item !== null) {
      try {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) {
          loaded = parsed;
        }
      } catch (err) {
        console.error('Error parsing stored campaigns:', err);
      }
    }
  }

  if (loaded === null || (Array.isArray(loaded) && loaded.length === 0)) {
    let tenantMeta: any = null;
    if (current && current !== 'tenant_nour' && current !== 'portal') {
      try {
        const allTenantsRaw = localStorage.getItem('chayef_all_tenants_v2');
        if (allTenantsRaw) {
          const allTenants = JSON.parse(allTenantsRaw);
          if (Array.isArray(allTenants)) {
            tenantMeta = allTenants.find((t: any) => t.id === current);
          }
        }
      } catch {}
    }

    const fallback: DonationCampaign[] = isMaster
      ? initialCampaigns
      : [
          {
            id: `camp_${current}_1`,
            title: tenantMeta ? `دعم ومساندة مشاريع ${tenantMeta.name}` : 'مشروع كفالة الأيتام والرعاية الاجتماعية',
            description: tenantMeta ? `المساهمة في تمويل المشاريع الخيرية والتنموية والأنشطة الإنسانية لـ ${tenantMeta.name}.` : 'مشروع خيري وتنموي يستهدف تقديم الرعاية الاجتماعية والدعم للمستفيدين.',
            targetProject: 'مشاريع وأنشطة الجمعية الخيرية',
            targetAmount: 50000,
            collectedAmount: 0,
            progressPercentage: 0,
            coverImage: tenantMeta?.logoUrl || tenantMeta?.bannerImageUrl || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
            startDate: new Date().toISOString().slice(0, 10),
            endDate: '',
            status: 'active',
            allowOverfunding: true,
            isVisibleOnStore: true,
            createdAt: new Date().toISOString(),
            tenantId: current,
            associationId: current,
            associationName: tenantMeta?.name || 'الجمعية',
          },
          {
            id: `camp_${current}_2`,
            title: tenantMeta ? `مبادرة القوافل الإنسانية والإغاثية لـ ${tenantMeta.name}` : 'مبادرة القوافل التضامنية',
            description: 'توفير المساعدات العاجلة والسلال الغذائية والدعم الميداني للأسر المعوزة والمحتاجين.',
            targetProject: 'مشاريع القوافل التضامنية والتنموية',
            targetAmount: 30000,
            collectedAmount: 0,
            progressPercentage: 0,
            coverImage: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80',
            startDate: new Date().toISOString().slice(0, 10),
            endDate: '',
            status: 'active',
            allowOverfunding: true,
            isVisibleOnStore: true,
            createdAt: new Date().toISOString(),
            tenantId: current,
            associationId: current,
            associationName: tenantMeta?.name || 'الجمعية',
          }
        ];
    saveData(key, fallback);
    loaded = fallback;
    if (typeof window !== 'undefined') {
      localStorage.setItem(initKey, 'true');
    }
  }

  const deletedIds = getDeletedCampaignIds(current);
  const filtered = (loaded || []).filter((c) => c && c.id && !deletedIds.includes(c.id)).map((c) => ({
    ...c,
    tenantId: c.tenantId || current,
    associationId: c.associationId || current,
  }));
  const contributions = getStoredCampaignContributions(current);
  return recalculateCampaignsFromContributions(filtered, contributions);
};

export const saveCampaigns = (campaigns: DonationCampaign[], tenantId?: string) => {
  const current = tenantId || getActiveTenantIdFromStorage();
  if (typeof window !== 'undefined') {
    localStorage.setItem(`chayef_tenant_${current}_campaigns_initialized`, 'true');
  }
  const contributions = getStoredCampaignContributions(current);
  const recalculated = recalculateCampaignsFromContributions(campaigns, contributions);
  saveData(getScopedKey(KEYS.CAMPAIGNS, current), recalculated);
  firestoreSyncService.syncCampaignsToFirestore(current, recalculated).catch((err) => {
    console.warn('[Storage] Firestore sync campaigns notice:', err);
  });
};

export const VOTING_RESTRICTED_MESSAGE =
  'التصويت متاح فقط لأعضاء مكتب الجمعية والمنخرطين فيها. يُرجى الانخراط في الجمعية لتتمكن من المشاركة في التصويت على القرارات.';

export interface VoteResult {
  success: boolean;
  message: string;
  polls: Poll[];
  poll?: Poll;
}

// Record or update member / board member vote (with strict membership verification)
export const recordPollVote = (
  pollId: string,
  newVote: PollVote,
  tenantId?: string
): VoteResult => {
  const activeTenant = tenantId || getActiveTenantIdFromStorage();
  const currentPolls = getStoredPolls(activeTenant);
  const targetPoll = currentPolls.find((p) => p.id === pollId);

  if (!targetPoll) {
    return {
      success: false,
      message: 'التصويت المطلوب غير موجود.',
      polls: currentPolls,
    };
  }

  // Verify membership / board member authorization in the target association
  const members = getStoredMembers(activeTenant);
  const boardMembers = getStoredBoardMembers(activeTenant);
  const loggedInMemberId = getStoredLoggedInMemberId(activeTenant);
  const adminSession = getStoredCurrentAdminSession(activeTenant);
  const currentRole = loadData<string>(KEYS.ROLE, 'member');

  const isAuthenticatedActiveMember =
    !!loggedInMemberId &&
    loggedInMemberId === newVote.memberId &&
    members.some((m) => m.id === loggedInMemberId && m.status === 'active');

  const isAuthenticatedBoardOrAdmin =
    currentRole === 'admin' &&
    !!adminSession &&
    (!adminSession.tenantId ||
      adminSession.tenantId === activeTenant ||
      (activeTenant === 'tenant_nour' && adminSession.tenantId === 'portal') ||
      adminSession.isMasterPlatformAdmin === true) &&
    (boardMembers.some((bm) => bm.id === newVote.memberId || bm.memberId === newVote.memberId) ||
      members.some((m) => m.id === newVote.memberId && m.status === 'active') ||
      newVote.memberId === (adminSession.id || 'board_admin'));

  if (!isAuthenticatedActiveMember && !isAuthenticatedBoardOrAdmin) {
    return {
      success: false,
      message: VOTING_RESTRICTED_MESSAGE,
      polls: currentPolls,
    };
  }

  if (targetPoll.status !== 'active') {
    return {
      success: false,
      message: targetPoll.status === 'paused' ? 'هذا التصويت متوقف مؤقتًا حاليًا.' : 'هذا التصويت مغلق نهائيًا.',
      polls: currentPolls,
    };
  }

  const existingIndex = (targetPoll.votes || []).findIndex(
    (v) => v.memberId === newVote.memberId || (newVote.memberCode && v.memberCode === newVote.memberCode)
  );

  if (existingIndex >= 0 && !targetPoll.allowVoteChange) {
    return {
      success: false,
      message: 'تم تسجيل تصويتك مسبقًا، والإدارة لا تتيح تعديل الصوت لهذا القرار.',
      polls: currentPolls,
      poll: targetPoll,
    };
  }

  let updatedTargetPoll: Poll | undefined;

  const updatedPolls = currentPolls.map((poll) => {
    if (poll.id !== pollId) return poll;

    let updatedVotes: PollVote[];
    const votes = poll.votes || [];

    if (existingIndex >= 0) {
      updatedVotes = [...votes];
      updatedVotes[existingIndex] = newVote;
    } else {
      updatedVotes = [...votes, newVote];
    }

    updatedTargetPoll = {
      ...poll,
      votes: updatedVotes,
    };

    return updatedTargetPoll;
  });

  savePolls(updatedPolls, activeTenant);

  return {
    success: true,
    message: existingIndex >= 0 ? 'تم تعديل تصويتك بنجاح!' : 'تم تسجيل وتوثيق تصويتك بنجاح!',
    polls: updatedPolls,
    poll: updatedTargetPoll,
  };
};

// Log Audit Action
export const addAuditLog = (
  action: AuditLog['action'],
  targetType: AuditLog['targetType'],
  description: string,
  performedBy: string = 'إدارة الجمعية',
  adminType?: 'super_admin' | 'sub_admin',
  adminPhone?: string,
  tenantId?: string
) => {
  const current = tenantId || getActiveTenantIdFromStorage();
  const currentLogs = getStoredAuditLogs(current);
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    action,
    targetType,
    description,
    performedBy,
    adminType,
    adminPhone,
  };
  const updatedLogs = [newLog, ...currentLogs];
  saveAuditLogs(updatedLogs, current);
  return updatedLogs;
};

// Reset to initial factory data
export const resetToDefaults = () => {
  saveMembers(initialMembers);
  saveBoardMembers(initialBoardMembers);
  saveContributions(initialContributions);
  saveOperations(initialOperations);
  saveActivities(initialActivities);
  saveRegistrationFields(initialRegistrationFields);
  saveUIElements(initialUIElements);
  savePolls(initialPolls);
  saveMemberCardSettings(initialMemberCardSettings);
  saveSubAdmins(initialSubAdmins);
  saveContributionTypes(initialContributionTypes);
  saveDonationPresets(DEFAULT_DONATION_PRESETS);
  saveCampaignContributions(initialCampaignContributions);
  saveCampaigns(initialCampaigns);
  saveAuditLogs([
    {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'update',
      targetType: 'settings',
      description: 'استعادة البيانات النموذجية الأولية للجمعية',
      performedBy: 'إدارة النظام',
      adminType: 'super_admin',
    },
    ...initialAuditLogs,
  ]);
  saveSettings(initialSettings);
};

// Export all data as downloadable JSON
export const exportBackupJSON = () => {
  const currentSettings = getStoredSettings();
  const data = {
    app: currentSettings.name ? `${currentSettings.name} - syoumax` : 'syoumax منصة العمل الجمعوي',
    exportedAt: new Date().toISOString(),
    settings: currentSettings,
    memberCardSettings: getStoredMemberCardSettings(),
    registrationFields: getStoredRegistrationFields(),
    uiElements: getStoredUIElements(),
    polls: getStoredPolls(),
    members: getStoredMembers(),
    boardMembers: getStoredBoardMembers(),
    contributions: getStoredContributions(),
    operations: getStoredOperations(),
    activities: getStoredActivities(),
    campaigns: getStoredCampaigns(),
    campaignContributions: getStoredCampaignContributions(),
    contributionTypes: getStoredContributionTypes(),
    donationPresets: getStoredDonationPresets(),
    subAdmins: getStoredSubAdmins(),
    auditLogs: getStoredAuditLogs(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chayef_association_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// CSV Export for financials
export const exportOperationsCSV = (operations: FinancialOperation[]) => {
  const headers = ['رقم المعاملة', 'البيان', 'النوع', 'الفئة', 'المبلغ (د.م)', 'التاريخ', 'المسؤول'];
  const rows = operations.map((op) => [
    `"${op.code}"`,
    `"${op.title.replace(/"/g, '""')}"`,
    `"${op.type === 'income' ? 'مدخول / اشتراك' : 'مصروف خيري'}"`,
    `"${op.category}"`,
    `"${op.amount}"`,
    `"${op.date}"`,
    `"${op.addedBy || 'إدارة الجمعية'}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `سجل_العمليات_المالية_syoumax_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
