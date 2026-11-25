import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import {
  initialMembers,
  initialBoardMembers,
  initialContributions,
  initialOperations,
  initialRegistrationFields,
  initialAuditLogs,
  initialSubAdmins,
} from '../initialData';
import {
  DATA_DIR,
  ensureStorageDirectories,
  normalizeTenantId,
  offloadEmbeddedMediaDeep,
  readJsonFileSync,
  writeJsonFileAtomicSync,
  readLargeJsonBody,
} from './storageEngine';
import {
  syncTenantCollectionToFirebaseServer,
  saveDocToFirebaseServer,
  getDocFromFirebaseServer,
  fetchTenantCollectionFromFirebaseServer,
  awaitPendingOffloadBackups,
  saveSingleTenantDocToFirebaseServer,
  deleteDocFromFirebaseServer,
} from './firebaseServerStorage';
import {
  verifyAuthSessionToken,
  extractBearerTokenFromHeaders,
} from './authCrypto';

const tenantRecordsCloudReconcileCache = new Map<string, number>();
const TENANT_RECORDS_RECONCILE_TTL_MS = 2000;
const COLD_SEED_EPOCH = '1970-01-01T00:00:00.000Z';

interface TenantRecordsAccess {
  authenticated: boolean;
  role: 'master_super_admin' | 'admin' | 'sub_admin' | 'member' | 'visitor';
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isActiveMember: boolean;
  canViewBoardMembers: boolean;
  subjectId: string;
}

function readDiskSubAdminsForAuthCheck(tenantId: string, db: TenantRecordsDatabase): any[] {
  const result: any[] = [];
  if (Array.isArray(db.subAdmins)) {
    result.push(...db.subAdmins);
  }
  try {
    const subFile = path.join(DATA_DIR, 'subadmins_database.json');
    if (fs.existsSync(subFile)) {
      const parsed = readJsonFileSync<any>(subFile, null);
      if (parsed && Array.isArray(parsed.subAdmins)) {
        for (const s of parsed.subAdmins) {
          if (s && s.id && (!s.tenantId || normalizeTenantId(s.tenantId) === tenantId)) {
            result.push(s);
          }
        }
      }
    }
  } catch {}
  return result;
}

function resolveTenantRecordsAccess(
  req: IncomingMessage,
  targetTenant: string,
  db: TenantRecordsDatabase
): TenantRecordsAccess {
  const visitor: TenantRecordsAccess = {
    authenticated: false,
    role: 'visitor',
    isAdmin: false,
    isSuperAdmin: false,
    isActiveMember: false,
    canViewBoardMembers: false,
    subjectId: '',
  };

  const token = extractBearerTokenFromHeaders(req.headers as Record<string, any>);
  const payload = verifyAuthSessionToken(token);
  if (!payload) {
    return visitor;
  }

  const tokenTenant = payload.tenantId === '*' ? '*' : normalizeTenantId(payload.tenantId);

  if (payload.role === 'master_super_admin') {
    return {
      authenticated: true,
      role: 'master_super_admin',
      isAdmin: true,
      isSuperAdmin: true,
      isActiveMember: false,
      canViewBoardMembers: true,
      subjectId: payload.subjectId || 'master',
    };
  }

  if (payload.role === 'admin') {
    if (tokenTenant !== targetTenant) {
      return visitor;
    }
    return {
      authenticated: true,
      role: 'admin',
      isAdmin: true,
      isSuperAdmin: true,
      isActiveMember: false,
      canViewBoardMembers: true,
      subjectId: payload.subjectId || 'admin',
    };
  }

  if (payload.role === 'sub_admin') {
    if (tokenTenant !== targetTenant) {
      return visitor;
    }
    const allSubs = readDiskSubAdminsForAuthCheck(targetTenant, db);
    const matchedSub = allSubs.find((s: any) => s && s.id === payload.subjectId);
    if (!matchedSub || matchedSub.status !== 'active') {
      return visitor;
    }
    return {
      authenticated: true,
      role: 'sub_admin',
      isAdmin: true,
      isSuperAdmin: matchedSub.role === 'main_admin',
      isActiveMember: false,
      canViewBoardMembers: true,
      subjectId: matchedSub.id,
    };
  }

  if (payload.role === 'member') {
    if (tokenTenant !== targetTenant) {
      return visitor;
    }
    const liveMember = (Array.isArray(db.members) ? db.members : []).find(
      (m: any) => m && m.id === payload.subjectId
    );
    if (!liveMember || liveMember.status !== 'active') {
      return visitor;
    }
    return {
      authenticated: true,
      role: 'member',
      isAdmin: false,
      isSuperAdmin: false,
      isActiveMember: true,
      canViewBoardMembers: true,
      subjectId: liveMember.id,
    };
  }

  return visitor;
}

function sanitizeRecordsForCaller(
  db: TenantRecordsDatabase,
  access: TenantRecordsAccess
): TenantRecordsDatabase {
  if (access.canViewBoardMembers) {
    return db;
  }
  return {
    ...db,
    boardMembers: [],
  };
}

const MEMBER_SELF_EDITABLE_FIELDS = new Set<string>([
  'fullName',
  'phone',
  'email',
  'cin',
  'city',
  'address',
  'profession',
  'avatarUrl',
  'photoUrl',
  'bio',
  'customFields',
  'passwordHash',
  'passwordSalt',
  'lastLoginDate',
  'updatedAt',
]);

function pickMemberSelfEditableFields(incoming: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = {};
  for (const key of Object.keys(incoming || {})) {
    if (MEMBER_SELF_EDITABLE_FIELDS.has(key)) {
      safe[key] = incoming[key];
    }
  }
  return safe;
}

export interface TenantRecordsDatabase {
  tenantId: string;
  members: any[];
  boardMembers: any[];
  contributions: any[];
  operations: any[];
  registrationFields: any[];
  auditLogs: any[];
  subAdmins: any[];
  adCampaigns: any[];
  deletedOperationIds?: string[];
  deletedContributionIds?: string[];
  updatedAt: string;
}

const GLOBAL_REGISTRATION_FIELDS_FILE = path.join(DATA_DIR, 'global_registration_fields.json');

function getTenantRecordsFile(tenantId?: string | null): string {
  const clean = normalizeTenantId(tenantId);
  if (clean === 'tenant_nour') {
    return path.join(DATA_DIR, 'tenant_records_database.json');
  }
  return path.join(DATA_DIR, `tenant_records_database_${clean}.json`);
}

function ensureMandatoryRegistrationPasswordFields(fields: any[]): any[] {
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
          type: f.type || 'text',
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
          type: f.type || 'password',
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
          type: f.type || 'password',
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
    const toInsert: any[] = [];
    if (!hasPassword && passwordTemplate) toInsert.push({ ...passwordTemplate });
    if (!hasConfirmPassword && confirmPasswordTemplate) toInsert.push({ ...confirmPasswordTemplate });
    result.splice(insertIdx, 0, ...toInsert);
  }

  if (!hasUsername || !hasPassword || !hasConfirmPassword) {
    result = result.map((f, idx) => ({ ...f, order: idx + 1 }));
  }

  return result;
}

export function readGlobalRegistrationFieldsFromDisk(): any[] {
  ensureStorageDirectories();
  if (fs.existsSync(GLOBAL_REGISTRATION_FIELDS_FILE)) {
    const parsed = readJsonFileSync<any>(GLOBAL_REGISTRATION_FIELDS_FILE, () => null);
    if (parsed && Array.isArray(parsed.registrationFields) && parsed.registrationFields.length > 0) {
      return ensureMandatoryRegistrationPasswordFields(parsed.registrationFields);
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      return ensureMandatoryRegistrationPasswordFields(parsed);
    }
  }
  return ensureMandatoryRegistrationPasswordFields([...initialRegistrationFields]);
}

export function writeGlobalRegistrationFieldsToDisk(fields: any[], syncFirestore: boolean = true): any[] {
  ensureStorageDirectories();
  const normalized = ensureMandatoryRegistrationPasswordFields(fields);
  const updatedAt = new Date().toISOString();
  writeJsonFileAtomicSync(
    GLOBAL_REGISTRATION_FIELDS_FILE,
    {
      registrationFields: normalized,
      updatedAt,
    },
    'global_registration_fields'
  );
  if (syncFirestore) {
    saveDocToFirebaseServer('settings', 'global_registration_fields', {
      tenantId: 'global',
      registrationFields: normalized,
      _updatedAt: updatedAt,
    }).catch(() => {});
  }
  return normalized;
}

function sanitizeMembersArray(members: any[]): any[] {
  if (!Array.isArray(members)) return [];
  const defaultMemberUsernames: Record<string, string> = {
    m1: 'chayef24',
    m2: 'fatima24',
    m3: 'omart24',
    m4: 'khadija24',
    m5: 'youssef24',
    m6: 'hassan24',
    m7: 'souad24',
    m8: 'fael2024',
  };
  return members.map((m) => {
    if (!m || typeof m !== 'object') return m;
    const copy = { ...m };
    if (!copy.username) {
      copy.username = defaultMemberUsernames[copy.id] || `member${String(copy.id).replace(/\D/g, '') || '01'}24`;
    }
    delete copy.password;
    delete copy.confirmPassword;
    if (copy.customFields && typeof copy.customFields === 'object') {
      const cf = { ...copy.customFields };
      delete cf.password;
      delete cf.confirmPassword;
      copy.customFields = Object.keys(cf).length > 0 ? cf : undefined;
    }
    return copy;
  });
}

function createInitialTenantRecords(tenantId: string): TenantRecordsDatabase {
  const isMaster = tenantId === 'tenant_nour';
  return {
    tenantId,
    members: isMaster ? sanitizeMembersArray([...initialMembers]) : [],
    boardMembers: isMaster ? [...initialBoardMembers] : [],
    contributions: isMaster ? [...initialContributions] : [],
    operations: isMaster ? [...initialOperations] : [],
    registrationFields: readGlobalRegistrationFieldsFromDisk(),
    auditLogs: isMaster ? [...initialAuditLogs] : [],
    subAdmins: isMaster ? [...initialSubAdmins] : [],
    adCampaigns: [],
    updatedAt: COLD_SEED_EPOCH,
  };
}

function reconcileServerUnpaidContributionsAndOperations(
  contributions: any[],
  operations: any[],
  tenantId: string,
  deletedOperationIds: string[] = [],
  deletedContributionIds: string[] = []
): {
  contributions: any[];
  operations: any[];
  removedOperationIds: string[];
  didChange: boolean;
} {
  const cleanTenant = normalizeTenantId(tenantId);
  let didChange = false;
  const removedOperationIds: string[] = [];
  const deletedOpSet = new Set(
    deletedOperationIds.filter((id) => Boolean(id) && !String(id).startsWith('op-unpaid-deduction-'))
  );
  const deletedContribSet = new Set(deletedContributionIds.filter(Boolean));

  const isUnpaid = (status?: string | null) => status === 'approved' || status === 'unpaid';
  const isUnpaidRecord = (c: any) => {
    if (!c || typeof c !== 'object') return false;
    if (c.status === 'rejected') return false;
    const ps = String(c.paymentStatus || '').trim().toLowerCase();
    return (
      isUnpaid(c.status) ||
      c.isNegative === true ||
      c.amountSign === '-' ||
      ps === 'unpaid' ||
      ps === 'not_paid'
    );
  };
  const unpaidMap = new Map<string, any>();

  // 1. Normalize and filter contributions
  const baseContribs: any[] = [];
  const seenContribIds = new Set<string>();
  for (const rawC of Array.isArray(contributions) ? contributions : []) {
    if (!rawC || typeof rawC !== 'object' || !rawC.id) continue;
    if (deletedContribSet.has(rawC.id)) {
      didChange = true;
      continue;
    }
    if (seenContribIds.has(rawC.id)) continue;
    seenContribIds.add(rawC.id);
    if (rawC.tenantId !== cleanTenant || rawC.associationId !== cleanTenant) {
      didChange = true;
    }
    baseContribs.push({
      ...rawC,
      tenantId: rawC.tenantId || cleanTenant,
      associationId: rawC.associationId || cleanTenant,
    });
  }

  // 2. Normalize and filter operations
  const baseOps: any[] = [];
  const seenOpIds = new Set<string>();
  for (const rawOp of Array.isArray(operations) ? operations : []) {
    if (!rawOp || typeof rawOp !== 'object' || !rawOp.id) continue;
    if (deletedOpSet.has(rawOp.id)) {
      didChange = true;
      removedOperationIds.push(rawOp.id);
      continue;
    }
    if (seenOpIds.has(rawOp.id)) continue;
    seenOpIds.add(rawOp.id);
    if (rawOp.tenantId !== cleanTenant || rawOp.associationId !== cleanTenant) {
      didChange = true;
    }
    baseOps.push({
      ...rawOp,
      tenantId: rawOp.tenantId || cleanTenant,
      associationId: rawOp.associationId || cleanTenant,
    });
  }

  // 3. Ensure every financial contribution (amount > 0, not rejected, not initial aggregated op-inc-1/op-inc-2) has its income operation in baseOps
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

  // 4. Ensure every income FinancialOperation (resources, financial aid, donations, membership fees) has a corresponding MemberContribution in «سجل المساهمات والانخراطات»
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

  const reconciledContribs = baseContribs.map((c) => {
    if (!c || typeof c !== 'object') return c;
    const deductionOpId = `op-unpaid-deduction-${c.id}`;
    if (isUnpaidRecord(c) && Number(c.amount) > 0) {
      const normalizedUnpaid = {
        ...c,
        status: 'unpaid',
        isNegative: true,
        amountSign: '-',
        paymentStatus: 'unpaid',
        isPaid: false,
        unpaidDeductionOperationId: deductionOpId,
      };
      unpaidMap.set(c.id, normalizedUnpaid);
      if (
        c.status !== 'unpaid' ||
        c.isNegative !== true ||
        c.amountSign !== '-' ||
        c.paymentStatus !== 'unpaid' ||
        c.isPaid !== false ||
        c.unpaidDeductionOperationId !== deductionOpId
      ) {
        didChange = true;
        return normalizedUnpaid;
      }
      return c;
    } else {
      const hasPendingPaymentDrift =
        c.status === 'completed' &&
        (String(c.paymentStatus || '').trim().toLowerCase() === 'pending' || c.isPaid === false);
      if (c.unpaidDeductionOperationId || hasPendingPaymentDrift) {
        didChange = true;
        const clone = {
          ...c,
          ...(hasPendingPaymentDrift ? { status: 'pending' } : {}),
        };
        delete clone.unpaidDeductionOperationId;
        return clone;
      }
      return c;
    }
  });

  const seenDeductionForContrib = new Set<string>();
  const nextOps: any[] = [];

  for (const op of baseOps) {
    if (!op || typeof op !== 'object') continue;
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

    const matchingUnpaid = unpaidMap.get(linkedId);
    if (!matchingUnpaid || seenDeductionForContrib.has(linkedId)) {
      didChange = true;
      if (op.id) removedOperationIds.push(op.id);
      continue;
    }

    seenDeductionForContrib.add(linkedId);
    const expectedAmount = Number(matchingUnpaid.amount) || 0;
    const expectedTitle = `خصم مساهمة لم يتم دفعها: ${matchingUnpaid.memberName} (${matchingUnpaid.memberCode})`;
    const expectedDesc = `خصم تلقائي من الرصيد المالي للجمعية بسبب تغيير حالة المساهمة (${matchingUnpaid.id}) إلى «لم يتم الدفع» للمنخرط ${matchingUnpaid.memberName}`;

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

  for (const [contribId, c] of unpaidMap.entries()) {
    if (!seenDeductionForContrib.has(contribId)) {
      didChange = true;
      const deductionOpId = `op-unpaid-deduction-${contribId}`;
      const shortCode = String(contribId).replace(/^contrib-/, '').slice(-6).toUpperCase();
      nextOps.unshift({
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
      });
    }
  }

  // Recompute running balanceAfter chronologically
  const sortedOps = [...nextOps].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  );
  let runningBalance = 0;
  const processedOps = sortedOps.map((op) => {
    const amt = Number(op.amount) || 0;
    if (op.type === 'income') {
      runningBalance += amt;
    } else {
      runningBalance -= amt;
    }
    return {
      ...op,
      balanceAfter: runningBalance,
    };
  });

  return {
    contributions: reconciledContribs,
    operations: processedOps,
    removedOperationIds,
    didChange,
  };
}

export function readTenantRecordsFromDisk(tenantId?: string | null): TenantRecordsDatabase {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const filePath = getTenantRecordsFile(cleanTenant);

  if (fs.existsSync(filePath)) {
    const parsed = readJsonFileSync<any>(filePath, () => null);
    if (parsed && typeof parsed === 'object') {
      const rawDeletedOperationIds = Array.isArray(parsed.deletedOperationIds) ? parsed.deletedOperationIds : [];
      const deletedOperationIds = rawDeletedOperationIds.filter(
        (id: any) => Boolean(id) && !String(id).startsWith('op-unpaid-deduction-')
      );
      const didStripAutoDeletedOps = deletedOperationIds.length !== rawDeletedOperationIds.length;
      const deletedContributionIds = Array.isArray(parsed.deletedContributionIds) ? parsed.deletedContributionIds : [];
      const reconciled = reconcileServerUnpaidContributionsAndOperations(
        Array.isArray(parsed.contributions) ? parsed.contributions : [],
        Array.isArray(parsed.operations) ? parsed.operations : [],
        cleanTenant,
        deletedOperationIds,
        deletedContributionIds
      );
      let parsedSubAdmins = Array.isArray(parsed.subAdmins) ? parsed.subAdmins : [];
      let didSubAdminsChange = false;
      if (cleanTenant === 'tenant_nour') {
        const subMap = new Map<string, any>();
        for (const seed of initialSubAdmins) {
          if (seed && seed.id) {
            subMap.set(seed.id, { ...seed, tenantId: seed.tenantId || 'tenant_nour' });
          }
        }
        for (const existing of parsedSubAdmins) {
          if (existing && existing.id) {
            const prev = subMap.get(existing.id);
            subMap.set(existing.id, prev ? { ...prev, ...existing } : existing);
          }
        }
        const mergedSubs = Array.from(subMap.values());
        if (mergedSubs.length !== parsedSubAdmins.length) {
          parsedSubAdmins = mergedSubs;
          didSubAdminsChange = true;
        }
      }

      const dbObj: TenantRecordsDatabase = {
        tenantId: cleanTenant,
        members: sanitizeMembersArray(Array.isArray(parsed.members) ? parsed.members : []),
        boardMembers: Array.isArray(parsed.boardMembers) ? parsed.boardMembers : [],
        contributions: reconciled.contributions,
        operations: reconciled.operations,
        registrationFields: ensureMandatoryRegistrationPasswordFields(
          Array.isArray(parsed.registrationFields) && parsed.registrationFields.length > 0
            ? parsed.registrationFields
            : readGlobalRegistrationFieldsFromDisk()
        ),
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        subAdmins: parsedSubAdmins,
        adCampaigns: Array.isArray(parsed.adCampaigns) ? parsed.adCampaigns : [],
        deletedOperationIds,
        deletedContributionIds,
        updatedAt: parsed.updatedAt || COLD_SEED_EPOCH,
      };
      if (reconciled.didChange || didSubAdminsChange || didStripAutoDeletedOps) {
        writeTenantRecordsToDisk(dbObj, cleanTenant, false, true);
      }
      return dbObj;
    }
  }

  const seeded = createInitialTenantRecords(cleanTenant);
  writeTenantRecordsToDisk(seeded, cleanTenant, false, true);
  return seeded;
}

export function writeTenantRecordsToDisk(
  db: TenantRecordsDatabase,
  tenantId?: string | null,
  syncFirestore: boolean = false,
  preserveTimestamp: boolean = false
): TenantRecordsDatabase {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId || db.tenantId);
  const filePath = getTenantRecordsFile(cleanTenant);

  const deletedOperationIds = (Array.isArray(db.deletedOperationIds) ? db.deletedOperationIds : []).filter(
    (id) => Boolean(id) && !String(id).startsWith('op-unpaid-deduction-')
  );
  const deletedContributionIds = Array.isArray(db.deletedContributionIds) ? db.deletedContributionIds : [];

  const reconciled = reconcileServerUnpaidContributionsAndOperations(
    db.contributions,
    db.operations,
    cleanTenant,
    deletedOperationIds,
    deletedContributionIds
  );

  const nextUpdatedAt = preserveTimestamp && db.updatedAt ? db.updatedAt : new Date().toISOString();

  const sanitizedDb = offloadEmbeddedMediaDeep(
    {
      ...db,
      members: sanitizeMembersArray(db.members),
      contributions: reconciled.contributions,
      operations: reconciled.operations,
      registrationFields: ensureMandatoryRegistrationPasswordFields(db.registrationFields),
      deletedOperationIds,
      deletedContributionIds,
      tenantId: cleanTenant,
      updatedAt: nextUpdatedAt,
    },
    `record_${cleanTenant}`
  );

  writeJsonFileAtomicSync(filePath, sanitizedDb, `record_${cleanTenant}`);
  if (nextUpdatedAt !== COLD_SEED_EPOCH) {
    tenantRecordsCloudReconcileCache.set(cleanTenant, Date.now());
  }

  if (syncFirestore) {
    syncTenantCollectionToFirebaseServer('members', cleanTenant, sanitizedDb.members, [], {
      reconcileDeletions: true,
    }).catch(() => {});
    syncTenantCollectionToFirebaseServer('board_members', cleanTenant, sanitizedDb.boardMembers || [], [], {
      reconcileDeletions: true,
    }).catch(() => {});
    syncTenantCollectionToFirebaseServer(
      'contributions',
      cleanTenant,
      sanitizedDb.contributions,
      deletedContributionIds,
      { reconcileDeletions: true }
    ).catch(() => {});
    syncTenantCollectionToFirebaseServer(
      'operations',
      cleanTenant,
      sanitizedDb.operations,
      Array.from(new Set([...reconciled.removedOperationIds, ...deletedOperationIds])),
      { reconcileDeletions: true }
    ).catch(() => {});
    if (Array.isArray(sanitizedDb.subAdmins)) {
      syncTenantCollectionToFirebaseServer('sub_admins', cleanTenant, sanitizedDb.subAdmins, [], {
        reconcileDeletions: sanitizedDb.subAdmins.length > 0,
      }).catch(() => {});
    }
    saveDocToFirebaseServer('settings', `${cleanTenant}_registration_fields`, {
      tenantId: cleanTenant,
      registrationFields: sanitizedDb.registrationFields,
      _updatedAt: sanitizedDb.updatedAt,
    }).catch(() => {});
    saveDocToFirebaseServer('settings', `${cleanTenant}_records_meta`, {
      tenantId: cleanTenant,
      updatedAt: sanitizedDb.updatedAt,
      _updatedAt: sanitizedDb.updatedAt,
      deletedOperationIds,
      deletedContributionIds,
    }).catch(() => {});
  }

  return sanitizedDb;
}

export async function writeTenantRecordsToDiskAndCloud(
  db: TenantRecordsDatabase,
  tenantId?: string | null,
  touchedCollections?: Set<string>
): Promise<TenantRecordsDatabase> {
  const cleanTenant = normalizeTenantId(tenantId || db.tenantId);
  const saved = writeTenantRecordsToDisk(db, cleanTenant, false, false);
  const deletedOperationIds = Array.isArray(saved.deletedOperationIds) ? saved.deletedOperationIds : [];
  const deletedContributionIds = Array.isArray(saved.deletedContributionIds) ? saved.deletedContributionIds : [];

  const syncAll = !touchedCollections || touchedCollections.size === 0;
  const tasks: Promise<any>[] = [awaitPendingOffloadBackups()];

  if (syncAll || touchedCollections.has('members')) {
    tasks.push(
      syncTenantCollectionToFirebaseServer('members', cleanTenant, saved.members || [], [], {
        reconcileDeletions: true,
      })
    );
  }
  if (syncAll || touchedCollections.has('boardMembers')) {
    tasks.push(
      syncTenantCollectionToFirebaseServer('board_members', cleanTenant, saved.boardMembers || [], [], {
        reconcileDeletions: true,
      })
    );
  }
  if (syncAll || touchedCollections.has('contributions') || touchedCollections.has('operations')) {
    tasks.push(
      syncTenantCollectionToFirebaseServer(
        'contributions',
        cleanTenant,
        saved.contributions || [],
        deletedContributionIds,
        { reconcileDeletions: true }
      )
    );
    tasks.push(
      syncTenantCollectionToFirebaseServer(
        'operations',
        cleanTenant,
        saved.operations || [],
        deletedOperationIds,
        { reconcileDeletions: true }
      )
    );
  }
  if ((syncAll || touchedCollections.has('subAdmins')) && Array.isArray(saved.subAdmins)) {
    tasks.push(
      syncTenantCollectionToFirebaseServer('sub_admins', cleanTenant, saved.subAdmins, [], {
        reconcileDeletions: saved.subAdmins.length > 0,
      })
    );
  }
  if (syncAll || touchedCollections.has('registrationFields')) {
    tasks.push(
      saveDocToFirebaseServer('settings', `${cleanTenant}_registration_fields`, {
        tenantId: cleanTenant,
        registrationFields: saved.registrationFields,
        _updatedAt: saved.updatedAt,
      })
    );
  }

  tasks.push(
    saveDocToFirebaseServer('settings', `${cleanTenant}_records_meta`, {
      tenantId: cleanTenant,
      updatedAt: saved.updatedAt,
      _updatedAt: saved.updatedAt,
      deletedOperationIds,
      deletedContributionIds,
    })
  );

  await Promise.all(tasks);
  return saved;
}

export async function reconcileTenantRecordsFromCloudFirestore(
  tenantId: string,
  force = false
): Promise<TenantRecordsDatabase> {
  const cleanTenant = normalizeTenantId(tenantId);
  const localDb = readTenantRecordsFromDisk(cleanTenant);
  const isColdLocal = localDb.updatedAt === COLD_SEED_EPOCH;
  const lastCheck = tenantRecordsCloudReconcileCache.get(cleanTenant) || 0;
  if (!force && !isColdLocal && Date.now() - lastCheck < TENANT_RECORDS_RECONCILE_TTL_MS) {
    return localDb;
  }
  tenantRecordsCloudReconcileCache.set(cleanTenant, Date.now());

  try {
    const [
      cloudMembers,
      cloudBoard,
      cloudOps,
      cloudContribs,
      cloudSubAdmins,
      cloudGlobalFields,
      cloudTenantFields,
      cloudMeta,
    ] = await Promise.all([
      fetchTenantCollectionFromFirebaseServer<any>('members', cleanTenant),
      fetchTenantCollectionFromFirebaseServer<any>('board_members', cleanTenant),
      fetchTenantCollectionFromFirebaseServer<any>('operations', cleanTenant),
      fetchTenantCollectionFromFirebaseServer<any>('contributions', cleanTenant),
      fetchTenantCollectionFromFirebaseServer<any>('sub_admins', cleanTenant),
      getDocFromFirebaseServer<any>('settings', 'global_registration_fields'),
      getDocFromFirebaseServer<any>('settings', `${cleanTenant}_registration_fields`),
      getDocFromFirebaseServer<any>('settings', `${cleanTenant}_records_meta`),
    ]);

    const localTs = isColdLocal ? 0 : new Date(localDb.updatedAt || 0).getTime();
    const metaTs = cloudMeta ? new Date(cloudMeta._updatedAt || cloudMeta.updatedAt || 0).getTime() : 0;
    const isMetaNewer = metaTs > localTs;

    let changed = false;
    const nextDb: TenantRecordsDatabase = { ...localDb };
    let newestTs = localTs;

    if (cloudMeta && Array.isArray(cloudMeta.deletedOperationIds)) {
      const mergedDelOps = Array.from(
        new Set([...(nextDb.deletedOperationIds || []), ...cloudMeta.deletedOperationIds])
      );
      if (mergedDelOps.length !== (nextDb.deletedOperationIds || []).length) {
        nextDb.deletedOperationIds = mergedDelOps;
        changed = true;
      }
    }
    if (cloudMeta && Array.isArray(cloudMeta.deletedContributionIds)) {
      const mergedDelContribs = Array.from(
        new Set([...(nextDb.deletedContributionIds || []), ...cloudMeta.deletedContributionIds])
      );
      if (mergedDelContribs.length !== (nextDb.deletedContributionIds || []).length) {
        nextDb.deletedContributionIds = mergedDelContribs;
        changed = true;
      }
    }

    const getMaxTs = (arr: any[]) => {
      let max = 0;
      for (const item of arr || []) {
        const ts = new Date(item?._updatedAt || item?.updatedAt || item?.createdAt || 0).getTime();
        if (ts > max) max = ts;
      }
      return max;
    };

    const membersMax = getMaxTs(cloudMembers);
    if (
      Array.isArray(cloudMembers) &&
      (cloudMembers.length > 0 || isMetaNewer) &&
      (isColdLocal || membersMax > localTs || isMetaNewer)
    ) {
      if (cloudMembers.length > 0 || isMetaNewer) {
        nextDb.members = sanitizeMembersArray(cloudMembers);
        if (membersMax > newestTs) newestTs = membersMax;
        changed = true;
      }
    }

    const boardMax = getMaxTs(cloudBoard);
    if (
      Array.isArray(cloudBoard) &&
      (cloudBoard.length > 0 || isMetaNewer) &&
      (isColdLocal || boardMax > localTs || isMetaNewer)
    ) {
      if (cloudBoard.length > 0 || isMetaNewer) {
        nextDb.boardMembers = cloudBoard;
        if (boardMax > newestTs) newestTs = boardMax;
        changed = true;
      }
    }

    const opsMax = getMaxTs(cloudOps);
    if (
      Array.isArray(cloudOps) &&
      (cloudOps.length > 0 || isMetaNewer) &&
      (isColdLocal || opsMax > localTs || isMetaNewer)
    ) {
      if (cloudOps.length > 0 || isMetaNewer) {
        nextDb.operations = cloudOps;
        if (opsMax > newestTs) newestTs = opsMax;
        changed = true;
      }
    }

    const contribsMax = getMaxTs(cloudContribs);
    if (Array.isArray(cloudContribs) && (cloudContribs.length > 0 || isMetaNewer)) {
      if (isColdLocal) {
        nextDb.contributions = cloudContribs;
        if (contribsMax > newestTs) newestTs = contribsMax;
        changed = true;
      } else if (cloudContribs.length > 0) {
        const deletedContribSet = new Set(nextDb.deletedContributionIds || []);
        const itemTs = (it: any) =>
          Math.max(
            new Date(it?.updatedAt || 0).getTime() || 0,
            new Date(it?._updatedAt || 0).getTime() || 0,
            new Date(it?.createdAt || 0).getTime() || 0
          );
        const localById = new Map<string, any>();
        for (const lc of nextDb.contributions || []) {
          if (lc && lc.id && !deletedContribSet.has(lc.id)) {
            localById.set(lc.id, lc);
          }
        }
        const mergedById = new Map<string, any>(localById);
        let contribsChanged = false;
        for (const cc of cloudContribs) {
          if (!cc || !cc.id || deletedContribSet.has(cc.id)) continue;
          const localItem = localById.get(cc.id);
          if (!localItem) {
            mergedById.set(cc.id, cc);
            contribsChanged = true;
          } else {
            const cTs = itemTs(cc);
            const lTs = itemTs(localItem);
            if (cTs > lTs || (cTs === lTs && isMetaNewer && cc.status !== localItem.status)) {
              mergedById.set(cc.id, cc);
              contribsChanged = true;
            }
          }
        }
        if (contribsChanged) {
          nextDb.contributions = Array.from(mergedById.values());
          if (contribsMax > newestTs) newestTs = contribsMax;
          changed = true;
        }
      } else if (isMetaNewer) {
        nextDb.contributions = [];
        changed = true;
      }
    }

    const subsMax = getMaxTs(cloudSubAdmins);
    if (
      Array.isArray(cloudSubAdmins) &&
      cloudSubAdmins.length > 0 &&
      (isColdLocal || subsMax > localTs || isMetaNewer)
    ) {
      nextDb.subAdmins = cloudSubAdmins;
      if (subsMax > newestTs) newestTs = subsMax;
      changed = true;
    }

    const tenantFieldsTs = cloudTenantFields ? new Date(cloudTenantFields._updatedAt || 0).getTime() : 0;
    const globalFieldsTs = cloudGlobalFields ? new Date(cloudGlobalFields._updatedAt || 0).getTime() : 0;
    if (
      cloudTenantFields &&
      Array.isArray(cloudTenantFields.registrationFields) &&
      cloudTenantFields.registrationFields.length > 0 &&
      (isColdLocal || tenantFieldsTs > localTs) &&
      tenantFieldsTs >= globalFieldsTs
    ) {
      nextDb.registrationFields = ensureMandatoryRegistrationPasswordFields(cloudTenantFields.registrationFields);
      if (tenantFieldsTs > newestTs) newestTs = tenantFieldsTs;
      changed = true;
    } else if (
      cloudGlobalFields &&
      Array.isArray(cloudGlobalFields.registrationFields) &&
      cloudGlobalFields.registrationFields.length > 0 &&
      (isColdLocal || globalFieldsTs > localTs)
    ) {
      nextDb.registrationFields = ensureMandatoryRegistrationPasswordFields(cloudGlobalFields.registrationFields);
      writeGlobalRegistrationFieldsToDisk(nextDb.registrationFields, false);
      if (globalFieldsTs > newestTs) newestTs = globalFieldsTs;
      changed = true;
    }

    if (metaTs > newestTs) newestTs = metaTs;

    if (changed) {
      nextDb.updatedAt = newestTs > 0 ? new Date(newestTs).toISOString() : new Date().toISOString();
      return writeTenantRecordsToDisk(nextDb, cleanTenant, false, true);
    }
  } catch {}

  return localDb;
}

export function propagateRegistrationFieldsToAllTenantsOnDisk(fields: any[]): any[] {
  ensureStorageDirectories();
  const normalized = writeGlobalRegistrationFieldsToDisk(fields, true);

  const tenantIds = new Set<string>(['tenant_nour']);

  try {
    const tenantsDbFile = path.join(DATA_DIR, 'tenants_database.json');
    if (fs.existsSync(tenantsDbFile)) {
      const parsedTenants = readJsonFileSync<any>(tenantsDbFile, () => null);
      const list = Array.isArray(parsedTenants?.tenants)
        ? parsedTenants.tenants
        : Array.isArray(parsedTenants)
        ? parsedTenants
        : [];
      for (const t of list) {
        if (t && t.id) {
          tenantIds.add(normalizeTenantId(t.id));
        }
      }
    }
  } catch {}

  try {
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      for (const file of files) {
        if (file.startsWith('tenant_records_database_') && file.endsWith('.json')) {
          const extracted = file
            .replace(/^tenant_records_database_/, '')
            .replace(/\.json$/, '');
          if (extracted) {
            tenantIds.add(normalizeTenantId(extracted));
          }
        }
      }
    }
  } catch {}

  for (const tId of tenantIds) {
    try {
      const existing = readTenantRecordsFromDisk(tId);
      existing.registrationFields = normalized;
      writeTenantRecordsToDisk(existing, tId, true);
    } catch (err) {
      console.warn(`[tenantRecordsApiHandler] Warning propagating registrationFields to ${tId}:`, err);
    }
  }

  return normalized;
}

function sendJson(res: ServerResponse, statusCode: number, data: any): boolean {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id, x-user-role, x-member-id');
  res.end(JSON.stringify(data));
  return true;
}

export async function handleTenantRecordsApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url || '').split('?')[0].replace(/\/$/, '') || '/';
  if (!url.startsWith('/api/tenant-records')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id, x-user-role, x-member-id');
    res.end();
    return true;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  } catch {
    parsedUrl = new URL('http://localhost' + (req.url || ''));
  }

  const headerTenant = (req.headers['x-tenant-id'] as string | undefined)?.trim();
  const queryTenant = parsedUrl.searchParams.get('tenantId')?.trim();
  const tenantId = normalizeTenantId(headerTenant || queryTenant);
  const method = req.method?.toUpperCase();

  try {
    const forceCloud = parsedUrl.searchParams.get('force') === 'true';

    // 1. GET /api/tenant-records -> Fetch all persistent records for the tenant (reconciled with Cloud Firestore)
    if (method === 'GET' && url === '/api/tenant-records') {
      const db = await reconcileTenantRecordsFromCloudFirestore(tenantId, forceCloud);
      const access = resolveTenantRecordsAccess(req, tenantId, db);
      const safeDb = sanitizeRecordsForCaller(db, access);
      const globalRegistrationFields = readGlobalRegistrationFieldsFromDisk();
      return sendJson(res, 200, {
        success: true,
        tenantId,
        records: safeDb,
        globalRegistrationFields,
        updatedAt: db.updatedAt,
      });
    }

    // 1.5 PATCH or POST /api/tenant-records/contributions/:id/status -> Atomic persistent status update for a single contribution
    const contribStatusMatch = url.match(/^\/api\/tenant-records\/contributions\/([^/]+)\/status$/);
    if (contribStatusMatch && (method === 'PATCH' || method === 'POST' || method === 'PUT')) {
      const contribId = decodeURIComponent(contribStatusMatch[1]).trim();
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body?.tenantId || tenantId);

      // Verified Bearer Token Admin Authorization & Tenant Isolation Check
      const authDb = await reconcileTenantRecordsFromCloudFirestore(targetTenant, false);
      const access = resolveTenantRecordsAccess(req, targetTenant, authDb);
      if (!access.isAdmin) {
        return sendJson(res, 403, {
          success: false,
          error: 'Access Denied (403 Forbidden): غير مصرح لك بتعديل حالة المساهمات والانخراطات.',
        });
      }

      const validStatuses = new Set(['completed', 'pending', 'approved', 'unpaid', 'rejected']);
      const nextStatus = String(body?.status || '').trim();
      if (!validStatuses.has(nextStatus)) {
        return sendJson(res, 400, {
          success: false,
          error: 'قيمة الحالة غير صالحة.',
        });
      }

      let current = await reconcileTenantRecordsFromCloudFirestore(targetTenant, false);
      const findTargetIdx = (list: any[]) =>
        (list || []).findIndex(
          (c: any) =>
            c &&
            (c.id === contribId ||
              c.id === `contrib-don-${contribId}` ||
              c.financialOperationId === `op-camp-${contribId}`)
        );
      let targetIdx = findTargetIdx(current.contributions);
      if (targetIdx === -1) {
        current = await reconcileTenantRecordsFromCloudFirestore(targetTenant, true);
        targetIdx = findTargetIdx(current.contributions);
      }

      if (targetIdx === -1) {
        return sendJson(res, 404, {
          success: false,
          error: 'تعذر العثور على سجل المساهمة المطلوب في قاعدة البيانات.',
        });
      }

      const existingContrib = current.contributions[targetIdx];
      const resolvedContribId = String(existingContrib.id || contribId);
      const isUnpaid = (st?: string | null) => st === 'approved' || st === 'unpaid';
      const existingPaymentStatus = String(existingContrib.paymentStatus || '').trim().toLowerCase();
      const wasUnpaid =
        existingContrib.status !== 'rejected' &&
        (isUnpaid(existingContrib.status) ||
          existingContrib.isNegative === true ||
          existingContrib.amountSign === '-' ||
          existingPaymentStatus === 'unpaid' ||
          existingPaymentStatus === 'not_paid');
      const isNowUnpaid = isUnpaid(nextStatus);
      const isNowNegative = isNowUnpaid || nextStatus === 'rejected';
      const nextAmountSign: '+' | '-' = isNowNegative ? '-' : '+';
      const nextPaymentStatus = isNowUnpaid
        ? 'unpaid'
        : nextStatus === 'completed'
        ? 'paid'
        : nextStatus === 'rejected'
        ? 'rejected'
        : 'pending';
      const nextIsPaid = nextStatus === 'completed' && !isNowNegative;
      const nowIso =
        typeof body?.updatedAt === 'string' && body.updatedAt.trim()
          ? body.updatedAt.trim()
          : new Date().toISOString();

      const updatedContrib = {
        ...existingContrib,
        status: nextStatus,
        isNegative: isNowNegative,
        amountSign: nextAmountSign,
        paymentStatus: nextPaymentStatus,
        isPaid: nextIsPaid,
        updatedAt: nowIso,
        _updatedAt: nowIso,
        tenantId: targetTenant,
        associationId: targetTenant,
      };

      const nextContributions = [...current.contributions];
      nextContributions[targetIdx] = updatedContrib;
      current.contributions = nextContributions;
      current.updatedAt = nowIso;

      // Save atomically to disk with the exact same timestamp (preserveTimestamp = true)
      const saved = writeTenantRecordsToDisk(current, targetTenant, false, true);
      const savedContrib =
        saved.contributions.find((c: any) => c && c.id === resolvedContribId) || updatedContrib;

      // Persist ONLY the modified contribution doc + records_meta to Cloud Firestore
      const cloudTasks: Promise<any>[] = [
        saveSingleTenantDocToFirebaseServer('contributions', targetTenant, savedContrib, nowIso, false),
        saveDocToFirebaseServer('settings', `${targetTenant}_records_meta`, {
          tenantId: targetTenant,
          updatedAt: nowIso,
          _updatedAt: nowIso,
          deletedOperationIds: saved.deletedOperationIds || [],
          deletedContributionIds: saved.deletedContributionIds || [],
        }),
      ];

      // Always keep Firestore unpaid deduction op consistent on any transition involving unpaid
      if (wasUnpaid !== isNowUnpaid || isNowUnpaid || !isNowUnpaid) {
        const deductionOpId = `op-unpaid-deduction-${resolvedContribId}`;
        if (isNowUnpaid) {
          const deductionOp = saved.operations.find((op: any) => op && op.id === deductionOpId);
          if (deductionOp) {
            cloudTasks.push(
              saveSingleTenantDocToFirebaseServer('operations', targetTenant, deductionOp, nowIso)
            );
          }
        } else if (wasUnpaid) {
          const docId = `${targetTenant}_${deductionOpId}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
          cloudTasks.push(deleteDocFromFirebaseServer('operations', docId));
        }
      }

      await Promise.all(cloudTasks);

      return sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        contribution: savedContrib,
        contributions: saved.contributions,
        operations: saved.operations,
        updatedAt: nowIso,
        message: 'تم تحديث وحفظ حالة المساهمة بشكل دائم في قاعدة البيانات بنجاح.',
      });
    }

    // 2. POST or PUT /api/tenant-records -> Save/Update one or more collections for the tenant
    if ((method === 'POST' || method === 'PUT') && url === '/api/tenant-records') {
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body.tenantId || tenantId);
      const current = await reconcileTenantRecordsFromCloudFirestore(targetTenant, true);

      // Authoritative Verified Token Role & Authorization Check (never trust spoofable headers alone)
      const access = resolveTenantRecordsAccess(req, targetTenant, current);
      const hasValidAdminSession = access.isAdmin;
      const isSuperAdminCaller = access.isSuperAdmin;
      const verifiedMemberId = access.isActiveMember ? access.subjectId : '';

      if (body.propagateToAllTenants === true && !isSuperAdminCaller) {
        return sendJson(res, 403, {
          success: false,
          error: 'Access Denied (403 Forbidden): تعديل إعدادات هذا القسم وتعميمه على جميع الجمعيات حصري للمدير العام للمنصة فقط.',
        });
      }

      const isRestrictedNonAdminCaller = !hasValidAdminSession;
      const adminOnlyCollections: Array<keyof TenantRecordsDatabase> = [
        'boardMembers',
        'registrationFields',
        'subAdmins',
        'adCampaigns',
      ];

      const validCollections: Array<keyof TenantRecordsDatabase> = [
        'members',
        'boardMembers',
        'contributions',
        'operations',
        'registrationFields',
        'auditLogs',
        'subAdmins',
        'adCampaigns',
      ];

      // Track explicit deletion IDs ONLY when caller is a verified admin
      const incomingDeletedOpIds: string[] = hasValidAdminSession
        ? [
            ...(Array.isArray(body.removedOperationIds) ? body.removedOperationIds : []),
            ...(Array.isArray(body.deletedOperationIds) ? body.deletedOperationIds : []),
          ].filter((id) => Boolean(id) && !String(id).startsWith('op-unpaid-deduction-'))
        : [];

      const incomingDeletedContribIds: string[] = hasValidAdminSession
        ? [
            ...(Array.isArray(body.removedContributionIds) ? body.removedContributionIds : []),
            ...(Array.isArray(body.deletedContributionIds) ? body.deletedContributionIds : []),
          ].filter(Boolean)
        : [];

      const mergedDeletedOpIds = Array.from(
        new Set([
          ...(current.deletedOperationIds || []).filter((id) => Boolean(id) && !String(id).startsWith('op-unpaid-deduction-')),
          ...incomingDeletedOpIds,
        ])
      );
      const mergedDeletedContribIds = Array.from(
        new Set([...(current.deletedContributionIds || []), ...incomingDeletedContribIds])
      );
      current.deletedOperationIds = mergedDeletedOpIds;
      current.deletedContributionIds = mergedDeletedContribIds;

      const deletedOpSet = new Set(mergedDeletedOpIds);
      const deletedContribSet = new Set(mergedDeletedContribIds);

      const applyCollectionUpdateSafely = (col: keyof TenantRecordsDatabase, incomingData: any[]) => {
        if (!Array.isArray(incomingData)) return;

        // Block non-admin sessions from modifying admin-only collections (boardMembers, registrationFields, subAdmins, adCampaigns)
        if (isRestrictedNonAdminCaller && adminOnlyCollections.includes(col)) {
          return;
        }

        // If caller is not a verified admin, protect existing records from deletion or unauthorized tampering
        if (isRestrictedNonAdminCaller) {
          if (col === 'members') {
            const existingMap = new Map<string, any>();
            for (const m of current.members || []) {
              if (m && m.id) existingMap.set(m.id, m);
            }
            for (const inc of incomingData) {
              if (!inc || !inc.id) continue;
              if (!existingMap.has(inc.id)) {
                // Allow public self-registration of a new member
                existingMap.set(inc.id, {
                  ...inc,
                  tenantId: targetTenant,
                  associationId: targetTenant,
                  updatedAt: new Date().toISOString(),
                });
              } else if (verifiedMemberId && inc.id === verifiedMemberId) {
                // Strict Member Self-Edit Whitelist: ONLY permitted personal fields may be modified by the verified member themselves
                const prev = existingMap.get(inc.id);
                const safePersonalFields = pickMemberSelfEditableFields(inc);
                existingMap.set(inc.id, {
                  ...prev,
                  ...safePersonalFields,
                  id: prev.id,
                  username: prev.username,
                  memberCode: prev.memberCode,
                  status: prev.status,
                  joinDate: prev.joinDate,
                  tenantId: prev.tenantId || targetTenant,
                  associationId: prev.associationId || targetTenant,
                  updatedAt: new Date().toISOString(),
                });
              }
            }
            current.members = Array.from(existingMap.values());
            return;
          }

          if (col === 'contributions' || col === 'operations' || col === 'auditLogs') {
            const existingList = Array.isArray((current as any)[col]) ? (current as any)[col] : [];
            const existingIds = new Set(existingList.map((item: any) => item?.id).filter(Boolean));
            const newItems = incomingData.filter((item: any) => item && item.id && !existingIds.has(item.id));
            (current as any)[col] = [...newItems, ...existingList];
            return;
          }
        }

        // CRITICAL FIX FOR PERMANENT PERSISTENCE OF FINANCIAL OPERATIONS, CONTRIBUTIONS & SUB-ADMINS:
        // Never allow a stale or partial client array to accidentally wipe out newly added financial records or sub-admins on disk!
        // Merge incoming items by ID (updating existing IDs and prepending new IDs), and only remove items if explicitly listed in deletedIds or if body.replaceAll === true.
        if ((col === 'contributions' || col === 'operations' || col === 'subAdmins') && body.replaceAll !== true) {
          const existingList: any[] = Array.isArray((current as any)[col]) ? (current as any)[col] : [];
          const delSet =
            col === 'operations'
              ? deletedOpSet
              : col === 'contributions'
              ? deletedContribSet
              : new Set<string>();

          const orderedResult: any[] = [];
          const addedIds = new Set<string>();

          // First place incoming items in their order (merging with existing properties if present)
          const existingById = new Map<string, any>();
          for (const ex of existingList) {
            if (ex && ex.id && !delSet.has(ex.id)) {
              existingById.set(ex.id, ex);
            }
          }

          const mergeNowIso = new Date().toISOString();
          for (const item of incomingData) {
            if (!item || !item.id || delSet.has(item.id) || addedIds.has(item.id)) continue;
            const prev = existingById.get(item.id);
            const statusChanged = Boolean(prev && col === 'contributions' && item.status !== prev.status);
            orderedResult.push(
              prev
                ? {
                    ...prev,
                    ...item,
                    ...(statusChanged ? { updatedAt: item.updatedAt || mergeNowIso, _updatedAt: mergeNowIso } : {}),
                    tenantId: item.tenantId || prev.tenantId || targetTenant,
                    associationId: item.associationId || prev.associationId || targetTenant,
                  }
                : {
                    ...item,
                    tenantId: item.tenantId || targetTenant,
                    associationId: item.associationId || targetTenant,
                  }
            );
            addedIds.add(item.id);
          }

          // Preserve any server-side items that were not in the incoming payload (unless explicitly deleted)
          for (const ex of existingList) {
            if (!ex || !ex.id || delSet.has(ex.id) || addedIds.has(ex.id)) continue;
            // Skip auto-deduction operations that will be freshly reconciled
            if (
              col === 'operations' &&
              (ex.isUnpaidContributionDeduction || String(ex.id).startsWith('op-unpaid-deduction-'))
            ) {
              continue;
            }
            orderedResult.push({
              ...ex,
              tenantId: ex.tenantId || targetTenant,
              associationId: ex.associationId || targetTenant,
            });
            addedIds.add(ex.id);
          }

          (current as any)[col] = orderedResult;
          return;
        }

        (current as any)[col] = incomingData;
      };

      const touchedCollections = new Set<string>();

      // 1. Support single collection update via `{ collection: 'members', data: [...] }` or `{ key: 'members', data: [...] }`
      const targetCollection = (body.collection || body.key) as keyof TenantRecordsDatabase | undefined;
      if (targetCollection && validCollections.includes(targetCollection) && Array.isArray(body.data)) {
        if (isRestrictedNonAdminCaller && adminOnlyCollections.includes(targetCollection)) {
          return sendJson(res, 403, {
            success: false,
            error: 'Access Denied (403 Forbidden): لا تملك صلاحية تعديل إعدادات أو سجلات لوحة تحكم الجمعية.',
          });
        }
        applyCollectionUpdateSafely(targetCollection, body.data);
        touchedCollections.add(String(targetCollection));
      }

      // 2. Support nested `{ records: { members: [...], ... } }`
      const sourceObj = body.records && typeof body.records === 'object' ? body.records : body;
      if (isRestrictedNonAdminCaller && Array.isArray(sourceObj?.boardMembers)) {
        return sendJson(res, 403, {
          success: false,
          error: 'Access Denied (403 Forbidden): تعديل أعضاء مكتب الجمعية مقتصر على إدارة الجمعية فقط.',
        });
      }
      for (const col of validCollections) {
        if (Array.isArray(sourceObj[col])) {
          if (isRestrictedNonAdminCaller && adminOnlyCollections.includes(col)) {
            continue;
          }
          applyCollectionUpdateSafely(col, sourceObj[col]);
          touchedCollections.add(String(col));
        }
      }

      if (body.propagateToAllTenants === true && isSuperAdminCaller && Array.isArray(current.registrationFields)) {
        current.registrationFields = propagateRegistrationFieldsToAllTenantsOnDisk(current.registrationFields);
      } else if (
        hasValidAdminSession &&
        targetTenant === 'tenant_nour' &&
        (targetCollection === 'registrationFields' || Array.isArray(sourceObj.registrationFields)) &&
        Array.isArray(current.registrationFields)
      ) {
        writeGlobalRegistrationFieldsToDisk(current.registrationFields, true);
      }

      const saved = await writeTenantRecordsToDiskAndCloud(current, targetTenant, touchedCollections);
      const safeSaved = sanitizeRecordsForCaller(saved, access);
      return sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        records: safeSaved,
        propagatedToAllTenants: Boolean(body.propagateToAllTenants),
        updatedAt: saved.updatedAt,
        message: 'تم حفظ بيانات وسجلات الجمعية في قاعدة البيانات السحابية بنجاح.',
      });
    }

    return sendJson(res, 404, { success: false, error: 'Tenant records endpoint not found' });
  } catch (err: any) {
    console.error('[tenantRecordsApiHandler] Error:', err);
    return sendJson(res, 500, {
      success: false,
      error: err?.message || 'خطأ في خادم سجلات الجمعية',
    });
  }
}
