import {
  MemberContribution,
  CampaignContribution,
  ContributionTypeConfig,
  PaymentMethodType,
  DonationCampaign,
  FinancialOperation,
} from '../types';
import { getAllGlobalContributionTypesIncludingDeleted } from '../contributionTypesStorage';
import { calculateFinancials } from '../storage';

export interface UnifiedTransparencyContribution {
  id: string;
  sourceType: 'campaign' | 'general' | 'membership';
  sourceMemberContributionId?: string;
  sourceCampaignContributionId?: string;
  amount: number;
  donorName: string;
  rawDonorName?: string;
  memberCode?: string;
  memberId?: string;
  isAnonymous: boolean;
  category: string;
  typeNameAr: string;
  campaignId?: string;
  campaignTitle?: string;
  date: string;
  time?: string;
  createdAt: string;
  status: 'completed' | 'approved' | 'pending' | 'unpaid' | 'rejected';
  isNegative: boolean;
  amountSign: '+' | '-';
  paymentMethod: PaymentMethodType;
  notes?: string;
  receiptNumber?: string;
  financialOperationId?: string;
  proofImageUrl?: string;
  receiptUrl?: string;
  tenantId: string;
  associationId?: string;
  isFinancial: boolean;
  isPaidCompleted?: boolean;
}

export interface TransparencyMetrics {
  totalApprovedAmount: number; // ONLY actually paid & completed contributions
  approvedCount: number;
  totalPendingAmount: number; // Pending amount shown separately
  pendingCount: number;
  totalUnpaidAmount: number; // Unpaid amount shown separately
  unpaidCount: number;
  rejectedCount: number;
  totalOperationsCount: number;
  campaignContributionsCount: number;
  generalContributionsCount: number;
  uniqueDonorsCount: number;
}

const UNPAID_STATUS_VALUES = new Set([
  'unpaid',
  'approved', // In platform schema & translations, 'approved' on contributions maps to «لم يتم الدفع»
  'not_paid',
  'unpaid_historical',
  'لم يتم الدفع',
  'غير مدفوع',
  'غير مدفوعة',
]);

const UNPAID_PAYMENT_STATUS_VALUES = new Set([
  'unpaid',
  'not_paid',
  'unpaid_historical',
  'failed',
  'refunded',
  'cancelled',
  'canceled',
  'rejected',
  'لم يتم الدفع',
  'غير مدفوع',
  'غير مدفوعة',
]);

const PENDING_STATUS_VALUES = new Set([
  'pending',
  'pending_payment',
  'pending_verification',
  'under_review',
  'in_review',
  'review',
  'قيد المراجعة',
  'قيد التحقق',
  'قيد المعالجة',
]);

const REJECTED_STATUS_VALUES = new Set([
  'rejected',
  'cancelled',
  'canceled',
  'ملغى',
  'ملغاة',
  'مرفوض',
  'مرفوضة',
]);

const PAID_COMPLETED_STATUS_VALUES = new Set([
  'completed',
  'paid',
  'confirmed',
  'verified',
  'settled',
  'مكتمل',
  'مكتملة',
  'مدفوع',
  'مدفوعة',
]);

type ContributionLikeRecord = {
  status?: string | null;
  paymentStatus?: string | null;
  payment_status?: string | null;
  isPaid?: boolean;
  paid?: boolean;
  isNegative?: boolean;
  amountSign?: '+' | '-' | string;
  amount?: number | string;
  isFinancial?: boolean;
};

/**
 * Resolves the true payment state of a contribution record strictly from its database payment fields and status.
 * Guarantees that «لم يتم الدفع» (unpaid / approved / isNegative / amountSign === '-' / paymentStatus === 'unpaid' / isPaid === false)
 * is NEVER treated as paid & completed.
 */
export function resolveActualPaymentState(
  record: ContributionLikeRecord | null | undefined,
  isTypeDeleted: boolean = false
): 'completed' | 'pending' | 'unpaid' | 'rejected' {
  if (!record) return 'unpaid';

  const rawStatus = String(record.status ?? '').trim().toLowerCase();
  const rawPaymentStatus = String(record.paymentStatus ?? record.payment_status ?? '').trim().toLowerCase();

  // 1. Explicit rejected/cancelled status (checked first so rejected items never inflate unpaid totals)
  if (REJECTED_STATUS_VALUES.has(rawStatus) || REJECTED_STATUS_VALUES.has(rawPaymentStatus)) {
    return 'rejected';
  }

  // 2. Explicit negative / deduction signs always indicate unpaid («لم يتم الدفع»)
  if (record.isNegative === true || record.amountSign === '-') {
    return 'unpaid';
  }

  // 3. Explicit paymentStatus field takes precedence over generic status when present
  if (rawPaymentStatus) {
    if (UNPAID_PAYMENT_STATUS_VALUES.has(rawPaymentStatus)) {
      return 'unpaid';
    }
    if (PENDING_STATUS_VALUES.has(rawPaymentStatus)) {
      return isTypeDeleted ? 'unpaid' : 'pending';
    }
  }

  // 4. Explicit unpaid status (includes 'unpaid' and legacy 'approved' which means «لم يتم الدفع»)
  if (UNPAID_STATUS_VALUES.has(rawStatus)) {
    return 'unpaid';
  }

  // 5. Pending with deleted contribution type becomes unpaid
  if ((PENDING_STATUS_VALUES.has(rawStatus) || !rawStatus) && isTypeDeleted) {
    return 'unpaid';
  }

  // 6. Pending / under review status -> NOT paid yet (and distinct from explicit «لم يتم الدفع»)
  if (PENDING_STATUS_VALUES.has(rawStatus)) {
    return 'pending';
  }

  // 7. Explicit boolean non-payment flags prevent any non-pending/completed record from counting as paid
  if (record.isPaid === false || record.paid === false) {
    return 'unpaid';
  }

  // 8. Strictly paid & completed ONLY when status is explicitly completed/paid
  //    AND paymentStatus (if present) is also explicitly paid/confirmed
  const hasPaidStatus = PAID_COMPLETED_STATUS_VALUES.has(rawStatus);
  const hasValidPaymentStatus = !rawPaymentStatus || PAID_COMPLETED_STATUS_VALUES.has(rawPaymentStatus);
  const numericAmount = Number(record.amount);

  if (hasPaidStatus && hasValidPaymentStatus && Number.isFinite(numericAmount) && numericAmount > 0) {
    return 'completed';
  }

  return 'pending';
}

/**
 * Resolves standard Arabic label for a contribution category
 */
export function getContributionTypeArabicName(
  category: string | undefined,
  typeNameFallback?: string,
  configuredTypes: ContributionTypeConfig[] = []
): string {
  if (typeNameFallback && typeNameFallback.trim()) {
    return typeNameFallback.trim();
  }

  // Look in configured types first
  const matched = configuredTypes.find(
    (t) => t.id === category || t.nameAr === category || t.nameEn === category
  );
  if (matched && matched.nameAr) {
    return matched.nameAr;
  }

  switch (category) {
    case 'membership_fee':
      return 'واجب الانخراط السنوي';
    case 'donation':
      return 'تبرع ومساعدة خيرية';
    case 'project_support':
      return 'كفالة ورعاية المشروع';
    case 'charity_zakat':
      return 'زكاة الفطر والمال';
    case 'initiative_proposal':
      return 'مساهمة مبادرة مجتمعية';
    case 'initiative_idea':
      return 'اقتراح ودعم مشروع';
    default:
      return 'مساهمة مالية عامة';
  }
}

/**
 * Normalizes payment method in Arabic
 */
export function getPaymentMethodArabicLabel(method?: PaymentMethodType | string): string {
  switch (method) {
    case 'bank_transfer':
      return 'تحويل بنكي رسمي';
    case 'cash':
      return 'أداء نقدي (كاش)';
    case 'check':
      return 'شيك بنكي معتمد';
    case 'online':
      return 'دفع إلكتروني مباشر';
    case 'other':
    default:
      return 'تحويل مالي / أخرى';
  }
}

/**
 * Unifies, deduplicates, and filters contributions for the Live Transparency Portal
 * Enforces strict multi-tenant isolation, guarantees no duplication,
 * and calculates verified totals strictly from actually paid & completed contributions.
 */
export function unifyAndDeduplicateContributions(
  memberContributions: MemberContribution[] = [],
  campaignContributions: CampaignContribution[] = [],
  contributionTypes: ContributionTypeConfig[] = [],
  campaigns: DonationCampaign[] = [],
  currentTenantId: string = 'tenant_nour'
): {
  contributions: UnifiedTransparencyContribution[];
  metrics: TransparencyMetrics;
} {
  const cleanTenant = (currentTenantId || 'tenant_nour').trim();
  const resultMap = new Map<string, UnifiedTransparencyContribution>();

  // Combine passed contributionTypes with any stored types (including soft-deleted ones)
  const allKnownTypes: ContributionTypeConfig[] = [...(contributionTypes || [])];
  try {
    const storedAll = getAllGlobalContributionTypesIncludingDeleted();
    for (const st of storedAll) {
      const idx = allKnownTypes.findIndex((t) => t.id === st.id);
      if (idx === -1) {
        allKnownTypes.push(st);
      } else if (st.isDeleted) {
        allKnownTypes[idx] = { ...allKnownTypes[idx], isDeleted: true };
      }
    }
  } catch {
    // ignore storage read error
  }

  const deletedTypeIds = new Set<string>();
  const deletedTypeNames = new Set<string>();
  for (const t of allKnownTypes) {
    if (t && t.isDeleted) {
      if (t.id) deletedTypeIds.add(t.id.trim());
      if (t.nameAr) deletedTypeNames.add(t.nameAr.trim());
    }
  }

  // Map campaigns by ID for quick title lookup
  const campaignsMap = new Map<string, string>();
  for (const c of campaigns || []) {
    if (c.id && c.title) {
      campaignsMap.set(c.id, c.title);
    }
  }

  // Index memberContributions by ID and financialOperationId for reliable lookup
  const tenantMemberContribs = (memberContributions || []).filter((mc) => {
    if (!mc || !mc.id) return false;
    const mcTenant = mc.tenantId || mc.associationId || 'tenant_nour';
    return cleanTenant === 'portal' || mcTenant === cleanTenant;
  });
  const memberContribById = new Map<string, MemberContribution>();
  const memberContribByOpId = new Map<string, MemberContribution>();
  for (const mc of tenantMemberContribs) {
    memberContribById.set(mc.id, mc);
    if (mc.financialOperationId) {
      memberContribByOpId.set(mc.financialOperationId, mc);
    }
  }

  // 1. Process Campaign Contributions
  for (const cc of campaignContributions || []) {
    if (!cc || !cc.id) continue;
    // Strict multi-tenant check
    const ccTenant = cc.tenantId || cc.associationId || 'tenant_nour';
    if (cleanTenant !== 'portal' && ccTenant !== cleanTenant) {
      continue;
    }

    const typeName =
      cc.contributionTypeName ||
      getContributionTypeArabicName(cc.contributionTypeId, undefined, allKnownTypes);

    const isAnon = Boolean(
      cc.isAnonymous ||
        !cc.donorName ||
        cc.donorName.trim() === 'فاعل خير' ||
        cc.donorName.includes('معفى من الظهور')
    );

    const resolvedCampaignTitle =
      cc.campaignTitle || campaignsMap.get(cc.campaignId) || 'حملة تبرع مرخصة';

    const isTypeDeleted =
      (cc.contributionTypeId && deletedTypeIds.has(cc.contributionTypeId.trim())) ||
      (cc.contributionTypeName && deletedTypeNames.has(cc.contributionTypeName.trim())) ||
      deletedTypeNames.has(typeName.trim());

    const linkedMc =
      memberContribById.get(`contrib-don-${cc.id}`) ||
      memberContribById.get(cc.id) ||
      memberContribByOpId.get(`op-camp-${cc.id}`);

    const ccPaymentState = resolveActualPaymentState(cc as ContributionLikeRecord, isTypeDeleted);
    const linkedMcPaymentState = linkedMc
      ? resolveActualPaymentState(linkedMc as ContributionLikeRecord, isTypeDeleted)
      : null;

    // Strict rule: if either the campaign record OR its linked member contribution is unpaid/rejected,
    // it MUST NEVER be counted as paid & completed.
    let normalizedStatus: 'completed' | 'approved' | 'pending' | 'unpaid' | 'rejected' = 'pending';
    let isNegative = false;
    let amountSign: '+' | '-' = '+';
    let isPaidCompleted = false;

    if (ccPaymentState === 'unpaid' || linkedMcPaymentState === 'unpaid') {
      normalizedStatus = 'unpaid';
      isNegative = true;
      amountSign = '-';
      isPaidCompleted = false;
    } else if (ccPaymentState === 'rejected' || linkedMcPaymentState === 'rejected') {
      normalizedStatus = 'rejected';
      isNegative = true;
      amountSign = '-';
      isPaidCompleted = false;
    } else if (
      ccPaymentState === 'completed' &&
      (!linkedMcPaymentState || linkedMcPaymentState === 'completed')
    ) {
      normalizedStatus = 'completed';
      isNegative = false;
      amountSign = '+';
      isPaidCompleted = cc.isFinancial !== false && Number(cc.amount) > 0;
    } else {
      normalizedStatus = 'pending';
      isNegative = false;
      amountSign = '+';
      isPaidCompleted = false;
    }

    const unified: UnifiedTransparencyContribution = {
      id: cc.id,
      sourceType: 'campaign',
      sourceMemberContributionId: linkedMc?.id,
      sourceCampaignContributionId: cc.id,
      amount: Math.abs(Number(cc.amount) || 0),
      donorName: isAnon ? 'فاعل خير (معفى من الظهور)' : cc.donorName.trim(),
      rawDonorName: linkedMc?.memberName || (isAnon ? 'فاعل خير (معفى من الظهور)' : cc.donorName.trim()),
      memberCode: linkedMc?.memberCode || (isAnon ? 'فاعل خير' : 'متبرع'),
      memberId: linkedMc?.memberId,
      isAnonymous: isAnon,
      category: linkedMc?.category || cc.contributionTypeId || 'campaign_donation',
      typeNameAr: typeName,
      campaignId: cc.campaignId,
      campaignTitle: resolvedCampaignTitle,
      date: cc.date || (cc.createdAt ? cc.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      time: cc.time || (cc.createdAt && cc.createdAt.includes('T') ? cc.createdAt.slice(11, 19) : undefined),
      createdAt: cc.createdAt || new Date().toISOString(),
      status: normalizedStatus,
      isNegative,
      amountSign,
      paymentMethod: cc.paymentMethod || 'bank_transfer',
      notes: linkedMc?.notes || cc.notes || '',
      receiptNumber: `REC-CAMP-${cc.id.slice(-6).toUpperCase()}`,
      financialOperationId: linkedMc?.financialOperationId || `op-camp-${cc.id}`,
      proofImageUrl: linkedMc?.proofImageUrl || cc.proofImageUrl || linkedMc?.receiptUrl || cc.receiptUrl,
      receiptUrl: linkedMc?.receiptUrl || cc.receiptUrl || linkedMc?.proofImageUrl || cc.proofImageUrl,
      tenantId: cleanTenant,
      associationId: cleanTenant,
      isFinancial: cc.isFinancial !== false,
      isPaidCompleted,
    };

    resultMap.set(cc.id, unified);
  }

  // 2. Process Member & General Contributions with Deduplication
  for (const mc of tenantMemberContribs) {
    // Check if this member contribution corresponds to an existing campaign contribution
    let matchedExistingKey: string | null = null;

    // Check explicit link IDs (exact match or contrib-don- prefix)
    if (resultMap.has(mc.id)) {
      matchedExistingKey = mc.id;
    }

    if (!matchedExistingKey && mc.id.startsWith('contrib-don-')) {
      const campIdCandidate = mc.id.replace('contrib-don-', '');
      if (resultMap.has(campIdCandidate)) {
        matchedExistingKey = campIdCandidate;
      }
    }

    if (!matchedExistingKey && mc.financialOperationId?.startsWith('op-camp-')) {
      const campIdCandidate = mc.financialOperationId.replace('op-camp-', '');
      if (resultMap.has(campIdCandidate)) {
        matchedExistingKey = campIdCandidate;
      }
    }

    // Check fuzzy match on campaignId + amount + date
    if (!matchedExistingKey && mc.campaignId) {
      for (const [key, existing] of resultMap.entries()) {
        if (
          existing.campaignId === mc.campaignId &&
          Math.abs(existing.amount - Math.abs(Number(mc.amount))) < 0.01 &&
          existing.date === mc.date
        ) {
          matchedExistingKey = key;
          break;
        }
      }
    }

    const typeName = getContributionTypeArabicName(
      mc.contributionTypeId || mc.category,
      mc.contributionTypeName,
      allKnownTypes
    );

    const isMcTypeDeleted =
      (mc.contributionTypeId && deletedTypeIds.has(mc.contributionTypeId.trim())) ||
      (mc.contributionTypeName && deletedTypeNames.has(mc.contributionTypeName.trim())) ||
      (mc.category &&
        (deletedTypeIds.has(mc.category.trim()) || deletedTypeNames.has(mc.category.trim()))) ||
      deletedTypeNames.has(typeName.trim());

    const mcPaymentState = resolveActualPaymentState(mc as ContributionLikeRecord, isMcTypeDeleted);

    if (matchedExistingKey) {
      // Merge additional metadata if available
      const existing = resultMap.get(matchedExistingKey)!;
      if (!existing.sourceMemberContributionId) existing.sourceMemberContributionId = mc.id;
      if (!existing.memberCode && mc.memberCode) existing.memberCode = mc.memberCode;
      if (!existing.memberId && mc.memberId) existing.memberId = mc.memberId;
      if (!existing.rawDonorName && mc.memberName) existing.rawDonorName = mc.memberName;
      if (mc.notes && !existing.notes) existing.notes = mc.notes;
      if (mc.proofImageUrl && !existing.proofImageUrl) existing.proofImageUrl = mc.proofImageUrl;
      if (mc.receiptUrl && !existing.receiptUrl) existing.receiptUrl = mc.receiptUrl;
      if (mc.financialOperationId && !existing.financialOperationId) {
        existing.financialOperationId = mc.financialOperationId;
      }
      if (mcPaymentState === 'unpaid') {
        existing.status = 'unpaid';
        existing.isNegative = true;
        existing.amountSign = '-';
        existing.isPaidCompleted = false;
      } else if (mcPaymentState === 'rejected') {
        existing.status = 'rejected';
        existing.isNegative = true;
        existing.amountSign = '-';
        existing.isPaidCompleted = false;
      } else if (mcPaymentState === 'pending') {
        if (existing.status !== 'unpaid' && existing.status !== 'rejected') {
          existing.status = 'pending';
          existing.isNegative = false;
          existing.amountSign = '+';
          existing.isPaidCompleted = false;
        }
      } else if (mcPaymentState === 'completed' && existing.status !== 'unpaid' && existing.status !== 'rejected') {
        existing.status = 'completed';
        existing.isNegative = false;
        existing.amountSign = '+';
        existing.isPaidCompleted = existing.isFinancial !== false && Number(existing.amount) > 0;
      }
      continue;
    }

    // New standalone member/general contribution
    const isAnon = Boolean(
      mc.isAnonymous ||
        !mc.memberName ||
        mc.memberName.trim() === 'فاعل خير' ||
        mc.memberName.includes('معفى من الظهور')
    );

    let normalizedStatus: 'completed' | 'approved' | 'pending' | 'unpaid' | 'rejected' = 'pending';
    let isNegative = false;
    let amountSign: '+' | '-' = '+';
    let isPaidCompleted = false;

    if (mcPaymentState === 'unpaid') {
      normalizedStatus = 'unpaid';
      isNegative = true;
      amountSign = '-';
      isPaidCompleted = false;
    } else if (mcPaymentState === 'rejected') {
      normalizedStatus = 'rejected';
      isNegative = true;
      amountSign = '-';
      isPaidCompleted = false;
    } else if (mcPaymentState === 'completed') {
      normalizedStatus = 'completed';
      isNegative = false;
      amountSign = '+';
      isPaidCompleted = Number(mc.amount) > 0;
    } else {
      normalizedStatus = 'pending';
      isNegative = false;
      amountSign = '+';
      isPaidCompleted = false;
    }

    const sourceType: 'campaign' | 'general' | 'membership' = mc.campaignId
      ? 'campaign'
      : mc.category === 'membership_fee'
      ? 'membership'
      : 'general';

    const resolvedCampaignTitle = mc.campaignTitle || (mc.campaignId ? campaignsMap.get(mc.campaignId) : undefined);

    const unified: UnifiedTransparencyContribution = {
      id: mc.id,
      sourceType,
      sourceMemberContributionId: mc.id,
      amount: Math.abs(Number(mc.amount) || 0),
      donorName: isAnon
        ? 'فاعل خير (معفى من الظهور)'
        : mc.memberCode
        ? `${mc.memberName.trim()} (${mc.memberCode})`
        : mc.memberName.trim(),
      rawDonorName: isAnon ? 'فاعل خير (معفى من الظهور)' : mc.memberName.trim(),
      memberCode: mc.memberCode,
      memberId: mc.memberId,
      isAnonymous: isAnon,
      category: mc.category,
      typeNameAr: typeName,
      campaignId: mc.campaignId,
      campaignTitle: resolvedCampaignTitle,
      date: mc.date || (mc.createdAt ? mc.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      time: mc.time || (mc.createdAt && mc.createdAt.includes('T') ? mc.createdAt.slice(11, 19) : undefined),
      createdAt: mc.createdAt || new Date().toISOString(),
      status: normalizedStatus,
      isNegative,
      amountSign,
      paymentMethod: mc.paymentMethod || 'bank_transfer',
      notes: mc.notes || '',
      receiptNumber: `REC-${mc.id.slice(-6).toUpperCase()}`,
      financialOperationId: mc.financialOperationId,
      proofImageUrl: mc.proofImageUrl || mc.receiptUrl,
      receiptUrl: mc.receiptUrl || mc.proofImageUrl,
      tenantId: cleanTenant,
      associationId: cleanTenant,
      isFinancial: true,
      isPaidCompleted,
    };

    resultMap.set(mc.id, unified);
  }

  // Convert to array and sort descending by date / createdAt
  const contributionsList = Array.from(resultMap.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date).getTime() || 0;
    const timeB = new Date(b.createdAt || b.date).getTime() || 0;
    return timeB - timeA;
  });

  // Calculate strict financial metrics
  // RULE: ONLY actually paid & completed financial contributions calculate into total funds collected!
  // All unpaid («لم يتم الدفع»), pending, rejected, negative, or non-financial records are strictly excluded.
  const approvedList = contributionsList.filter(
    (c) =>
      c.isPaidCompleted === true &&
      c.status === 'completed' &&
      !c.isNegative &&
      c.amountSign === '+' &&
      c.isFinancial !== false &&
      Number.isFinite(Number(c.amount)) &&
      Number(c.amount) > 0
  );
  const pendingList = contributionsList.filter((c) => c.status === 'pending');
  const unpaidList = contributionsList.filter(
    (c) => c.status === 'unpaid' && c.isPaidCompleted !== true
  );
  const rejectedList = contributionsList.filter((c) => c.status === 'rejected');

  const totalApprovedAmount = approvedList.reduce((sum, c) => sum + Math.abs(Number(c.amount) || 0), 0);
  const totalPendingAmount = pendingList.reduce((sum, c) => sum + Math.abs(Number(c.amount) || 0), 0);
  const totalUnpaidAmount = unpaidList.reduce(
    (sum, c) =>
      c.isFinancial !== false && Number.isFinite(Number(c.amount)) && Math.abs(Number(c.amount)) > 0
        ? sum + Math.abs(Number(c.amount))
        : sum,
    0
  );

  const campaignContribsCount = contributionsList.filter((c) => c.sourceType === 'campaign').length;
  const generalContribsCount = contributionsList.filter((c) => c.sourceType !== 'campaign').length;

  const donorsSet = new Set<string>();
  for (const c of contributionsList) {
    if (!c.isAnonymous && c.donorName) {
      donorsSet.add(c.donorName);
    }
  }

  const metrics: TransparencyMetrics = {
    totalApprovedAmount,
    approvedCount: approvedList.length,
    totalPendingAmount,
    pendingCount: pendingList.length,
    totalUnpaidAmount,
    unpaidCount: unpaidList.length,
    rejectedCount: rejectedList.length,
    totalOperationsCount: contributionsList.length,
    campaignContributionsCount: campaignContribsCount,
    generalContributionsCount: generalContribsCount,
    uniqueDonorsCount: donorsSet.size,
  };

  return {
    contributions: contributionsList,
    metrics,
  };
}

export interface ApprovedExpensesResult {
  approvedCompletedExpenses: FinancialOperation[];
  totalApprovedExpenses: number;
  approvedExpensesCount: number;
}

const EXPENSE_EXCLUDED_STATUSES = new Set([
  'pending',
  'under_review',
  'in_review',
  'review',
  'rejected',
  'incomplete',
  'unpaid',
  'cancelled',
  'canceled',
  'draft',
  'failed',
  'قيد المراجعة',
  'قيد التحقق',
  'مرفوض',
  'مرفوضة',
  'غير مكتمل',
  'غير مكتملة',
  'ملغى',
  'ملغاة',
]);

const EXPENSE_APPROVED_STATUSES = new Set([
  'approved',
  'completed',
  'paid',
  'confirmed',
  'verified',
  'settled',
  'معتمد',
  'معتمدة',
  'مكتمل',
  'مكتملة',
]);

/**
 * Calculates approved & completed actual expenses strictly from verified financial operations.
 * Excludes unpaid-contribution deduction bookkeeping entries, pending/rejected/cancelled/draft expenses,
 * soft-deleted items, and enforces strict multi-tenant isolation.
 */
export function calculateApprovedExpenses(
  operations: FinancialOperation[] = [],
  tenantId: string = 'tenant_nour'
): ApprovedExpensesResult {
  const cleanTenant = (tenantId || 'tenant_nour').trim();

  const approvedCompletedExpenses = (operations || []).filter((op) => {
    if (!op || !op.id || op.type !== 'expense') return false;
    if (op.isUnpaidContributionDeduction || String(op.id).startsWith('op-unpaid-deduction-')) {
      return false;
    }

    const opTenant = (op.tenantId || op.associationId || 'tenant_nour').trim();
    if (cleanTenant !== 'portal' && opTenant !== cleanTenant) {
      return false;
    }

    const rawStatus = String(op.status ?? '').trim().toLowerCase();
    if (rawStatus) {
      if (EXPENSE_EXCLUDED_STATUSES.has(rawStatus) || !EXPENSE_APPROVED_STATUSES.has(rawStatus)) {
        return false;
      }
    }

    const opFlags = op as FinancialOperation & {
      isDeleted?: boolean;
      isRejected?: boolean;
      isPending?: boolean;
      isApproved?: boolean;
      isCompleted?: boolean;
    };
    if (
      opFlags.isDeleted === true ||
      opFlags.isRejected === true ||
      opFlags.isPending === true ||
      opFlags.isApproved === false ||
      opFlags.isCompleted === false
    ) {
      return false;
    }

    const amt = Number(op.amount);
    return Number.isFinite(amt) && amt > 0;
  });

  const totalApprovedExpenses = approvedCompletedExpenses.reduce(
    (sum, op) => sum + Math.abs(Number(op.amount) || 0),
    0
  );

  return {
    approvedCompletedExpenses,
    totalApprovedExpenses,
    approvedExpensesCount: approvedCompletedExpenses.length,
  };
}

export interface UnifiedAssociationFinancials {
  /** Unified approved & collected incomes/contributions (identical across Admin, Contributions Ledger & Transparency Portal) */
  totalIncomes: number;
  /** Unified approved & completed actual expenses (identical across Admin & Transparency Portal) */
  totalExpenses: number;
  /** Explicit alias for approved & collected incomes */
  totalApprovedIncomes: number;
  /** Explicit alias for approved & completed actual expenses */
  totalApprovedExpenses: number;
  approvedCompletedExpenses: FinancialOperation[];
  approvedExpensesCount: number;
  /** Raw operational ledger sums backing operational balance equation */
  operationalIncomes: number;
  operationalExpenses: number;
  currentBalance: number;
  processedOperations: FinancialOperation[];
  expenseByCategory: Record<string, number>;
  contributions: UnifiedTransparencyContribution[];
  metrics: TransparencyMetrics;
}

/**
 * Single Unified Financial Source across the Admin Dashboard («لوحة الإدارة»),
 * Operations Management («إدارة العمليات المالية»), Admin Contributions Ledger («سجل المساهمات والانخراطات»),
 * Live Transparency Portal («بوابة سجل الشفافية المباشر»), Financial Dashboard, and Official Statements.
 * Guarantees 100% identical `totalIncomes`, `totalExpenses`, `currentBalance`, and `metrics.totalApprovedAmount`
 * across all sections for tenant_nour and every association on the platform.
 */
export function calculateUnifiedAssociationFinancials(params: {
  operations?: FinancialOperation[];
  contributions?: MemberContribution[];
  campaignContributions?: CampaignContribution[];
  contributionTypes?: ContributionTypeConfig[];
  campaigns?: DonationCampaign[];
  tenantId?: string;
}): UnifiedAssociationFinancials {
  const cleanTenant = (params.tenantId || 'tenant_nour').trim();

  const tenantOps = (params.operations || []).filter((op) => {
    if (!op || !op.id) return false;
    if (cleanTenant === 'portal') return true;
    const opTenant = (op.tenantId || op.associationId || 'tenant_nour').trim();
    return opTenant === cleanTenant;
  });

  const opFinancials = calculateFinancials(tenantOps);
  const unified = unifyAndDeduplicateContributions(
    params.contributions || [],
    params.campaignContributions || [],
    params.contributionTypes || [],
    params.campaigns || [],
    cleanTenant
  );
  const approvedExpensesResult = calculateApprovedExpenses(opFinancials.processedOperations, cleanTenant);

  const totalApprovedIncomes = unified.metrics.totalApprovedAmount;
  const totalApprovedExpenses = approvedExpensesResult.totalApprovedExpenses;
  const totalUnpaidAmount = unified.metrics.totalUnpaidAmount;
  const currentBalance = totalApprovedIncomes - totalApprovedExpenses - totalUnpaidAmount;

  return {
    totalIncomes: totalApprovedIncomes,
    totalExpenses: totalApprovedExpenses,
    totalApprovedIncomes,
    totalApprovedExpenses,
    approvedCompletedExpenses: approvedExpensesResult.approvedCompletedExpenses,
    approvedExpensesCount: approvedExpensesResult.approvedExpensesCount,
    operationalIncomes: opFinancials.totalIncomes,
    operationalExpenses: opFinancials.totalExpenses,
    currentBalance,
    processedOperations: opFinancials.processedOperations,
    expenseByCategory: opFinancials.expenseByCategory,
    contributions: unified.contributions,
    metrics: unified.metrics,
  };
}


