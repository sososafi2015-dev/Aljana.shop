import { 
  AssociationTenant, 
  AssociationOwner, 
  AssociationStatus,
  AssociationLegalDocument,
  PlatformMasterStats, 
  SubscriptionTier,
  CurrentAdminSession,
  AssociationSettings,
  Member,
  FinancialOperation,
  ActivityItem,
  DonationCampaign,
  MemberContribution,
  CampaignContribution,
  SubAdmin,
  BoardMember,
  AuditLog,
  UserRole,
  DEFAULT_DONATION_PRESETS,
  MasterAdminSession
} from './types';
import { 
  initialMembers, 
  initialBoardMembers, 
  initialContributions, 
  initialOperations, 
  initialActivities, 
  initialSettings, 
  initialRegistrationFields, 
  initialUIElements, 
  initialPolls, 
  initialMemberCardSettings, 
  initialSubAdmins, 
  initialCampaigns, 
  initialCampaignContributions, 
  initialContributionTypes, 
  defaultStoreThemeColors
} from './initialData';
import { hashPasswordSync, generateSalt, verifyPasswordAnyFormat, authenticateMember } from './security';
import { loadData, saveData, saveActivities, saveSettings, getStoredContributionTypes, getStoredUIElements, KEYS, saveCurrentAdminSession, clearCurrentAdminSession, getStoredMembers, saveMembers, saveBoardMembers, getStoredSubAdmins, saveSubAdmins, saveRegistrationFields, saveUIElements, saveAuditLogs, saveLoggedInMemberId, clearLoggedInMemberId, clonePollsFromMasterForTenant, savePolls, getStoredActivities, getStoredOperations, getStoredContributions, getStoredCampaignContributions, getStoredCampaigns } from './storage';
import { cloneReferenceActivitiesForNewTenant } from './utils/referenceContentVersioning';
import { calculateUnifiedAssociationFinancials } from './utils/transparencyUtils';
import { firestoreSyncService } from './services/firestoreSyncService';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ensurePermanentImageUrl } from './api/imageApi';
import { setTenantAuthToken, clearMasterAuthToken } from './authSessionClient';

export const MASTER_TEMPLATE_TENANT_ID = 'tenant_nour';

export const TENANT_DATA_KEYS = {
  CURRENT_ADMIN_SESSION: 'current_admin_session',
  SUB_ADMINS: 'sub_admins',
  MEMBERS: 'members',
  OPERATIONS: 'financial_operations',
  CONTRIBUTIONS: 'member_contributions',
  ACTIVITIES: 'activities',
  SETTINGS: 'settings',
  AUDIT_LOGS: 'audit_logs',
  CAMPAIGNS: 'donation_campaigns',
  CAMPAIGN_CONTRIBUTIONS: 'campaign_contributions',
};

const TENANT_STORAGE_KEYS = {
  ALL_TENANTS: 'chayef_all_tenants_v2',
  ALL_OWNERS: 'chayef_all_owners_v2',
  ACTIVE_TENANT_ID: 'chayef_active_tenant_id_v2',
  MASTER_ADMIN_SESSION: 'chayef_master_admin_session_v2',
  DELETED_TENANT_IDS: 'chayef_deleted_tenant_ids_v1',
};

// Pre-seeded Demo Associations
export const defaultTenants: AssociationTenant[] = [
  {
    id: MASTER_TEMPLATE_TENANT_ID,
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
    createdAt: '2024-01-01T00:00:00.000Z',
    subscriptionStartedAt: '2026-01-01T00:00:00.000Z',
    subscriptionExpiresAt: '2027-01-01T00:00:00.000Z',
    activationFeePaid: 199,
    activationFeeCurrency: 'MAD',
    activationFeeDate: '2026-01-01T00:00:00.000Z',
    tier: 'pro',
    monthlyFee: 399,
    isTemplate: true,
    isVisibleOnPublicPortal: true,
    enablePublicDonations: true,
    tagline: 'الشفافية والتكافل والتنمية المجتمعية المستدامة (القالب الأساسي Master Template)',
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
    createdAt: '2024-03-15T10:30:00.000Z',
    tier: 'basic',
    monthlyFee: 199,
    isTemplate: false,
    isVisibleOnPublicPortal: false,
    tagline: 'رعاية الأيتام والنهوض بالتعليم والتكافل المجتمعي',
    stats: {
      membersCount: 8,
      activitiesCount: 4,
      totalBalance: 24300,
      campaignsCount: 2,
    },
  },
  {
    id: 'tenant_1789045972557_t35i',
    name: 'جمعية أطلس للتنمية والأعمال الاجتماعية',
    nameFr: "Association Atlas pour le Développement et l'Action Sociale",
    nameEn: 'Atlas Association for Development',
    country: 'المغرب',
    city: 'خنيفرة',
    slug: 'atlas-khenifra',
    logoUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=300&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
    ownerId: 'owner_1789045972557_8ycr',
    ownerUsername: 'atlas2024',
    ownerName: 'يوسف الرباحي',
    ownerPhone: '0612458765',
    status: 'active',
    createdAt: '2024-04-10T09:00:00.000Z',
    tier: 'pro',
    monthlyFee: 299,
    isTemplate: false,
    isVisibleOnPublicPortal: false,
    tagline: 'تأهيل دور الأيتام، فك العزلة عن القرى الجبلية، والمبادرات الصحية والتعليمية',
    stats: {
      membersCount: 12,
      activitiesCount: 6,
      totalBalance: 32000,
      campaignsCount: 3,
    },
  },
  {
    id: 'tenant_1789212385161_k79d',
    name: 'جمعية البر والإحسان للتضامن الإنساني',
    nameFr: 'Association Al-Birr pour la Solidarité Humaine',
    nameEn: 'Al-Birr Association for Human Solidarity',
    country: 'المغرب',
    city: 'مراكش',
    slug: 'albir-marrakech',
    logoUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=300&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=80',
    ownerId: 'owner_1789212385161_ud49',
    ownerName: 'سليمان بن',
    ownerPhone: '+212 6 89 56 23 56',
    status: 'active',
    createdAt: '2024-05-12T14:30:00.000Z',
    tier: 'pro',
    monthlyFee: 349,
    isTemplate: false,
    isVisibleOnPublicPortal: false,
    tagline: 'قوافل الإغاثة الشتوية، إفطار الصائم، ومشاريع كفالة الأيتام والأسر المعوزة',
    stats: {
      membersCount: 15,
      activitiesCount: 5,
      totalBalance: 51200,
      campaignsCount: 2,
    },
  },
  {
    id: 'tenant_ihsan_sa',
    name: 'جمعية الإحسان للتنمية والتكافل الاجتماعي',
    nameFr: 'Association Al-Ihsan pour le Développement',
    nameEn: 'Al-Ihsan Society for Social Solidarity',
    country: 'السعودية',
    city: 'الرياض',
    slug: 'al-ihsan-sa',
    logoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=300&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80',
    ownerId: 'owner_ihsan_sa',
    ownerName: 'عبدالرحمن بن سعود',
    ownerPhone: '+966501234567',
    status: 'active',
    createdAt: '2024-06-01T10:00:00.000Z',
    tier: 'enterprise',
    monthlyFee: 599,
    isTemplate: false,
    isVisibleOnPublicPortal: false,
    tagline: 'مشاريع التمكين المجتمعي، سلال العطاء، ودعم الأسر المتعففة والطلاب',
    stats: {
      membersCount: 24,
      activitiesCount: 7,
      totalBalance: 98500,
      campaignsCount: 2,
    },
  },
  {
    id: 'tenant_takafol_eg',
    name: 'جمعية تكافل وبناء للرعاية والتنمية',
    nameFr: 'Association Takaful et Construction',
    nameEn: 'Takaful & Building Society',
    country: 'مصر',
    city: 'القاهرة',
    slug: 'takafol-cairo',
    logoUrl: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=300&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1200&q=80',
    ownerId: 'owner_takafol_eg',
    ownerName: 'محمود حسن الشريف',
    ownerPhone: '+201012345678',
    status: 'active',
    createdAt: '2024-07-01T11:00:00.000Z',
    tier: 'pro',
    monthlyFee: 299,
    isTemplate: false,
    isVisibleOnPublicPortal: false,
    tagline: 'تنمية القرى الأكثر احتياجاً، تيسير الزواج، والقوافل الطبية المجانية',
    stats: {
      membersCount: 18,
      activitiesCount: 6,
      totalBalance: 65000,
      campaignsCount: 2,
    },
  },
  {
    id: 'tenant_1792430222354_klrf',
    name: 'جمعية بسمة للتنمية',
    nameFr: 'Association Basma pour le Développement',
    nameEn: 'Basma Association for Development',
    country: 'المغرب',
    city: 'فاس',
    slug: 'assoc-1792430222354',
    logoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=300&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80',
    ownerId: 'owner_1792430222354_0140',
    ownerName: 'سعيد الفاسي',
    ownerPhone: '0611223344',
    status: 'active',
    paymentVerified: true,
    createdAt: '2026-10-19T17:17:02.354Z',
    tier: 'pro',
    monthlyFee: 299,
    isTemplate: false,
    isVisibleOnPublicPortal: false,
    enablePublicDonations: true,
    tagline: 'الشفافية والتكافل والتنمية المجتمعية المستدامة',
    stats: {
      membersCount: 1,
      activitiesCount: 8,
      totalBalance: 0,
      campaignsCount: 3,
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
  },
];

// Pre-seeded Association Owners
export const defaultOwners: AssociationOwner[] = [
  {
    id: 'owner_nour_master',
    username: 'nour2024',
    fullName: 'أحمد المنصوري',
    phone: '0661000001',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // 'admin123'
    passwordSalt: 'nour_salt_123',
    tenantId: MASTER_TEMPLATE_TENANT_ID,
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
  {
    id: 'owner_borj_nador',
    username: 'borj2024',
    fullName: 'مسؤول جمعية برج الناضور',
    phone: '0661000101',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    passwordSalt: 'borj_nador_salt',
    tenantId: 'tenant_borj_nador',
    status: 'active',
    createdAt: '2026-10-19T18:00:00.000Z',
  },
  {
    id: 'owner_al_istithmar',
    username: 'istithmar24',
    fullName: 'مسؤول جمعية الاستثمار',
    phone: '0661000202',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    passwordSalt: 'al_istithmar_salt',
    tenantId: 'tenant_al_istithmar',
    status: 'active',
    createdAt: '2026-10-19T18:10:00.000Z',
  },
];

function getDeletedTenantIds(): Set<string> {
  try {
    const raw = loadData<string[]>(TENANT_STORAGE_KEYS.DELETED_TENANT_IDS, []);
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function addDeletedTenantId(tenantId: string): void {
  try {
    const current = getDeletedTenantIds();
    current.add(tenantId);
    saveData(TENANT_STORAGE_KEYS.DELETED_TENANT_IDS, Array.from(current));
  } catch {}
}

// ==================== TENANTS MANAGEMENT ====================

export function getAllTenants(): AssociationTenant[] {
  const loaded = loadData<AssociationTenant[]>(TENANT_STORAGE_KEYS.ALL_TENANTS, defaultTenants);
  const deletedIds = getDeletedTenantIds();
  let needsUpdate = false;
  const uniqueTenantsMap = new Map<string, AssociationTenant>();

  const rawList = Array.isArray(loaded) ? loaded : defaultTenants;
  for (const t of rawList) {
    if (t && t.id && !deletedIds.has(t.id)) {
      uniqueTenantsMap.set(t.id, t);
    }
  }

  // Ensure core known tenants (including جمعية برج الناضور and جمعية الاستثمار) are present unless explicitly deleted
  for (const defT of defaultTenants) {
    if (defT && defT.id && !deletedIds.has(defT.id) && !uniqueTenantsMap.has(defT.id)) {
      // Check if user already has a locally created tenant with the same normalized Arabic name
      const alreadyHasSameName = Array.from(uniqueTenantsMap.values()).some(
        (existing) => normalizeArabicText(existing.name) === normalizeArabicText(defT.name)
      );
      if (!alreadyHasSameName || defT.id === MASTER_TEMPLATE_TENANT_ID) {
        uniqueTenantsMap.set(defT.id, defT);
        needsUpdate = true;
      }
    }
  }

  // Also scan localStorage for any orphaned tenant settings (`chayef_tenant_<id>_settings`) whose tenant record might have been dropped
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('chayef_tenant_') && key.endsWith('_settings')) {
          const extractedId = key.replace(/^chayef_tenant_/, '').replace(/_settings$/, '');
          if (extractedId && !uniqueTenantsMap.has(extractedId) && !deletedIds.has(extractedId)) {
            const rawSettings = localStorage.getItem(key);
            if (rawSettings) {
              const parsedSettings = JSON.parse(rawSettings);
              const sName = parsedSettings?.name || parsedSettings?.settings?.name;
              if (sName && sName !== 'جمعية الشايف' && sName !== 'جمعية النور للتنمية والتضامن') {
                const sObj = parsedSettings?.settings || parsedSettings;
                const addressParts = (sObj.address || 'الدار البيضاء، المغرب').split('،');
                const recoveredTenant: AssociationTenant = {
                  id: extractedId,
                  name: sName,
                  nameFr: sObj.nameFr || `Association ${sName}`,
                  nameEn: sObj.nameEn || `Association ${sName}`,
                  country: (addressParts[1] || 'المغرب').trim(),
                  city: (addressParts[0] || 'الدار البيضاء').trim(),
                  slug: `assoc-${extractedId.replace(/[^a-zA-Z0-9]/g, '')}`,
                  logoUrl: sObj.logoUrl || 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=300&q=80',
                  bannerImageUrl: sObj.bannerImageUrl || 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80',
                  ownerId: `owner_${extractedId}`,
                  ownerName: `مسؤول ${sName}`,
                  ownerPhone: sObj.phone || '0661000000',
                  status: 'pending_subscription',
                  paymentVerified: false,
                  createdAt: new Date().toISOString(),
                  tier: 'pro',
                  monthlyFee: 180,
                  isTemplate: false,
                  isVisibleOnPublicPortal: false,
                  enablePublicDonations: true,
                  tagline: sObj.tagline || `منصة العمل الجمعوي الشفاف والتنمية المستدامة`,
                  stats: { membersCount: 1, activitiesCount: 8, totalBalance: 0, campaignsCount: 3 },
                };
                uniqueTenantsMap.set(extractedId, recoveredTenant);
                needsUpdate = true;
              }
            }
          }
        }
      }
    } catch {}
  }

  const merged = Array.from(uniqueTenantsMap.values());

  const sanitized = merged.map((t) => {
    const isMaster = t.id === MASTER_TEMPLATE_TENANT_ID || t.isTemplate;
    if (isMaster) {
      if (t.isVisibleOnPublicPortal !== true || !t.isTemplate) {
        needsUpdate = true;
        return { ...t, isTemplate: true, isVisibleOnPublicPortal: true };
      }
    } else {
      if (t.isVisibleOnPublicPortal !== false) {
        needsUpdate = true;
        return { ...t, isTemplate: false, isVisibleOnPublicPortal: false };
      }
    }
    return t;
  });

  if (needsUpdate || (Array.isArray(loaded) && loaded.length !== sanitized.length)) {
    saveData(TENANT_STORAGE_KEYS.ALL_TENANTS, sanitized);
  }

  return sanitized;
}

/**
 * Returns only the associations that should appear on the public platform portal.
 * As strictly requested: ONLY «جمعية النور للتنمية والتضامن» (Master Template) is shown to users!
 * Any association created by users is strictly hidden from the public portal.
 */
export function getPublicPortalTenants(): AssociationTenant[] {
  const all = getAllTenants();
  return all.filter((t) => (t.isTemplate || t.id === MASTER_TEMPLATE_TENANT_ID) && t.isVisibleOnPublicPortal === true);
}

export function saveAllTenants(tenants: AssociationTenant[]): void {
  saveData(TENANT_STORAGE_KEYS.ALL_TENANTS, tenants);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chayef-tenants-changed', { detail: tenants }));
  }
  // Push to server API asynchronously (non-destructive merge on server)
  try {
    const owners = loadData<AssociationOwner[]>(TENANT_STORAGE_KEYS.ALL_OWNERS, defaultOwners);
    const deletedTenantIds = Array.from(getDeletedTenantIds());
    fetch('/api/tenants/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenants, owners, deletedTenantIds }),
    }).catch(() => {});
  } catch {}
}

/**
 * Applies live Cloud Firestore tenant snapshot updates to local cache & UI without triggering write-back loops
 */
export function applyRealtimeTenants(incomingTenants: AssociationTenant[]): void {
  if (!Array.isArray(incomingTenants) || incomingTenants.length === 0) return;
  const deletedIds = getDeletedTenantIds();
  const currentTenants = getAllTenants();
  const mergedMap = new Map<string, AssociationTenant>();

  for (const existing of currentTenants) {
    if (existing && existing.id && !deletedIds.has(existing.id)) {
      mergedMap.set(existing.id, existing);
    }
  }

  for (const incoming of incomingTenants) {
    if (!incoming || !incoming.id || !incoming.name || deletedIds.has(incoming.id)) continue;
    const prev = mergedMap.get(incoming.id);
    if (!prev) {
      mergedMap.set(incoming.id, incoming);
    } else {
      mergedMap.set(incoming.id, {
        ...prev,
        ...incoming,
        logoUrl: incoming.logoUrl || prev.logoUrl,
        bannerImageUrl: incoming.bannerImageUrl || prev.bannerImageUrl,
      });
    }
  }

  const mergedList = Array.from(mergedMap.values());
  saveData(TENANT_STORAGE_KEYS.ALL_TENANTS, mergedList);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chayef-tenants-changed', { detail: mergedList }));
  }
}

/**
 * Fetches tenants & owners from backend disk database and performs a non-destructive bidirectional merge
 * with local storage so newly created associations are never lost!
 */
export async function syncTenantsFromBackend(force = false): Promise<AssociationTenant[]> {
  try {
    const deletedIds = getDeletedTenantIds();
    const q = force ? `?force=true&_t=${Date.now()}` : `?_t=${Date.now()}`;
    const [tenantsRes, ownersRes] = await Promise.all([
      fetch(`/api/tenants${q}`, { cache: 'no-store' }),
      fetch('/api/tenants/owners', { cache: 'no-store' }).catch(() => null),
    ]);

    if (tenantsRes.ok) {
      const data = await tenantsRes.json();
      if (data && Array.isArray(data.deletedTenantIds)) {
        let deletedChanged = false;
        for (const delId of data.deletedTenantIds) {
          if (typeof delId === 'string' && delId.trim() && delId !== MASTER_TEMPLATE_TENANT_ID && !deletedIds.has(delId.trim())) {
            deletedIds.add(delId.trim());
            deletedChanged = true;
          }
        }
        if (deletedChanged) {
          saveData(TENANT_STORAGE_KEYS.DELETED_TENANT_IDS, Array.from(deletedIds));
        }
      }
      if (data && Array.isArray(data.tenants)) {
        const localTenants = getAllTenants();
        const mergedMap = new Map<string, AssociationTenant>();

        // 1. Seed with all local tenants first so locally created associations are NEVER lost
        for (const lt of localTenants) {
          if (lt && lt.id && !deletedIds.has(lt.id)) {
            mergedMap.set(lt.id, lt);
          }
        }

        let localHadUnsyncedTenants = false;
        const serverIds = new Set<string>();

        // 2. Merge server tenants
        for (const st of data.tenants) {
          if (!st || !st.id || deletedIds.has(st.id)) continue;
          serverIds.add(st.id);

          // Avoid duplicate if local already has a user-created tenant_17... with the exact same name as a recovered account
          if ((st as any).recoveredAccount) {
            const matchingRealLocal = Array.from(mergedMap.values()).find(
              (lt) => lt.id !== st.id && lt.id.startsWith('tenant_17') && normalizeArabicText(lt.name) === normalizeArabicText(st.name)
            );
            if (matchingRealLocal) {
              localHadUnsyncedTenants = true;
              continue;
            }
          }

              const existing = mergedMap.get(st.id);
              if (!existing) {
                mergedMap.set(st.id, st);
              } else {
                mergedMap.set(st.id, {
                  ...existing,
                  ...st,
                  ownerUsername: st.ownerUsername || existing.ownerUsername,
                  status: st.status || existing.status,
                  logoUrl: st.logoUrl !== undefined && st.logoUrl !== '' ? st.logoUrl : existing.logoUrl,
                  bannerImageUrl: st.bannerImageUrl !== undefined && st.bannerImageUrl !== '' ? st.bannerImageUrl : existing.bannerImageUrl,
                  legalDocument: st.legalDocument || existing.legalDocument,
                });
              }
            }

            for (const lt of localTenants) {
              if (lt && lt.id && !serverIds.has(lt.id) && !deletedIds.has(lt.id)) {
                localHadUnsyncedTenants = true;
              }
            }

            const masterDefault = defaultTenants.find((d) => d.id === MASTER_TEMPLATE_TENANT_ID) || defaultTenants[0];
            if (masterDefault && !mergedMap.has(masterDefault.id)) {
              mergedMap.set(masterDefault.id, masterDefault);
            }

            const mergedTenants = Array.from(mergedMap.values());
            saveData(TENANT_STORAGE_KEYS.ALL_TENANTS, mergedTenants);

            // 3. Merge owners from backend while preserving local username & hashed credentials
            let mergedOwners = getAllOwners();
            if (ownersRes && ownersRes.ok) {
              const ownersData = await ownersRes.json().catch(() => null);
              if (ownersData && Array.isArray(ownersData.owners)) {
                const ownersMap = new Map<string, AssociationOwner>();
                for (const lo of mergedOwners) {
                  if (lo && lo.id && !deletedIds.has(lo.tenantId)) {
                    ownersMap.set(lo.id, lo);
                  }
                }
                for (const so of ownersData.owners) {
                  if (!so || !so.id || deletedIds.has(so.tenantId)) continue;
                  const existingO = ownersMap.get(so.id);
                  if (!existingO) {
                    ownersMap.set(so.id, so);
                  } else {
                    ownersMap.set(so.id, {
                      ...existingO,
                      ...so,
                      username: so.username || existingO.username,
                      hasCustomPassword: so.hasCustomPassword ?? existingO.hasCustomPassword,
                      passwordHash: so.passwordHash || existingO.passwordHash,
                      passwordSalt: so.passwordSalt || existingO.passwordSalt,
                    });
                  }
                }
                mergedOwners = Array.from(ownersMap.values());
                saveData(TENANT_STORAGE_KEYS.ALL_OWNERS, mergedOwners);
              }
            }

        // If local had any tenants not yet on the server, push the merged state back to the server immediately
        if (localHadUnsyncedTenants) {
          fetch('/api/tenants/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenants: mergedTenants,
              owners: mergedOwners,
              deletedTenantIds: Array.from(deletedIds),
            }),
          }).catch(() => {});
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chayef-tenants-changed', { detail: mergedTenants }));
        }
        return mergedTenants;
      }
    }
  } catch (err) {
    console.warn('[tenantStorage] syncTenantsFromBackend failed:', err);
  }
  return getAllTenants();
}

export function getTenantById(tenantId: string): AssociationTenant | undefined {
  if (!tenantId) return undefined;
  const tenants = getAllTenants();
  const found = tenants.find((t) => t.id === tenantId);
  if (found) return found;

  // Fallback: Check if there is a session or cached tenant in storage
  try {
    const session = loadTenantData<any>(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, null, tenantId);
    if (session && session.tenantId === tenantId) {
      syncTenantsFromBackend().catch(() => {});
    }
  } catch {}

  return undefined;
}

export function resolveTenantIdFromUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('portal') === 'true' || params.get('view') === 'portal') {
        return 'portal';
      }

      const rawParam = (params.get('tenant') || params.get('association') || '').trim();
      let candidate = rawParam;

      if (!candidate) {
        const pathMatch = window.location.pathname.match(/^\/(?:association|tenant|a)\/([^/?#]+)/i);
        if (pathMatch && pathMatch[1]) {
          candidate = decodeURIComponent(pathMatch[1]).trim();
        }
      }

      if (candidate && candidate.toLowerCase() !== 'portal') {
        const lower = candidate.toLowerCase();
        const all = getAllTenants();
        const matched = all.find(
          (t) =>
            t.id === candidate ||
            (t.slug && t.slug.toLowerCase() === lower)
        );
        if (matched) return matched.id;

        const defMatch = defaultTenants.find(
          (t) =>
            t.id === candidate ||
            (t.slug && t.slug.toLowerCase() === lower)
        );
        if (defMatch) return defMatch.id;

        return candidate;
      }
    } catch {}
  }

  return 'portal';
}

export function getActiveTenantId(): string {
  // Always honor direct URL routing first; root "/" strictly defaults to the SYOMAX main platform portal
  if (typeof window !== 'undefined') {
    const resolvedFromUrl = resolveTenantIdFromUrl();
    if (resolvedFromUrl !== 'portal') {
      return resolvedFromUrl;
    }
    // If the user is on the root domain "/" with no tenant param/path, return 'portal'
    const params = new URLSearchParams(window.location.search);
    if (!params.get('tenant') && !params.get('association')) {
      return 'portal';
    }
  }

  const saved = loadData<string>(TENANT_STORAGE_KEYS.ACTIVE_TENANT_ID, 'portal');
  return saved || 'portal';
}

export function setActiveTenantId(tenantId: string): void {
  saveData(TENANT_STORAGE_KEYS.ACTIVE_TENANT_ID, tenantId);
}

// ==================== NORMALIZATION HELPERS ====================

export function normalizePhone(phone: string): string {
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

export function phonesMatch(phoneA?: string, phoneB?: string): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizePhone(phoneA);
  const normB = normalizePhone(phoneB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  const digitsA = normA.replace(/\D/g, '');
  const digitsB = normB.replace(/\D/g, '');
  if (digitsA.length >= 8 && digitsB.length >= 8) {
    if (digitsA.slice(-8) === digitsB.slice(-8)) return true;
  }
  return false;
}

export function normalizeArabicText(text: string): string {
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

export function namesMatch(candidateName?: string, queryText?: string): boolean {
  if (!candidateName || !queryText) return false;
  const normCandidate = normalizeArabicText(candidateName);
  const normQuery = normalizeArabicText(queryText);
  if (!normCandidate || !normQuery || normQuery.length < 2) return false;
  if (normCandidate === normQuery || normCandidate.includes(normQuery) || normQuery.includes(normCandidate)) {
    return true;
  }
  const strippedCandidate = normCandidate.replace(/^(جمعيه|جمعية|association)\s+/i, '').trim();
  const strippedQuery = normQuery.replace(/^(جمعيه|جمعية|association)\s+/i, '').trim();
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

export function normalizeOwnerUsername(username?: string): string {
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

export function validateOwnerUsernameFormat(username?: string): { valid: boolean; error?: string } {
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

export function isOwnerUsernameTaken(username?: string, excludeTenantId?: string): boolean {
  const norm = normalizeOwnerUsername(username);
  if (!norm) return false;

  const owners = getAllOwners();
  const tenants = getAllTenants();

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

export async function checkOwnerUsernameAvailability(
  username: string,
  excludeTenantId?: string
): Promise<{ available: boolean; error?: string }> {
  const formatCheck = validateOwnerUsernameFormat(username);
  if (!formatCheck.valid) {
    return { available: false, error: formatCheck.error };
  }

  if (isOwnerUsernameTaken(username, excludeTenantId)) {
    return {
      available: false,
      error: 'اسم المستخدم هذا مستخدم بالفعل لجمعية أخرى. يرجى اختيار اسم مستخدم فريد.',
    };
  }

  try {
    const res = await fetch('/api/tenants/check-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), excludeTenantId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.available === false) {
        return {
          available: false,
          error: data.error || 'اسم المستخدم هذا مستخدم بالفعل لجمعية أخرى. يرجى اختيار اسم مستخدم فريد.',
        };
      }
    }
  } catch {}

  return { available: true };
}

// ==================== OWNERS MANAGEMENT ====================

export function getAllOwners(): AssociationOwner[] {
  const loaded = loadData<AssociationOwner[]>(TENANT_STORAGE_KEYS.ALL_OWNERS, defaultOwners);
  const deletedIds = getDeletedTenantIds();

  // Deduplicate loaded owners by unique ID
  const uniqueOwnersMap = new Map<string, AssociationOwner>();
  const rawList = Array.isArray(loaded) ? loaded : defaultOwners;
  for (const o of rawList) {
    if (o && o.id && !deletedIds.has(o.tenantId)) {
      uniqueOwnersMap.set(o.id, o);
    }
  }

  for (const defO of defaultOwners) {
    if (defO && defO.id && !deletedIds.has(defO.tenantId) && !uniqueOwnersMap.has(defO.id)) {
      uniqueOwnersMap.set(defO.id, defO);
    }
  }

  // Reconcile with any existing tenants that might have been created
  // IMPORTANT: Match by o.id === existingOwnerId || o.tenantId === t.id so multiple associations with the same phone each have their own owner record!
  const tenants = getAllTenants();
  let updated = false;

  for (const t of tenants) {
    const existingOwnerId = t.ownerId || `owner_${t.id}`;
    const allCurrent = Array.from(uniqueOwnersMap.values());
    const existingOwner = allCurrent.find(
      (o) => o.id === existingOwnerId || (t.id && o.tenantId === t.id)
    );

    if (existingOwner && t.ownerUsername && !existingOwner.username) {
      existingOwner.username = t.ownerUsername;
      uniqueOwnersMap.set(existingOwner.id, existingOwner);
      updated = true;
    }

    if (!existingOwner && (t.ownerPhone || t.ownerName || t.ownerUsername)) {
      const salt = generateSalt(16);
      uniqueOwnersMap.set(existingOwnerId, {
        id: existingOwnerId,
        ...(t.ownerUsername ? { username: t.ownerUsername } : {}),
        fullName: t.ownerName || 'مدير الجمعية',
        phone: t.ownerPhone || '',
        passwordHash: hashPasswordSync('admin123', salt),
        passwordSalt: salt,
        tenantId: t.id,
        status: 'active',
        createdAt: t.createdAt || new Date().toISOString(),
      });
      updated = true;
    }
  }

  const reconciled = Array.from(uniqueOwnersMap.values());

  if (updated || (Array.isArray(loaded) && loaded.length !== reconciled.length)) {
    saveData(TENANT_STORAGE_KEYS.ALL_OWNERS, reconciled);
  }

  return reconciled;
}

export function saveAllOwners(owners: AssociationOwner[]): void {
  saveData(TENANT_STORAGE_KEYS.ALL_OWNERS, owners);
  try {
    const tenants = loadData<AssociationTenant[]>(TENANT_STORAGE_KEYS.ALL_TENANTS, defaultTenants);
    const deletedTenantIds = Array.from(getDeletedTenantIds());
    fetch('/api/tenants/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenants, owners, deletedTenantIds }),
    }).catch(() => {});
  } catch {}
}

export function getOwnerByPhone(phone: string): AssociationOwner | undefined {
  const owners = getAllOwners();
  return owners.find((o) => phonesMatch(o.phone, phone));
}

// ==================== MASTER PLATFORM ADMIN SESSION ====================

export function getMasterAdminSession(): MasterAdminSession | null {
  return loadData<MasterAdminSession | null>(TENANT_STORAGE_KEYS.MASTER_ADMIN_SESSION, null);
}

export function setMasterAdminSession(session: MasterAdminSession | null): void {
  saveData(TENANT_STORAGE_KEYS.MASTER_ADMIN_SESSION, session);
  if (session) {
    saveData(KEYS.ROLE, 'admin');
  } else {
    clearMasterAuthToken();
  }
}

// ==================== CREATE NEW ASSOCIATION PLATFORM ====================

export interface CreateAssociationInput {
  ownerFullName: string;
  ownerUsername?: string;
  ownerPhone: string;
  password: string;
  associationName: string;
  associationNameFr: string;
  country: string;
  city: string;
  legalDocument?: AssociationLegalDocument;
}

export function createAssociationPlatform(input: CreateAssociationInput): { tenant: AssociationTenant; owner: AssociationOwner } {
  const allTenants = getAllTenants();
  const allOwners = getAllOwners();

  const cleanUsername = (input.ownerUsername || '').trim();
  if (cleanUsername) {
    const formatValidation = validateOwnerUsernameFormat(cleanUsername);
    if (!formatValidation.valid) {
      throw new Error(formatValidation.error || 'يرجى إدخال اسم مستخدم صالح عبارة عن كلمات وحروف.');
    }
    if (isOwnerUsernameTaken(cleanUsername)) {
      throw new Error('اسم المستخدم هذا مستخدم بالفعل لجمعية أخرى. يرجى اختيار اسم مستخدم فريد.');
    }
  }

  const timestamp = Date.now();
  const newTenantId = `tenant_${timestamp}_${Math.random().toString(36).substring(2, 6)}`;
  const newOwnerId = `owner_${timestamp}_${Math.random().toString(36).substring(2, 6)}`;
  const cleanPassword = input.password.trim();
  const salt = generateSalt(16);
  const passwordHash = hashPasswordSync(cleanPassword, salt);

  // 1. Create Owner Record (hashed with cryptographic salt, never storing cleartext password in localStorage)
  const newOwner: AssociationOwner = {
    id: newOwnerId,
    ...(cleanUsername ? { username: cleanUsername } : {}),
    fullName: input.ownerFullName.trim(),
    phone: input.ownerPhone.trim(),
    passwordHash,
    passwordSalt: salt,
    hasCustomPassword: true,
    tenantId: newTenantId,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  // 2. Create Tenant Record
  const cleanAssocName = input.associationName.trim();
  const cleanAssocNameFr = (input.associationNameFr || '').trim() || `Association ${cleanAssocName}`;
  const cleanAssocNameEn = cleanAssocNameFr;

  const newTenant: AssociationTenant = {
    id: newTenantId,
    name: cleanAssocName,
    nameFr: cleanAssocNameFr,
    nameEn: cleanAssocNameEn,
    country: input.country.trim(),
    city: input.city.trim(),
    slug: `assoc-${timestamp}`,
    logoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=300&q=80',
    bannerImageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80',
    legalDocument: input.legalDocument,
    ownerId: newOwnerId,
    ...(cleanUsername ? { ownerUsername: cleanUsername } : {}),
    ownerName: newOwner.fullName,
    ownerPhone: newOwner.phone,
    status: 'pending_subscription',
    paymentVerified: false,
    subscriptionStatusHistory: [
      {
        status: 'pending_subscription',
        label: 'في انتظار الدفع',
        timestamp: new Date().toISOString(),
        actor: newOwner.fullName,
        note: 'تم إنشاء المنصة بحالة «في انتظار الدفع» وبانتظار تسديد مبلغ الاشتراك المطلوب وتأكيد التفعيل من الإدارة العامة.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tier: 'pro',
    monthlyFee: 180,
    isTemplate: false,
    isVisibleOnPublicPortal: false, // User created associations are strictly hidden from public portal
    enablePublicDonations: true, // ظاهرة افتراضياً في قسم تبرع وشارك بمجرد التفعيل ويمكن التحكم بها من لوحة الإدارة
    tagline: `منصة العمل الجمعوي الشفاف والتنمية المستدامة - ${input.city}`,
    stats: {
      membersCount: 1,
      activitiesCount: initialActivities.length,
      totalBalance: 0,
      campaignsCount: initialCampaigns.length,
    },
  };

  // 3. Clone Template Structure from Nour Association Model with Strict Financial Zeroing & Data Isolation!
  
  // Clone Activities: pulls the latest active version of photos, gallery, media & videos directly from جمعية النور للتنمية والتضامن
  // Resets all financial properties to 0 to maintain absolute financial independence
  const clonedActivities: ActivityItem[] = cloneReferenceActivitiesForNewTenant(newTenantId);
  saveActivities(clonedActivities, true, newTenantId);
  saveData(`chayef_tenant_${newTenantId}_activities`, clonedActivities);
  saveData(`chayef_tenant_${newTenantId}_chayef_assoc_activities_v1`, clonedActivities);

  // Clone Donation Campaigns: copy targets, titles, descriptions, cover images
  // Reset collected amount and progress percentage strictly to 0
  const clonedCampaigns: DonationCampaign[] = initialCampaigns.map((camp, idx) => ({
    ...camp,
    id: `camp_${newTenantId}_${idx + 1}`,
    collectedAmount: 0, // Strict zeroing of donations
    progressPercentage: 0, // Starts at 0%
    status: 'active',
    isVisibleOnStore: true,
  }));
  saveData(`chayef_tenant_${newTenantId}_campaigns`, clonedCampaigns);

  // Clone Polls and Resolutions from the approved model (جمعية النور للتنمية والتضامن)
  const clonedPolls = clonePollsFromMasterForTenant(newTenantId, cleanAssocName);
  savePolls(clonedPolls, newTenantId);
  saveData(`chayef_tenant_${newTenantId}_polls`, clonedPolls);
  saveData(`chayef_tenant_${newTenantId}_chayef_assoc_polls_v1`, clonedPolls);

  // Strict Financial Independence: Empty operations, contributions, and campaign contributions
  saveData(`chayef_tenant_${newTenantId}_operations`, []);
  saveData(`chayef_tenant_${newTenantId}_contributions`, []);
  saveData(`chayef_tenant_${newTenantId}_campaign_contributions`, []);

  // Founding Member (The Owner) with 0 fee so that financial balance remains strictly 0
  const founderMember: Member = {
    id: `mem_${timestamp}_01`,
    fullName: newOwner.fullName,
    memberCode: 'MEM-001',
    annualFee: 0, // Zero fee ensures 0 operations and 0 balance
    status: 'active',
    phone: newOwner.phone,
    joinDate: new Date().toISOString().slice(0, 10),
    renewalDate: `${new Date().getFullYear() + 1}-12-31`,
    notes: 'عضو مؤسس ورئيس الجمعية',
  };
  saveData(`chayef_tenant_${newTenantId}_members`, [founderMember]);
  saveMembers([founderMember], newTenantId);

  // Initial Board Members with Owner as President
  const initialBoard: BoardMember[] = [
    {
      id: `bm_${timestamp}_01`,
      memberId: founderMember.id,
      roleAr: 'رئيس الجمعية',
      roleFr: 'Président',
      roleEn: 'President',
      order: 1,
      appointedDate: new Date().toISOString().slice(0, 10),
      notes: 'عضو مؤسس ورئيس المكتب المسير',
    },
  ];
  saveData(`chayef_tenant_${newTenantId}_board_members`, initialBoard);
  saveBoardMembers(initialBoard, newTenantId, false);
  saveData(`chayef_tenant_${newTenantId}_sub_admins`, []);
  saveSubAdmins([], false, newTenantId);

  // Cloned settings customized for the new association
  const freshSettings: AssociationSettings = {
    ...initialSettings,
    name: cleanAssocName,
    nameFr: cleanAssocNameFr,
    nameEn: cleanAssocNameEn,
    phone: newOwner.phone,
    whatsapp: newOwner.phone,
    address: `${input.city}، ${input.country}`,
    heroBadgeText: '',
    heroBadgeTextFr: '',
    heroBadgeTextEn: '',
    licenseNumber: `W/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}-MA`,
    foundingYear: new Date().getFullYear().toString(),
    adminPin: '',
    adminUsername: cleanUsername,
    ribBank: (input as any).ribBank?.trim() || (input as any).rib?.trim() || initialSettings.ribBank,
    bankName: (input as any).bankName?.trim() || initialSettings.bankName,
    email: `contact@${newTenant.slug}.org`,
    themeColors: { ...defaultStoreThemeColors },
  };
  saveSettings(freshSettings, true, newTenantId);
  saveData(`chayef_tenant_${newTenantId}_settings`, freshSettings);

  // Cloned configuration templates
  saveData(`chayef_tenant_${newTenantId}_registration_fields`, initialRegistrationFields);
  saveRegistrationFields(initialRegistrationFields, newTenantId);
  const masterUIElements = getStoredUIElements(MASTER_TEMPLATE_TENANT_ID);
  const clonedUIElements = (masterUIElements && masterUIElements.length > 0)
    ? JSON.parse(JSON.stringify(masterUIElements))
    : JSON.parse(JSON.stringify(initialUIElements));
  saveData(`chayef_tenant_${newTenantId}_ui_elements`, clonedUIElements);
  saveUIElements(clonedUIElements, newTenantId);
  saveData(`chayef_tenant_${newTenantId}_member_card_settings`, {
    ...initialMemberCardSettings,
    titleAr: `وصل وبطاقة انخراط - ${cleanAssocName}`,
    titleFr: `Reçu et Carte d'adhésion - ${cleanAssocNameFr}`,
    titleEn: `Receipt and Membership Card - ${cleanAssocNameEn}`,
    signatureImageUrl: undefined,
    stampImageUrl: undefined,
  });
  // Cloned configuration templates: clone live active contribution types directly from the approved model (جمعية النور للتنمية والتضامن)
  const masterContributionTypes = getStoredContributionTypes(MASTER_TEMPLATE_TENANT_ID);
  const clonedContributionTypes = (masterContributionTypes && masterContributionTypes.length > 0)
    ? JSON.parse(JSON.stringify(masterContributionTypes))
    : JSON.parse(JSON.stringify(initialContributionTypes));
  saveData(`chayef_tenant_${newTenantId}_contribution_types`, clonedContributionTypes);
  saveData(`chayef_tenant_${newTenantId}_donation_presets`, DEFAULT_DONATION_PRESETS);

  // Initial audit log
  const initialAudit: AuditLog[] = [
    {
      id: `log-init-${timestamp}`,
      timestamp: new Date().toISOString(),
      action: 'create',
      targetType: 'settings',
      description: `تم تدشين منصة «${cleanAssocName}» (${cleanAssocNameFr}) المستقلة استنادًا إلى القالب الأساسي لجمعية النور.`,
      performedBy: newOwner.fullName,
      adminType: 'super_admin',
      adminPhone: newOwner.phone,
    },
  ];
  saveData(`chayef_tenant_${newTenantId}_audit_logs`, initialAudit);
  saveAuditLogs(initialAudit, newTenantId);

  // 4. Save and append to global registries
  const updatedTenants = [newTenant, ...allTenants];
  const updatedOwners = [newOwner, ...allOwners];
  saveAllTenants(updatedTenants);
  saveAllOwners(updatedOwners);

  // 5. Save owner identity and active admin session strictly scoped to their tenant (never Master Platform Admin)
  setMasterAdminSession(null);
  const ownerSession: CurrentAdminSession = {
    type: 'super_admin',
    role: 'main_admin',
    id: newOwner.id,
    ...(cleanUsername ? { username: cleanUsername } : {}),
    fullName: newOwner.fullName,
    phone: newOwner.phone,
    tenantId: newTenantId,
    isMasterPlatformAdmin: false,
  };
  saveData(`chayef_tenant_${newTenantId}_current_admin_session`, ownerSession);
  saveCurrentAdminSession(ownerSession, newTenantId);
  saveData(KEYS.ROLE, 'admin');

  // 6. Set active tenant
  setActiveTenantId(newTenantId);

  // Sync to backend sequentially: POST /api/tenants FIRST (hashes password with scrypt and writes Cloud Firestore tenants/{id}),
  // then POST /api/settings so settings never race against or overwrite the newly hashed credentials.
  try {
    fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newTenant,
        ownerUsername: cleanUsername || undefined,
        passwordHash,
        passwordSalt: salt,
        password: cleanPassword,
        hasCustomPassword: true,
      }),
    })
      .then(async (tenantRes) => {
        const createdJson = await tenantRes.json().catch(() => null);
        if (createdJson?.authToken) {
          setTenantAuthToken(newTenantId, createdJson.authToken);
        }
        saveBoardMembers(initialBoard, newTenantId, true).catch(() => {});
        return fetch(`/api/settings?tenantId=${encodeURIComponent(newTenantId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': newTenantId,
          },
          body: JSON.stringify({
            settings: freshSettings,
            lastUpdated: new Date().toISOString(),
          }),
        });
      })
      .catch(() => {});
  } catch {}

  try {
    fetch(`/api/activities/sync?tenantId=${encodeURIComponent(newTenantId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': newTenantId,
      },
      body: JSON.stringify({
        activities: clonedActivities,
        tenantId: newTenantId,
      }),
    }).catch(() => {});
  } catch {}

  // Sync cloned activities permanently to Cloud Firestore
  try {
    firestoreSyncService.syncActivitiesToFirestore(newTenantId, clonedActivities).catch(console.warn);
  } catch {}

  // Sync cloned polls & resolutions permanently to backend database and Cloud Firestore
  try {
    fetch(`/api/polls/sync?tenantId=${encodeURIComponent(newTenantId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': newTenantId,
      },
      body: JSON.stringify({
        polls: clonedPolls,
        tenantId: newTenantId,
      }),
    }).catch(() => {});
  } catch {}

  try {
    firestoreSyncService.syncPollsToFirestore(newTenantId, clonedPolls).catch(console.warn);
    if (cleanUsername) {
      firestoreSyncService
        .syncPlatformSessionWithFirebaseAuth({
          username: cleanUsername,
          password: cleanPassword,
          fullName: newOwner.fullName,
          role: 'admin',
          tenantId: newTenantId,
        })
        .catch(() => {});
    }
  } catch {}

  return { tenant: newTenant, owner: newOwner };
}

// ==================== TENANT DATA ACCESS HELPERS ====================

export function getTenantScopedKey(keyName: string, tenantId?: string): string {
  const currentTenant = tenantId || getActiveTenantId();
  // If master template or default legacy
  if (!currentTenant || currentTenant === MASTER_TEMPLATE_TENANT_ID || currentTenant === 'portal') {
    return `chayef_assoc_${keyName}_v1`;
  }
  return `chayef_tenant_${currentTenant}_${keyName}`;
}

// Load tenant-scoped data with automatic fallback
export function loadTenantData<T>(keyName: string, fallback: T, tenantId?: string): T {
  const scopedKey = getTenantScopedKey(keyName, tenantId);
  return loadData<T>(scopedKey, fallback);
}

// Save tenant-scoped data
export function saveTenantData<T>(keyName: string, data: T, tenantId?: string): void {
  const scopedKey = getTenantScopedKey(keyName, tenantId);
  saveData<T>(scopedKey, data);
}

// ==================== MASTER PLATFORM STATS & MANAGEMENT ====================

export function calculatePlatformMasterStats(): PlatformMasterStats {
  const tenants = getAllTenants();
  const owners = getAllOwners();

  const totalAssociations = tenants.length;
  const activeAssociations = tenants.filter((t) => t.status === 'active').length;
  const disabledAssociations = tenants.filter((t) => t.status === 'inactive').length;

  const tierDistribution: Record<SubscriptionTier, number> = {
    free: 0,
    basic: 0,
    pro: 0,
    enterprise: 0,
  };

  let totalProfits = 0;
  let totalSubscribers = 0;

  tenants.forEach((t) => {
    const tier = t.tier || 'basic';
    tierDistribution[tier] = (tierDistribution[tier] || 0) + 1;
    if (tier !== 'free') {
      totalSubscribers += 1;
      totalProfits += (Number(t.monthlyFee) || 0);
    }
  });

  // Calculate total members across all tenants
  let totalUsers = owners.length;
  tenants.forEach((t) => {
    const members = loadTenantData<any[]>('members', t.isTemplate ? initialMembers : [], t.id);
    const subAdmins = loadTenantData<any[]>('sub_admins', t.isTemplate ? initialSubAdmins : [], t.id);
    totalUsers += (members?.length || 0) + (subAdmins?.length || 0);
  });

  return {
    totalAssociations,
    activeAssociations,
    disabledAssociations,
    totalUsers,
    totalProfits,
    totalSubscribers,
    tierDistribution,
  };
}

// Get real-time live statistics for an association
export function getTenantLiveStats(tenantId: string, _isTemplate?: boolean) {
  try {
    const cleanTenant = !tenantId || tenantId === 'portal' ? MASTER_TEMPLATE_TENANT_ID : tenantId;
    const members = getStoredMembers(cleanTenant);
    const activities = getStoredActivities(cleanTenant);
    const operations = getStoredOperations(cleanTenant);
    const contributions = getStoredContributions(cleanTenant);
    const campaignContributions = getStoredCampaignContributions(cleanTenant);
    const contributionTypes = getStoredContributionTypes(cleanTenant);
    const campaigns = getStoredCampaigns(cleanTenant);

    const unified = calculateUnifiedAssociationFinancials({
      operations,
      contributions,
      campaignContributions,
      contributionTypes,
      campaigns,
      tenantId: cleanTenant,
    });

    return {
      membersCount: members?.length || 0,
      activitiesCount: activities?.length || 0,
      totalBalance: unified.currentBalance,
      campaignsCount: campaigns?.length || 0,
    };
  } catch {
    return {
      membersCount: 0,
      activitiesCount: 0,
      totalBalance: 0,
      campaignsCount: 0,
    };
  }
}

// Toggle association status (active / inactive)
export function toggleTenantStatus(tenantId: string): AssociationTenant | null {
  const tenants = getAllTenants();
  const index = tenants.findIndex((t) => t.id === tenantId);
  if (index === -1) return null;

  const current = tenants[index];
  const newStatus: AssociationStatus = current.status === 'active' ? 'inactive' : 'active';
  tenants[index] = {
    ...current,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  saveAllTenants(tenants);

  // Sync with backend API
  try {
    fetch(`/api/tenants/${tenantId}/toggle-status`, { method: 'POST' }).catch(() => {});
  } catch {}

  return tenants[index];
}

// Set association status explicitly
export function setTenantStatus(tenantId: string, newStatus: AssociationStatus): AssociationTenant | null {
  const tenants = getAllTenants();
  const index = tenants.findIndex((t) => t.id === tenantId);
  if (index === -1) return null;

  const current = tenants[index];
  const now = new Date().toISOString();
  tenants[index] = {
    ...current,
    status: newStatus,
    ...(newStatus === 'active' ? { paymentVerified: true, paymentVerifiedAt: current.paymentVerifiedAt || now } : {}),
    updatedAt: now,
  };

  saveAllTenants(tenants);

  // Sync with backend API
  try {
    fetch(`/api/tenants/${tenantId}/toggle-status`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
  } catch {}

  // Persist status change directly to Cloud Firestore
  try {
    if (db) {
      const sanitized = JSON.parse(JSON.stringify({ ...tenants[index], _updatedAt: now }));
      setDoc(doc(db, 'tenants', tenantId), sanitized, { merge: true }).catch(() => {});
    }
  } catch {}

  return tenants[index];
}

// Clean isolated localStorage keys for a specific deleted tenant only
function cleanIsolatedTenantLocalStorage(tenantId: string): void {
  if (!tenantId || tenantId === MASTER_TEMPLATE_TENANT_ID || tenantId === 'portal') return;
  try {
    const prefix = `chayef_tenant_${tenantId}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.error('[tenantStorage] Error cleaning tenant storage keys:', err);
  }
}

// Delete association permanently (Super Admin Only)
export function deleteTenant(tenantId: string): boolean {
  if (!tenantId || tenantId === MASTER_TEMPLATE_TENANT_ID) {
    // Cannot delete the master template
    return false;
  }

  // Enforce Super Admin permission check
  const masterSession = getMasterAdminSession();
  if (masterSession && masterSession.role === 'secondary_admin' && !masterSession.isMaster) {
    return false;
  }

  // 1. Mark tenantId as permanently deleted FIRST so getAllTenants() & getAllOwners() never resurrect it
  addDeletedTenantId(tenantId);

  // 2. Remove from local tenants & owners registries while preserving all other associations
  const currentTenants = loadData<AssociationTenant[]>(TENANT_STORAGE_KEYS.ALL_TENANTS, defaultTenants);
  const filteredTenants = (Array.isArray(currentTenants) ? currentTenants : defaultTenants).filter(
    (t) => t && t.id !== tenantId && ! getDeletedTenantIds().has(t.id)
  );
  saveData(TENANT_STORAGE_KEYS.ALL_TENANTS, filteredTenants);

  const currentOwners = loadData<AssociationOwner[]>(TENANT_STORAGE_KEYS.ALL_OWNERS, defaultOwners);
  const filteredOwners = (Array.isArray(currentOwners) ? currentOwners : defaultOwners).filter(
    (o) => o && o.tenantId !== tenantId && !getDeletedTenantIds().has(o.tenantId)
  );
  saveData(TENANT_STORAGE_KEYS.ALL_OWNERS, filteredOwners);

  // 3. If the deleted tenant was active, safely fall back to main SYOMAX platform portal
  if (getActiveTenantId() === tenantId) {
    setActiveTenantId('portal');
  }

  // 4. Clean all isolated localStorage keys for this tenant only
  cleanIsolatedTenantLocalStorage(tenantId);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chayef-tenants-changed', { detail: getAllTenants() }));
  }

  // 5. Sync deletion with backend database
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (masterSession) {
      headers['x-admin-session'] = encodeURIComponent(JSON.stringify(masterSession));
    }
    fetch(`/api/tenants/${encodeURIComponent(tenantId)}`, {
      method: 'DELETE',
      headers,
    }).catch(() => {});
  } catch {}

  return true;
}

/**
 * Deletes an association permanently from both the backend database and local storage,
 * restricted strictly to the Super Admin, while protecting all other associations and their data.
 */
export async function deleteTenantFromDatabase(
  tenantId: string
): Promise<{ success: boolean; tenants: AssociationTenant[]; error?: string }> {
  if (!tenantId || tenantId === MASTER_TEMPLATE_TENANT_ID) {
    return {
      success: false,
      tenants: getAllTenants(),
      error: 'لا يمكن حذف القالب الأساسي للمنصة (جمعية النور للتنمية والتضامن).',
    };
  }

  const masterSession = getMasterAdminSession();
  if (masterSession && masterSession.role === 'secondary_admin' && !masterSession.isMaster) {
    return {
      success: false,
      tenants: getAllTenants(),
      error: 'عذراً، صلاحية حذف الجمعيات محصورة بالأدمن الرئيسي (Super Admin) فقط.',
    };
  }

  // 1. Mark tenant as deleted locally & clean isolated keys
  addDeletedTenantId(tenantId);

  const currentTenants = loadData<AssociationTenant[]>(TENANT_STORAGE_KEYS.ALL_TENANTS, defaultTenants);
  const deletedSet = getDeletedTenantIds();
  const filteredTenants = (Array.isArray(currentTenants) ? currentTenants : defaultTenants).filter(
    (t) => t && t.id !== tenantId && !deletedSet.has(t.id)
  );
  saveData(TENANT_STORAGE_KEYS.ALL_TENANTS, filteredTenants);

  const currentOwners = loadData<AssociationOwner[]>(TENANT_STORAGE_KEYS.ALL_OWNERS, defaultOwners);
  const filteredOwners = (Array.isArray(currentOwners) ? currentOwners : defaultOwners).filter(
    (o) => o && o.tenantId !== tenantId && !deletedSet.has(o.tenantId)
  );
  saveData(TENANT_STORAGE_KEYS.ALL_OWNERS, filteredOwners);

  if (getActiveTenantId() === tenantId) {
    setActiveTenantId('portal');
  }

  cleanIsolatedTenantLocalStorage(tenantId);

  // 2. Execute DELETE on backend database and sync state
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (masterSession) {
      headers['x-admin-session'] = encodeURIComponent(JSON.stringify(masterSession));
    }
    const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}`, {
      method: 'DELETE',
      headers,
    });
    if (res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        tenants: getAllTenants(),
        error: errData.error || 'غير مصرح بتنفيذ عملية الحذف.',
      };
    }
  } catch (err) {
    console.warn('[tenantStorage] Backend DELETE request warning:', err);
  }

  const updatedList = getAllTenants();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chayef-tenants-changed', { detail: updatedList }));
  }

  return {
    success: true,
    tenants: updatedList,
  };
}

// Update association details permanently in backend database, Firestore, and local state
export async function updateTenantDetailsPermanent(
  tenantId: string,
  updates: Partial<AssociationTenant>
): Promise<{ success: boolean; tenant?: AssociationTenant; error?: string }> {
  try {
    const tenants = getAllTenants();
    const index = tenants.findIndex((t) => t.id === tenantId);
    if (index === -1) {
      return { success: false, error: 'الجمعية المطلوبة غير مسجلة في النظام.' };
    }

    // 1. Ensure any data URLs in logoUrl or bannerImageUrl are uploaded to permanent storage
    let permanentLogoUrl = updates.logoUrl;
    if (permanentLogoUrl && permanentLogoUrl.startsWith('data:')) {
      try {
        permanentLogoUrl = await ensurePermanentImageUrl(permanentLogoUrl, { tenantId, category: 'branding' });
      } catch (imgErr) {
        console.warn('[tenantStorage] Error saving logo permanently, fallback to server upload:', imgErr);
      }
    }

    let permanentBannerUrl = updates.bannerImageUrl;
    if (permanentBannerUrl && permanentBannerUrl.startsWith('data:')) {
      try {
        permanentBannerUrl = await ensurePermanentImageUrl(permanentBannerUrl, { tenantId, category: 'banners' });
      } catch (imgErr) {
        console.warn('[tenantStorage] Error saving banner permanently, fallback to server upload:', imgErr);
      }
    }

    const cleanedUpdates: Partial<AssociationTenant> = {
      ...updates,
      logoUrl: permanentLogoUrl,
      bannerImageUrl: permanentBannerUrl,
      updatedAt: new Date().toISOString(),
    };

    // 2. Persist to server backend database via PUT /api/tenants/:id
    const res = await fetch(`/api/tenants/${tenantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanedUpdates),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || 'فشل الاتصال بالخادم لحفظ بيانات الجمعية في قاعدة البيانات.');
    }

    const resData = await res.json();
    const serverTenant: AssociationTenant = resData.tenant || {
      ...tenants[index],
      ...cleanedUpdates,
    };

    // 3. Update local state & localStorage
    tenants[index] = serverTenant;
    saveAllTenants(tenants);

    // 4. Synchronize settings for this tenant in localStorage
    let preservedRibBank = initialSettings.ribBank;
    let preservedBankName = initialSettings.bankName;
    try {
      const currentSettings = loadTenantData<AssociationSettings>('settings', initialSettings, tenantId);
      preservedRibBank =
        (serverTenant.rib && serverTenant.rib.trim()) ||
        ((serverTenant as any).ribBank && String((serverTenant as any).ribBank).trim()) ||
        (currentSettings.ribBank && currentSettings.ribBank.trim()) ||
        initialSettings.ribBank;
      preservedBankName =
        (serverTenant.bankName && serverTenant.bankName.trim()) ||
        (currentSettings.bankName && currentSettings.bankName.trim()) ||
        initialSettings.bankName;
      const updatedSettings: AssociationSettings = {
        ...currentSettings,
        name: serverTenant.name || currentSettings.name,
        nameFr: serverTenant.nameFr ?? currentSettings.nameFr,
        nameEn: serverTenant.nameEn ?? currentSettings.nameEn,
        tagline: serverTenant.tagline ?? currentSettings.tagline,
        description: serverTenant.description ?? currentSettings.description,
        address: serverTenant.address || (serverTenant.city && serverTenant.country ? `${serverTenant.city}، ${serverTenant.country}` : currentSettings.address),
        phone: serverTenant.phone || serverTenant.ownerPhone || currentSettings.phone,
        whatsapp: serverTenant.whatsapp || currentSettings.whatsapp || serverTenant.ownerPhone || currentSettings.phone,
        email: serverTenant.email || currentSettings.email,
        logoUrl: serverTenant.logoUrl || currentSettings.logoUrl,
        bannerImageUrl: serverTenant.bannerImageUrl || currentSettings.bannerImageUrl,
        ribBank: preservedRibBank,
        bankName: preservedBankName,
        licenseNumber: serverTenant.licenseNumber || currentSettings.licenseNumber,
      };
      saveTenantData('settings', updatedSettings, tenantId);
    } catch (sErr) {
      console.warn('[tenantStorage] Error syncing local settings:', sErr);
    }

    // 5. Synchronize owner in local storage if owner details changed
    if (serverTenant.ownerName || serverTenant.ownerPhone) {
      const owners = getAllOwners();
      const oIdx = owners.findIndex((o) => o.tenantId === tenantId || o.id === serverTenant.ownerId);
      if (oIdx !== -1) {
        owners[oIdx] = {
          ...owners[oIdx],
          fullName: serverTenant.ownerName ? serverTenant.ownerName.trim() : owners[oIdx].fullName,
          phone: serverTenant.ownerPhone ? serverTenant.ownerPhone.trim() : owners[oIdx].phone,
        };
        saveAllOwners(owners);
      }
    }

    // 6. Firestore synchronization: update tenant document and settings document
    try {
      if (db) {
        await Promise.all([
          setDoc(doc(db, 'tenants', tenantId), {
            ...serverTenant,
            _updatedAt: new Date().toISOString(),
          }, { merge: true }),
          setDoc(doc(db, 'settings', tenantId), {
            name: serverTenant.name,
            nameFr: serverTenant.nameFr || '',
            nameEn: serverTenant.nameEn || '',
            tagline: serverTenant.tagline || '',
            description: serverTenant.description || '',
            address: serverTenant.address || `${serverTenant.city}، ${serverTenant.country}`,
            phone: serverTenant.phone || serverTenant.ownerPhone || '',
            whatsapp: serverTenant.whatsapp || serverTenant.ownerPhone || '',
            email: serverTenant.email || '',
            logoUrl: serverTenant.logoUrl || '',
            bannerImageUrl: serverTenant.bannerImageUrl || '',
            ribBank: preservedRibBank,
            bankName: preservedBankName,
            licenseNumber: serverTenant.licenseNumber || '',
            tenantId,
            _updatedAt: new Date().toISOString(),
          }, { merge: true }),
        ]);
      }
    } catch (fsErr) {
      console.warn('[tenantStorage] Firestore sync notice:', fsErr);
    }

    // 7. Verify by re-syncing from backend
    await syncTenantsFromBackend().catch(() => {});

    // 8. Notify all listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chayef-tenants-changed'));
    }

    return {
      success: true,
      tenant: serverTenant,
    };
  } catch (err: any) {
    console.error('[tenantStorage] updateTenantDetailsPermanent error:', err);
    return {
      success: false,
      error: err?.message || 'حدث خطأ أثناء حفظ التعديلات في قاعدة البيانات.',
    };
  }
}

export function getOwnerUsernameForTenant(tenantId?: string | null): string {
  const cleanId = !tenantId || tenantId === 'portal' ? MASTER_TEMPLATE_TENANT_ID : tenantId;
  const tenant = getTenantById(cleanId) || defaultTenants.find((t) => t.id === cleanId);
  if (tenant?.ownerUsername && tenant.ownerUsername.trim()) {
    return tenant.ownerUsername.trim();
  }
  const owners = getAllOwners();
  const owner = owners.find(
    (o) =>
      o &&
      (o.tenantId === cleanId ||
        (tenant?.ownerId && o.id === tenant.ownerId))
  );
  if (owner?.username && owner.username.trim()) {
    return owner.username.trim();
  }
  if (cleanId === 'tenant_nour') return 'nour2024';
  if (cleanId === 'tenant_amal') return 'amal2024';
  return '';
}

export function updateLocalOwnerUsername(tenantId: string, newUsername: string): void {
  const cleanUsername = String(newUsername || '').trim();
  if (!cleanUsername || !tenantId) return;
  try {
    const owners = getAllOwners();
    const tenant = getTenantById(tenantId);
    const idx = owners.findIndex(
      (o) =>
        o &&
        (o.tenantId === tenantId ||
          (tenant?.ownerId && o.id === tenant.ownerId))
    );
    if (idx >= 0 && owners[idx].username !== cleanUsername) {
      owners[idx] = {
        ...owners[idx],
        username: cleanUsername,
      };
      saveAllOwners(owners);
    }
  } catch {}
}

// Synchronous wrapper for backwards compatibility
export function updateTenantDetails(tenantId: string, updates: Partial<AssociationTenant>): AssociationTenant | null {
  const tenants = getAllTenants();
  const index = tenants.findIndex((t) => t.id === tenantId);
  if (index === -1) return null;

  tenants[index] = {
    ...tenants[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveAllTenants(tenants);

  if (typeof updates.ownerUsername === 'string' && updates.ownerUsername.trim()) {
    updateLocalOwnerUsername(tenantId, updates.ownerUsername.trim());
  }

  // Trigger permanent async save in background
  updateTenantDetailsPermanent(tenantId, updates).catch((err) => {
    console.warn('[tenantStorage] Background permanent update note:', err);
  });

  return tenants[index];
}

// Safely reset owner password and persist to backend database
export function resetOwnerPassword(
  ownerPhone: string,
  newPassword: string,
  ownerId?: string,
  tenantId?: string
): boolean {
  const owners = getAllOwners();
  const cleanedPhone = ownerPhone.replace(/\s+/g, '').replace(/-/g, '');
  const index = owners.findIndex(
    (o) =>
      (ownerId && o.id === ownerId) ||
      (tenantId && o.tenantId === tenantId) ||
      o.phone.replace(/\s+/g, '').replace(/-/g, '') === cleanedPhone
  );

  if (index !== -1) {
    const salt = generateSalt(16);
    const passwordHash = hashPasswordSync(newPassword, salt);

    owners[index] = {
      ...owners[index],
      passwordHash,
      passwordSalt: salt,
    };

    saveAllOwners(owners);
  }

  // Persist permanently to backend owners_database.json
  try {
    fetch('/api/tenants/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: ownerPhone,
        phone: ownerPhone,
        ownerId: ownerId || (index !== -1 ? owners[index].id : undefined),
        tenantId: tenantId || (index !== -1 ? owners[index].tenantId : undefined),
        newPassword,
      }),
    }).catch(() => {});
  } catch {}

  return index !== -1 || !!ownerPhone;
}

// ==================== PLATFORM MULTI-TENANT AUTHENTICATION ====================

export interface PlatformAuthResult {
  success: boolean;
  tenant?: AssociationTenant;
  session?: CurrentAdminSession;
  role?: UserRole;
  owner?: AssociationOwner;
  member?: Member;
  error?: string;
  errorCode?:
    | 'EMPTY_FIELDS'
    | 'NOT_FOUND'
    | 'USER_NOT_FOUND'
    | 'WRONG_PASSWORD'
    | 'INACTIVE'
    | 'TENANT_MISMATCH'
    | 'SERVER_ERROR';
}

/**
 * Authenticates an Association Owner, SubAdmin, or Member strictly against the authoritative
 * Cloud Firestore backend (/api/tenants/login) — never trusting stale localStorage credentials
 * after the server responds.
 */
export async function authenticatePlatformAccount(
  identifier: string,
  password: string,
  expectedTenantId?: string
): Promise<PlatformAuthResult> {
  const cleanId = identifier.trim();
  const cleanPass = password.trim();

  if (!cleanId || !cleanPass) {
    return {
      success: false,
      errorCode: 'EMPTY_FIELDS',
      error: 'يرجى إدخال اسم المستخدم وكلمة المرور.',
    };
  }

  // 1. Authoritative server-side authentication backed by Cloud Firestore
  try {
    const res = await fetch('/api/tenants/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify({
        loginIdentifier: cleanId,
        password: cleanPass,
        ...(expectedTenantId ? { tenantId: expectedTenantId } : {}),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.tenant) {
        // Merge authoritative tenant into local cache so UI reflects latest ownerUsername & status immediately
        const all = getAllTenants();
        const existingIdx = all.findIndex((t) => t.id === data.tenant.id);
        const updated: AssociationTenant[] = existingIdx >= 0
          ? all.map((t) => (t.id === data.tenant.id ? { ...t, ...data.tenant } : t))
          : [data.tenant, ...all];
        saveAllTenants(updated);

        // Keep local owner cache synchronized with authoritative username (without storing password hashes locally)
        if (data.owner && data.tenant.ownerUsername) {
          updateLocalOwnerUsername(data.tenant.id, data.tenant.ownerUsername);
        }

        const resolvedAuthToken = data.authToken || data.session?.token;
        if (resolvedAuthToken) {
          setTenantAuthToken(data.tenant.id, resolvedAuthToken);
        }

        // Case A: Authenticated as a Member (منخرط) -> strictly role: 'member', NO admin session!
        if (data.role === 'member' && data.member) {
          clearCurrentAdminSession(data.tenant.id);
          saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, null, data.tenant.id);
          saveData(KEYS.ROLE, 'member');
          saveLoggedInMemberId(data.member.id, data.tenant.id);
          const currentMems = getStoredMembers(data.tenant.id);
          const nextMems = currentMems.some((m) => m.id === data.member.id)
            ? currentMems.map((m) => (m.id === data.member.id ? data.member : m))
            : [data.member, ...currentMems];
          saveMembers(nextMems, data.tenant.id, false);
          setActiveTenantId(data.tenant.id);
          firestoreSyncService
            .syncPlatformSessionWithFirebaseAuth({
              username: data.member.username || cleanId,
              password: cleanPass,
              fullName: data.member.fullName,
              role: 'member',
              tenantId: data.tenant.id,
            })
            .catch(() => {});
          return {
            success: true,
            tenant: data.tenant,
            session: undefined,
            role: 'member',
            member: data.member,
          };
        }

        // Case B: Authenticated as an Admin (Association Owner or SubAdmin)
        if (data.session) {
          setMasterAdminSession(null);
          clearLoggedInMemberId(data.tenant.id);
          saveData(KEYS.ROLE, 'admin');
          const safeSession: CurrentAdminSession = {
            ...data.session,
            tenantId: data.tenant.id,
            isMasterPlatformAdmin: false,
          };
          if (data.subAdmin || safeSession.subAdmin) {
            const subItem = data.subAdmin || safeSession.subAdmin;
            const currentSubs = getStoredSubAdmins(data.tenant.id);
            const nextSubs = currentSubs.some((s) => s.id === subItem.id)
              ? currentSubs.map((s) => (s.id === subItem.id ? { ...s, ...subItem } : s))
              : [subItem, ...currentSubs];
            saveSubAdmins(nextSubs, false, data.tenant.id);
          }
          saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, safeSession, data.tenant.id);
          saveCurrentAdminSession(safeSession, data.tenant.id);
          setActiveTenantId(data.tenant.id);
          firestoreSyncService
            .syncPlatformSessionWithFirebaseAuth({
              username: safeSession.username || cleanId,
              password: cleanPass,
              fullName: safeSession.fullName,
              role: 'admin',
              tenantId: data.tenant.id,
            })
            .catch(() => {});
          return {
            success: true,
            tenant: data.tenant,
            session: safeSession,
            role: 'admin',
            owner: data.owner,
          };
        }
      }
    } else {
      // Authoritative server rejection: NEVER fall back to stale localStorage!
      const errData = await res.json().catch(() => ({}));
      const code = errData.errorCode as PlatformAuthResult['errorCode'] | undefined;
      if (code === 'INACTIVE') {
        return {
          success: false,
          errorCode: 'INACTIVE',
          error: errData.error || 'هذا الحساب غير مفعل حالياً من طرف إدارة الجمعية.',
        };
      }
      if (code === 'TENANT_MISMATCH') {
        return {
          success: false,
          errorCode: 'TENANT_MISMATCH',
          error: errData.error || 'عذراً، هذا الحساب مرتبط بجمعية أخرى مستقلة.',
        };
      }
      if (code === 'WRONG_PASSWORD') {
        return {
          success: false,
          errorCode: 'WRONG_PASSWORD',
          error: errData.error || 'كلمة المرور غير صحيحة. يرجى التحقق وإعادة المحاولة.',
        };
      }
      if (code === 'USER_NOT_FOUND' || code === 'NOT_FOUND' || res.status === 404) {
        return {
          success: false,
          errorCode: 'USER_NOT_FOUND',
          error: errData.error || 'اسم المستخدم غير موجود أو غير مسجل في النظام. يرجى التأكد من كتابة اسم المستخدم الصحيح.',
        };
      }
      if (res.status >= 500) {
        return {
          success: false,
          errorCode: 'SERVER_ERROR',
          error: errData.error || 'حدث خطأ مؤقت في قاعدة البيانات أثناء التحقق من الحساب. يرجى المحاولة مرة أخرى.',
        };
      }
      return {
        success: false,
        errorCode: code || 'WRONG_PASSWORD',
        error: errData.error || 'تعذر تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة المرور.',
      };
    }
  } catch (netErr) {
    console.warn('[tenantStorage] Server login unreachable:', netErr);
    return {
      success: false,
      errorCode: 'SERVER_ERROR',
      error: 'تعذر الاتصال بخادم قاعدة البيانات السحابية. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.',
    };
  }

  return {
    success: false,
    errorCode: 'SERVER_ERROR',
    error: 'تعذر إتمام عملية تسجيل الدخول. يرجى المحاولة مجدداً.',
  };
}

/**
 * Live lookup to identify association name and owner by phone or name
 */
export async function lookupPlatformAccount(identifier: string): Promise<{
  found: boolean;
  associationName?: string;
  ownerName?: string;
  tenantId?: string;
  city?: string;
  error?: string;
}> {
  const cleanId = identifier.trim();
  if (!cleanId) return { found: false, error: 'يرجى إدخال الاسم أو رقم الهاتف للبحث.' };

  try {
    const res = await fetch('/api/tenants/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.found) {
        return {
          found: true,
          associationName: data.associationName,
          ownerName: data.ownerName,
          tenantId: data.tenantId,
          city: data.city,
        };
      }
    }
  } catch {}

  // Local lookup fallback
  const normPhone = normalizePhone(cleanId);
  const normText = normalizeArabicText(cleanId);
  const normUser = normalizeOwnerUsername(cleanId);
  const owners = getAllOwners();
  const tenants = getAllTenants();

  const owner = owners.find((o) => {
    const oUser = normalizeOwnerUsername(o.username);
    const oPhone = normalizePhone(o.phone);
    const oName = normalizeArabicText(o.fullName);
    return (
      (normUser && oUser && oUser === normUser) ||
      (normPhone && oPhone === normPhone) ||
      (normText && oName.includes(normText))
    );
  });

  if (owner) {
    const tenant = tenants.find((t) => t.id === owner.tenantId);
    return {
      found: true,
      associationName: tenant?.name || 'منصة جمعيتك',
      ownerName: owner.fullName,
      tenantId: owner.tenantId,
      city: tenant?.city,
    };
  }

  const tenant = tenants.find((t) => {
    const tUser = normalizeOwnerUsername(t.ownerUsername);
    const tPhone = normalizePhone(t.ownerPhone);
    const tName = normalizeArabicText(t.ownerName);
    return (
      (normUser && tUser && tUser === normUser) ||
      (normPhone && tPhone === normPhone) ||
      (normText && tName.includes(normText))
    );
  });

  if (tenant) {
    return {
      found: true,
      associationName: tenant.name,
      ownerName: tenant.ownerName,
      tenantId: tenant.id,
      city: tenant.city,
    };
  }

  return { found: false, error: 'لم يتم العثور على أي جمعية مسجلة بهذه البيانات.' };
}

/**
 * Resets an owner's password safely via server API or local storage
 */
export async function resetPlatformOwnerPassword(
  identifier: string,
  newPassword: string
): Promise<{ success: boolean; message: string; error?: string; tenantId?: string }> {
  const cleanId = identifier.trim();
  const cleanPass = newPassword.trim();

  if (!cleanId || !cleanPass || cleanPass.length < 4) {
    return { success: false, message: '', error: 'يرجى إدخال كلمة مرور مكونة من 4 خانات على الأقل.' };
  }

  try {
    const res = await fetch('/api/tenants/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, newPassword: cleanPass }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: data.message || 'تم تحديث كلمة المرور بنجاح.', tenantId: data.tenantId };
    }
    return {
      success: false,
      message: '',
      error: data.error || 'تعذر العثور على الحساب لتحديث كلمة المرور.',
    };
  } catch {
    return {
      success: false,
      message: '',
      error: 'تعذر الاتصال بقاعدة البيانات لتحديث كلمة المرور. يرجى المحاولة مجدداً.',
    };
  }
}

/**
 * Verifies that the admin session is strictly authorized for the requested tenant
 */
export function validateTenantAccess(tenantId: string, session: CurrentAdminSession | null): boolean {
  if (!session) return false;
  if (session.isMasterPlatformAdmin) return true;
  return session.tenantId === tenantId;
}

/**
 * Updates legal document verification status for an association tenant
 */
export function updateTenantLegalDocumentStatus(
  tenantId: string, 
  status: 'approved' | 'rejected' | 'pending', 
  options?: { rejectionReason?: string; verifiedBy?: string; activateTenant?: boolean }
): AssociationTenant | null {
  const tenants = getAllTenants();
  const index = tenants.findIndex((t) => t.id === tenantId);
  if (index === -1) return null;

  const tenant = { ...tenants[index] };
  if (!tenant.legalDocument) return null;

  const now = new Date().toISOString();
  tenant.legalDocument = {
    ...tenant.legalDocument,
    status,
    rejectionReason: status === 'rejected' ? (options?.rejectionReason || 'الوثيقة غير واضحة أو غير مطابقة للضوابط القانونية.') : undefined,
    verifiedAt: now,
    verifiedBy: options?.verifiedBy || 'الإدارة العامة للمنصة',
  };

  if (options?.activateTenant && status === 'approved' && tenant.paymentVerified) {
    tenant.status = 'active';
  }

  tenant.updatedAt = now;
  tenants[index] = tenant;
  saveAllTenants(tenants);

  // Sync to backend if possible
  try {
    fetch(`/api/tenants/${encodeURIComponent(tenantId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenant),
    }).catch(() => {});
  } catch {}

  return tenant;
}

