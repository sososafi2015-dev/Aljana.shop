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
} from './firebaseServerStorage';

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
    updatedAt: new Date().toISOString(),
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
  const deletedOpSet = new Set(deletedOperationIds.filter(Boolean));
  const deletedContribSet = new Set(deletedContributionIds.filter(Boolean));

  const isUnpaid = (status?: string | null) => status === 'approved' || status === 'unpaid';
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
    if (isUnpaid(c.status) && Number(c.amount) > 0) {
      unpaidMap.set(c.id, c);
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
      const deletedOperationIds = Array.isArray(parsed.deletedOperationIds) ? parsed.deletedOperationIds : [];
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
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
      if (reconciled.didChange || didSubAdminsChange) {
        writeTenantRecordsToDisk(dbObj, cleanTenant);
      }
      return dbObj;
    }
  }

  const seeded = createInitialTenantRecords(cleanTenant);
  writeTenantRecordsToDisk(seeded, cleanTenant);
  return seeded;
}

export function writeTenantRecordsToDisk(
  db: TenantRecordsDatabase,
  tenantId?: string | null,
  syncFirestore: boolean = false
): TenantRecordsDatabase {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId || db.tenantId);
  const filePath = getTenantRecordsFile(cleanTenant);

  const deletedOperationIds = Array.isArray(db.deletedOperationIds) ? db.deletedOperationIds : [];
  const deletedContributionIds = Array.isArray(db.deletedContributionIds) ? db.deletedContributionIds : [];

  const reconciled = reconcileServerUnpaidContributionsAndOperations(
    db.contributions,
    db.operations,
    cleanTenant,
    deletedOperationIds,
    deletedContributionIds
  );

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
      updatedAt: new Date().toISOString(),
    },
    `record_${cleanTenant}`
  );

  writeJsonFileAtomicSync(filePath, sanitizedDb, `record_${cleanTenant}`);

  if (syncFirestore) {
    syncTenantCollectionToFirebaseServer('members', cleanTenant, sanitizedDb.members).catch(() => {});
    syncTenantCollectionToFirebaseServer(
      'contributions',
      cleanTenant,
      sanitizedDb.contributions,
      deletedContributionIds
    ).catch(() => {});
    syncTenantCollectionToFirebaseServer(
      'operations',
      cleanTenant,
      sanitizedDb.operations,
      Array.from(new Set([...reconciled.removedOperationIds, ...deletedOperationIds]))
    ).catch(() => {});
    if (Array.isArray(sanitizedDb.subAdmins) && sanitizedDb.subAdmins.length > 0) {
      syncTenantCollectionToFirebaseServer('sub_admins', cleanTenant, sanitizedDb.subAdmins).catch(() => {});
    }
    saveDocToFirebaseServer('settings', `${cleanTenant}_registration_fields`, {
      tenantId: cleanTenant,
      registrationFields: sanitizedDb.registrationFields,
      _updatedAt: sanitizedDb.updatedAt,
    }).catch(() => {});
  }

  return sanitizedDb;
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
    // 1. GET /api/tenant-records -> Fetch all persistent records for the tenant
    if (method === 'GET' && url === '/api/tenant-records') {
      const db = readTenantRecordsFromDisk(tenantId);
      const globalRegistrationFields = readGlobalRegistrationFieldsFromDisk();
      return sendJson(res, 200, {
        success: true,
        tenantId,
        records: db,
        globalRegistrationFields,
        updatedAt: db.updatedAt,
      });
    }

    // 2. POST or PUT /api/tenant-records -> Save/Update one or more collections for the tenant
    if ((method === 'POST' || method === 'PUT') && url === '/api/tenant-records') {
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body.tenantId || tenantId);
      const current = readTenantRecordsFromDisk(targetTenant);

      // Database-level Role & Authorization Check
      const callerRole = ((req.headers['x-user-role'] as string | undefined) || body.callerRole || '').trim();
      const callerMemberId = ((req.headers['x-member-id'] as string | undefined) || body.callerMemberId || '').trim();
      const adminSessionHeader = (req.headers['x-admin-session'] as string | undefined)?.trim();

      let hasValidAdminSession = callerRole === 'admin';
      let isSuperAdminCaller = false;
      if (adminSessionHeader) {
        try {
          const parsedAdmin = JSON.parse(decodeURIComponent(adminSessionHeader));
          if (
            parsedAdmin &&
            (parsedAdmin.isMaster === true ||
              parsedAdmin.isMasterPlatformAdmin === true ||
              parsedAdmin.type === 'super_admin' ||
              parsedAdmin.type === 'sub_admin' ||
              parsedAdmin.role === 'super_admin' ||
              parsedAdmin.role === 'main_admin' ||
              parsedAdmin.role === 'secondary_admin')
          ) {
            hasValidAdminSession = true;
          }
          if (
            parsedAdmin &&
            (parsedAdmin.isMaster === true ||
              parsedAdmin.isMasterPlatformAdmin === true ||
              parsedAdmin.type === 'super_admin' ||
              parsedAdmin.role === 'super_admin' ||
              parsedAdmin.role === 'main_admin') &&
            parsedAdmin.type !== 'sub_admin' &&
            parsedAdmin.role !== 'secondary_admin'
          ) {
            isSuperAdminCaller = true;
          }
        } catch {}
      }

      if (body.propagateToAllTenants === true && !isSuperAdminCaller) {
        return sendJson(res, 403, {
          success: false,
          error: 'Access Denied (403 Forbidden): تعديل إعدادات هذا القسم وتعميمه على جميع الجمعيات حصري للمدير العام للمنصة فقط.',
        });
      }

      const isRestrictedMemberCaller = callerRole === 'member' && !hasValidAdminSession;
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

      // Track any explicit deletion IDs sent by the client
      const incomingDeletedOpIds: string[] = [
        ...(Array.isArray(body.removedOperationIds) ? body.removedOperationIds : []),
        ...(Array.isArray(body.deletedOperationIds) ? body.deletedOperationIds : []),
      ].filter(Boolean);

      const incomingDeletedContribIds: string[] = [
        ...(Array.isArray(body.removedContributionIds) ? body.removedContributionIds : []),
        ...(Array.isArray(body.deletedContributionIds) ? body.deletedContributionIds : []),
      ].filter(Boolean);

      const mergedDeletedOpIds = Array.from(
        new Set([...(current.deletedOperationIds || []), ...incomingDeletedOpIds])
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

        // Block member-only sessions from modifying admin-only collections
        if (isRestrictedMemberCaller && adminOnlyCollections.includes(col)) {
          return;
        }

        // If caller is a member (not an admin), protect existing records from deletion or unauthorized tampering
        if (isRestrictedMemberCaller) {
          if (col === 'members') {
            const existingMap = new Map<string, any>();
            for (const m of current.members || []) {
              if (m && m.id) existingMap.set(m.id, m);
            }
            for (const inc of incomingData) {
              if (!inc || !inc.id) continue;
              if (!existingMap.has(inc.id)) {
                // Allow self-registration of a new member
                existingMap.set(inc.id, inc);
              } else if (!callerMemberId || inc.id === callerMemberId) {
                // Allow a member to update their own profile / password / lastLoginDate while preserving admin-managed status & code
                const prev = existingMap.get(inc.id);
                existingMap.set(inc.id, {
                  ...prev,
                  ...inc,
                  status: prev.status,
                  memberCode: prev.memberCode || inc.memberCode,
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

          const incomingById = new Map<string, any>();
          const orderedResult: any[] = [];
          const addedIds = new Set<string>();

          for (const item of incomingData) {
            if (!item || !item.id || delSet.has(item.id)) continue;
            incomingById.set(item.id, item);
          }

          // First place incoming items in their order (merging with existing properties if present)
          const existingById = new Map<string, any>();
          for (const ex of existingList) {
            if (ex && ex.id && !delSet.has(ex.id)) {
              existingById.set(ex.id, ex);
            }
          }

          for (const item of incomingData) {
            if (!item || !item.id || delSet.has(item.id) || addedIds.has(item.id)) continue;
            const prev = existingById.get(item.id);
            orderedResult.push(
              prev
                ? {
                    ...prev,
                    ...item,
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

      // 1. Support single collection update via `{ collection: 'members', data: [...] }` or `{ key: 'members', data: [...] }`
      const targetCollection = (body.collection || body.key) as keyof TenantRecordsDatabase | undefined;
      if (targetCollection && validCollections.includes(targetCollection) && Array.isArray(body.data)) {
        if (isRestrictedMemberCaller && adminOnlyCollections.includes(targetCollection)) {
          return sendJson(res, 403, {
            success: false,
            error: 'Access Denied (403 Forbidden): حساب المنخرط لا يملك صلاحية تعديل إعدادات أو سجلات لوحة تحكم الجمعية.',
          });
        }
        applyCollectionUpdateSafely(targetCollection, body.data);
      }

      // 2. Support nested `{ records: { members: [...], ... } }`
      const sourceObj = body.records && typeof body.records === 'object' ? body.records : body;
      for (const col of validCollections) {
        if (Array.isArray(sourceObj[col])) {
          applyCollectionUpdateSafely(col, sourceObj[col]);
        }
      }

      if (body.propagateToAllTenants === true && Array.isArray(current.registrationFields)) {
        current.registrationFields = propagateRegistrationFieldsToAllTenantsOnDisk(current.registrationFields);
      } else if (
        targetTenant === 'tenant_nour' &&
        (targetCollection === 'registrationFields' || Array.isArray(sourceObj.registrationFields)) &&
        Array.isArray(current.registrationFields)
      ) {
        writeGlobalRegistrationFieldsToDisk(current.registrationFields, true);
      }

      const saved = writeTenantRecordsToDisk(current, targetTenant, true);
      return sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        records: saved,
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
