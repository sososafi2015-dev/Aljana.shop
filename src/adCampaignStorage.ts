import { PlatformAdCampaign, AdCampaignStatus, AssociationTenant, AdCampaignRequest, AdCampaignRequestStatus, AdCampaignPaymentStatus } from './types';
import { getAllTenants, MASTER_TEMPLATE_TENANT_ID } from './tenantStorage';
import { getAllTenantPayments, saveAllTenantPayments, getAdCreationFeeForCountry } from './paymentStorage';

export const AD_CAMPAIGNS_STORAGE_KEY = 'chayef_ad_campaigns_v1';
export const AD_CAMPAIGNS_EVENT = 'chayef-ad-campaigns-changed';

export const AD_CAMPAIGN_REQUESTS_STORAGE_KEY = 'chayef_ad_campaign_requests_v1';
export const AD_CAMPAIGN_REQUESTS_EVENT = 'chayef-ad-campaign-requests-changed';

/**
 * Helper to compute the dynamic real-time status of an Ad Campaign
 */
export function getAdCampaignStatus(
  campaign: PlatformAdCampaign,
  refDate: Date = new Date()
): AdCampaignStatus {
  if (!campaign.enabled) {
    // If disabled manually, we can treat it as expired or inactive
    // But for date-based classification:
    const end = new Date(campaign.endDate).getTime();
    if (refDate.getTime() > end) return 'expired';
    const start = new Date(campaign.startDate).getTime();
    if (refDate.getTime() < start) return 'scheduled';
    return 'expired'; // Disabled while in active period
  }

  const now = refDate.getTime();
  const start = new Date(campaign.startDate).getTime();
  const end = new Date(campaign.endDate).getTime();

  if (now < start) {
    return 'scheduled';
  }
  if (now >= start && now <= end) {
    return 'active';
  }
  return 'expired';
}

/**
 * Calculates human readable remaining time or start time
 */
export function getCampaignTimeRemaining(
  campaign: PlatformAdCampaign,
  refDate: Date = new Date()
): { label: string; isUrgent?: boolean } {
  const now = refDate.getTime();
  const start = new Date(campaign.startDate).getTime();
  const end = new Date(campaign.endDate).getTime();

  if (!campaign.enabled) {
    return { label: 'معطلة يدوياً' };
  }

  if (now < start) {
    const diffMs = start - now;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return { label: `تبدأ بعد ${days} يوم و ${hours} ساعة` };
    }
    if (hours > 0) {
      return { label: `تبدأ بعد ${hours} ساعة و ${mins} دقيقة` };
    }
    return { label: `تبدأ بعد ${Math.max(1, mins)} دقيقة` };
  }

  if (now >= start && now <= end) {
    const diffMs = end - now;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return { 
        label: `متبقي ${days} يوم و ${hours} ساعة`,
        isUrgent: days <= 1 
      };
    }
    if (hours > 0) {
      return { 
        label: `متبقي ${hours} ساعة و ${mins} دقيقة`,
        isUrgent: true 
      };
    }
    return { 
      label: `متبقي ${Math.max(1, mins)} دقيقة فقط`,
      isUrgent: true 
    };
  }

  const expiredDiff = now - end;
  const expiredDays = Math.floor(expiredDiff / (1000 * 60 * 60 * 24));
  if (expiredDays === 0) {
    return { label: 'انتهت اليوم' };
  }
  return { label: `انتهت منذ ${expiredDays} يوم` };
}

// Initial seed ad campaigns
export const defaultAdCampaigns: PlatformAdCampaign[] = [
  {
    id: 'ad_camp_default_1',
    tenantId: MASTER_TEMPLATE_TENANT_ID,
    tenantName: 'جمعية النور للتنمية والتضامن',
    tenantSlug: 'nour',
    tenantLogoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=200&q=80',
    tenantCity: 'الدار البيضاء',
    tenantCountry: 'المغرب',
    priorityOrder: 1,
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'حملة ترويجية للمشاريع التنموية الكبرى',
    notes: 'حملة إعلانية مميزة لتصدر مشاريع التنمية في الصفحة الأولى',
    enabled: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Super Admin',
  },
  {
    id: 'ad_camp_default_2',
    tenantId: 'tenant_amal_atlas',
    tenantName: 'جمعية أمل الأطلس لرعاية الأيتام',
    tenantSlug: 'amal-atlas',
    tenantLogoUrl: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=200&q=80',
    tenantCity: 'مراكش',
    tenantCountry: 'المغرب',
    priorityOrder: 2,
    startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'رعاية ودعم المبادرات التعليمية واليتامى',
    notes: 'ترتيب متقدم ضمن قائمة الجمعيات الأكثر نشاطاً',
    enabled: true,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Super Admin',
  },
];

let inMemoryCampaigns: PlatformAdCampaign[] | null = null;

function broadcastCampaignsChange(campaigns: PlatformAdCampaign[]): void {
  inMemoryCampaigns = campaigns;
  try {
    localStorage.setItem(AD_CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
  } catch (err) {
    console.warn('[AdCampaignStorage] localStorage write failed:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(AD_CAMPAIGNS_EVENT, { detail: { campaigns } })
    );
  }
}

/**
 * Get all advertising campaigns
 */
export function getAllAdCampaigns(): PlatformAdCampaign[] {
  if (inMemoryCampaigns) {
    return inMemoryCampaigns;
  }

  try {
    const raw = localStorage.getItem(AD_CAMPAIGNS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryCampaigns = parsed;
        return inMemoryCampaigns;
      }
    }
  } catch (err) {
    console.warn('[AdCampaignStorage] Error reading localStorage:', err);
  }

  inMemoryCampaigns = [...defaultAdCampaigns];
  try {
    localStorage.setItem(AD_CAMPAIGNS_STORAGE_KEY, JSON.stringify(inMemoryCampaigns));
  } catch {}
  return inMemoryCampaigns;
}

/**
 * Fetch ad campaigns asynchronously from server API and update cache
 */
export async function fetchAdCampaignsFromServer(): Promise<PlatformAdCampaign[]> {
  try {
    const res = await fetch('/api/ad-campaigns');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.campaigns)) {
        broadcastCampaignsChange(data.campaigns);
        return data.campaigns;
      }
    }
  } catch (err) {
    console.warn('[AdCampaignStorage] Server fetch failed, using local cache:', err);
  }
  return getAllAdCampaigns();
}

/**
 * Get only currently active ad campaigns (enabled, now >= startDate, now <= endDate)
 * sorted by priorityOrder ASC (1, 2, 3...)
 */
export function getActiveAdCampaigns(refDate: Date = new Date()): PlatformAdCampaign[] {
  const all = getAllAdCampaigns();
  return all
    .filter((camp) => getAdCampaignStatus(camp, refDate) === 'active')
    .sort((a, b) => a.priorityOrder - b.priorityOrder);
}

/**
 * Saves (create or update) an advertising campaign
 */
export function saveAdCampaign(
  campaignData: Partial<PlatformAdCampaign> & { tenantId: string; priorityOrder: number; startDate: string; endDate: string }
): PlatformAdCampaign {
  const allTenants = getAllTenants();
  const matchedTenant = allTenants.find((t) => t.id === campaignData.tenantId);

  const current = getAllAdCampaigns();
  const nowIso = new Date().toISOString();

  let targetCampaign: PlatformAdCampaign;

  if (campaignData.id) {
    const existingIndex = current.findIndex((c) => c.id === campaignData.id);
    if (existingIndex >= 0) {
      targetCampaign = {
        ...current[existingIndex],
        ...campaignData,
        tenantName: matchedTenant ? matchedTenant.name : (campaignData.tenantName || current[existingIndex].tenantName),
        tenantSlug: matchedTenant?.slug || campaignData.tenantSlug || current[existingIndex].tenantSlug,
        tenantLogoUrl: matchedTenant?.logoUrl || campaignData.tenantLogoUrl || current[existingIndex].tenantLogoUrl,
        tenantCity: matchedTenant?.city || campaignData.tenantCity || current[existingIndex].tenantCity,
        tenantCountry: matchedTenant?.country || campaignData.tenantCountry || current[existingIndex].tenantCountry,
        updatedAt: nowIso,
      };
      current[existingIndex] = targetCampaign;
    } else {
      targetCampaign = {
        id: campaignData.id,
        tenantId: campaignData.tenantId,
        tenantName: matchedTenant ? matchedTenant.name : (campaignData.tenantName || 'جمعية'),
        tenantSlug: matchedTenant?.slug || campaignData.tenantSlug,
        tenantLogoUrl: matchedTenant?.logoUrl || campaignData.tenantLogoUrl,
        tenantCity: matchedTenant?.city || campaignData.tenantCity,
        tenantCountry: matchedTenant?.country || campaignData.tenantCountry,
        priorityOrder: Number(campaignData.priorityOrder) || 1,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        title: campaignData.title || '',
        notes: campaignData.notes || '',
        enabled: campaignData.enabled !== false,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: 'Super Admin',
      };
      current.push(targetCampaign);
    }
  } else {
    targetCampaign = {
      id: `ad_camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId: campaignData.tenantId,
      tenantName: matchedTenant ? matchedTenant.name : (campaignData.tenantName || 'جمعية'),
      tenantSlug: matchedTenant?.slug || campaignData.tenantSlug,
      tenantLogoUrl: matchedTenant?.logoUrl || campaignData.tenantLogoUrl,
      tenantCity: matchedTenant?.city || campaignData.tenantCity,
      tenantCountry: matchedTenant?.country || campaignData.tenantCountry,
      priorityOrder: Number(campaignData.priorityOrder) || 1,
      startDate: campaignData.startDate,
      endDate: campaignData.endDate,
      title: campaignData.title || '',
      notes: campaignData.notes || '',
      enabled: campaignData.enabled !== false,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: 'Super Admin',
    };
    current.push(targetCampaign);
  }

  broadcastCampaignsChange([...current]);

  // Sync to server in background
  try {
    fetch('/api/ad-campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign: targetCampaign }),
    }).catch((e) => console.warn('[AdCampaignStorage] Background server sync warning:', e));
  } catch {}

  return targetCampaign;
}

/**
 * Delete an advertising campaign
 */
export function deleteAdCampaign(id: string): boolean {
  const current = getAllAdCampaigns();
  const filtered = current.filter((c) => c.id !== id);
  if (filtered.length !== current.length) {
    broadcastCampaignsChange(filtered);

    try {
      fetch(`/api/ad-campaigns/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch((e) => console.warn('[AdCampaignStorage] Background delete warning:', e));
    } catch {}

    return true;
  }
  return false;
}

/**
 * Toggle active/paused state of an ad campaign
 */
export function toggleAdCampaignStatus(id: string, newEnabledState?: boolean): PlatformAdCampaign | null {
  const current = getAllAdCampaigns();
  const index = current.findIndex((c) => c.id === id);
  if (index >= 0) {
    const updated = {
      ...current[index],
      enabled: newEnabledState !== undefined ? newEnabledState : !current[index].enabled,
      updatedAt: new Date().toISOString(),
    };
    current[index] = updated;
    broadcastCampaignsChange([...current]);

    try {
      fetch(`/api/ad-campaigns/${encodeURIComponent(id)}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: updated.enabled }),
      }).catch((e) => console.warn('[AdCampaignStorage] Background toggle warning:', e));
    } catch {}

    return updated;
  }
  return null;
}

/**
 * Get active advertising campaign for a specific tenant (if any)
 */
export function getAdCampaignForTenant(
  tenantId: string,
  refDate: Date = new Date()
): PlatformAdCampaign | null {
  const all = getAllAdCampaigns();
  const activeForTenant = all.filter(
    (camp) => camp.tenantId === tenantId && getAdCampaignStatus(camp, refDate) === 'active'
  );

  if (activeForTenant.length === 0) return null;

  // Pick highest priority (smallest number)
  activeForTenant.sort((a, b) => a.priorityOrder - b.priorityOrder);
  return activeForTenant[0];
}

/**
 * Core Algorithm: Applies active Ad Campaigns to sort and prioritize associations
 * in "تبرع وشارك في مشاريع التنمية".
 * 
 * Rules:
 * 1. An association with an ACTIVE campaign gets ranked according to its priorityOrder (1, 2, 3...)
 * 2. If multiple associations share the same priorityOrder, they are sorted by earliest startDate
 * 3. Expired, scheduled (not yet started), or disabled campaigns DO NOT affect the order;
 *    those associations cleanly drop back to default ranking.
 * 4. Associations without active campaigns follow the sponsored list, preserving their normal sequence
 *    (e.g., Master Template first, then others by creation/activity).
 */
export function applyAdCampaignPriorityToTenants(
  tenantsList: AssociationTenant[],
  refDate: Date = new Date(),
  cachedCampaigns?: PlatformAdCampaign[]
): AssociationTenant[] {
  const allCampaigns = cachedCampaigns || getAllAdCampaigns();
  
  // Find active campaigns map by tenantId
  // In case an association has multiple active campaigns, pick the one with the highest priority (smallest number)
  const activeCampaignsByTenant = new Map<string, PlatformAdCampaign>();

  allCampaigns.forEach((camp) => {
    if (getAdCampaignStatus(camp, refDate) === 'active') {
      const existing = activeCampaignsByTenant.get(camp.tenantId);
      if (!existing || camp.priorityOrder < existing.priorityOrder) {
        activeCampaignsByTenant.set(camp.tenantId, camp);
      }
    }
  });

  const sponsoredTenants: { tenant: AssociationTenant; campaign: PlatformAdCampaign }[] = [];
  const regularTenants: AssociationTenant[] = [];

  tenantsList.forEach((tenant) => {
    const activeCamp = activeCampaignsByTenant.get(tenant.id);
    if (activeCamp) {
      sponsoredTenants.push({ tenant, campaign: activeCamp });
    } else {
      regularTenants.push(tenant);
    }
  });

  // Sort sponsored tenants strictly by priorityOrder ascending (1, 2, 3...)
  sponsoredTenants.sort((a, b) => {
    if (a.campaign.priorityOrder !== b.campaign.priorityOrder) {
      return a.campaign.priorityOrder - b.campaign.priorityOrder;
    }
    // Fallback: earliest start date
    return new Date(a.campaign.startDate).getTime() - new Date(b.campaign.startDate).getTime();
  });

  // Sort regular tenants: Master Template first, then others
  regularTenants.sort((a, b) => {
    if (a.id === MASTER_TEMPLATE_TENANT_ID) return -1;
    if (b.id === MASTER_TEMPLATE_TENANT_ID) return 1;
    return 0;
  });

  return [
    ...sponsoredTenants.map((s) => s.tenant),
    ...regularTenants,
  ];
}

// ==================== CAMPAIGN LAUNCH REQUESTS (طلبات تدشين حملة جديدة) ====================

export const defaultAdCampaignRequests: AdCampaignRequest[] = [
  {
    id: 'ad_req_demo_1',
    tenantId: 'tenant_amal_atlas',
    tenantName: 'جمعية أمل الأطلس لرعاية الأيتام',
    tenantSlug: 'amal-atlas',
    tenantLogoUrl: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=200&q=80',
    tenantCity: 'مراكش',
    tenantCountry: 'المغرب',
    ownerId: 'owner_amal',
    ownerName: 'عبد اللطيف التازي',
    ownerPhone: '+212 661-889900',
    campaignTitle: 'حملة إعلان مبادرات التعليم والرعاية المدرسية',
    campaignDescription: 'طلب ترويج مشاريع الجمعية وتصدر قائمة التبرعات في الصفحة الأولى لمدة 3 أشهر خلال الموسم الدراسي الجديد.',
    monthsCount: 3,
    startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 91 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    requestedPriorityOrder: 2,
    amount: 597,
    currency: 'MAD',
    monthlyRate: 199,
    status: 'paid_pending_review',
    paymentStatus: 'pending_verification',
    paymentId: 'pay_ad_demo_1',
    paymentMethod: 'bank_transfer',
    paymentReference: 'TR-BMCE-992014',
    paymentSubmittedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    paymentAmount: 597,
    paymentCurrency: 'MAD',
    proofFileName: 'recu_virement_bmce.jpg',
    proofDocumentUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ad_req_demo_2',
    tenantId: MASTER_TEMPLATE_TENANT_ID,
    tenantName: 'جمعية النور للتنمية والتضامن',
    tenantSlug: 'nour',
    tenantLogoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=200&q=80',
    tenantCity: 'الدار البيضاء',
    tenantCountry: 'المغرب',
    ownerId: 'owner_nour',
    ownerName: 'الحاج بوشعيب الزهراني',
    ownerPhone: '+212 661-123456',
    campaignTitle: 'حملة ترويجية للمشاريع التنموية الكبرى',
    campaignDescription: 'إعلان سنوي لتسليط الضوء على مبادرات التنمية المستدامة والتضامن الاجتماعي.',
    monthsCount: 1,
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    requestedPriorityOrder: 1,
    amount: 199,
    currency: 'MAD',
    monthlyRate: 199,
    status: 'approved',
    paymentStatus: 'confirmed',
    paymentId: 'pay_ad_demo_2',
    paymentMethod: 'credit_card',
    paymentReference: 'CMI-8823190',
    paymentSubmittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    paymentAmount: 199,
    paymentCurrency: 'MAD',
    cardLast4: '4242',
    reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reviewedBy: 'الإدارة العامة للمنصة',
    approvedCampaignId: 'ad_camp_default_1',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ad_req_demo_3',
    tenantId: 'tenant_basma_takaful',
    tenantName: 'جمعية بسمة للتكافل والعمل الخيري',
    tenantSlug: 'basma-takaful',
    tenantCity: 'طنجة',
    tenantCountry: 'المغرب',
    ownerId: 'owner_basma',
    ownerName: 'فاطمة الزهراء بنجلون',
    ownerPhone: '+212 662-445566',
    campaignTitle: 'تدشين إعلان مشاريع الإطعام وقفة الشتاء',
    campaignDescription: 'الرغبة في ظهور مشاريع الإطعام الدافئ وقوافل المساعدات الشتوية في الواجهة الأمامية للمنصة.',
    monthsCount: 2,
    startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 62 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    requestedPriorityOrder: 3,
    amount: 398,
    currency: 'MAD',
    monthlyRate: 199,
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ad_req_demo_4',
    tenantId: 'tenant_yad_fi_yad',
    tenantName: 'جمعية اليد في اليد لدعم التعليم',
    tenantSlug: 'yad-fi-yad',
    tenantCity: 'فاس',
    tenantCountry: 'المغرب',
    ownerId: 'owner_yad',
    ownerName: 'ياسين الفاسي',
    ownerPhone: '+212 663-778899',
    campaignTitle: 'حملة ترميم المدارس القروية',
    campaignDescription: 'إعلان للتعريف ببرنامج تجهيز وترميم أقسام المدارس بالمناطق النائية.',
    monthsCount: 2,
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    requestedPriorityOrder: 2,
    amount: 398,
    currency: 'MAD',
    monthlyRate: 199,
    status: 'rejected',
    paymentStatus: 'failed',
    rejectionReason: 'وصل التحويل البنكي المرفق غير واضح والمبلغ المحول لا يطابق مدة الشهرين. يرجى إعادة إرسال الطلب مع وصل بنكي مقروء بالمبلغ الصحيح.',
    reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reviewedBy: 'الإدارة المركزية',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

let inMemoryCampaignRequests: AdCampaignRequest[] | null = null;

function broadcastCampaignRequestsChange(requests: AdCampaignRequest[]): void {
  inMemoryCampaignRequests = requests;
  try {
    localStorage.setItem(AD_CAMPAIGN_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  } catch (err) {
    console.warn('[AdCampaignStorage] localStorage write failed for requests:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(AD_CAMPAIGN_REQUESTS_EVENT, { detail: { requests } })
    );
  }
}

/**
 * Get all advertising campaign launch requests
 */
export function getAllAdCampaignRequests(): AdCampaignRequest[] {
  if (inMemoryCampaignRequests) {
    return inMemoryCampaignRequests;
  }

  try {
    const raw = localStorage.getItem(AD_CAMPAIGN_REQUESTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryCampaignRequests = parsed;
        return inMemoryCampaignRequests;
      }
    }
  } catch (err) {
    console.warn('[AdCampaignStorage] Error reading campaign requests from localStorage:', err);
  }

  inMemoryCampaignRequests = [...defaultAdCampaignRequests];
  try {
    localStorage.setItem(AD_CAMPAIGN_REQUESTS_STORAGE_KEY, JSON.stringify(inMemoryCampaignRequests));
  } catch {}
  return inMemoryCampaignRequests;
}

/**
 * Fetch ad campaign requests asynchronously from server API and update cache
 */
export async function fetchAdCampaignRequestsFromServer(): Promise<AdCampaignRequest[]> {
  try {
    const res = await fetch('/api/ad-campaign-requests');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        broadcastCampaignRequestsChange(data.requests);
        return data.requests;
      }
    }
  } catch (err) {
    console.warn('[AdCampaignStorage] Server fetch for requests failed, using local cache:', err);
  }
  return getAllAdCampaignRequests();
}

/**
 * Get request by ID
 */
export function getAdCampaignRequestById(id: string): AdCampaignRequest | undefined {
  const all = getAllAdCampaignRequests();
  return all.find((r) => r.id === id);
}

/**
 * Get all requests for a specific tenant
 */
export function getAdCampaignRequestsByTenant(tenantId: string): AdCampaignRequest[] {
  const all = getAllAdCampaignRequests();
  return all
    .filter((r) => r.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Creates or updates an ad campaign launch request
 */
export function createOrUpdateAdCampaignRequest(
  data: Partial<AdCampaignRequest> & {
    tenantId: string;
    campaignTitle: string;
    monthsCount: number;
    startDate: string;
    endDate: string;
    amount: number;
  }
): AdCampaignRequest {
  const allTenants = getAllTenants();
  const matchedTenant = allTenants.find((t) => t.id === data.tenantId);

  const current = getAllAdCampaignRequests();
  const nowIso = new Date().toISOString();

  let targetRequest: AdCampaignRequest;

  if (data.id) {
    const existingIndex = current.findIndex((r) => r.id === data.id);
    if (existingIndex >= 0) {
      targetRequest = {
        ...current[existingIndex],
        ...data,
        tenantName: matchedTenant ? matchedTenant.name : (data.tenantName || current[existingIndex].tenantName),
        tenantSlug: matchedTenant?.slug || data.tenantSlug || current[existingIndex].tenantSlug,
        tenantLogoUrl: matchedTenant?.logoUrl || data.tenantLogoUrl || current[existingIndex].tenantLogoUrl,
        tenantCity: matchedTenant?.city || data.tenantCity || current[existingIndex].tenantCity,
        tenantCountry: matchedTenant?.country || data.tenantCountry || current[existingIndex].tenantCountry,
        ownerId: matchedTenant?.ownerId || data.ownerId || current[existingIndex].ownerId,
        ownerName: matchedTenant?.ownerName || data.ownerName || current[existingIndex].ownerName,
        ownerPhone: matchedTenant?.ownerPhone || data.ownerPhone || current[existingIndex].ownerPhone,
        campaignTitle: data.campaignTitle || current[existingIndex].campaignTitle,
        campaignDescription: data.campaignDescription !== undefined ? data.campaignDescription : current[existingIndex].campaignDescription,
        campaignBannerUrl: data.campaignBannerUrl !== undefined ? data.campaignBannerUrl : current[existingIndex].campaignBannerUrl,
        monthsCount: data.monthsCount || current[existingIndex].monthsCount,
        startDate: data.startDate || current[existingIndex].startDate,
        endDate: data.endDate || current[existingIndex].endDate,
        requestedPriorityOrder: data.requestedPriorityOrder || current[existingIndex].requestedPriorityOrder,
        amount: data.amount || current[existingIndex].amount,
        currency: data.currency || current[existingIndex].currency,
        monthlyRate: data.monthlyRate || current[existingIndex].monthlyRate,
        status: data.status || current[existingIndex].status,
        paymentStatus: data.paymentStatus || current[existingIndex].paymentStatus,
        paymentId: data.paymentId || current[existingIndex].paymentId,
        paymentMethod: data.paymentMethod || current[existingIndex].paymentMethod,
        paymentReference: data.paymentReference || current[existingIndex].paymentReference,
        paymentSubmittedAt: data.paymentSubmittedAt || current[existingIndex].paymentSubmittedAt,
        paymentAmount: data.paymentAmount || current[existingIndex].paymentAmount,
        paymentCurrency: data.paymentCurrency || current[existingIndex].paymentCurrency,
        proofDocumentUrl: data.proofDocumentUrl || current[existingIndex].proofDocumentUrl,
        proofFileName: data.proofFileName || current[existingIndex].proofFileName,
        cardLast4: data.cardLast4 || current[existingIndex].cardLast4,
        updatedAt: nowIso,
      };
      current[existingIndex] = targetRequest;
    } else {
      targetRequest = {
        id: data.id,
        tenantId: data.tenantId,
        tenantName: matchedTenant ? matchedTenant.name : (data.tenantName || 'جمعية'),
        tenantSlug: matchedTenant?.slug || data.tenantSlug,
        tenantLogoUrl: matchedTenant?.logoUrl || data.tenantLogoUrl,
        tenantCity: matchedTenant?.city || data.tenantCity,
        tenantCountry: matchedTenant?.country || data.tenantCountry,
        ownerId: matchedTenant?.ownerId || data.ownerId,
        ownerName: matchedTenant?.ownerName || data.ownerName,
        ownerPhone: matchedTenant?.ownerPhone || data.ownerPhone,
        campaignTitle: data.campaignTitle,
        campaignDescription: data.campaignDescription || '',
        campaignBannerUrl: data.campaignBannerUrl,
        monthsCount: data.monthsCount,
        startDate: data.startDate,
        endDate: data.endDate,
        requestedPriorityOrder: data.requestedPriorityOrder || 1,
        amount: data.amount,
        currency: data.currency || (matchedTenant?.country === 'المغرب' ? 'MAD' : 'USD'),
        monthlyRate: data.monthlyRate || getAdCreationFeeForCountry(matchedTenant?.country || data.tenantCountry || 'المغرب').amount,
        status: data.status || 'pending_payment',
        paymentStatus: data.paymentStatus || 'unpaid',
        paymentId: data.paymentId,
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference,
        paymentSubmittedAt: data.paymentSubmittedAt,
        paymentAmount: data.paymentAmount,
        paymentCurrency: data.paymentCurrency,
        proofDocumentUrl: data.proofDocumentUrl,
        proofFileName: data.proofFileName,
        cardLast4: data.cardLast4,
        createdAt: data.createdAt || nowIso,
        updatedAt: nowIso,
      };
      current.unshift(targetRequest);
    }
  } else {
    // Generate new unique ID
    const newId = `ad_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    targetRequest = {
      id: newId,
      tenantId: data.tenantId,
      tenantName: matchedTenant ? matchedTenant.name : (data.tenantName || 'جمعية'),
      tenantSlug: matchedTenant?.slug || data.tenantSlug,
      tenantLogoUrl: matchedTenant?.logoUrl || data.tenantLogoUrl,
      tenantCity: matchedTenant?.city || data.tenantCity,
      tenantCountry: matchedTenant?.country || data.tenantCountry,
      ownerId: matchedTenant?.ownerId || data.ownerId,
      ownerName: matchedTenant?.ownerName || data.ownerName,
      ownerPhone: matchedTenant?.ownerPhone || data.ownerPhone,
      campaignTitle: data.campaignTitle,
      campaignDescription: data.campaignDescription || '',
      campaignBannerUrl: data.campaignBannerUrl,
      monthsCount: data.monthsCount,
      startDate: data.startDate,
      endDate: data.endDate,
      requestedPriorityOrder: data.requestedPriorityOrder || 1,
      amount: data.amount,
      currency: data.currency || (matchedTenant?.country === 'المغرب' ? 'MAD' : 'USD'),
      monthlyRate: data.monthlyRate || (matchedTenant?.country === 'المغرب' ? 199 : 20),
      status: data.status || 'pending_payment',
      paymentStatus: data.paymentStatus || 'unpaid',
      paymentId: data.paymentId,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      paymentSubmittedAt: data.paymentSubmittedAt,
      paymentAmount: data.paymentAmount,
      paymentCurrency: data.paymentCurrency,
      proofDocumentUrl: data.proofDocumentUrl,
      proofFileName: data.proofFileName,
      cardLast4: data.cardLast4,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    current.unshift(targetRequest);
  }

  broadcastCampaignRequestsChange([...current]);

  // Sync with backend API
  try {
    fetch('/api/ad-campaign-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetRequest),
    }).catch((e) => console.warn('[AdCampaignStorage] Sync request failed:', e));
  } catch {}

  return targetRequest;
}

/**
 * Links a payment to an ad campaign request and updates statuses to paid_pending_review
 */
export function linkPaymentToAdCampaignRequest(
  requestId: string,
  paymentData: {
    paymentId: string;
    paymentMethod: any;
    paymentReference?: string;
    paymentAmount: number;
    paymentCurrency: 'MAD' | 'USD';
    proofDocumentUrl?: string;
    proofFileName?: string;
    cardLast4?: string;
    notes?: string;
  }
): AdCampaignRequest | null {
  const current = getAllAdCampaignRequests();
  const index = current.findIndex((r) => r.id === requestId);
  if (index < 0) return null;

  const nowIso = new Date().toISOString();
  const updated: AdCampaignRequest = {
    ...current[index],
    status: 'paid_pending_review',
    paymentStatus: 'pending_verification',
    paymentId: paymentData.paymentId,
    paymentMethod: paymentData.paymentMethod,
    paymentReference: paymentData.paymentReference,
    paymentAmount: paymentData.paymentAmount,
    paymentCurrency: paymentData.paymentCurrency,
    paymentSubmittedAt: nowIso,
    proofDocumentUrl: paymentData.proofDocumentUrl,
    proofFileName: paymentData.proofFileName,
    cardLast4: paymentData.cardLast4,
    adminNotes: paymentData.notes || current[index].adminNotes,
    updatedAt: nowIso,
  };

  current[index] = updated;
  broadcastCampaignRequestsChange([...current]);

  try {
    fetch('/api/ad-campaign-requests/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, ...paymentData }),
    }).catch(() => {});
  } catch {}

  return updated;
}

/**
 * Reviews a campaign launch request: Approve, Reject, or Request Correction
 */
export function reviewAdCampaignRequest(
  requestId: string,
  decision: 'approve' | 'reject' | 'correction_requested' | 'under_review',
  options: {
    rejectionReason?: string;
    correctionNotes?: string;
    adminNotes?: string;
    adminName?: string;
    priorityOrder?: number;
    customStartDate?: string;
    customEndDate?: string;
  } = {}
): { success: boolean; request?: AdCampaignRequest; campaign?: PlatformAdCampaign; error?: string } {
  const current = getAllAdCampaignRequests();
  const index = current.findIndex((r) => r.id === requestId);
  if (index < 0) {
    return { success: false, error: 'طلب تدشين الحملة غير موجود' };
  }

  const req = current[index];
  const nowIso = new Date().toISOString();
  const adminName = options.adminName || 'الإدارة العامة للمنصة';

  if (decision === 'approve') {
    // 1. Determine campaign start and end dates
    const finalStart = options.customStartDate || req.startDate || nowIso;
    let finalEnd = options.customEndDate || req.endDate;
    if (!finalEnd) {
      const d = new Date(finalStart);
      d.setMonth(d.getMonth() + (req.monthsCount || 1));
      finalEnd = d.toISOString();
    }

    const priority = options.priorityOrder !== undefined ? Number(options.priorityOrder) : (req.requestedPriorityOrder || 1);

    // 2. Create and activate PlatformAdCampaign in live ranking system
    const campaign = saveAdCampaign({
      id: req.approvedCampaignId || `ad_camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId: req.tenantId,
      priorityOrder: priority,
      startDate: finalStart,
      endDate: finalEnd,
      title: req.campaignTitle,
      notes: options.adminNotes || req.campaignDescription || `حملة مفعلة بعد مراجعة الطلب رقم ${req.id}`,
      enabled: true,
      createdBy: adminName,
    });

    // 3. Confirm linked payment record if present
    if (req.paymentId) {
      try {
        const payments = getAllTenantPayments();
        const pIdx = payments.findIndex((p) => p.id === req.paymentId || p.transactionReference === req.paymentReference);
        if (pIdx >= 0) {
          payments[pIdx].status = 'confirmed';
          payments[pIdx].reviewedAt = nowIso;
          payments[pIdx].reviewedBy = adminName;
          payments[pIdx].adCampaignId = campaign.id;
          saveAllTenantPayments(payments);
        }
      } catch (err) {
        console.warn('[AdCampaignStorage] Error updating payment record on approval:', err);
      }
    }

    // 4. Update request object
    const updatedRequest: AdCampaignRequest = {
      ...req,
      status: 'approved',
      paymentStatus: 'confirmed',
      approvedCampaignId: campaign.id,
      startDate: finalStart,
      endDate: finalEnd,
      requestedPriorityOrder: priority,
      reviewedAt: nowIso,
      reviewedBy: adminName,
      adminNotes: options.adminNotes || req.adminNotes,
      updatedAt: nowIso,
    };

    current[index] = updatedRequest;
    broadcastCampaignRequestsChange([...current]);

    // Backend sync
    try {
      fetch('/api/ad-campaign-requests/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          decision: 'approve',
          campaignId: campaign.id,
          priorityOrder: priority,
          startDate: finalStart,
          endDate: finalEnd,
          adminName,
          adminNotes: options.adminNotes,
        }),
      }).catch(() => {});
    } catch {}

    return { success: true, request: updatedRequest, campaign };
  }

  if (decision === 'reject') {
    if (!options.rejectionReason?.trim()) {
      return { success: false, error: 'يرجى كتابة سبب الرفض لتوضيحه للجمعية' };
    }

    const updatedRequest: AdCampaignRequest = {
      ...req,
      status: 'rejected',
      paymentStatus: req.paymentStatus === 'pending_verification' ? 'failed' : req.paymentStatus,
      rejectionReason: options.rejectionReason.trim(),
      reviewedAt: nowIso,
      reviewedBy: adminName,
      adminNotes: options.adminNotes || req.adminNotes,
      updatedAt: nowIso,
    };

    current[index] = updatedRequest;
    broadcastCampaignRequestsChange([...current]);

    // Update payment record to rejected as well if linked
    if (req.paymentId) {
      try {
        const payments = getAllTenantPayments();
        const pIdx = payments.findIndex((p) => p.id === req.paymentId);
        if (pIdx >= 0) {
          payments[pIdx].status = 'rejected';
          payments[pIdx].rejectionReason = options.rejectionReason.trim();
          payments[pIdx].reviewedAt = nowIso;
          payments[pIdx].reviewedBy = adminName;
          saveAllTenantPayments(payments);
        }
      } catch {}
    }

    // Backend sync
    try {
      fetch('/api/ad-campaign-requests/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          decision: 'reject',
          rejectionReason: options.rejectionReason.trim(),
          adminName,
          adminNotes: options.adminNotes,
        }),
      }).catch(() => {});
    } catch {}

    return { success: true, request: updatedRequest };
  }

  if (decision === 'correction_requested') {
    const updatedRequest: AdCampaignRequest = {
      ...req,
      status: 'correction_requested',
      correctionNotes: options.correctionNotes?.trim() || 'يرجى استكمال وتصحيح تفاصيل الحملة أو وصل الدفع.',
      reviewedAt: nowIso,
      reviewedBy: adminName,
      adminNotes: options.adminNotes || req.adminNotes,
      updatedAt: nowIso,
    };

    current[index] = updatedRequest;
    broadcastCampaignRequestsChange([...current]);

    // Backend sync
    try {
      fetch('/api/ad-campaign-requests/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          decision: 'correction_requested',
          correctionNotes: options.correctionNotes?.trim(),
          adminName,
          adminNotes: options.adminNotes,
        }),
      }).catch(() => {});
    } catch {}

    return { success: true, request: updatedRequest };
  }

  if (decision === 'under_review') {
    const updatedRequest: AdCampaignRequest = {
      ...req,
      status: 'under_review',
      reviewedAt: nowIso,
      reviewedBy: adminName,
      adminNotes: options.adminNotes || req.adminNotes,
      updatedAt: nowIso,
    };

    current[index] = updatedRequest;
    broadcastCampaignRequestsChange([...current]);
    return { success: true, request: updatedRequest };
  }

  return { success: false, error: 'إجراء غير صالح' };
}

/**
 * Delete a campaign request
 */
export function deleteAdCampaignRequest(id: string): boolean {
  const current = getAllAdCampaignRequests();
  const filtered = current.filter((r) => r.id !== id);
  if (filtered.length !== current.length) {
    broadcastCampaignRequestsChange(filtered);

    try {
      fetch(`/api/ad-campaign-requests/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => {});
    } catch {}

    return true;
  }
  return false;
}

