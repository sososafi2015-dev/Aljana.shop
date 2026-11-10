import {
  MemberContribution,
  CampaignContribution,
  ContributionTypeConfig,
  PaymentMethodType,
  DonationCampaign,
} from '../types';
import { getAllGlobalContributionTypesIncludingDeleted } from '../contributionTypesStorage';

export interface UnifiedTransparencyContribution {
  id: string;
  sourceType: 'campaign' | 'general' | 'membership';
  amount: number;
  donorName: string;
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
  tenantId: string;
  associationId?: string;
  isFinancial: boolean;
}

export interface TransparencyMetrics {
  totalApprovedAmount: number; // ONLY approved/completed
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
 * and calculates verified totals.
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

  // Index memberContributions by ID for fast lookup
  const tenantMemberContribs = (memberContributions || []).filter((mc) => {
    if (!mc || !mc.id) return false;
    const mcTenant = mc.tenantId || mc.associationId || 'tenant_nour';
    return cleanTenant === 'portal' || mcTenant === cleanTenant;
  });
  const memberContribById = new Map<string, MemberContribution>();
  for (const mc of tenantMemberContribs) {
    memberContribById.set(mc.id, mc);
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
      memberContribById.get(`contrib-don-${cc.id}`) || memberContribById.get(cc.id);

    const isExplicitlyUnpaid =
      cc.status === 'unpaid' ||
      cc.isNegative === true ||
      cc.amountSign === '-' ||
      (linkedMc &&
        (linkedMc.status === 'unpaid' ||
          linkedMc.status === 'approved' ||
          linkedMc.isNegative === true ||
          linkedMc.amountSign === '-'));

    let normalizedStatus: 'completed' | 'approved' | 'pending' | 'unpaid' | 'rejected' = 'pending';
    let isNegative = false;
    let amountSign: '+' | '-' = '+';

    if (
      isExplicitlyUnpaid ||
      ((cc.status === 'pending' || cc.status === 'unpaid') && isTypeDeleted)
    ) {
      normalizedStatus = 'unpaid';
      isNegative = true;
      amountSign = '-';
    } else if (cc.status === 'completed' || cc.status === 'approved') {
      normalizedStatus = 'approved';
      isNegative = false;
      amountSign = '+';
    } else if ((cc.status as any) === 'rejected') {
      normalizedStatus = 'rejected';
      isNegative = true;
      amountSign = '-';
    } else {
      normalizedStatus = 'pending';
      isNegative = false;
      amountSign = '+';
    }

    const unified: UnifiedTransparencyContribution = {
      id: cc.id,
      sourceType: 'campaign',
      amount: Math.abs(Number(cc.amount) || 0),
      donorName: isAnon ? 'فاعل خير (معفى من الظهور)' : cc.donorName.trim(),
      isAnonymous: isAnon,
      category: cc.contributionTypeId || 'campaign_donation',
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
      notes: cc.notes || '',
      receiptNumber: `REC-CAMP-${cc.id.slice(-6).toUpperCase()}`,
      financialOperationId: `op-camp-${cc.id}`,
      tenantId: cleanTenant,
      associationId: cleanTenant,
      isFinancial: cc.isFinancial !== false,
    };

    resultMap.set(cc.id, unified);
  }

  // 2. Process Member & General Contributions with Deduplication
  for (const mc of tenantMemberContribs) {
    // Check if this member contribution corresponds to an existing campaign contribution
    let matchedExistingKey: string | null = null;

    // Check explicit link IDs
    if (mc.id.startsWith('contrib-don-')) {
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

    // Note: in storage.ts, mc.status === 'unpaid' || mc.status === 'approved' means 'لم يتم الدفع'
    const isMcUnpaid =
      mc.status === 'unpaid' ||
      mc.status === 'approved' ||
      mc.isNegative === true ||
      mc.amountSign === '-' ||
      (mc.status === 'pending' && isMcTypeDeleted);

    if (matchedExistingKey) {
      // Merge additional metadata if available
      const existing = resultMap.get(matchedExistingKey)!;
      if (mc.notes && !existing.notes) existing.notes = mc.notes;
      if (mc.financialOperationId && !existing.financialOperationId) {
        existing.financialOperationId = mc.financialOperationId;
      }
      if (isMcUnpaid) {
        existing.status = 'unpaid';
        existing.isNegative = true;
        existing.amountSign = '-';
      } else if (mc.status === 'completed' && existing.status !== 'unpaid') {
        existing.status = 'approved';
        existing.isNegative = false;
        existing.amountSign = '+';
      } else if (mc.status === 'rejected') {
        existing.status = 'rejected';
        existing.isNegative = true;
        existing.amountSign = '-';
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

    if (isMcUnpaid) {
      normalizedStatus = 'unpaid';
      isNegative = true;
      amountSign = '-';
    } else if (mc.status === 'completed') {
      normalizedStatus = 'approved';
      isNegative = false;
      amountSign = '+';
    } else if (mc.status === 'rejected') {
      normalizedStatus = 'rejected';
      isNegative = true;
      amountSign = '-';
    } else {
      normalizedStatus = 'pending';
      isNegative = false;
      amountSign = '+';
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
      amount: Math.abs(Number(mc.amount) || 0),
      donorName: isAnon
        ? 'فاعل خير (معفى من الظهور)'
        : mc.memberCode
        ? `${mc.memberName.trim()} (${mc.memberCode})`
        : mc.memberName.trim(),
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
      tenantId: cleanTenant,
      associationId: cleanTenant,
      isFinancial: true,
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
  // RULE: Only approved & completed contributions calculate into total funds collected!
  const approvedList = contributionsList.filter(
    (c) => c.status === 'completed' || c.status === 'approved'
  );
  const pendingList = contributionsList.filter((c) => c.status === 'pending');
  const unpaidList = contributionsList.filter((c) => c.status === 'unpaid');
  const rejectedList = contributionsList.filter((c) => c.status === 'rejected');

  const totalApprovedAmount = approvedList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalPendingAmount = pendingList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalUnpaidAmount = unpaidList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

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

