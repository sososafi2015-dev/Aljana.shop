import {
  getStoredCampaigns,
  saveCampaigns,
  getStoredCampaignContributions,
  saveCampaignContributions,
  getStoredContributionTypes,
  saveContributionTypes,
  getStoredDonationPresets,
  saveDonationPresets,
  recalculateCampaignsFromContributions,
  getStoredCurrentAdminSession,
  getActiveTenantIdFromStorage,
  recordDeletedCampaignId,
} from '../storage';
import {
  saveGlobalContributionTypes,
  saveGlobalContributionTypesToServer,
} from '../contributionTypesStorage';
import {
  DEFAULT_DONATION_PRESETS,
} from '../types';
import type {
  DonationCampaign,
  CampaignContribution,
  ContributionTypeConfig,
  CurrentAdminSession,
  CampaignStatus,
} from '../types';
import { firestoreSyncService } from '../services/firestoreSyncService';

function getAdminHeader(session: CurrentAdminSession | null | undefined): Record<string, string> {
  const resolved = session || getStoredCurrentAdminSession() || {
    type: 'super_admin',
    role: 'main_admin',
    fullName: 'إدارة الجمعية',
  };
  const activeTenant = (session as any)?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  return {
    'x-admin-session': encodeURIComponent(JSON.stringify(resolved)),
    'x-tenant-id': activeTenant,
  };
}

/**
 * Fetch all campaigns and contribution types
 */
export async function apiFetchCampaigns(tenantId?: string): Promise<{
  campaigns: DonationCampaign[];
  contributionTypes: ContributionTypeConfig[];
}> {
  const currentTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  try {
    const res = await fetch(`/api/campaigns?tenantId=${encodeURIComponent(currentTenant)}`, {
      headers: {
        'Accept': 'application/json',
        'x-tenant-id': currentTenant,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.campaigns)) {
        saveCampaigns(data.campaigns, currentTenant);
        if (Array.isArray(data.contributionTypes)) {
          const activeOnly = data.contributionTypes.filter((t: any) => !t.isDeleted);
          saveContributionTypes(activeOnly, currentTenant);
        }
        const activeTypes = Array.isArray(data.contributionTypes)
          ? data.contributionTypes.filter((t: any) => !t.isDeleted)
          : getStoredContributionTypes(currentTenant);
        return {
          campaigns: data.campaigns,
          contributionTypes: activeTypes,
        };
      }
    }
  } catch (err) {
    console.warn('[CampaignsAPI] Server fetch failed, falling back to local data:', err);
  }

  return {
    campaigns: getStoredCampaigns(currentTenant),
    contributionTypes: getStoredContributionTypes(currentTenant),
  };
}

/**
 * Create a new donation campaign
 */
export async function apiCreateCampaign(
  campaignData: Partial<DonationCampaign>,
  session: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; campaign?: DonationCampaign; error?: string }> {
  const activeTenant = tenantId || (campaignData as any).tenantId || (session as any)?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  const cleanVideoUrl = (campaignData.videoUrl || '').trim() || undefined;

  const payload: Partial<DonationCampaign> = {
    ...campaignData,
    videoUrl: cleanVideoUrl,
    tenantId: activeTenant,
    associationId: activeTenant,
  };

  try {
    const res = await fetch(`/api/campaigns?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.success && data.campaign) {
      const current = getStoredCampaigns(activeTenant);
      const updated = [data.campaign, ...current.filter((c) => c.id !== data.campaign.id)];
      saveCampaigns(updated, activeTenant);
      // Synchronize directly with Firestore for immediate multi-client and refresh persistence
      await firestoreSyncService.syncCampaignsToFirestore(activeTenant, updated);
      return { success: true, campaign: data.campaign };
    }
    return { success: false, error: data.error || 'فشل حفظ وإضافة الحملة في قاعدة البيانات.' };
  } catch (err: any) {
    console.warn('[CampaignsAPI] Server error creating campaign, attempting Firestore fallback:', err);
    try {
      const newCamp: DonationCampaign = {
        id: campaignData.id || `camp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: (campaignData.title || '').trim(),
        description: (campaignData.description || '').trim(),
        targetProject: (campaignData.targetProject || '').trim(),
        targetAmount: Number(campaignData.targetAmount) || 0,
        collectedAmount: Number(campaignData.collectedAmount) || 0,
        progressPercentage: Number(campaignData.progressPercentage) || 0,
        coverImage: campaignData.coverImage || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
        videoUrl: cleanVideoUrl,
        startDate: campaignData.startDate || new Date().toISOString().slice(0, 10),
        endDate: campaignData.endDate || '',
        status: campaignData.status || 'active',
        allowOverfunding: campaignData.allowOverfunding ?? true,
        isVisibleOnStore: campaignData.isVisibleOnStore !== false,
        createdAt: new Date().toISOString(),
        tenantId: activeTenant,
        associationId: activeTenant,
      };
      const current = getStoredCampaigns(activeTenant);
      const updated = [newCamp, ...current.filter((c) => c.id !== newCamp.id)];
      const fsOk = await firestoreSyncService.syncCampaignsToFirestore(activeTenant, updated);
      if (fsOk) {
        saveCampaigns(updated, activeTenant);
        return { success: true, campaign: newCamp };
      }
    } catch (fsErr) {
      console.error('[CampaignsAPI] Firestore fallback write also failed:', fsErr);
    }
    return {
      success: false,
      error: 'تعذر حفظ الحملة بشكل دائم على الخادم أو قاعدة بيانات Firebase. يرجى إعادة المحاولة.',
    };
  }
}

/**
 * Toggle or update campaign visibility on store storefront (ON / OFF)
 */
export async function apiToggleCampaignVisibility(
  campaignId: string,
  session: CurrentAdminSession | null,
  explicitVisibility?: boolean,
  tenantId?: string
): Promise<{ success: boolean; campaign?: DonationCampaign; message?: string; error?: string }> {
  const activeTenant = tenantId || (session as any)?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  try {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/visibility?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
      body: JSON.stringify(
        explicitVisibility !== undefined ? { isVisibleOnStore: explicitVisibility, tenantId: activeTenant } : { tenantId: activeTenant }
      ),
    });

    const data = await res.json();
    if (res.ok && data.success && data.campaign) {
      const current = getStoredCampaigns(activeTenant);
      const updated = current.map((c) => (c.id === campaignId ? data.campaign : c));
      saveCampaigns(updated, activeTenant);
      firestoreSyncService.syncCampaignsToFirestore(activeTenant, updated).catch(() => {});
      return { success: true, campaign: data.campaign, message: data.message };
    }
    return { success: false, error: data.error || 'فشل تعديل ظهور الحملة على المتجر' };
  } catch (err) {
    const current = getStoredCampaigns(activeTenant);
    const target = current.find((c) => c.id === campaignId);
    if (!target) return { success: false, error: 'الحملة غير موجودة' };
    const nextVis = explicitVisibility !== undefined ? explicitVisibility : !(target.isVisibleOnStore !== false);
    const updated = current.map((c) =>
      c.id === campaignId ? { ...c, isVisibleOnStore: nextVis, updatedAt: new Date().toISOString() } : c
    );
    saveCampaigns(updated, activeTenant);
    firestoreSyncService.syncCampaignsToFirestore(activeTenant, updated).catch(() => {});
    const updatedCamp = updated.find((c) => c.id === campaignId);
    return {
      success: true,
      campaign: updatedCamp,
      message: nextVis ? 'تم تفعيل ظهور الحملة على واجهة المتجر بنجاح.' : 'تم إخفاء الحملة من واجهة المتجر بنجاح.',
    };
  }
}

/**
 * Update an existing campaign
 */
export async function apiUpdateCampaign(
  campaignId: string,
  campaignData: Partial<DonationCampaign>,
  session: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; campaign?: DonationCampaign; error?: string }> {
  const activeTenant = tenantId || (campaignData as any).tenantId || (session as any)?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  const cleanVideoUrl =
    campaignData.videoUrl !== undefined
      ? (typeof campaignData.videoUrl === 'string' && campaignData.videoUrl.trim() ? campaignData.videoUrl.trim() : null)
      : undefined;

  const payload: Partial<DonationCampaign> = {
    ...campaignData,
    ...(cleanVideoUrl !== undefined ? { videoUrl: cleanVideoUrl as any } : {}),
    tenantId: activeTenant,
    associationId: activeTenant,
  };

  try {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.success && data.campaign) {
      const current = getStoredCampaigns(activeTenant);
      const updated = current.map((c) => (c.id === campaignId ? data.campaign : c));
      saveCampaigns(updated, activeTenant);
      // Synchronize directly with Firestore for permanent persistence
      await firestoreSyncService.syncCampaignsToFirestore(activeTenant, updated);
      return { success: true, campaign: data.campaign };
    }
    return { success: false, error: data.error || 'فشل تحديث بيانات الحملة في قاعدة البيانات.' };
  } catch (err: any) {
    console.warn('[CampaignsAPI] Server error updating campaign, attempting Firestore fallback:', err);
    try {
      const current = getStoredCampaigns(activeTenant);
      const updated = current.map((c) => {
        if (c.id === campaignId) {
          return {
            ...c,
            ...campaignData,
            videoUrl:
              cleanVideoUrl !== undefined
                ? (cleanVideoUrl ? cleanVideoUrl : undefined)
                : c.videoUrl,
            tenantId: activeTenant,
            associationId: activeTenant,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });
      const fsOk = await firestoreSyncService.syncCampaignsToFirestore(activeTenant, updated);
      if (fsOk) {
        saveCampaigns(updated, activeTenant);
        const updatedCamp = updated.find((c) => c.id === campaignId);
        return { success: true, campaign: updatedCamp };
      }
    } catch (fsErr) {
      console.error('[CampaignsAPI] Firestore fallback write failed:', fsErr);
    }
    return {
      success: false,
      error: 'تعذر حفظ التعديلات بشكل دائم على الخادم أو قاعدة بيانات Firebase. يرجى إعادة المحاولة.',
    };
  }
}

/**
 * Toggle or update campaign status (active / paused / completed)
 */
export async function apiToggleCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
  session: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; campaign?: DonationCampaign; error?: string }> {
  const activeTenant = tenantId || (session as any)?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  try {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/status?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
      body: JSON.stringify({ status, tenantId: activeTenant }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.campaign) {
      const current = getStoredCampaigns(activeTenant);
      const updated = current.map((c) => (c.id === campaignId ? data.campaign : c));
      saveCampaigns(updated, activeTenant);
      firestoreSyncService.syncCampaignsToFirestore(activeTenant, updated).catch(() => {});
      return { success: true, campaign: data.campaign };
    }
    return { success: false, error: data.error || 'فشل تعديل حالة الحملة' };
  } catch (err) {
    const current = getStoredCampaigns(activeTenant);
    const updated = current.map((c) => (c.id === campaignId ? { ...c, status } : c));
    saveCampaigns(updated, activeTenant);
    firestoreSyncService.syncCampaignsToFirestore(activeTenant, updated).catch(() => {});
    const camp = updated.find((c) => c.id === campaignId);
    return { success: true, campaign: camp };
  }
}

/**
 * Delete a campaign and its contributions
 */
export async function apiDeleteCampaign(
  campaignId: string,
  session: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; error?: string; campaigns?: DonationCampaign[] }> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage();
  try {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
    });

    if (!res.ok) {
      let errorMsg = 'تعذر حذف الحملة من الخادم.';
      try {
        const errorData = await res.json();
        if (errorData && errorData.error) {
          errorMsg = errorData.error;
        }
      } catch (e) {}
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    if (data.success) {
      // Record tombstone locally so that it can never reappear
      recordDeletedCampaignId(campaignId, activeTenant);
      firestoreSyncService.deleteCampaignFromFirestore(activeTenant, campaignId).catch(() => {});

      const current = getStoredCampaigns(activeTenant);
      const remaining = current.filter((c) => c.id !== campaignId);
      saveCampaigns(remaining, activeTenant);
      const contribs = getStoredCampaignContributions(activeTenant);
      saveCampaignContributions(contribs.filter((c) => c.campaignId !== campaignId), activeTenant);
      return { success: true, campaigns: remaining };
    }
    return { success: false, error: data.error || 'فشل حذف الحملة من قاعدة البيانات.' };
  } catch (err: any) {
    console.error('[CampaignsAPI] Failed to delete campaign on backend:', err);
    return {
      success: false,
      error: 'فشل الاتصال بالخادم لحذف الحملة. لم يتم حذف الحملة منعاً لعدم تطابق البيانات.',
    };
  }
}

/**
 * Fetch contributions with filters
 */
export async function apiFetchContributions(params?: {
  campaignId?: string;
  typeId?: string;
  search?: string;
  tenantId?: string;
}): Promise<{
  contributions: CampaignContribution[];
  totalContributionsCount: number;
  totalAmountCollected: number;
}> {
  const activeTenant = params?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  try {
    const query = new URLSearchParams();
    if (params?.campaignId) query.set('campaignId', params.campaignId);
    if (params?.typeId) query.set('typeId', params.typeId);
    if (params?.search) query.set('search', params.search);
    if (activeTenant) query.set('tenantId', activeTenant);

    const res = await fetch(`/api/campaigns/contributions?${query.toString()}`, {
      headers: {
        'x-tenant-id': activeTenant,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.contributions)) {
        return {
          contributions: data.contributions,
          totalContributionsCount: data.totalContributionsCount ?? data.contributions.length,
          totalAmountCollected: data.totalAmountCollected ?? 0,
        };
      }
    }
  } catch (err) {
    console.warn('[CampaignsAPI] Fallback fetching contributions locally:', err);
  }

  let local = getStoredCampaignContributions(activeTenant);
  if (params?.campaignId && params.campaignId !== 'all') {
    local = local.filter((c) => c.campaignId === params.campaignId);
  }
  if (params?.typeId && params.typeId !== 'all') {
    local = local.filter((c) => c.contributionTypeId === params.typeId);
  }
  if (params?.search) {
    const s = params.search.toLowerCase();
    local = local.filter(
      (c) =>
        c.donorName.toLowerCase().includes(s) ||
        c.campaignTitle.toLowerCase().includes(s) ||
        c.contributionTypeName.toLowerCase().includes(s)
    );
  }

  const totalAmount = local
    .filter((c) => c.isFinancial)
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  return {
    contributions: local,
    totalContributionsCount: local.length,
    totalAmountCollected: totalAmount,
  };
}

/**
 * Submit a donation/contribution
 */
export async function apiSubmitDonationContribution(payload: {
  campaignId: string;
  donorName: string;
  donorPhone?: string;
  isAnonymous?: boolean;
  contributionTypeId: string;
  amount: number;
  notes?: string;
  paymentMethod?: string;
  proofImageUrl?: string;
  receiptUrl?: string;
  tenantId?: string;
  associationId?: string;
}): Promise<{
  success: boolean;
  message?: string;
  contribution?: CampaignContribution;
  campaign?: DonationCampaign;
  error?: string;
  tenantId?: string;
  associationId?: string;
}> {
  const targetTenant = payload.tenantId || payload.associationId || getActiveTenantIdFromStorage() || 'tenant_nour';
  const cleanProofUrl = (payload.proofImageUrl || payload.receiptUrl || '').trim() || undefined;

  try {
    const res = await fetch(`/api/campaigns/contributions?tenantId=${encodeURIComponent(targetTenant)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': targetTenant,
      },
      body: JSON.stringify({
        ...payload,
        proofImageUrl: cleanProofUrl,
        receiptUrl: cleanProofUrl,
        tenantId: targetTenant,
        associationId: targetTenant,
      }),
    });

    const data = await res.json();
    if (data.success && data.contribution) {
      const resolvedTenant = data.tenantId || data.associationId || targetTenant;
      const taggedContribution: CampaignContribution = {
        ...data.contribution,
        proofImageUrl: data.contribution.proofImageUrl || data.contribution.receiptUrl || cleanProofUrl,
        receiptUrl: data.contribution.receiptUrl || data.contribution.proofImageUrl || cleanProofUrl,
        tenantId: resolvedTenant,
        associationId: resolvedTenant,
      };

      // Synchronize in local storage immediately for the beneficiary association
      const currentContribs = getStoredCampaignContributions(resolvedTenant);
      const updatedContribs = [taggedContribution, ...currentContribs.filter((c) => c.id !== taggedContribution.id)];
      saveCampaignContributions(updatedContribs, resolvedTenant);

      const currentCampaigns = getStoredCampaigns(resolvedTenant);
      const updatedCampaigns = recalculateCampaignsFromContributions(currentCampaigns, updatedContribs);
      saveCampaigns(updatedCampaigns, resolvedTenant);

      return {
        success: true,
        message: data.message,
        contribution: taggedContribution,
        campaign: data.campaign || updatedCampaigns.find((c) => c.id === payload.campaignId),
        tenantId: resolvedTenant,
        associationId: resolvedTenant,
      };
    }
    return {
      success: false,
      error: data.error || 'تعذر إتمام عملية التبرع، يرجى المحاولة مرة أخرى.',
    };
  } catch (err: any) {
    console.warn('[CampaignsAPI] Offline submission fallback:', err);
    const campaigns = getStoredCampaigns(targetTenant);
    let campaign = campaigns.find((c) => c.id === payload.campaignId);
    if (!campaign) {
      campaign = getStoredCampaigns('tenant_nour').find((c) => c.id === payload.campaignId);
    }
    if (!campaign) {
      return { success: false, error: 'حملة التبرع غير موجودة.' };
    }

    const types = getStoredContributionTypes(targetTenant);
    const matchedType = types.find((t) => t.id === payload.contributionTypeId) || {
      id: 'type-charity-donation',
      nameAr: 'تبرع ومساعدة خيرية',
      isFinancial: true,
    };

    const parsedAmount = Number(payload.amount) || 0;
    if (matchedType.isFinancial && parsedAmount <= 0) {
      return { success: false, error: 'يرجى إدخال مبلغ صحيح أكبر من صفر.' };
    }

    const now = new Date();
    const newContribution: CampaignContribution = {
      id: `cc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      campaignId: payload.campaignId,
      campaignTitle: campaign.title,
      donorName: payload.isAnonymous ? 'فاعل خير' : (payload.donorName || 'فاعل خير').trim(),
      donorPhone: payload.donorPhone || '',
      isAnonymous: !!payload.isAnonymous,
      contributionTypeId: matchedType.id,
      contributionTypeName: matchedType.nameAr,
      isFinancial: matchedType.isFinancial,
      amount: matchedType.isFinancial ? parsedAmount : 0,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8),
      createdAt: now.toISOString(),
      status: 'pending', // تلقائياً «قيد المراجعة» لعمليات التبرع الجديدة
      paymentMethod: (payload.paymentMethod as any) || 'bank_transfer',
      notes: payload.notes || '',
      proofImageUrl: cleanProofUrl,
      receiptUrl: cleanProofUrl,
      tenantId: targetTenant,
      associationId: targetTenant,
    };

    const currentContribs = getStoredCampaignContributions(targetTenant);
    const updatedContribs = [newContribution, ...currentContribs.filter((c) => c.id !== newContribution.id)];
    saveCampaignContributions(updatedContribs, targetTenant);

    const updatedCampaigns = recalculateCampaignsFromContributions(campaigns, updatedContribs);
    saveCampaigns(updatedCampaigns, targetTenant);

    const updatedCamp = updatedCampaigns.find((c) => c.id === payload.campaignId);

    return {
      success: true,
      message: 'تم تسجيل وتوثيق تبرعكم بنجاح! جزاكم الله خيراً.',
      contribution: newContribution,
      campaign: updatedCamp,
      tenantId: targetTenant,
      associationId: targetTenant,
    };
  }
}

/**
 * Delete a contribution
 */
export async function apiDeleteContribution(
  contributionId: string,
  session: CurrentAdminSession | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/campaigns/contributions/${contributionId}`, {
      method: 'DELETE',
      headers: {
        ...getAdminHeader(session),
      },
    });
    const data = await res.json();
    if (data.success) {
      const current = getStoredCampaignContributions();
      const updated = current.map((c) =>
        c.id === contributionId
          ? { ...c, status: 'unpaid' as const, isNegative: true, amountSign: '-' as const }
          : c
      );
      saveCampaignContributions(updated);
      return { success: true };
    }
    return { success: false, error: data.error || 'فشل تحديث حالة المساهمة' };
  } catch (err) {
    const current = getStoredCampaignContributions();
    const updated = current.map((c) =>
      c.id === contributionId
        ? { ...c, status: 'unpaid' as const, isNegative: true, amountSign: '-' as const }
        : c
    );
    saveCampaignContributions(updated);
    return { success: true };
  }
}

/**
 * Save / update a contribution type
 */
export async function apiSaveContributionType(
  typeData: Partial<ContributionTypeConfig>,
  session: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; type?: ContributionTypeConfig; error?: string }> {
  const activeTenant = tenantId || (session as any)?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  try {
    const res = await fetch(`/api/campaigns/types?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
      body: JSON.stringify(typeData),
    });
    const data = await res.json();
    if (data.success && data.type) {
      const current = getStoredContributionTypes(activeTenant);
      const existingIdx = current.findIndex((t) => t.id === data.type.id);
      let updated: ContributionTypeConfig[];
      if (existingIdx >= 0) {
        updated = current.map((t) => (t.id === data.type.id ? data.type : t));
      } else {
        updated = [...current, data.type];
      }
      saveContributionTypes(updated, activeTenant);
      return { success: true, type: data.type };
    }
    return { success: false, error: data.error || 'فشل حفظ نوع المساهمة' };
  } catch (err) {
    const current = getStoredContributionTypes(activeTenant);
    const newType: ContributionTypeConfig = {
      id: typeData.id || `type-${Date.now()}`,
      nameAr: typeData.nameAr || 'نوع مساهمة جديد',
      nameFr: typeData.nameFr || '',
      nameEn: typeData.nameEn || '',
      isFinancial: typeData.isFinancial ?? true,
      isDefault: !!typeData.isDefault,
      enabled: typeData.enabled ?? true,
      descriptionAr: typeData.descriptionAr || '',
    };
    const existingIdx = current.findIndex((t) => t.id === newType.id);
    let updated: ContributionTypeConfig[];
    if (existingIdx >= 0) {
      updated = current.map((t) => (t.id === newType.id ? newType : t));
    } else {
      updated = [...current, newType];
    }
    saveContributionTypes(updated, activeTenant);
    return { success: true, type: newType };
  }
}

/**
 * Delete a contribution type
 */
export async function apiDeleteContributionType(
  typeId: string,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  isSoftDeleted?: boolean;
  types?: ContributionTypeConfig[];
}> {
  if (!typeId) {
    return { success: false, error: 'معرف نوع المساهمة غير صالح.' };
  }

  const activeTenant = tenantId || (session as any)?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  const cleanId = String(typeId).trim();
  const localTypes = getStoredContributionTypes(activeTenant);
  const targetLocal = localTypes.find((t) => t.id === cleanId);

  // Guard: At least 1 active contribution type must remain in the system
  const activeLocalTypes = localTypes.filter((t) => !t.isDeleted);
  if (activeLocalTypes.length <= 1 && targetLocal && !targetLocal.isDeleted) {
    return {
      success: false,
      error: 'لا يمكن حذف هذا النوع. يجب توفر نوع مساهمة نشط واحد على الأقل في النظام لاستقبال التبرعات.',
    };
  }

  try {
    const res = await fetch(`/api/campaigns/types/${encodeURIComponent(cleanId)}?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      const allServerTypes: ContributionTypeConfig[] = Array.isArray(data.types)
        ? data.types
        : localTypes.map((t) => (t.id === cleanId ? { ...t, isDeleted: true, enabled: false } : t));

      const activeServerTypes = allServerTypes.filter((t: any) => !t.isDeleted);
      saveGlobalContributionTypes(allServerTypes);
      saveContributionTypes(activeServerTypes, activeTenant);

      if (Array.isArray(data.contributions)) {
        saveCampaignContributions(data.contributions, activeTenant);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('transparency_records_updated', { detail: { tenantId: activeTenant } }));
      }

      return {
        success: true,
        message: data.message || 'تم حذف نوع المساهمة وتحديث العمليات المرتبطة به إلى «لم يتم الدفع» بنجاح.',
        isSoftDeleted: true,
        types: activeServerTypes,
      };
    }

    // If permission explicitly denied by server (401/403), return error to user
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        error: data?.error || 'غير مصرح لك بحذف نوع المساهمة. يرجى التحقق من صلاحيات المسؤول.',
      };
    }

    // For any other server error (404, 500, etc.), fall back to local deletion to prevent UI blocking
    const storedContributions = getStoredCampaignContributions(activeTenant);
    const isLinked = storedContributions.some(
      (c) =>
        c.contributionTypeId === cleanId ||
        (targetLocal && c.contributionTypeName && c.contributionTypeName.trim() === targetLocal.nameAr.trim())
    );

    let updatedTypes: ContributionTypeConfig[];
    if (isLinked) {
      updatedTypes = localTypes.map((t) =>
        t.id === cleanId ? { ...t, isDeleted: true, enabled: false } : t
      );
    } else {
      updatedTypes = localTypes.filter((t) => t.id !== cleanId);
    }

    const remainingActive = updatedTypes.filter((t) => !t.isDeleted);
    if (targetLocal?.isDefault && remainingActive.length > 0 && !remainingActive.some((t) => t.isDefault)) {
      remainingActive[0] = { ...remainingActive[0], isDefault: true };
    }

    saveContributionTypes(remainingActive, activeTenant);

    return {
      success: true,
      isSoftDeleted: isLinked,
      message: isLinked
        ? `نوع المساهمة «${targetLocal?.nameAr || cleanId}» مستخدم في تبرعات سابقة، تم تعطيله وأرشفته لحفظ البيانات التاريخية.`
        : `تم حذف نوع المساهمة «${targetLocal?.nameAr || cleanId}» بنجاح.`,
      types: remainingActive,
    };
  } catch (err) {
    console.warn('[CampaignsAPI] Exception while deleting contribution type, falling back to local deletion:', err);
    const storedContributions = getStoredCampaignContributions(activeTenant);
    const isLinked = storedContributions.some(
      (c) =>
        c.contributionTypeId === cleanId ||
        (targetLocal && c.contributionTypeName && c.contributionTypeName.trim() === targetLocal.nameAr.trim())
    );

    let updatedTypes: ContributionTypeConfig[];
    if (isLinked) {
      updatedTypes = localTypes.map((t) =>
        t.id === cleanId ? { ...t, isDeleted: true, enabled: false } : t
      );
    } else {
      updatedTypes = localTypes.filter((t) => t.id !== cleanId);
    }

    const remainingActive = updatedTypes.filter((t) => !t.isDeleted);
    if (targetLocal?.isDefault && remainingActive.length > 0 && !remainingActive.some((t) => t.isDefault)) {
      remainingActive[0] = { ...remainingActive[0], isDefault: true };
    }

    saveContributionTypes(remainingActive, activeTenant);

    return {
      success: true,
      isSoftDeleted: isLinked,
      message: isLinked
        ? `نوع المساهمة «${targetLocal?.nameAr || cleanId}» مستخدم في تبرعات سابقة، تم تعطيله وأرشفته لحفظ البيانات التاريخية.`
        : `تم حذف نوع المساهمة «${targetLocal?.nameAr || cleanId}» بنجاح من النظام.`,
      types: remainingActive,
    };
  }
}

/**
 * Toggle contribution type enabled status
 */
export async function apiToggleContributionTypeStatus(
  typeId: string,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; type?: ContributionTypeConfig; error?: string }> {
  const activeTenant = tenantId || (session as any)?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  try {
    const res = await fetch(`/api/campaigns/types/${typeId}/toggle?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'PATCH',
      headers: {
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
    });
    const data = await res.json();
    if (data.success && data.type) {
      const current = getStoredContributionTypes(activeTenant).map((t) => (t.id === typeId ? data.type : t));
      saveContributionTypes(current, activeTenant);
      return { success: true, type: data.type };
    }
    return { success: false, error: data.error };
  } catch (err) {
    const current = getStoredContributionTypes(activeTenant);
    const updated = current.map((t) => (t.id === typeId ? { ...t, enabled: !t.enabled } : t));
    saveContributionTypes(updated, activeTenant);
    const target = updated.find((t) => t.id === typeId);
    return { success: true, type: target };
  }
}

/**
 * Fetch presets
 */
export async function apiFetchDonationPresets(): Promise<number[]> {
  try {
    const res = await fetch('/api/campaigns/presets');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.presets)) {
        saveDonationPresets(data.presets);
        return data.presets;
      }
    }
  } catch (err) {
    console.warn('[CampaignsAPI] Failed to fetch presets, using local:', err);
  }
  return getStoredDonationPresets();
}

/**
 * Save presets
 */
export async function apiSaveDonationPresets(
  presets: number[],
  session?: CurrentAdminSession | null
): Promise<{ success: boolean; presets?: number[]; error?: string }> {
  try {
    const res = await fetch('/api/campaigns/presets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeader(session),
      },
      body: JSON.stringify({ presets }),
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.presets)) {
      saveDonationPresets(data.presets);
      return { success: true, presets: data.presets };
    }
  } catch (err) {
    saveDonationPresets(presets);
    return { success: true, presets };
  }
  saveDonationPresets(presets);
  return { success: true, presets };
}

/**
 * Convenience unified campaigns API service object
 */
export const campaignsApi = {
  getCampaigns: async (tenantId?: string): Promise<DonationCampaign[]> => {
    const res = await apiFetchCampaigns(tenantId);
    return res.campaigns;
  },
  getContributions: async (campaignId?: string, tenantId?: string): Promise<CampaignContribution[]> => {
    const res = await apiFetchContributions(campaignId ? { campaignId, tenantId } : (tenantId ? { tenantId } : undefined));
    return res.contributions;
  },
  getContributionTypes: async (tenantId?: string): Promise<ContributionTypeConfig[]> => {
    try {
      const res = await fetch('/api/contribution-types');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.types) && data.types.length > 0) {
          saveGlobalContributionTypes(data.types);
          return data.types;
        }
      }
    } catch {}
    const res = await apiFetchCampaigns(tenantId);
    return res.contributionTypes;
  },
  saveCampaigns: async (campaigns: DonationCampaign[], tenantId?: string) => {
    const activeTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
    saveCampaigns(campaigns, activeTenant);
    try {
      await fetch(`/api/campaigns/sync?tenantId=${encodeURIComponent(activeTenant)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': activeTenant,
        },
        body: JSON.stringify({ campaigns, tenantId: activeTenant }),
      });
    } catch (e) {
      console.warn('[CampaignsAPI] Failed to sync campaigns to server:', e);
    }
    // Also guarantee Firestore persistence
    firestoreSyncService.syncCampaignsToFirestore(activeTenant, campaigns).catch((fsErr) => {
      console.warn('[CampaignsAPI] Firestore background sync notice:', fsErr);
    });
  },
  saveContributions: async (contributions: CampaignContribution[], tenantId?: string) => {
    const activeTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
    saveCampaignContributions(contributions, activeTenant);
    try {
      await fetch(`/api/campaigns/sync?tenantId=${encodeURIComponent(activeTenant)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': activeTenant,
        },
        body: JSON.stringify({ contributions, tenantId: activeTenant }),
      });
    } catch (e) {
      console.warn('[CampaignsAPI] Failed to sync contributions to server:', e);
    }
  },
  saveContributionTypes: async (types: ContributionTypeConfig[], tenantId?: string) => {
    const activeTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
    saveContributionTypes(types, activeTenant);
    return saveGlobalContributionTypesToServer(types);
  },
  saveContributionTypesToServer: async (types: ContributionTypeConfig[]) => {
    return saveGlobalContributionTypesToServer(types);
  },
  createCampaign: apiCreateCampaign,
  updateCampaign: apiUpdateCampaign,
  deleteCampaign: apiDeleteCampaign,
  submitContribution: apiSubmitDonationContribution,
};

