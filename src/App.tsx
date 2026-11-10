import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  getStoredMembers, 
  saveMembers, 
  getStoredBoardMembers,
  saveBoardMembers,
  getStoredContributions,
  saveContributions,
  getStoredOperations, 
  saveOperations, 
  getStoredActivities, 
  saveActivities, 
  getStoredAuditLogs, 
  saveAuditLogs, 
  getStoredSettings, 
  saveSettings,
  getStoredRegistrationFields,
  saveRegistrationFields,
  getStoredUIElements,
  saveUIElements,
  getStoredPolls,
  savePolls,
  getStoredMemberCardSettings,
  saveMemberCardSettings,
  recordPollVote,
  calculateFinancials,
  reconcileMemberFinancialOperations,
  reconcileUnpaidContributionDeductions,
  saveContributionsAndOperations,
  isUnpaidContributionStatus,
  addAuditLog,
  resetToDefaults,
  exportBackupJSON,
  exportOperationsCSV,
  getStoredLoggedInMemberId,
  saveLoggedInMemberId,
  clearLoggedInMemberId,
  getStoredSubAdmins,
  saveSubAdmins,
  getStoredCurrentAdminSession,
  saveCurrentAdminSession,
  clearCurrentAdminSession,
  getStoredCampaigns,
  saveCampaigns,
  getStoredCampaignContributions,
  saveCampaignContributions,
  getStoredContributionTypes,
  saveContributionTypes,
  getStoredDonationPresets,
  recalculateCampaignsFromContributions,
  getSettingsTimestamp,
  setSettingsTimestamp,
  getActivitiesTimestamp,
  setActivitiesTimestamp,
  getSubAdminsTimestamp,
  setSubAdminsTimestamp,
  recordDeletedActivityId,
  getDeletedActivityIds,
  recordDeletedOperationId,
  recordDeletedContributionId,
  getUIElementsTimestamp,
  setUIElementsTimestamp,
  syncTenantRecordsFromBackend,
  ensureMandatoryPasswordFields,
  GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT,
  saveData,
  KEYS,
  VOTING_RESTRICTED_MESSAGE,
} from './storage';
import {
  apiCreateOperation,
  apiUpdateOperationInPlace,
  apiDeleteOperation,
} from './api/operationsApi';
import { campaignsApi } from './api/campaignsApi';
import { apiFetchPolls, apiVotePoll } from './api/pollsApi';
import {
  apiAddGalleryPhotos,
  apiDeleteSingleGalleryPhoto,
  apiDeleteAllGalleryPhotos,
  apiDeleteActivity,
  apiToggleActivityStatus,
  apiSyncActivities,
  apiFetchActivities,
  apiFetchActivitiesWithMeta,
  apiPublishReferenceVersion,
} from './api/activitiesApi';
import {
  publishNewReferenceVersion,
  syncTenantReferenceActivities,
  getCurrentReferenceVersion,
  isTenantReferenceOutOfSync,
} from './utils/referenceContentVersioning';
import { apiFetchSettings, apiFetchSettingsWithMeta, apiSyncSettings } from './api/settingsApi';
import { apiFetchSubAdminsWithMeta, apiSyncSubAdmins } from './api/subAdminsApi';
import { fetchGlobalContributionTypesFromServer } from './contributionTypesStorage';
import { fetchPortalSettings } from './portalSettingsStorage';
import { firestoreSyncService } from './services/firestoreSyncService';
import {
  rescueLegacyVideos,
  deleteVideoFromObjectStorage,
} from './utils/videoStorageEngine';
import { 
  Member, 
  MemberStatus,
  FinancialOperation, 
  ActivityItem, 
  AuditLog, 
  AssociationSettings, 
  Language, 
  UserRole,
  MemberRegistrationField,
  UIElementConfig,
  Poll,
  PollVote,
  MemberCardSettings,
  MemberContribution,
  ContributionStatus,
  BoardMember,
  SubAdmin,
  CurrentAdminSession,
  DonationCampaign,
  CampaignContribution,
  ContributionTypeConfig,
  PaymentMethodType
} from './types';
import { defaultStoreThemeColors } from './initialData';
import { applyStoreTheme } from './utils/themeEngine';
import { checkAdminPermission } from './security';
import { GLOBAL_CONTRIBUTION_SETTINGS_EVENT } from './contributionTypesStorage';
import { ShieldCheck, UserCheck, HeartHandshake, ArrowRight, Users, LayoutDashboard, ArrowLeft, Sparkles } from 'lucide-react';
import { isSectionVisibleForUser, isProofPreviewVisibleForUser } from './utils/visibilityRules';
import { fetchUIElementsApi, saveUIElementsListApi } from './api/uiElementsApi';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { HomeSection } from './components/HomeSection';
import { FinancialDashboard } from './components/FinancialDashboard';
import { ActivitiesSection } from './components/ActivitiesSection';
import { MembersSection } from './components/MembersSection';
import { BoardMembersPage } from './components/BoardMembersPage';
import { ExpensesLedger } from './components/ExpensesLedger';
import { AdminPanel } from './components/AdminPanel';
import { AdminAuthModal } from './components/AdminAuthModal';
import { MemberAuthModal } from './components/MemberAuthModal';
import { MemberRegistrationModal } from './components/MemberRegistrationModal';
import { MyAccountSection } from './components/MyAccountSection';
import { AddOperationModal } from './components/AddOperationModal';
import { AddActivityModal } from './components/AddActivityModal';
import { MemberFormModal } from './components/MemberFormModal';
import { MediaViewerModal } from './components/MediaViewerModal';
import { ReceiptModal } from './components/ReceiptModal';
import { CampaignDonationModal } from './components/CampaignDonationModal';
import { Toast, ToastMessage } from './components/Toast';
import { hashPasswordWithSalt, generateSalt, verifyMemberPassword, isValidAdminSessionForTenant } from './security';
import { MainPlatformPortal } from './components/MainPlatformPortal';
import { MasterPlatformAdmin } from './components/MasterPlatformAdmin';
import { MasterAdminAuthModal } from './components/MasterAdminAuthModal';
import { AssociationTopBanner } from './components/AssociationTopBanner';
import { CreateAssociationWizardModal } from './components/CreateAssociationWizardModal';
import { SuspendedAssociationScreen } from './components/SuspendedAssociationScreen';
import { PlatformActivationScreen } from './components/PlatformActivationScreen';
import { AssociationLoginModal } from './components/AssociationLoginModal';
import { 
  getActiveTenantId, 
  setActiveTenantId, 
  getTenantById, 
  getAllTenants,
  saveAllTenants,
  syncTenantsFromBackend,
  updateTenantDetails,
  defaultTenants, 
  MASTER_TEMPLATE_TENANT_ID,
  saveTenantData,
  TENANT_DATA_KEYS,
  getMasterAdminSession,
  setMasterAdminSession
} from './tenantStorage';
import { syncPaymentsFromBackend } from './paymentStorage';
import { AssociationTenant } from './types';
import { useAssociationSectionsConfig } from './associationSectionsStorage';

export default function App() {
  // Subscribe to central association sections config for live reactive updates across the app
  useAssociationSectionsConfig();

  // Global States
  const [lang, setLang] = useState<Language>('ar');
  const [role, setRole] = useState<UserRole>(() => {
    const activeMemberId = getStoredLoggedInMemberId();
    if (activeMemberId) {
      return 'member';
    }
    const session = getStoredCurrentAdminSession();
    return isValidAdminSessionForTenant(session, 'admin', getActiveTenantId()) ? 'admin' : 'member';
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
          if (tab === 'admin') {
            const activeMemberId = getStoredLoggedInMemberId();
            const session = getStoredCurrentAdminSession();
            if (activeMemberId || !isValidAdminSessionForTenant(session, 'admin', getActiveTenantId())) {
              return 'home';
            }
          }
          return tab;
        }
      } catch {}
    }
    return 'home';
  });

  // Multi-Tenant Platform States
  const [activeTenantId, setActiveTenantIdState] = useState<string>(() => {
    // 1. Direct URL parameters check (?portal=true or ?tenant=...)
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('portal') === 'true' || params.get('view') === 'portal') {
          return 'portal';
        }
        const tenantParam = params.get('tenant');
        if (tenantParam) {
          return tenantParam;
        }
        // Check if user explicitly navigated to portal in this browser session
        if (sessionStorage.getItem('explicit_portal_navigation') === 'true') {
          return 'portal';
        }
      } catch {}
    }

    const stored = getActiveTenantId();
    if (!stored) {
      setActiveTenantId(MASTER_TEMPLATE_TENANT_ID);
      return MASTER_TEMPLATE_TENANT_ID;
    }
    return stored;
  });
  const [tenantsVersion, setTenantsVersion] = useState(0);
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);
  const [isMasterAdminOpen, setIsMasterAdminOpen] = useState(false);
  const [isMasterAdminAuthModalOpen, setIsMasterAdminAuthModalOpen] = useState(false);
  const [isAssociationLoginOpen, setIsAssociationLoginOpen] = useState(false);
  const [returnToDonations, setReturnToDonations] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('nav_from_donations') === 'true';
    } catch {
      return false;
    }
  });
  const [isDonationsPageOpenInPortal, setIsDonationsPageOpenInPortal] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('nav_from_donations') === 'true';
    } catch {
      return false;
    }
  });

  const [isTenantsSynced, setIsTenantsSynced] = useState(false);

  // Listen to tenant and payment changes across tabs/modals for instant reactivity
  useEffect(() => {
    // Background database sync on mount to ensure freshness
    syncTenantsFromBackend()
      .then(() => {
        setIsTenantsSynced(true);
        setTenantsVersion((v) => v + 1);
      })
      .catch(() => {
        setIsTenantsSynced(true);
      });
    syncPaymentsFromBackend().catch(() => {});

    const handleTenantsUpdate = () => {
      setTenantsVersion((v) => v + 1);
    };
    const handlePaymentsUpdate = () => {
      setTenantsVersion((v) => v + 1);
    };
    const handleFieldsUpdate = (e: any) => {
      const rawActive = getActiveTenantId();
      const currentActive = !rawActive || rawActive === 'portal' ? MASTER_TEMPLATE_TENANT_ID : rawActive;
      const targetTenant = e?.detail?.tenantId;
      if (e?.detail?.fields && Array.isArray(e.detail.fields) && (!targetTenant || e?.detail?.isGlobal || targetTenant === currentActive)) {
        setRegistrationFields(ensureMandatoryPasswordFields(e.detail.fields));
      } else {
        setRegistrationFields(getStoredRegistrationFields(currentActive));
      }
    };
    window.addEventListener('chayef-tenants-changed', handleTenantsUpdate);
    window.addEventListener('chayef-payments-changed', handlePaymentsUpdate);
    window.addEventListener(GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT, handleFieldsUpdate);
    window.addEventListener('storage', handleTenantsUpdate);
    return () => {
      window.removeEventListener('chayef-tenants-changed', handleTenantsUpdate);
      window.removeEventListener('chayef-payments-changed', handlePaymentsUpdate);
      window.removeEventListener(GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT, handleFieldsUpdate);
      window.removeEventListener('storage', handleTenantsUpdate);
    };
  }, []);

  // Individual Association Platform View (Scoped Tenant) - Declared unconditionally at top
  const currentTenant = useMemo(() => {
    if (activeTenantId === 'portal') {
      return defaultTenants[0];
    }
    const found = getTenantById(activeTenantId);
    if (found) return found;

    try {
      const all = getAllTenants();
      const match = all.find((t) => t.id === activeTenantId);
      if (match) return match;
    } catch {}

    const defMatch = defaultTenants.find((t) => t.id === activeTenantId);
    if (defMatch) return defMatch;

    if (!isTenantsSynced && activeTenantId !== MASTER_TEMPLATE_TENANT_ID) {
      return {
        ...defaultTenants[0],
        id: activeTenantId,
        name: 'جاري التحقق من حالة المنصة...',
        status: 'pending_subscription' as const,
        paymentVerified: false,
      };
    }

    // If not found in any store after sync, fallback to default active template
    return defaultTenants[0];
  }, [activeTenantId, tenantsVersion, isTenantsSynced]);

  // Stored Data States
  const [members, setMembers] = useState<Member[]>(getStoredMembers);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>(getStoredBoardMembers);
  const [contributions, setContributions] = useState<MemberContribution[]>(getStoredContributions);
  const [operations, setOperations] = useState<FinancialOperation[]>(getStoredOperations);
  const [activities, setActivities] = useState<ActivityItem[]>(getStoredActivities);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(getStoredAuditLogs);
  const [settings, setSettings] = useState<AssociationSettings>(getStoredSettings);
  const [registrationFields, setRegistrationFields] = useState<MemberRegistrationField[]>(getStoredRegistrationFields);
  const [memberCardSettings, setMemberCardSettings] = useState<MemberCardSettings>(getStoredMemberCardSettings);
  const [uiElements, setUIElements] = useState<UIElementConfig[]>(getStoredUIElements);
  const [polls, setPolls] = useState<Poll[]>(getStoredPolls);
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>(getStoredSubAdmins);
  const [currentAdminSession, setCurrentAdminSession] = useState<CurrentAdminSession | null>(getStoredCurrentAdminSession);

  // Enforce strict access control based on platform status (pending_subscription, pending_activation, inactive vs active)
  useEffect(() => {
    if (activeTenantId === 'portal') return;
    const isMasterOverride = currentAdminSession?.isMasterPlatformAdmin === true;
    const activeMemberId = getStoredLoggedInMemberId(currentTenant.id);
    if (activeMemberId) {
      if (role === 'admin') {
        setRole('member');
        saveData(KEYS.ROLE, 'member');
      }
      if (activeTab === 'admin') {
        setActiveTab('home');
      }
      return;
    }
    if (currentTenant.status !== 'active' && !isMasterOverride) {
      if (role === 'admin') {
        setRole('member');
      }
      if (activeTab === 'admin') {
        setActiveTab('home');
      }
    } else if (currentTenant.status === 'active' && !isMasterOverride) {
      const storedSess = getStoredCurrentAdminSession(currentTenant.id);
      if (
        storedSess &&
        isValidAdminSessionForTenant(storedSess, 'admin', currentTenant.id, subAdmins) &&
        role !== 'admin'
      ) {
        setCurrentAdminSession(storedSess);
        setRole('admin');
      }
    }
  }, [activeTenantId, currentTenant.id, currentTenant.status, tenantsVersion]);

  // Donation Campaigns States
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>(getStoredCampaigns);
  const [campaignContributions, setCampaignContributions] = useState<CampaignContribution[]>(getStoredCampaignContributions);
  const [contributionTypes, setContributionTypes] = useState<ContributionTypeConfig[]>(getStoredContributionTypes);
  const [donationModalCampaign, setDonationModalCampaign] = useState<DonationCampaign | null>(null);

  // Sync campaigns and contribution types with backend JSON storage & Cloud Firestore on mount / tenant switch / auth state change
  useEffect(() => {
    async function loadCampaignData() {
      try {
        const rawActive = getActiveTenantId();
        const currentActive = (!rawActive || rawActive === 'portal') ? MASTER_TEMPLATE_TENANT_ID : rawActive;

        const [remoteCampaigns, remoteContribs, remoteTypes, firestoreCampaigns] = await Promise.all([
          campaignsApi.getCampaigns(currentActive).catch(() => []),
          campaignsApi.getContributions(undefined, currentActive).catch(() => []),
          campaignsApi.getContributionTypes(currentActive).catch(() => []),
          firestoreSyncService.fetchCampaignsFromFirestore(currentActive).catch(() => []),
        ]);

        let finalCampaigns = Array.isArray(remoteCampaigns) && remoteCampaigns.length > 0 ? remoteCampaigns : [];
        if (Array.isArray(firestoreCampaigns) && firestoreCampaigns.length > 0) {
          const byId = new Map<string, DonationCampaign>();
          for (const c of finalCampaigns) {
            byId.set(c.id, c);
          }
          for (const fc of firestoreCampaigns) {
            const existing = byId.get(fc.id);
            if (!existing || (fc.updatedAt && (!existing.updatedAt || fc.updatedAt >= existing.updatedAt))) {
              byId.set(fc.id, fc);
            }
          }
          finalCampaigns = Array.from(byId.values());
        }

        if (finalCampaigns && finalCampaigns.length > 0) {
          setCampaigns(finalCampaigns);
          saveCampaigns(finalCampaigns, currentActive);
        }
        if (remoteContribs && remoteContribs.length > 0) {
          setCampaignContributions(remoteContribs);
          saveCampaignContributions(remoteContribs, currentActive);
        }
        if (remoteTypes && remoteTypes.length > 0) {
          setContributionTypes(remoteTypes);
          saveContributionTypes(remoteTypes, currentActive);
        }
      } catch (err) {
        console.warn('Backend campaign synchronization note:', err);
      }
    }
    loadCampaignData();
  }, [activeTenantId, currentAdminSession?.tenantId, role]);

  // Listen to Global Platform Admin changes to Contribution Types & Registration Fields
  useEffect(() => {
    const handleGlobalContributionChange = (e: any) => {
      const rawActive = getActiveTenantId();
      const currentActive = !rawActive || rawActive === 'portal' ? MASTER_TEMPLATE_TENANT_ID : rawActive;
      const allIncomingTypes: any[] =
        e?.detail?.types && Array.isArray(e.detail.types)
          ? e.detail.types
          : getStoredContributionTypes();

      setContributionTypes(allIncomingTypes.filter((t: any) => !t.isDeleted));

      // Check if any contribution type was deleted (`isDeleted: true`) and immediately transition linked pending contributions to 'unpaid' with '-' sign
      const deletedIds = new Set<string>();
      const deletedNames = new Set<string>();
      for (const t of allIncomingTypes) {
        if (t && t.isDeleted) {
          if (t.id) deletedIds.add(String(t.id).trim());
          if (t.nameAr) deletedNames.add(String(t.nameAr).trim());
        }
      }

      if (deletedIds.size > 0 || deletedNames.size > 0) {
        setCampaignContributions((prevCc) => {
          let changed = false;
          const nextCc = prevCc.map((cc) => {
            const isMatched =
              (cc.contributionTypeId && deletedIds.has(cc.contributionTypeId.trim())) ||
              (cc.contributionTypeName && deletedNames.has(cc.contributionTypeName.trim()));
            if (isMatched && cc.status === 'pending') {
              changed = true;
              return {
                ...cc,
                status: 'unpaid' as const,
                isNegative: true,
                amountSign: '-' as const,
              };
            }
            return cc;
          });
          if (changed) {
            saveCampaignContributions(nextCc, currentActive);
            campaignsApi.saveContributions(nextCc, currentActive).catch(() => {});
          }
          return changed ? nextCc : prevCc;
        });

        setContributions((prevMc) => {
          let changed = false;
          const nextMc = prevMc.map((mc) => {
            const isMatched =
              (mc.contributionTypeId && deletedIds.has(mc.contributionTypeId.trim())) ||
              (mc.contributionTypeName && deletedNames.has(mc.contributionTypeName.trim())) ||
              (mc.category && (deletedIds.has(mc.category.trim()) || deletedNames.has(mc.category.trim())));
            if (isMatched && mc.status === 'pending') {
              changed = true;
              return {
                ...mc,
                status: 'unpaid' as const,
                isNegative: true,
                amountSign: '-' as const,
              };
            }
            return mc;
          });
          if (changed) {
            setOperations((prevOps) => {
              const {
                reconciledContributions,
                reconciledOperations,
                removedOperationIds,
              } = reconcileUnpaidContributionDeductions(nextMc, prevOps, currentActive);
              saveContributionsAndOperations(
                reconciledContributions,
                reconciledOperations,
                currentActive,
                removedOperationIds
              );
              return reconciledOperations;
            });
          }
          return changed ? nextMc : prevMc;
        });
      }
    };
    const handleGlobalRegistrationFieldsChange = (e: any) => {
      const rawActive = getActiveTenantId();
      const currentActive = !rawActive || rawActive === 'portal' ? MASTER_TEMPLATE_TENANT_ID : rawActive;
      const targetTenant = e?.detail?.tenantId;
      if (e?.detail?.fields && Array.isArray(e.detail.fields) && (!targetTenant || e?.detail?.isGlobal || targetTenant === currentActive)) {
        setRegistrationFields(ensureMandatoryPasswordFields(e.detail.fields));
      } else {
        setRegistrationFields(getStoredRegistrationFields(currentActive));
      }
    };
    const handleTransparencyRecordsUpdate = () => {
      const rawActive = getActiveTenantId();
      const currentActive = !rawActive || rawActive === 'portal' ? MASTER_TEMPLATE_TENANT_ID : rawActive;
      Promise.all([
        syncTenantRecordsFromBackend(currentActive).catch(() => null),
        campaignsApi.getContributions(undefined, currentActive).catch(() => []),
      ]).then(([syncedRecords, remoteCampaignContribs]) => {
        if (syncedRecords && Array.isArray(syncedRecords.contributions)) {
          setContributions(syncedRecords.contributions);
        }
        if (remoteCampaignContribs && Array.isArray(remoteCampaignContribs)) {
          setCampaignContributions(remoteCampaignContribs);
        }
      });
    };
    window.addEventListener(GLOBAL_CONTRIBUTION_SETTINGS_EVENT, handleGlobalContributionChange);
    window.addEventListener(GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT, handleGlobalRegistrationFieldsChange);
    window.addEventListener('transparency_records_updated', handleTransparencyRecordsUpdate);
    return () => {
      window.removeEventListener(GLOBAL_CONTRIBUTION_SETTINGS_EVENT, handleGlobalContributionChange);
      window.removeEventListener(GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT, handleGlobalRegistrationFieldsChange);
      window.removeEventListener('transparency_records_updated', handleTransparencyRecordsUpdate);
    };
  }, []);

  // Synchronize UI elements & custom configuration from backend JSON storage on mount and tenant switch
  useEffect(() => {
    async function loadElementsAndVisibility() {
      try {
        const currentActive = (!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;
        const localElements = getStoredUIElements(currentActive);
        const backendElements = await fetchUIElementsApi(currentActive);
        if (backendElements && Array.isArray(backendElements) && backendElements.length > 0) {
          setUIElements(backendElements);
          saveUIElements(backendElements, currentActive, false);
        } else if (localElements.length > 0) {
          saveUIElementsListApi(localElements, currentActive, 'الأدمن (تهيئة سحابية)').catch(console.warn);
        }
      } catch (err) {
        console.warn('UI elements server sync fallback to local storage:', err);
      }
    }
    loadElementsAndVisibility();
  }, [activeTenantId]);

  // Synchronize persistent tenant records (members, boardMembers, contributions, operations, registrationFields, auditLogs, memberCardSettings, polls) from backend database
  useEffect(() => {
    let isMounted = true;
    async function loadTenantRecordsAndPolls() {
      try {
        const rawActive = getActiveTenantId();
        const currentActive = (!rawActive || rawActive === 'portal') ? MASTER_TEMPLATE_TENANT_ID : rawActive;

        const [syncedRecords, pollsResult] = await Promise.all([
          syncTenantRecordsFromBackend(currentActive).catch(() => null),
          apiFetchPolls(currentActive).catch(() => null),
        ]);

        if (!isMounted) return;

        if (syncedRecords) {
          const authoritativeMembers = Array.isArray(syncedRecords.members) ? syncedRecords.members : members;
          const authoritativeOps = Array.isArray(syncedRecords.operations) ? syncedRecords.operations : operations;
          const authoritativeContribs = Array.isArray(syncedRecords.contributions) ? syncedRecords.contributions : contributions;

          if (Array.isArray(syncedRecords.members)) {
            setMembers(syncedRecords.members);
          }
          if (Array.isArray(syncedRecords.boardMembers)) {
            setBoardMembers(syncedRecords.boardMembers);
          }

          const { reconciledOperations, reconciledContributions, didUpdate } = reconcileMemberFinancialOperations(
            authoritativeMembers,
            authoritativeOps,
            authoritativeContribs
          );

          if (didUpdate) {
            setOperations(reconciledOperations);
            setContributions(reconciledContributions);
            saveOperations(reconciledOperations, currentActive, true);
            saveContributions(reconciledContributions, currentActive, true);
          } else {
            if (Array.isArray(syncedRecords.contributions)) {
              setContributions(syncedRecords.contributions);
            }
            if (Array.isArray(syncedRecords.operations)) {
              const calculated = calculateFinancials(syncedRecords.operations);
              setOperations(calculated.processedOperations);
            }
          }

          if (Array.isArray(syncedRecords.registrationFields)) {
            setRegistrationFields(ensureMandatoryPasswordFields(syncedRecords.registrationFields));
          }
          if (Array.isArray(syncedRecords.auditLogs)) {
            setAuditLogs(syncedRecords.auditLogs);
          }
          if (syncedRecords.memberCardSettings) {
            setMemberCardSettings(syncedRecords.memberCardSettings);
          }
          if (Array.isArray((syncedRecords as any).subAdmins) && (syncedRecords as any).subAdmins.length > 0) {
            const localSubs = getStoredSubAdmins(currentActive);
            const map = new Map<string, SubAdmin>();
            for (const s of [...(syncedRecords as any).subAdmins, ...localSubs]) {
              if (s && s.id) {
                map.set(s.id, { ...(map.get(s.id) || {}), ...s });
              }
            }
            const mergedSubs = Array.from(map.values());
            setSubAdmins(mergedSubs);
            saveSubAdmins(mergedSubs, false, currentActive);
          }
        }

        if (pollsResult && pollsResult.success && Array.isArray(pollsResult.polls)) {
          setPolls(pollsResult.polls);
        }
      } catch (err) {
        console.warn('Tenant records server sync warning:', err);
      }
    }
    loadTenantRecordsAndPolls();
    return () => {
      isMounted = false;
    };
  }, [activeTenantId]);

  // Synchronize activities with backend JSON database on mount and reconcile reference version
  useEffect(() => {
    let isMounted = true;
    async function loadAndReconcileActivities() {
      try {
        const rawActive = getActiveTenantId();
        const currentActive = (!rawActive || rawActive === 'portal') ? MASTER_TEMPLATE_TENANT_ID : rawActive;
        const remoteResult = await apiFetchActivitiesWithMeta(currentActive);
        if (!isMounted) return;
        
        const localActivities = getStoredActivities(currentActive);

        let baseList = localActivities;
        if (remoteResult && Array.isArray(remoteResult.activities) && remoteResult.activities.length > 0) {
          const remoteTs = remoteResult.lastUpdated ? new Date(remoteResult.lastUpdated).getTime() : 0;
          const localTs = getActivitiesTimestamp(currentActive);
          const deletedIds = getDeletedActivityIds(currentActive);
          const serverClean = remoteResult.activities.filter((a) => !deletedIds.includes(a.id));

          if (localTs > remoteTs + 2000 && localActivities.length > 0) {
            baseList = localActivities;
            apiSyncActivities(localActivities, currentAdminSession, currentActive).catch(console.warn);
          } else {
            baseList = serverClean;
            setActivities(serverClean);
            saveActivities(serverClean, false, currentActive);
            if (remoteTs > 0) {
              setActivitiesTimestamp(remoteTs, currentActive);
            }
          }
        } else if (localActivities.length > 0) {
          apiSyncActivities(localActivities, currentAdminSession, currentActive).catch(console.warn);
        }

        // Auto-rescue any legacy videos stored only in local IndexedDB with old blob URLs
        const rescued = await rescueLegacyVideos(baseList);
        if (rescued !== baseList && isMounted) {
          setActivities(rescued);
          saveActivities(rescued, true, currentActive);
          apiSyncActivities(rescued, currentAdminSession, currentActive).catch(console.warn);
        }
      } catch (err) {
        console.warn('Activities server sync fallback to local storage:', err);
      }
    }
    loadAndReconcileActivities();

    // Listen for reference activities updates across tabs/tenants without destructively overwriting
    const handleRefUpdate = () => {
      const rawActive = getActiveTenantId();
      const currentActive = (!rawActive || rawActive === 'portal') ? MASTER_TEMPLATE_TENANT_ID : rawActive;
      apiFetchActivitiesWithMeta(currentActive).then((remote) => {
        if (remote && Array.isArray(remote.activities) && remote.activities.length > 0) {
          setActivities(remote.activities);
          saveActivities(remote.activities, false, currentActive);
        }
      }).catch(console.warn);
    };

    window.addEventListener('chayef-reference-activities-updated', handleRefUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('chayef-reference-activities-updated', handleRefUpdate);
    };
  }, [activeTenantId]);

  // Synchronize settings & branding with backend JSON database
  useEffect(() => {
    let isMounted = true;
    async function loadAndReconcileSettings() {
      try {
        const rawActive = getActiveTenantId();
        const currentActive = (!rawActive || rawActive === 'portal') ? MASTER_TEMPLATE_TENANT_ID : rawActive;
        const remoteResult = await apiFetchSettingsWithMeta(currentActive);
        if (!isMounted) return;

        if (remoteResult && remoteResult.settings) {
          const remoteTs = remoteResult.lastUpdated ? new Date(remoteResult.lastUpdated).getTime() : Date.now();
          setSettings((prev) => {
            const remoteName = remoteResult.settings.name;
            const isCorruptedRemoteName = (currentActive !== 'tenant_nour' && currentActive !== 'portal') &&
              (!remoteName || remoteName === 'جمعية الشايف');

            const safeName = isCorruptedRemoteName
              ? (prev.name && prev.name !== 'جمعية الشايف' ? prev.name : 'الجمعية')
              : (remoteName || prev.name);

            const merged: AssociationSettings = {
              ...prev,
              ...remoteResult.settings,
              name: safeName,
              heroBadgeText: remoteResult.settings.heroBadgeText !== undefined
                ? remoteResult.settings.heroBadgeText
                : '',
              showAdminLoginButton: remoteResult.settings.showAdminLoginButton !== undefined
                ? remoteResult.settings.showAdminLoginButton
                : (prev.showAdminLoginButton ?? false),
              enableTripleClickLogoLogin: remoteResult.settings.enableTripleClickLogoLogin !== undefined
                ? remoteResult.settings.enableTripleClickLogoLogin
                : (prev.enableTripleClickLogoLogin ?? true),
            };
            saveSettings(merged, false, currentActive);
            applyStoreTheme(merged.themeColors);
            if (remoteTs > 0) {
              setSettingsTimestamp(remoteTs, currentActive);
            }
            return merged;
          });
        }
      } catch (err) {
        console.warn('Settings server sync fallback to local storage:', err);
      }
    }
    loadAndReconcileSettings();
    return () => {
      isMounted = false;
    };
  }, [activeTenantId]);

  // Synchronize global contribution types and portal settings from backend on mount and when updated
  useEffect(() => {
    let isMounted = true;
    fetchGlobalContributionTypesFromServer().then((types) => {
      if (isMounted && Array.isArray(types) && types.length > 0) {
        setContributionTypes(types);
      }
    }).catch(console.warn);

    // Synchronize portal UI settings from backend database
    fetchPortalSettings().catch(console.warn);

    const handleTypesUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setContributionTypes(e.detail);
      } else {
        fetchGlobalContributionTypesFromServer().then((types) => {
          if (Array.isArray(types) && types.length > 0) {
            setContributionTypes(types);
          }
        }).catch(console.warn);
      }
    };

    window.addEventListener('global-contribution-types-updated', handleTypesUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('global-contribution-types-updated', handleTypesUpdate);
    };
  }, []);

  // Synchronize sub-admins with backend JSON database and Cloud Firestore on mount and tenant change
  useEffect(() => {
    let isMounted = true;
    async function loadAndReconcileSubAdmins() {
      try {
        const rawActive = getActiveTenantId();
        const currentActive = !rawActive || rawActive === 'portal' ? MASTER_TEMPLATE_TENANT_ID : rawActive;

        const [remoteResult, firestoreSubs] = await Promise.all([
          apiFetchSubAdminsWithMeta().catch(() => null),
          firestoreSyncService.fetchSubAdminsFromFirestore(currentActive).catch(() => []),
        ]);
        if (!isMounted) return;

        const localSubs = getStoredSubAdmins(currentActive);
        const remoteSubs =
          remoteResult && Array.isArray(remoteResult.subAdmins)
            ? remoteResult.subAdmins.filter(
                (s) => !s.tenantId || s.tenantId === currentActive || (currentActive === MASTER_TEMPLATE_TENANT_ID && !s.tenantId)
              )
            : [];

        const map = new Map<string, SubAdmin>();
        for (const item of [...localSubs, ...firestoreSubs, ...remoteSubs]) {
          if (item && item.id) {
            const prev = map.get(item.id);
            map.set(item.id, prev ? { ...prev, ...item } : item);
          }
        }
        const mergedSubs = Array.from(map.values());
        if (mergedSubs.length > 0) {
          setSubAdmins(mergedSubs);
          saveSubAdmins(mergedSubs, false, currentActive);
          apiSyncSubAdmins(mergedSubs, currentAdminSession).catch(() => {});
        }
      } catch (err) {
        console.warn('Sub-admins server sync fallback to local storage:', err);
      }
    }
    loadAndReconcileSubAdmins();
    return () => {
      isMounted = false;
    };
  }, [activeTenantId]);

  // Security guard: If current sub-admin session is disabled by the Super Admin, terminate session immediately
  useEffect(() => {
    if (currentAdminSession && (currentAdminSession.type === 'sub_admin' || currentAdminSession.role === 'secondary_admin')) {
      const storedList = getStoredSubAdmins(currentAdminSession.tenantId || activeTenantId);
      const combined = [...storedList, ...subAdmins];
      const liveAccount =
        combined.find(
          (a) =>
            a.id === currentAdminSession.id ||
            (currentAdminSession.username &&
              a.username &&
              a.username.trim().toLowerCase() === currentAdminSession.username.trim().toLowerCase()) ||
            (currentAdminSession.phone &&
              a.phone &&
              a.phone.replace(/[\s\-\.\(\)]/g, '') === currentAdminSession.phone.replace(/[\s\-\.\(\)]/g, ''))
        ) || currentAdminSession.subAdmin;

      if (liveAccount && liveAccount.status !== 'active') {
        // Account disabled by main admin
        setCurrentAdminSession(null);
        clearCurrentAdminSession();
        setRole('member');
        if (activeTab === 'admin') {
          setActiveTab('home');
        }
        addToast('error', 'تم تعطيل حسابك الإداري من طرف الأدمن الرئيسي. تم إنهاء الجلسة أمنياً.');
      }
    }
  }, [subAdmins, currentAdminSession]);

  const handleUpdateCampaigns = (updated: DonationCampaign[]) => {
    const rawActive = getActiveTenantId();
    const cleanTenant = (!rawActive || rawActive === 'portal') ? (activeTenantId || MASTER_TEMPLATE_TENANT_ID) : rawActive;
    setCampaigns(updated);
    saveCampaigns(updated, cleanTenant);
    campaignsApi.saveCampaigns(updated, cleanTenant).catch(console.error);
    firestoreSyncService.syncCampaignsToFirestore(cleanTenant, updated).catch(console.error);
  };

  const handleUpdateCampaignContributions = (updated: CampaignContribution[]) => {
    setCampaignContributions(updated);
    saveCampaignContributions(updated, activeTenantId);
    const recalc = recalculateCampaignsFromContributions(campaigns, updated);
    setCampaigns(recalc);
    saveCampaigns(recalc, activeTenantId);
    campaignsApi.saveContributions(updated, activeTenantId).catch(console.error);
    campaignsApi.saveCampaigns(recalc, activeTenantId).catch(console.error);
  };

  const handleUpdateContributionTypes = (updated: ContributionTypeConfig[]) => {
    setContributionTypes(updated);
    saveContributionTypes(updated, activeTenantId);
    campaignsApi.saveContributionTypes(updated, activeTenantId).catch(console.error);
  };

  const handleDonationCompleted = (
    newContrib: CampaignContribution,
    updatedCamp?: DonationCampaign,
    explicitTenantId?: string
  ) => {
    // 1. Strictly resolve beneficiary Association ID
    const targetTenantId =
      explicitTenantId ||
      newContrib.tenantId ||
      newContrib.associationId ||
      updatedCamp?.tenantId ||
      updatedCamp?.associationId ||
      donationModalCampaign?.tenantId ||
      donationModalCampaign?.associationId ||
      (activeTenantId !== 'portal' ? activeTenantId : 'tenant_nour');

    const taggedContrib: CampaignContribution = {
      ...newContrib,
      tenantId: targetTenantId,
      associationId: targetTenantId,
    };

    // 2. Save campaign contributions for beneficiary association ONLY
    const currentCampContribs = getStoredCampaignContributions(targetTenantId);
    const updatedCampContribs = [
      taggedContrib,
      ...currentCampContribs.filter((c) => c.id !== taggedContrib.id),
    ];
    saveCampaignContributions(updatedCampContribs, targetTenantId);
    if (activeTenantId === targetTenantId) {
      setCampaignContributions(updatedCampContribs);
    }

    // 3. Recalculate campaigns for beneficiary association ONLY
    const currentCamps = getStoredCampaigns(targetTenantId);
    let listToRecalc = currentCamps;
    if (updatedCamp) {
      listToRecalc = currentCamps.map((c) =>
        c.id === updatedCamp.id ? { ...updatedCamp, tenantId: targetTenantId, associationId: targetTenantId } : c
      );
    }
    const recalculated = recalculateCampaignsFromContributions(listToRecalc, updatedCampContribs);
    saveCampaigns(recalculated, targetTenantId);
    if (activeTenantId === targetTenantId) {
      setCampaigns(recalculated);
    }

    // Sync remote for beneficiary association
    campaignsApi.saveCampaigns(recalculated, targetTenantId).catch(console.error);
    campaignsApi.saveContributions(updatedCampContribs, targetTenantId).catch(console.error);

    // 4. CRITICAL: Register donation in "سجل المساهمات والانخراطات" (Contributions & Subscriptions ledger)
    // AND in general financial operations ledger & update balance for beneficiary association ATOMICALLY!
    const newOpId = `op-camp-${taggedContrib.id}`;
    const memberContribId = `contrib-don-${taggedContrib.id}`;

    const currentMemberContribs = getStoredContributions(targetTenantId);
    const alreadyRegistered = currentMemberContribs.some(
      (c) => c.id === memberContribId || c.financialOperationId === newOpId
    );

    let updatedMemberContribs = currentMemberContribs;
    const cleanProofUrl = taggedContrib.proofImageUrl || taggedContrib.receiptUrl || undefined;
    if (!alreadyRegistered) {
      const newMemberContribution: MemberContribution = {
        id: memberContribId,
        memberId: taggedContrib.isAnonymous ? 'anonymous-donor' : `donor-${Date.now().toString(36)}`,
        memberCode: taggedContrib.isAnonymous ? 'فاعل خير' : 'متبرع',
        memberName: taggedContrib.donorName || 'فاعل خير',
        amount: Number(taggedContrib.amount),
        date: taggedContrib.date || new Date().toISOString().slice(0, 10),
        time: taggedContrib.time || new Date().toTimeString().slice(0, 8),
        createdAt: taggedContrib.createdAt || new Date().toISOString(),
        status: 'pending', // تلقائياً «قيد المراجعة» لعمليات التبرع الجديدة
        category: 'donation',
        paymentMethod: (taggedContrib.paymentMethod as any) || 'bank_transfer',
        notes: `تبرع لحملة: ${taggedContrib.campaignTitle}${taggedContrib.notes ? ` - ${taggedContrib.notes}` : ''}`,
        financialOperationId: newOpId,
        contributionTypeId: taggedContrib.contributionTypeId,
        contributionTypeName: taggedContrib.contributionTypeName,
        tenantId: targetTenantId,
        associationId: targetTenantId,
        campaignId: taggedContrib.campaignId,
        campaignTitle: taggedContrib.campaignTitle,
        donorPhone: taggedContrib.donorPhone,
        isAnonymous: taggedContrib.isAnonymous,
        proofImageUrl: cleanProofUrl,
        receiptUrl: cleanProofUrl,
      };
      updatedMemberContribs = [newMemberContribution, ...currentMemberContribs];
    } else if (cleanProofUrl) {
      updatedMemberContribs = currentMemberContribs.map((c) =>
        c.id === memberContribId || c.financialOperationId === newOpId
          ? { ...c, proofImageUrl: cleanProofUrl, receiptUrl: cleanProofUrl }
          : c
      );
    }

    const currentOps = getStoredOperations(targetTenantId);
    const opAlreadyExists = currentOps.some((op) => op.id === newOpId);
    let updatedOps = currentOps;
    if (!opAlreadyExists && Number(taggedContrib.amount) > 0) {
      const newOperation: FinancialOperation = {
        id: newOpId,
        code: `OP-${new Date().getFullYear()}-${String(currentOps.length + 1).padStart(3, '0')}`,
        type: 'income',
        category: 'donation',
        title: `تبرع لحملة: ${taggedContrib.campaignTitle} (${taggedContrib.donorName})`,
        description: `مساهمة (${taggedContrib.contributionTypeName || 'تبرع مالي'}) - طريقة الدفع: ${taggedContrib.paymentMethod || 'نقداً'}`,
        amount: Number(taggedContrib.amount),
        date: taggedContrib.date || new Date().toISOString().slice(0, 10),
        paymentMethod: (taggedContrib.paymentMethod as any) || 'bank_transfer',
        proofUrls: cleanProofUrl ? [cleanProofUrl] : undefined,
        addedBy: taggedContrib.donorName || 'فاعل خير',
        createdAt: new Date().toISOString(),
        tenantId: targetTenantId,
        associationId: targetTenantId,
      };
      updatedOps = [newOperation, ...currentOps];
    } else if (cleanProofUrl) {
      updatedOps = currentOps.map((op) =>
        op.id === newOpId ? { ...op, proofUrls: [cleanProofUrl] } : op
      );
    }

    const reconciled = reconcileUnpaidContributionDeductions(
      updatedMemberContribs,
      updatedOps,
      targetTenantId
    );

    if (activeTenantId === targetTenantId) {
      setContributions(reconciled.reconciledContributions);
      setOperations(reconciled.reconciledOperations);
    }

    saveContributionsAndOperations(
      reconciled.reconciledContributions,
      reconciled.reconciledOperations,
      targetTenantId,
      reconciled.removedOperationIds
    ).catch(console.error);

    // 6. Audit log for beneficiary association
    const targetSettings = getStoredSettings(targetTenantId);
    const updatedLogs = addAuditLog(
      'create',
      'campaign_contribution',
      `تسجيل مساهمة تبرع جديدة لحملة "${taggedContrib.campaignTitle}" من المتبرع (${taggedContrib.donorName}) بمبلغ ${taggedContrib.amount} ${targetSettings.currency || 'د.م'}`,
      taggedContrib.donorName,
      undefined,
      undefined,
      targetTenantId
    );
    if (activeTenantId === targetTenantId) {
      setAuditLogs(updatedLogs);
    }

    addToast('success', `تقبل الله تبرعك بمبلغ ${taggedContrib.amount} ${targetSettings.currency || 'د.م'} بنجاح! جزاكم الله خيراً.`);
  };

  // Sub-Admins Handlers
  const handleUpdateSubAdmins = (updated: SubAdmin[]) => {
    const isSuper = !currentAdminSession || currentAdminSession.type === 'super_admin' || currentAdminSession.role === 'main_admin';
    if (!isSuper) {
      addToast('error', 'عفواً، إدارة وتعديل حسابات الأدمن مخصصة حصرياً للأدمن الرئيسي.');
      return;
    }
    setSubAdmins(updated);
    saveSubAdmins(updated, true);
    apiSyncSubAdmins(updated, currentAdminSession).catch((err) => {
      console.warn('Sync sub-admins to server failed:', err);
    });
  };

  const handleAdminLogout = (redirectToLogin: boolean = true) => {
    const effectiveTenantId =
      !activeTenantId || activeTenantId === 'portal'
        ? currentTenant?.id || MASTER_TEMPLATE_TENANT_ID
        : activeTenantId;

    if (currentAdminSession) {
      const updatedLogs = addAuditLog(
        'logout',
        'auth',
        `تسجيل الخروج من لوحة التحكم الإدارية: ${currentAdminSession.fullName}`,
        currentAdminSession.fullName,
        currentAdminSession.type,
        currentAdminSession.phone,
        effectiveTenantId
      );
      setAuditLogs(updatedLogs);
      if (currentAdminSession.tenantId && currentAdminSession.tenantId !== effectiveTenantId) {
        clearCurrentAdminSession(currentAdminSession.tenantId);
        saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, null, currentAdminSession.tenantId);
      }
    }

    firestoreSyncService.logout().catch(console.warn);
    clearCurrentAdminSession(effectiveTenantId);
    saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, null, effectiveTenantId);
    saveData(KEYS.ROLE, 'member');
    setCurrentAdminSession(null);
    setRole('member');
    setActiveTab('home');

    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('tab');
        url.searchParams.delete('admin');
        url.searchParams.delete('adminTab');
        url.searchParams.delete('section');
        if (url.hash && url.hash.toLowerCase().includes('admin')) {
          url.hash = '';
        }
        window.history.replaceState({}, '', url.toString());
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {}
    }

    if (redirectToLogin) {
      setIsAdminAuthOpen(true);
    }

    addToast('info', 'تم تسجيل الخروج بنجاح وإنهاء الجلسة الحالية بشكل آمن.');
  };

  // Multi-Tenant Platform Switching & Navigation
  const switchTenant = (
    newTenantId: string, 
    fromDonations?: boolean, 
    targetTenant?: AssociationTenant,
    openAdminPanel?: boolean
  ) => {
    if (fromDonations) {
      setReturnToDonations(true);
      try {
        sessionStorage.setItem('nav_from_donations', 'true');
      } catch {}
    } else if (fromDonations === false) {
      setReturnToDonations(false);
      try {
        sessionStorage.removeItem('nav_from_donations');
      } catch {}
    }

    if (targetTenant) {
      const all = getAllTenants();
      const existingIdx = all.findIndex((t) => t.id === targetTenant.id);
      let updated: AssociationTenant[];
      if (existingIdx >= 0) {
        updated = all.map((t) => (t.id === targetTenant.id ? { ...t, ...targetTenant } : t));
      } else {
        updated = [targetTenant, ...all];
      }
      saveAllTenants(updated);
    }

    if (newTenantId !== 'portal') {
      try {
        sessionStorage.removeItem('explicit_portal_navigation');
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('portal');
          url.searchParams.delete('view');
          url.searchParams.set('tenant', newTenantId);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
    } else {
      try {
        sessionStorage.setItem('explicit_portal_navigation', 'true');
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('tenant');
          url.searchParams.set('portal', 'true');
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
    }

    setActiveTenantId(newTenantId);
    setActiveTenantIdState(newTenantId);
    setTenantsVersion((v) => v + 1);
    setIsMasterAdminOpen(false);

    // Reload all tenant-isolated data into React state (syncBackend = false so local cache doesn't overwrite server before loadTenantRecordsAndPolls completes)
    const tenantMembers = getStoredMembers(newTenantId);
    const tenantContribs = getStoredContributions(newTenantId);
    const tenantOps = getStoredOperations(newTenantId);
    const { reconciledOperations, reconciledContributions, didUpdate } = reconcileMemberFinancialOperations(
      tenantMembers,
      tenantOps,
      tenantContribs
    );
    if (didUpdate) {
      saveOperations(reconciledOperations, newTenantId, false);
      saveContributions(reconciledContributions, newTenantId, false);
      setMembers(tenantMembers);
      setContributions(reconciledContributions);
      setOperations(reconciledOperations);
    } else {
      setMembers(tenantMembers);
      setContributions(tenantContribs);
      setOperations(tenantOps);
    }
    const localActs = getStoredActivities(newTenantId);
    setActivities(localActs);
    apiFetchActivitiesWithMeta(newTenantId).then((remote) => {
      const deletedIds = getDeletedActivityIds(newTenantId);
      if (remote && Array.isArray(remote.activities) && remote.activities.length > 0) {
        const cleanRemote = remote.activities.filter((a) => !deletedIds.includes(a.id));
        setActivities(cleanRemote);
        saveActivities(cleanRemote, false, newTenantId);
      } else if (localActs.length > 0) {
        apiSyncActivities(localActs, undefined, newTenantId).catch(console.warn);
      }
    }).catch(console.warn);
    setAuditLogs(getStoredAuditLogs(newTenantId));
    const tenantSubAdmins = getStoredSubAdmins(newTenantId);
    setSubAdmins(tenantSubAdmins);
    const newSettings = getStoredSettings(newTenantId);
    setSettings(newSettings);
    applyStoreTheme(newSettings.themeColors);
    apiFetchSettingsWithMeta(newTenantId).then((remote) => {
      if (remote && remote.settings) {
        setSettings(remote.settings);
        saveSettings(remote.settings, false, newTenantId);
        applyStoreTheme(remote.settings.themeColors);
      }
    }).catch(console.warn);
    setRegistrationFields(getStoredRegistrationFields(newTenantId));
    setMemberCardSettings(getStoredMemberCardSettings(newTenantId));
    setUIElements(getStoredUIElements(newTenantId));
    fetchUIElementsApi(newTenantId).then((backendElements) => {
      if (backendElements && Array.isArray(backendElements) && backendElements.length > 0) {
        setUIElements(backendElements);
        saveUIElements(backendElements, newTenantId, false);
      }
    }).catch(console.error);
    setPolls(getStoredPolls(newTenantId));
    apiFetchPolls(newTenantId).then((res) => {
      if (res.success && Array.isArray(res.polls)) {
        setPolls(res.polls);
      }
    }).catch(console.error);
    setCampaigns(getStoredCampaigns(newTenantId));
    setCampaignContributions(getStoredCampaignContributions(newTenantId));
    setContributionTypes(getStoredContributionTypes(newTenantId));
    campaignsApi.getCampaigns(newTenantId).then(async (camps) => {
      let finalCamps = camps;
      try {
        const fsCamps = await firestoreSyncService.fetchCampaignsFromFirestore(newTenantId);
        if (fsCamps && fsCamps.length > 0) {
          const byId = new Map<string, DonationCampaign>();
          for (const c of finalCamps || []) byId.set(c.id, c);
          for (const fc of fsCamps) {
            const existing = byId.get(fc.id);
            if (!existing || (fc.updatedAt && (!existing.updatedAt || fc.updatedAt >= existing.updatedAt))) {
              byId.set(fc.id, fc);
            }
          }
          finalCamps = Array.from(byId.values());
        }
      } catch {}
      if (finalCamps && finalCamps.length > 0) {
        setCampaigns(finalCamps);
        saveCampaigns(finalCamps, newTenantId);
      }
    }).catch(() => {});

    if (openAdminPanel) {
      // Super Admin entering association control panel directly from Master Platform Admin
      const masterSession = getMasterAdminSession();
      const superAdminSession: CurrentAdminSession = {
        type: 'super_admin',
        role: 'main_admin',
        fullName: masterSession?.fullName || 'الأدمن الرئيسي (الإدارة العامة للمنصة)',
        phone: masterSession?.phone || '0661000001',
        tenantId: newTenantId,
        isMasterPlatformAdmin: true,
      };
      const all = getAllTenants();
      const assoc = all.find((t) => t.id === newTenantId) || targetTenant;
      saveCurrentAdminSession(superAdminSession, newTenantId);
      saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, superAdminSession, newTenantId);
      saveData(KEYS.ROLE, 'admin');
      setCurrentAdminSession(superAdminSession);
      setRole('admin');
      setActiveTab('admin');
      setLoggedInMember(null);

      const assocName = assoc?.name || 'الجمعية';
      addToast('success', `تم الدخول إلى لوحة تحكم «${assocName}» بصلاحيات الأدمن الرئيسي بنجاح.`);
    } else {
      const all = getAllTenants();
      const assoc = all.find((t) => t.id === newTenantId) || targetTenant;
      const isTenantRestricted = Boolean(assoc && assoc.status !== 'active');
      const storedMemberId = !isTenantRestricted ? getStoredLoggedInMemberId(newTenantId) : null;
      let resolvedMember: Member | null = null;
      if (storedMemberId) {
        const mems = getStoredMembers(newTenantId);
        resolvedMember = mems.find((x) => x.id === storedMemberId && x.status === 'active') || null;
      }

      if (resolvedMember) {
        // Active Member session: strictly isolate from Admin session and direct to general public interface
        setLoggedInMember(resolvedMember);
        setCurrentAdminSession(null);
        setRole('member');
        saveData(KEYS.ROLE, 'member');
        setActiveTab('home');
      } else {
        setLoggedInMember(null);
        const newAdminSession = !isTenantRestricted ? getStoredCurrentAdminSession(newTenantId) : null;
        const isAdminValid = isValidAdminSessionForTenant(newAdminSession, 'admin', newTenantId, tenantSubAdmins);
        setCurrentAdminSession(isAdminValid ? newAdminSession : null);
        setActiveTab('home');
        setRole(isAdminValid && !isTenantRestricted ? 'admin' : 'member');
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDirectDonateToAssociation = (assoc: AssociationTenant) => {
    if (assoc.status !== 'active') {
      addToast('error', 'لا يمكن عرض أو استخدام هذه المنصة قبل تسديد الاشتراك وتفعيلها من طرف الإدارة العامة.');
      return;
    }
    // 1. Immediately switch tenant context with fromDonations = true
    switchTenant(assoc.id, true, assoc);

    // 2. Resolve or initialize campaigns for this specific association
    let assocCampaigns = getStoredCampaigns(assoc.id);
    let targetCampaign = assocCampaigns.find((c) => c.status === 'active' || !c.status);

    if (!targetCampaign) {
      if (assocCampaigns.length > 0) {
        targetCampaign = assocCampaigns[0];
      } else {
        targetCampaign = {
          id: `camp_${assoc.id}_general`,
          title: `دعم ومساندة مشاريع ${assoc.name}`,
          description: `المساهمة في تمويل المشاريع الخيرية والتنموية والأنشطة الإنسانية لجمعية ${assoc.name}.`,
          targetProject: 'مشاريع وأنشطة الجمعية الخيرية',
          targetAmount: 50000,
          collectedAmount: 0,
          progressPercentage: 0,
          coverImage: assoc.logoUrl || assoc.bannerImageUrl || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
          startDate: new Date().toISOString().slice(0, 10),
          endDate: '',
          status: 'active',
          allowOverfunding: true,
          isVisibleOnStore: true,
          createdAt: new Date().toISOString(),
          tenantId: assoc.id,
          associationId: assoc.id,
          associationName: assoc.name,
        };
        assocCampaigns = [targetCampaign];
        saveCampaigns(assocCampaigns, assoc.id);
        setCampaigns(assocCampaigns);
        campaignsApi.saveCampaigns(assocCampaigns, assoc.id).catch(console.error);
      }
    }

    const boundCampaign: DonationCampaign = {
      ...targetCampaign,
      tenantId: assoc.id,
      associationId: assoc.id,
      associationName: assoc.name,
    };

    // 3. Open donation modal bound strictly to this association and campaign
    setDonationModalCampaign(boundCampaign);

    // 4. Update browser URL history for bookmarking & routing
    try {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('portal');
        url.searchParams.delete('view');
        url.searchParams.set('tenant', assoc.id);
        url.searchParams.set('donate', 'true');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}

    // 5. Smoothly scroll down to the campaigns section
    setTimeout(() => {
      const campSec = document.getElementById('campaigns-section');
      if (campSec) {
        campSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);
  };

  // Support direct URL deep linking with ?tenant=...&donate=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('donate') === 'true' && activeTenantId !== 'portal') {
          const all = getAllTenants();
          const target = all.find((t) => t.id === activeTenantId);
          if (target && target.status === 'active') {
            handleDirectDonateToAssociation(target);
          }
        }
      } catch {}
    }
  }, []);

  const handleSwitchToTenantFromMasterAdmin = (tenantId: string, openAdminPanel?: boolean) => {
    setReturnToDonations(false);
    try {
      sessionStorage.removeItem('nav_from_donations');
    } catch {}
    switchTenant(tenantId, false, undefined, openAdminPanel ?? false);
  };

  const handleBackToDonations = () => {
    try {
      sessionStorage.setItem('explicit_portal_navigation', 'true');
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('tenant');
        url.searchParams.set('portal', 'true');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
    setActiveTenantId('portal');
    setActiveTenantIdState('portal');
    setIsDonationsPageOpenInPortal(true);
    setIsMasterAdminOpen(false);
    setReturnToDonations(true);
    try {
      sessionStorage.setItem('nav_from_donations', 'true');
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToPortal = () => {
    try {
      sessionStorage.setItem('explicit_portal_navigation', 'true');
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('tenant');
        url.searchParams.set('portal', 'true');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
    setActiveTenantId('portal');
    setActiveTenantIdState('portal');
    setIsDonationsPageOpenInPortal(false);
    setIsMasterAdminOpen(false);
    setIsMasterAdminAuthModalOpen(false);
    setReturnToDonations(false);
    try {
      sessionStorage.removeItem('nav_from_donations');
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAssociationLoginSuccess = (
    tenant: AssociationTenant,
    session: CurrentAdminSession | null,
    userRole: UserRole,
    member?: Member
  ) => {
    setIsAssociationLoginOpen(false);
    const freshTenant = getTenantById(tenant.id) || tenant;
    if (freshTenant.status === 'inactive') {
      clearCurrentAdminSession(freshTenant.id);
      setCurrentAdminSession(null);
      setRole('member');
      setActiveTab('home');
      switchTenant(freshTenant.id, false, freshTenant);
      addToast('error', `منصة «${freshTenant.name}» معطلة مؤقتاً من طرف الإدارة العامة.`);
      return;
    }

    // 1. If authenticated as a Member (منخرط): direct strictly to the public interface of their association without any admin privileges
    if (userRole === 'member' || (!session && member)) {
      clearCurrentAdminSession(freshTenant.id);
      saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, null, freshTenant.id);
      setCurrentAdminSession(null);
      setRole('member');
      saveData(KEYS.ROLE, 'member');

      if (member) {
        saveLoggedInMemberId(member.id, freshTenant.id);
        const existingMems = getStoredMembers(freshTenant.id);
        const nextMems = existingMems.some((m) => m.id === member.id)
          ? existingMems.map((m) => (m.id === member.id ? member : m))
          : [member, ...existingMems];
        saveMembers(nextMems, freshTenant.id, false);
      }

      switchTenant(freshTenant.id, false, freshTenant);
      if (member) {
        setLoggedInMember(member);
      }
      setCurrentAdminSession(null);
      setRole('member');
      setActiveTab('home');

      if (member) {
        const updatedLogs = addAuditLog(
          'login',
          'member',
          `تسجيل دخول المنخرط إلى واجهة الجمعية: ${member.fullName} (${member.memberCode})`,
          member.fullName,
          undefined,
          undefined,
          freshTenant.id
        );
        setAuditLogs(updatedLogs);
        addToast('success', `مرحبًا بك يا ${member.fullName}! تم توجيهك إلى الواجهة العامة لـ «${freshTenant.name}».`);
      }
      return;
    }

    if (!session) return;

    // 2. Authenticated as an Association Owner or Sub-Admin: clear any member session or master admin state and store tenant-scoped admin session
    setIsMasterAdminOpen(false);
    clearLoggedInMemberId(freshTenant.id);
    setLoggedInMember(null);
    const scopedSession: CurrentAdminSession = {
      ...session,
      tenantId: freshTenant.id,
      isMasterPlatformAdmin: false,
    };
    saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, scopedSession, freshTenant.id);
    saveCurrentAdminSession(scopedSession, freshTenant.id);

    if (freshTenant.status === 'pending_subscription') {
      setCurrentAdminSession(null);
      setRole('member');
      setActiveTab('home');
      switchTenant(freshTenant.id, false, freshTenant);
      addToast('info', `منصة «${freshTenant.name}» في حالة «في انتظار الدفع». يرجى تسديد مبلغ الاشتراك المطلوب لتفعيل المنصة.`);
      return;
    }

    if (freshTenant.status === 'pending_activation') {
      setCurrentAdminSession(null);
      setRole('member');
      setActiveTab('home');
      switchTenant(freshTenant.id, false, freshTenant);
      addToast('info', `منصة «${freshTenant.name}» في حالة «في انتظار التفعيل». سيتم السماح بالدخول إلى لوحة الإدارة فور التحقق من الدفع وموافقة الإدارة العامة.`);
      return;
    }

    saveData(KEYS.ROLE, 'admin');
    switchTenant(freshTenant.id, false, freshTenant);
    if (scopedSession.type === 'sub_admin' && scopedSession.subAdmin) {
      const currentSubs = getStoredSubAdmins(freshTenant.id);
      const nextSubs = currentSubs.some((s) => s.id === scopedSession.subAdmin!.id)
        ? currentSubs.map((s) => (s.id === scopedSession.subAdmin!.id ? { ...s, ...scopedSession.subAdmin! } : s))
        : [scopedSession.subAdmin, ...currentSubs];
      setSubAdmins(nextSubs);
      saveSubAdmins(nextSubs, false, freshTenant.id);
    }
    setLoggedInMember(null);
    setRole('admin');
    setCurrentAdminSession(scopedSession);
    setActiveTab('admin');
    addToast('success', `مرحباً بك يا ${scopedSession.fullName}! تم توجيهك إلى لوحة إدارة منصة «${freshTenant.name}» بنجاح.`);
  };

  // Member Authentication States
  const [isMemberAuthOpen, setIsMemberAuthOpen] = useState(false);
  const [isMemberRegistrationOpen, setIsMemberRegistrationOpen] = useState(false);

  // Ensure registrationFields is always up-to-date whenever the registration modal opens
  useEffect(() => {
    if (!isMemberRegistrationOpen) return;
    const rawActive = getActiveTenantId();
    const currentActive = !rawActive || rawActive === 'portal' ? MASTER_TEMPLATE_TENANT_ID : rawActive;
    setRegistrationFields(getStoredRegistrationFields(currentActive));
    syncTenantRecordsFromBackend(currentActive)
      .then((res) => {
        if (res?.registrationFields && Array.isArray(res.registrationFields) && res.registrationFields.length > 0) {
          setRegistrationFields(ensureMandatoryPasswordFields(res.registrationFields));
        }
      })
      .catch(() => {});
  }, [isMemberRegistrationOpen, activeTenantId]);

  const [loggedInMember, setLoggedInMember] = useState<Member | null>(() => {
    const storedId = getStoredLoggedInMemberId();
    if (!storedId) return null;
    const initialMembers = getStoredMembers();
    const found = initialMembers.find((m) => m.id === storedId && m.status === 'active');
    return found || null;
  });

  // Keep loggedInMember synced with members list updates
  useEffect(() => {
    if (loggedInMember) {
      const refreshed = members.find((m) => m.id === loggedInMember.id);
      if (refreshed && refreshed.status === 'active') {
        setLoggedInMember(refreshed);
      } else if (refreshed && refreshed.status !== 'active') {
        setLoggedInMember(null);
        clearLoggedInMemberId();
        if (activeTab === 'my-account') {
          setActiveTab('home');
        }
        addToast('error', 'تم تعليق أو تعطيل الحساب من طرف الإدارة. تم تسجيل الخروج.');
      } else if (!refreshed && members.length > 0) {
        setLoggedInMember(null);
        clearLoggedInMemberId();
        if (activeTab === 'my-account') {
          setActiveTab('home');
        }
      }
    }
  }, [members]);

  // System-level Authorization & Direct-URL Guard:
  // Strictly prevent any Member or non-admin from accessing the Admin Control Panel via direct URL (?tab=admin, ?admin=true, #admin) or state
  useEffect(() => {
    const cleanUrlAdminParams = () => {
      if (typeof window === 'undefined') return;
      try {
        const url = new URL(window.location.href);
        let modified = false;
        if (url.searchParams.get('tab') === 'admin') {
          url.searchParams.delete('tab');
          modified = true;
        }
        if (url.searchParams.has('admin')) {
          url.searchParams.delete('admin');
          modified = true;
        }
        if (url.hash && url.hash.toLowerCase().includes('admin')) {
          url.hash = '';
          modified = true;
        }
        if (modified) {
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
    };

    const hasValidAdminAccess =
      !loggedInMember &&
      isValidAdminSessionForTenant(currentAdminSession, role, activeTenantId, subAdmins);

    if (!hasValidAdminAccess) {
      if (role === 'admin') {
        setRole('member');
        saveData(KEYS.ROLE, 'member');
      }
      if (activeTab === 'admin') {
        setActiveTab('home');
      }
      cleanUrlAdminParams();
    }

    const handlePopStateOrHashChange = () => {
      if (typeof window === 'undefined') return;
      try {
        const params = new URLSearchParams(window.location.search);
        const requestedTab = params.get('tab');
        if (
          (requestedTab === 'admin' || params.get('admin') === 'true' || window.location.hash.toLowerCase().includes('admin')) &&
          !hasValidAdminAccess
        ) {
          cleanUrlAdminParams();
          setActiveTab('home');
        }
      } catch {}
    };

    window.addEventListener('popstate', handlePopStateOrHashChange);
    window.addEventListener('hashchange', handlePopStateOrHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopStateOrHashChange);
      window.removeEventListener('hashchange', handlePopStateOrHashChange);
    };
  }, [activeTab, role, currentAdminSession, loggedInMember, activeTenantId, subAdmins]);

  const handleSelectTab = (tab: string) => {
    const hasValidAdminAccess =
      !loggedInMember &&
      isValidAdminSessionForTenant(currentAdminSession, role, activeTenantId, subAdmins);
    if (tab === 'admin' && !hasValidAdminAccess) {
      setActiveTab('home');
      return;
    }
    setSelectedActivityIdForView(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Apply dynamic theme colors to root CSS variables and styles
  useEffect(() => {
    applyStoreTheme(settings.themeColors);
  }, [settings.themeColors]);

  // Synchronize theme across tabs/windows in real time
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'chayef_assoc_settings_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.themeColors) {
            applyStoreTheme(parsed.themeColors);
            setSettings(prev => ({ ...prev, ...parsed }));
          }
        } catch {
          // ignore
        }
      }
    };
    const handleThemeEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        applyStoreTheme(customEvent.detail);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('chayef-store-theme-applied', handleThemeEvent);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('chayef-store-theme-applied', handleThemeEvent);
    };
  }, []);

  // Modals States
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [isAddOperationOpen, setIsAddOperationOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityItem | null>(null);
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Media & Receipt Modals
  const [selectedActivityIdForView, setSelectedActivityIdForView] = useState<string | null>(null);
  const [mediaModalData, setMediaModalData] = useState<{
    title: string;
    url: string;
    type: 'image' | 'video' | 'document';
    description?: string;
  } | null>(null);

  const [receiptModalData, setReceiptModalData] = useState<{
    type: 'member_card' | 'operation_receipt' | 'financial_statement';
    member?: Member;
    operation?: FinancialOperation;
  } | null>(null);

  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', text: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleOpenMediaModal = (media: {
    title: string;
    url: string;
    type: 'image' | 'video' | 'document';
    description?: string;
  }) => {
    if (media.type === 'document' || media.title.includes('إثبات') || media.title.includes('فاتورة')) {
      const allowed = isProofPreviewVisibleForUser({
        isAdmin: role === 'admin',
        isMember: !!loggedInMember,
        uiElements,
      });
      if (!allowed) {
        addToast('error', 'عذراً، معاينة وثيقة وفاتورة الإثبات محجوبة ومتاحة حصرياً للمنخرطين المسجلين في الجمعية');
        return;
      }
    }
    setMediaModalData(media);
  };

  // Sync RTL / LTR document direction with Language
  useEffect(() => {
    if (lang === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = lang;
    }
  }, [lang]);

  // Recalculate Financials
  const { totalIncomes, totalExpenses, currentBalance, processedOperations } = calculateFinancials(operations);

  // ---------------- OPERATIONS HANDLERS ----------------
  const handleSaveOperation = async (
    opData: Partial<FinancialOperation>,
    editId?: string
  ) => {
    const cleanTenant = !activeTenantId || activeTenantId === 'portal' ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;

    if (editId) {
      // 1. In-place Edit: Preserve original ID & Code, Append Revision
      const existingOp = operations.find((o) => o.id === editId);
      if (!existingOp) {
        addToast('error', 'العملية المالية المطلوبة غير موجودة.');
        return { success: false, error: 'Operation not found' };
      }

      const res = await apiUpdateOperationInPlace(
        editId,
        { ...opData, tenantId: cleanTenant, associationId: cleanTenant },
        existingOp,
        currentAdminSession,
        subAdmins
      );

      if (!res.success || !res.data) {
        addToast('error', res.error || 'تم رفض التعديل أمنياً: لا تملك صلاحية تعديل العمليات المالية.');
        return res;
      }

      const { updatedOperation, changeSummary } = res.data;
      const taggedUpdatedOp: FinancialOperation = {
        ...updatedOperation,
        tenantId: cleanTenant,
        associationId: cleanTenant,
      };

      // Update strictly in-place without creating a new record
      const updatedList = operations.map((op) => (op.id === editId ? taggedUpdatedOp : op));

      // Also sync any linked MemberContribution in «سجل المساهمات والانخراطات»
      const updatedContribs = contributions.map((c) => {
        if (c.financialOperationId === editId || c.id === `contrib-op-${editId}`) {
          return {
            ...c,
            amount: Number(taggedUpdatedOp.amount) || c.amount,
            date: taggedUpdatedOp.date || c.date,
            paymentMethod: (taggedUpdatedOp.paymentMethod as any) || c.paymentMethod,
            notes: taggedUpdatedOp.description
              ? `${taggedUpdatedOp.title} - ${taggedUpdatedOp.description}`
              : taggedUpdatedOp.title || c.notes,
            tenantId: cleanTenant,
            associationId: cleanTenant,
          };
        }
        return c;
      });

      const reconciled = reconcileUnpaidContributionDeductions(
        updatedContribs,
        updatedList,
        cleanTenant
      );

      setContributions(reconciled.reconciledContributions);
      setOperations(reconciled.reconciledOperations);

      const savedOk = await saveContributionsAndOperations(
        reconciled.reconciledContributions,
        reconciled.reconciledOperations,
        cleanTenant,
        reconciled.removedOperationIds
      );
      if (!savedOk) {
        addToast('error', 'تعذر حفظ تعديلات العملية المالية في قاعدة البيانات الدائمة. يرجى إعادة المحاولة.');
        return { success: false, error: 'تعذر الحفظ في الخادم' };
      }

      // Audit log
      const performerName = currentAdminSession?.fullName || settings.name || 'إدارة الجمعية';
      const logDesc = `تعديل في نفس السجل للعملية (${existingOp.code}): ${changeSummary.join(' | ')}`;
      const updatedLogs = addAuditLog(
        'update',
        'operation',
        logDesc,
        performerName,
        currentAdminSession?.type,
        currentAdminSession?.phone,
        cleanTenant
      );
      setAuditLogs(updatedLogs);

      addToast('success', 'تم حفظ التعديلات في نفس السجل المالي الأصلي وإعادة احتساب الرصيد بنجاح!');
      return { success: true, operation: taggedUpdatedOp };
    } else {
      // 2. New Operation Creation
      const res = await apiCreateOperation(
        {
          ...opData,
          tenantId: cleanTenant,
          associationId: cleanTenant,
        } as Omit<FinancialOperation, 'id' | 'balanceAfter' | 'createdAt'>,
        currentAdminSession,
        subAdmins
      );

      if (!res.success || !res.data) {
        addToast('error', res.error || 'تم رفض إضافة العملية أمنياً: لا تملك صلاحية إضافة عمليات مالية.');
        return res;
      }

      const newOperation: FinancialOperation = {
        ...res.data,
        tenantId: cleanTenant,
        associationId: cleanTenant,
      };
      const updatedOps = [newOperation, ...operations.filter((o) => o.id !== newOperation.id)];

      // If this is an income operation (e.g. financial contribution, resources, financial aid, subscription),
      // also register a linked MemberContribution in «سجل المساهمات والانخراطات» so both ledgers stay permanently in sync!
      let updatedContribs = [...contributions];
      if (newOperation.type === 'income' && Number(newOperation.amount) > 0) {
        const linkedContribId = `contrib-op-${newOperation.id}`;
        const alreadyHasContrib = updatedContribs.some(
          (c) => c.id === linkedContribId || c.financialOperationId === newOperation.id
        );
        if (!alreadyHasContrib) {
          const newContrib: MemberContribution = {
            id: linkedContribId,
            memberId: newOperation.memberId || `donor-${newOperation.id}`,
            memberCode: newOperation.memberId ? newOperation.code || 'منخرط' : 'موارد ومساعدات',
            memberName: newOperation.memberName || newOperation.addedBy || newOperation.title || 'موارد ومساعدات مالية',
            amount: Number(newOperation.amount),
            date: newOperation.date || new Date().toISOString().slice(0, 10),
            time: new Date().toTimeString().slice(0, 8),
            createdAt: newOperation.createdAt || new Date().toISOString(),
            status: 'completed',
            category: newOperation.category === 'membership_fee' ? 'membership_fee' : 'donation',
            paymentMethod: (newOperation.paymentMethod as any) || 'bank_transfer',
            notes: newOperation.description
              ? `${newOperation.title} - ${newOperation.description}`
              : newOperation.title || 'موارد ومساعدات مالية للجمعية',
            financialOperationId: newOperation.id,
            contributionTypeName:
              newOperation.category === 'aid'
                ? 'مساهمة مالية في موارد ومساعدات مالية للجمعية'
                : newOperation.category === 'membership_fee'
                ? 'واجب الانخراط السنوي'
                : newOperation.title || 'مساهمة مالية للجمعية',
            tenantId: cleanTenant,
            associationId: cleanTenant,
          };
          updatedContribs = [newContrib, ...updatedContribs];
        }
      }

      const reconciled = reconcileUnpaidContributionDeductions(
        updatedContribs,
        updatedOps,
        cleanTenant
      );

      setContributions(reconciled.reconciledContributions);
      setOperations(reconciled.reconciledOperations);

      const savedOk = await saveContributionsAndOperations(
        reconciled.reconciledContributions,
        reconciled.reconciledOperations,
        cleanTenant,
        reconciled.removedOperationIds
      );
      if (!savedOk) {
        addToast('error', 'تعذر حفظ العملية المالية في قاعدة البيانات الدائمة. يرجى إعادة المحاولة.');
        return { success: false, error: 'تعذر الحفظ في الخادم' };
      }

      const logDesc =
        newOperation.type === 'income'
          ? `تسجيل مدخول/مساهمة مالية جديدة بقيمة +${newOperation.amount} د.م (${newOperation.title})`
          : `تسجيل مصروف عمل خيري بقيمة -${newOperation.amount} د.م (${newOperation.title})`;

      const updatedLogs = addAuditLog(
        'create',
        'operation',
        logDesc,
        currentAdminSession?.fullName || settings.name || 'إدارة الجمعية',
        currentAdminSession?.type,
        currentAdminSession?.phone,
        cleanTenant
      );
      setAuditLogs(updatedLogs);

      if (newOperation.type === 'income') {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch (e) {}
      }

      addToast('success', 'تم تسجيل العملية المالية بنجاح وتحديث الرصيد المالي!');
      return { success: true, operation: newOperation };
    }
  };

  const handleDeleteOperation = async (id: string) => {
    const cleanTenant = !activeTenantId || activeTenantId === 'portal' ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;
    const res = await apiDeleteOperation(id, currentAdminSession, subAdmins);
    if (!res.success) {
      addToast('error', res.error || 'تم رفض حذف العملية أمنياً: لا تملك صلاحية حذف العمليات المالية.');
      return;
    }

    if (!window.confirm('هل أنت متأكد من حذف هذه العملية المالية؟ سيتم تحديث الرصيد وتسجيل العملية في سجل التدقيق.')) {
      return;
    }

    const opToDelete = operations.find((op) => op.id === id);
    const removedContribIds = contributions
      .filter(
        (c) =>
          c.financialOperationId === id ||
          c.id === `contrib-op-${id}` ||
          (opToDelete?.memberId && c.id === `contrib-fee-${opToDelete.memberId}`)
      )
      .map((c) => c.id);

    recordDeletedOperationId(id, cleanTenant);
    for (const cId of removedContribIds) {
      recordDeletedContributionId(cId, cleanTenant);
    }

    const updatedOps = operations.filter((op) => op.id !== id);
    const updatedContribs = contributions.filter((c) => !removedContribIds.includes(c.id));

    const reconciled = reconcileUnpaidContributionDeductions(
      updatedContribs,
      updatedOps,
      cleanTenant
    );

    setContributions(reconciled.reconciledContributions);
    setOperations(reconciled.reconciledOperations);

    const savedOk = await saveContributionsAndOperations(
      reconciled.reconciledContributions,
      reconciled.reconciledOperations,
      cleanTenant,
      [id, ...reconciled.removedOperationIds],
      removedContribIds
    );
    if (!savedOk) {
      addToast('error', 'تعذر حذف العملية المالية من قاعدة البيانات الدائمة. يرجى إعادة المحاولة.');
      return;
    }

    const updatedLogs = addAuditLog(
      'delete',
      'operation',
      `حذف عملية مالية: ${opToDelete?.title || id} بقيمة ${opToDelete?.amount} د.م`,
      currentAdminSession?.fullName || settings.name || 'إدارة الجمعية',
      currentAdminSession?.type,
      currentAdminSession?.phone,
      cleanTenant
    );
    setAuditLogs(updatedLogs);
    addToast('info', 'تم حذف العملية وتحديث الرصيد المالي.');
  };

  // ---------------- MEMBERS HANDLERS ----------------
  const handleSaveMember = async (memberData: Omit<Member, 'id'>) => {
    const action = editingMember ? 'canEdit' : 'canAdd';
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'members', action);
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً.');
      return;
    }

    if (editingMember) {
      // Update
      const newFee = Number(memberData.annualFee) || 0;
      const feeDate = memberData.joinDate || editingMember.joinDate || new Date().toISOString().slice(0, 10);
      const feeOpId = `op-fee-${editingMember.id}`;
      const feeContribId = `contrib-fee-${editingMember.id}`;

      const chosenPaymentMethod = (memberData.membershipPaymentMethod as PaymentMethodType) || 'bank_transfer';
      const updated = members.map((m) =>
        m.id === editingMember.id ? { ...memberData, id: editingMember.id, annualFee: newFee, membershipPaymentMethod: chosenPaymentMethod } : m
      );

      let updatedOps = [...operations];
      let updatedContribs = [...contributions];

      const existingOpIndex = updatedOps.findIndex(
        (op) => op.id === feeOpId || (op.memberId === editingMember.id && op.category === 'membership_fee')
      );

      const existingContribIndex = updatedContribs.findIndex(
        (c) => c.id === feeContribId || (c.memberId === editingMember.id && c.category === 'membership_fee')
      );

      if (newFee > 0) {
        if (existingOpIndex >= 0) {
          const targetOp = updatedOps[existingOpIndex];
          updatedOps[existingOpIndex] = {
            ...targetOp,
            title: `واجب انخراط سنوي: ${memberData.fullName} (${memberData.memberCode})`,
            description: `استخلاص واجب الانخراط السنوي للمنخرط ${memberData.fullName} (${memberData.memberCode}) بتاريخ ${feeDate}`,
            amount: newFee,
            memberName: memberData.fullName,
            date: feeDate,
            paymentMethod: chosenPaymentMethod,
            updatedAt: new Date().toISOString(),
            updatedBy: currentAdminSession?.fullName || 'إدارة الجمعية',
          };
        } else {
          const newOp: FinancialOperation = {
            id: feeOpId,
            code: `REC-${new Date().getFullYear()}-${memberData.memberCode}`,
            title: `واجب انخراط سنوي: ${memberData.fullName} (${memberData.memberCode})`,
            description: `استخلاص واجب الانخراط السنوي للمنخرط ${memberData.fullName} (${memberData.memberCode}) بتاريخ ${feeDate}`,
            type: 'income',
            category: 'membership_fee',
            amount: newFee,
            date: feeDate,
            memberId: editingMember.id,
            memberName: memberData.fullName,
            paymentMethod: chosenPaymentMethod,
            addedBy: currentAdminSession?.fullName || 'إدارة الجمعية',
            createdAt: new Date().toISOString(),
            proofUrls: (memberData as any).proofImageUrl ? [(memberData as any).proofImageUrl] : undefined,
          };
          updatedOps = [newOp, ...updatedOps];
        }

        const opId = existingOpIndex >= 0 ? updatedOps[existingOpIndex].id : feeOpId;

        if (existingContribIndex >= 0) {
          const targetContrib = updatedContribs[existingContribIndex];
          updatedContribs[existingContribIndex] = {
            ...targetContrib,
            amount: newFee,
            memberName: memberData.fullName,
            memberCode: memberData.memberCode,
            date: feeDate,
            paymentMethod: chosenPaymentMethod,
            financialOperationId: opId,
            proofImageUrl: (memberData as any).proofImageUrl || (memberData as any).receiptUrl || targetContrib.proofImageUrl,
            receiptUrl: (memberData as any).proofImageUrl || (memberData as any).receiptUrl || targetContrib.receiptUrl,
          };
        } else {
          const newContrib: MemberContribution = {
            id: feeContribId,
            memberId: editingMember.id,
            memberCode: memberData.memberCode,
            memberName: memberData.fullName,
            amount: newFee,
            date: feeDate,
            time: '12:00:00',
            createdAt: new Date().toISOString(),
            status: 'pending',
            category: 'membership_fee',
            paymentMethod: chosenPaymentMethod,
            notes: `واجب الانخراط السنوي (${feeDate}) - قيد المراجعة`,
            financialOperationId: opId,
            proofImageUrl: (memberData as any).proofImageUrl || (memberData as any).receiptUrl,
            receiptUrl: (memberData as any).proofImageUrl || (memberData as any).receiptUrl,
          };
          updatedContribs = [newContrib, ...updatedContribs];
        }
      } else {
        // If fee was set to 0, remove previous fee op & contribution so balance is not inflated
        if (existingOpIndex >= 0) {
          updatedOps = updatedOps.filter((_, idx) => idx !== existingOpIndex);
        }
        if (existingContribIndex >= 0) {
          updatedContribs = updatedContribs.filter((_, idx) => idx !== existingContribIndex);
        }
      }

      const calculated = calculateFinancials(updatedOps);
      const [okMembers, okFin] = await Promise.all([
        saveMembers(updated),
        saveContributionsAndOperations(updatedContribs, calculated.processedOperations, activeTenantId),
      ]);

      if (!okMembers || !okFin) {
        addToast('error', 'تعذر حفظ تعديلات المنخرط في قاعدة البيانات الدائمة. يرجى إعادة المحاولة.');
        return;
      }

      setMembers(updated);
      setContributions(updatedContribs);
      setOperations(calculated.processedOperations);
      setEditingMember(null);

      const updatedLogs = addAuditLog(
        'update',
        'member',
        `تعديل بيانات المنخرط: ${memberData.fullName} (${memberData.memberCode}) وتحديث السجل المالي (+${newFee} د.م)`,
        currentAdminSession?.fullName || 'إدارة الجمعية'
      );
      setAuditLogs(updatedLogs);
      addToast('success', 'تم تعديل بيانات المنخرط وتحديث السجل المالي والرصيد بنجاح!');
    } else {
      // Create
      const newFee = Number(memberData.annualFee) || 0;
      const chosenPaymentMethod = (memberData.membershipPaymentMethod as PaymentMethodType) || 'bank_transfer';
      const newMember: Member = {
        ...memberData,
        id: `m-${Date.now()}`,
        annualFee: newFee,
        membershipPaymentMethod: chosenPaymentMethod,
      };
      const updatedMembers = [newMember, ...members];

      let updatedOps = [...operations];
      let updatedContribs = [...contributions];

      if (newFee > 0) {
        const feeDate = newMember.joinDate || new Date().toISOString().slice(0, 10);
        const feeOpId = `op-fee-${newMember.id}`;
        const feeContribId = `contrib-fee-${newMember.id}`;

        const newOperation: FinancialOperation = {
          id: feeOpId,
          code: `REC-${new Date().getFullYear()}-${newMember.memberCode}`,
          title: `واجب انخراط سنوي: ${newMember.fullName} (${newMember.memberCode})`,
          description: `استخلاص واجب الانخراط السنوي للمنخرط ${newMember.fullName} (${newMember.memberCode}) بتاريخ التسجيل ${feeDate} (قيد المراجعة)`,
          type: 'income',
          category: 'membership_fee',
          amount: newFee,
          date: feeDate,
          memberId: newMember.id,
          memberName: newMember.fullName,
          paymentMethod: chosenPaymentMethod,
          addedBy: currentAdminSession?.fullName || 'إدارة الجمعية',
          createdAt: new Date().toISOString(),
          proofUrls: newMember.proofImageUrl ? [newMember.proofImageUrl] : (newMember.receiptUrl ? [newMember.receiptUrl] : undefined),
        };

        const newContrib: MemberContribution = {
          id: feeContribId,
          memberId: newMember.id,
          memberCode: newMember.memberCode,
          memberName: newMember.fullName,
          amount: newFee,
          date: feeDate,
          time: new Date().toTimeString().slice(0, 8),
          createdAt: new Date().toISOString(),
          status: 'pending',
          category: 'membership_fee',
          paymentMethod: chosenPaymentMethod,
          notes: `واجب الانخراط السنوي عند التسجيل (${feeDate}) - قيد المراجعة`,
          financialOperationId: feeOpId,
          proofImageUrl: newMember.proofImageUrl || newMember.receiptUrl,
          receiptUrl: newMember.proofImageUrl || newMember.receiptUrl,
        };

        updatedOps = [newOperation, ...operations];
        updatedContribs = [newContrib, ...contributions];
      }

      const calculated = calculateFinancials(updatedOps);
      const [okMembers, okFin] = await Promise.all([
        saveMembers(updatedMembers),
        saveContributionsAndOperations(updatedContribs, calculated.processedOperations, activeTenantId),
      ]);

      if (!okMembers || !okFin) {
        addToast('error', 'تعذر حفظ المنخرط الجديد في قاعدة البيانات الدائمة. يرجى إعادة المحاولة.');
        return;
      }

      setMembers(updatedMembers);
      setContributions(updatedContribs);
      setOperations(calculated.processedOperations);

      const updatedLogs = addAuditLog(
        'create',
        'member',
        `تسجيل منخرط جديد: ${newMember.fullName} (${newMember.memberCode}) وتقييد واجب الانخراط السنوي بمبلغ +${newFee} د.م`,
        currentAdminSession?.fullName || 'إدارة الجمعية'
      );
      setAuditLogs(updatedLogs);

      if (newFee > 0) {
        try {
          confetti({
            particleCount: 60,
            spread: 60,
            origin: { y: 0.6 },
          });
        } catch (e) {}
      }

      addToast('success', `تم تسجيل المنخرط الجديد بنجاح وتقييد مبلغ الانخراط (+${newFee.toLocaleString()} د.م) في السجل المالي والرصيد!`);
    }
  };

  const handleDeleteMember = async (id: string, skipConfirm = false) => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'members', 'canDelete');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: لا تملك صلاحية حذف المنخرطين.');
      return;
    }

    if (!skipConfirm && !window.confirm('هل أنت متأكد من حذف هذا المنخرط؟ سيتم إلغاء أثره المالي وحذف مساهمات انخراطه من السجل وتحديث الرصيد.')) return;
    const memberToDelete = members.find((m) => m.id === id);
    const updatedMembers = members.filter((m) => m.id !== id);

    // Remove any linked financial operations and contributions for this member!
    const feeOpId = `op-fee-${id}`;
    const feeContribId = `contrib-fee-${id}`;
    const updatedOps = operations.filter(
      (op) => op.id !== feeOpId && op.memberId !== id
    );
    const updatedContribs = contributions.filter(
      (c) => c.id !== feeContribId && c.memberId !== id
    );

    const calculated = calculateFinancials(updatedOps);
    const [okMembers, okContribs, okOps] = await Promise.all([
      saveMembers(updatedMembers),
      saveContributions(updatedContribs),
      saveOperations(calculated.processedOperations),
    ]);

    if (!okMembers || !okContribs || !okOps) {
      addToast('error', 'تعذر حذف المنخرط من قاعدة البيانات الدائمة. يرجى إعادة المحاولة.');
      return;
    }

    setMembers(updatedMembers);
    setContributions(updatedContribs);
    setOperations(calculated.processedOperations);

    const updatedLogs = addAuditLog(
      'delete',
      'member',
      `حذف المنخرط نهائيًا وإلغاء أثره المالي: ${memberToDelete?.fullName || id} (${memberToDelete?.memberCode || ''})`,
      currentAdminSession?.fullName || 'إدارة الجمعية'
    );
    setAuditLogs(updatedLogs);
    addToast('info', `تم حذف المنخرط «${memberToDelete?.fullName || ''}» وتحديث الرصيد المالي.`);
  };

  const handleToggleMemberStatus = async (id: string, targetStatus?: MemberStatus) => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'members', 'canEdit');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: لا تملك صلاحية تعديل حالة المنخرطين.');
      return;
    }

    const member = members.find((m) => m.id === id);
    if (!member) return;
    const currentActive = member.status === 'active';
    const newStatus: MemberStatus = targetStatus || (currentActive ? 'inactive' : 'active');
    if (member.status === newStatus) {
      return;
    }

    const currentTenant = (!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;
    const updated = members.map((m) =>
      m.id === id ? { ...m, status: newStatus } : m
    );

    // Update UI state immediately so it reflects right away on the association interface and member list
    setMembers(updated);

    const savedOk = await saveMembers(updated, currentTenant, true);
    if (!savedOk) {
      addToast('error', 'تعذر حفظ حالة المنخرط في قاعدة البيانات الدائمة. يرجى إعادة المحاولة.');
      return;
    }

    const updatedLogs = addAuditLog(
      'update',
      'member',
      `${newStatus === 'active' ? 'تفعيل حساب المنخرط' : 'إلغاء تفعيل حساب المنخرط (تعطيل مؤقت)'}: ${member.fullName} (${member.memberCode})`,
      currentAdminSession?.fullName || settings.name || 'إدارة الجمعية',
      currentAdminSession?.type,
      currentAdminSession?.phone,
      currentTenant
    );
    setAuditLogs(updatedLogs);

    if (newStatus === 'active') {
      addToast('success', `تم تفعيل حساب المنخرط «${member.fullName}» بنجاح! (نشط ومفعّل) 🟢`);
    } else {
      addToast('info', `تم إلغاء تفعيل حساب المنخرط «${member.fullName}» (غير نشط) مع الاحتفاظ بجميع بياناته وسجلاته 🔴`);
    }
  };

  // ---------------- ACTIVITIES HANDLERS ----------------
  const handleSaveActivity = async (activityData: Omit<ActivityItem, 'id'>): Promise<boolean> => {
    const action = editingActivity ? 'canEdit' : 'canAdd';
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'activities', action);
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً.');
      return false;
    }

    const currentTenant = (!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;

    if (editingActivity) {
      const updated = activities.map((act) =>
        act.id === editingActivity.id ? { ...activityData, id: editingActivity.id } : act
      );

      // Persist permanently to backend database FIRST and verify
      const res = await apiSyncActivities(updated, currentAdminSession, currentTenant);
      if (!res || !res.success) {
        addToast('error', res?.error || 'تعذر حفظ تعديلات النشاط في قاعدة البيانات الدائمة.');
        return false;
      }

      const authoritativeList = Array.isArray(res.activities) ? res.activities : updated;
      setActivities(authoritativeList);
      saveActivities(authoritativeList, true, currentTenant);
      setEditingActivity(null);

      const updatedLogs = addAuditLog(
        'update',
        'activity',
        `تعديل بيانات النشاط الخيري: ${activityData.title}`,
        currentAdminSession?.fullName || settings.name || 'إدارة الجمعية'
      );
      setAuditLogs(updatedLogs);
      addToast('success', 'تم تحديث النشاط الخيري وحفظه في قاعدة البيانات بنجاح!');
      return true;
    } else {
      const newAct: ActivityItem = {
        ...activityData,
        id: `act-${Date.now()}`,
      };
      const updated = [newAct, ...activities];

      // Persist permanently to backend database FIRST and verify
      const res = await apiSyncActivities(updated, currentAdminSession, currentTenant);
      if (!res || !res.success) {
        addToast('error', res?.error || 'تعذر حفظ النشاط الجديد في قاعدة البيانات الدائمة.');
        return false;
      }

      const authoritativeList = Array.isArray(res.activities) ? res.activities : updated;
      setActivities(authoritativeList);
      saveActivities(authoritativeList, true, currentTenant);

      const updatedLogs = addAuditLog(
        'create',
        'activity',
        `إضافة نشاط خيري جديد: ${newAct.title} بتكلفة ${newAct.spentAmount} د.م`,
        currentAdminSession?.fullName || settings.name || 'إدارة الجمعية'
      );
      setAuditLogs(updatedLogs);
      addToast('success', 'تم حفظ ونشر النشاط الخيري في قاعدة البيانات بنجاح!');
      return true;
    }
  };

  const handleDeleteActivity = async (id: string): Promise<boolean> => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canDelete');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: لا تملك صلاحية حذف الأنشطة.');
      return false;
    }

    const actToDelete = activities.find((a) => a.id === id);
    if (!actToDelete) {
      addToast('error', 'تعذر العثور على النشاط المطلوب حذفه.');
      return false;
    }

    const currentTenant = (!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;

    try {
      // 1. Authoritative Backend Deletion First
      const result = await apiDeleteActivity(id, currentAdminSession, currentTenant);

      if (!result.success) {
        addToast('error', result.error || 'فشلت عملية حذف النشاط من قاعدة البيانات.');
        return false;
      }

      // 2. Only after backend success: update state & localStorage
      recordDeletedActivityId(id, currentTenant);
      const updated = Array.isArray(result.activities)
        ? result.activities
        : activities.filter((a) => a.id !== id);
      saveActivities(updated, true, currentTenant);
      setActivities(updated);

      // 3. Clean up uploaded video and thumbnails from Object Storage
      if (actToDelete?.videoMetadata?.id && actToDelete.videoMetadata.isUploadedDirectly) {
        deleteVideoFromObjectStorage(actToDelete.videoMetadata.id).catch((err) =>
          console.warn('Background cleanup of deleted activity video failed:', err)
        );
      }

      // 4. Reset featured activity if the deleted one was selected
      if (settings.featuredActivityId === id) {
        const updatedSettings = {
          ...settings,
          featuredActivityId: undefined,
        };
        saveSettings(updatedSettings, true, currentTenant);
        setSettings(updatedSettings);
        localStorage.removeItem('achayef_featured_manually_selected');
      }

      // 5. Audit Log
      const updatedLogs = addAuditLog(
        'delete',
        'activity',
        `حذف نشاط خيري نهائيًا: ${actToDelete.title || id}`,
        currentAdminSession?.fullName || (currentTenant === 'tenant_nour' ? 'جمعية النور للتنمية والتضامن' : 'إدارة الجمعية')
      );
      setAuditLogs(updatedLogs);

      // 6. Display Success Toast ONLY when confirmed
      addToast('success', result.message || `تم حذف النشاط «${actToDelete.title}» بنجاح من قاعدة البيانات.`);
      return true;
    } catch (err: any) {
      console.error('[App] Failed to delete activity:', err);
      addToast('error', 'تعذر الاتصال بالخادم لإتمام حذف النشاط.');
      return false;
    }
  };

  const handleToggleActivityStatus = async (id: string) => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canEdit');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً.');
      return;
    }

    const act = activities.find((a) => a.id === id);
    if (!act) return;
    const currentActive = act.isActive !== false && (act as any).isActive !== 'false';
    const newStatus = !currentActive;
    const currentTenant = (!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;
    const nowIso = new Date().toISOString();

    const updated = activities.map((a) =>
      a.id === id ? ({ ...a, isActive: newStatus, updatedAt: nowIso } as ActivityItem) : a
    );

    // 1. Immediately update UI state & localStorage so public views reflect the change instantaneously
    setActivities(updated);
    saveActivities(updated, true, currentTenant);

    if (!newStatus && selectedActivityIdForView === id) {
      setSelectedActivityIdForView(null);
    }

    // 2. Persist permanently to backend JSON database and Cloud Firestore
    const res = await apiToggleActivityStatus(id, newStatus, currentAdminSession, currentTenant);
    if (!res || !res.success) {
      addToast('error', res?.error || 'تعذر تحديث حالة النشاط في الخادم.');
      return;
    }

    const authoritativeList = Array.isArray(res.activities) ? res.activities : updated;
    saveActivities(authoritativeList, true, currentTenant);
    setActivities(authoritativeList);

    // If deactivated activity was chosen as custom featured, reset to automatic display
    if (!newStatus && settings.featuredActivityId === id) {
      const updatedSettings = {
        ...settings,
        featuredActivityId: undefined,
      };
      saveSettings(updatedSettings, true, currentTenant);
      setSettings(updatedSettings);
      localStorage.removeItem('achayef_featured_manually_selected');
    }

    const updatedLogs = addAuditLog(
      'update',
      'activity',
      `${newStatus ? 'تفعيل ظهور النشاط للمستخدمين' : 'إلغاء تفعيل ظهور النشاط (إخفاء)'}: ${act.title}`,
      currentAdminSession?.fullName || settings.name || 'إدارة الجمعية'
    );
    setAuditLogs(updatedLogs);

    if (newStatus) {
      addToast('success', `تم تفعيل النشاط «${act.title}» وسيظهر الآن للمستخدمين والزوار!`);
    } else {
      addToast('info', `تم إلغاء تفعيل النشاط «${act.title}» وتم إخفاؤه عن المستخدمين.`);
    }
  };

  const handleAddActivityGalleryImages = async (activityId: string, newUrls: string[]) => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canEdit');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: غير مصرح لك بإضافة أو تعديل صور الأنشطة.');
      throw new Error(permCheck.reason || 'غير مصرح لك بإضافة أو تعديل صور الأنشطة.');
    }

    const currentTenant = (!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;

    try {
      const res = await apiAddGalleryPhotos(activityId, newUrls, currentAdminSession, currentTenant);
      const targetAct = activities.find((a) => a.id === activityId);
      const updated = activities.map((a) => {
        if (a.id !== activityId) return a;
        if (res.activity) return res.activity;
        const existing = Array.isArray(a.galleryImages) ? [...a.galleryImages] : [];
        const merged = [...existing];
        for (const u of newUrls) {
          if (!merged.includes(u)) merged.push(u);
        }
        return {
          ...a,
          coverImage: a.coverImage || merged[0] || '',
          galleryImages: merged,
        };
      });

      setActivities(updated);
      saveActivities(updated, true, currentTenant);

      if (editingActivity && editingActivity.id === activityId) {
        const updatedAct = updated.find((a) => a.id === activityId);
        if (updatedAct) {
          setEditingActivity(updatedAct);
        }
      }

      const updatedLogs = addAuditLog(
        'update',
        'activity',
        `إضافة ${newUrls.length} صور جديدة لمعرض التوثيق الميداني للنشاط الخيري: ${targetAct?.title || activityId}`,
        currentAdminSession?.fullName || settings.name || 'إدارة الجمعية'
      );
      setAuditLogs(updatedLogs);

      addToast('success', 'تم رفع وحفظ الصور الإضافية في معرض التوثيق الميداني وقاعدة البيانات بنجاح.');
      return true;
    } catch (err: any) {
      addToast('error', err.message || 'تعذر حفظ الصور الإضافية في المعرض.');
      throw err;
    }
  };

  const handleDeleteActivityGalleryImage = async (activityId: string, imageIndex: number, imageUrl?: string) => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canEdit');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: غير مصرح لك بتعديل أو حذف صور الأنشطة.');
      throw new Error(permCheck.reason || 'غير مصرح لك بتعديل أو حذف صور الأنشطة.');
    }

    const currentTenant = (!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;

    try {
      const res = await apiDeleteSingleGalleryPhoto(activityId, imageIndex, imageUrl, currentAdminSession, currentTenant);
      const targetAct = activities.find((a) => a.id === activityId);
      const updated = activities.map((a) =>
        a.id === activityId ? (res.activity || { ...a, galleryImages: res.galleryImages }) : a
      );
      setActivities(updated);
      saveActivities(updated, true, currentTenant);

      if (editingActivity && editingActivity.id === activityId) {
        setEditingActivity({
          ...editingActivity,
          galleryImages: res.galleryImages,
        });
      }

      const updatedLogs = addAuditLog(
        'delete',
        'activity',
        `حذف صورة من معرض التوثيق الميداني للنشاط الخيري: ${targetAct?.title || activityId}`,
        currentAdminSession?.fullName || settings.name || 'إدارة الجمعية'
      );
      setAuditLogs(updatedLogs);

      addToast('success', 'تم حذف الصورة المحددة بنجاح من المعرض وقاعدة البيانات.');
      return true;
    } catch (err: any) {
      addToast('error', err.message || 'تعذر حذف الصورة من المعرض.');
      throw err;
    }
  };

  const handleDeleteAllActivityGalleryImages = async (activityId: string) => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canEdit');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: غير مصرح لك بتعديل أو حذف صور الأنشطة.');
      throw new Error(permCheck.reason || 'غير مصرح لك بتعديل أو حذف صور الأنشطة.');
    }

    const currentTenant = (!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;

    try {
      const res = await apiDeleteAllGalleryPhotos(activityId, currentAdminSession, currentTenant);
      const targetAct = activities.find((a) => a.id === activityId);
      const updated = activities.map((a) =>
        a.id === activityId ? (res.activity || { ...a, galleryImages: [] }) : a
      );
      setActivities(updated);
      saveActivities(updated, true, currentTenant);

      if (editingActivity && editingActivity.id === activityId) {
        setEditingActivity({
          ...editingActivity,
          galleryImages: [],
        });
      }

      const updatedLogs = addAuditLog(
        'delete',
        'activity',
        `حذف جميع صور التوثيق الميداني (${targetAct?.galleryImages?.length || 0} صور) للنشاط الخيري: ${targetAct?.title || activityId}`,
        currentAdminSession?.fullName || settings.name || 'إدارة الجمعية'
      );
      setAuditLogs(updatedLogs);

      addToast('success', 'تم حذف جميع صور التوثيق الميداني للنشاط بنجاح.');
      return true;
    } catch (err: any) {
      addToast('error', err.message || 'تعذر حذف صور المعرض.');
      throw err;
    }
  };

  // ---------------- REFERENCE CONTENT VERSIONING HANDLERS ----------------
  const handlePublishReferenceActivities = async () => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canEdit');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: غير مصرح لك باعتماد أو نشر المحتوى المرجعي.');
      return;
    }

    try {
      const authorName = currentAdminSession?.fullName || 'إدارة جمعية النور للتنمية والتضامن (النموذج المعتمد)';
      // 1. Publish in local storage reference engine
      const meta = publishNewReferenceVersion(activities, authorName);
      
      // 2. Publish to backend server API
      await apiPublishReferenceVersion(activities, authorName, currentAdminSession);
      
      // 3. Log audit
      const updatedLogs = addAuditLog(
        'update',
        'activity',
        `اعتماد ونشر الإصدار المرجعي الرسمي (${meta.versionId}) لقسم أبرز الأعمال والأنشطة الخيرية لجميع المنصات`,
        authorName
      );
      setAuditLogs(updatedLogs);

      addToast('success', `تم اعتماد ونشر النسخة المرجعية (${meta.versionId}) لجمعية النور لجميع المنصات بنجاح! 🚀`);
    } catch (err: any) {
      addToast('error', err?.message || 'حدث خطأ أثناء نشر النسخة المرجعية.');
    }
  };

  const handleSyncReferenceActivities = async () => {
    try {
      const currentActive = getActiveTenantId();
      const synced = syncTenantReferenceActivities(currentActive);
      setActivities(synced);

      const currentVersion = getCurrentReferenceVersion();
      const updatedLogs = addAuditLog(
        'update',
        'activity',
        `مزامنة أحدث صور وفيديوهات قسم أبرز الأعمال من النموذج المعتمد لجمعية النور (${currentVersion.versionId})`,
        currentAdminSession?.fullName || 'مسؤول الجمعية'
      );
      setAuditLogs(updatedLogs);

      addToast('success', `تمت مزامنة أحدث الوسائط والصور من جمعية النور (${currentVersion.versionId}) مع حماية بياناتكم المالية! ✨`);
    } catch (err: any) {
      addToast('error', err?.message || 'حدث خطأ أثناء مزامنة المحتوى المرجعي.');
    }
  };

  // ---------------- MEMBER ACCOUNT & AUTH HANDLERS ----------------
  const handleMemberLogin = (member: Member, targetTenant?: AssociationTenant) => {
    const targetTenantId =
      targetTenant?.id || (activeTenantId && activeTenantId !== 'portal' ? activeTenantId : MASTER_TEMPLATE_TENANT_ID);

    // 1. Strictly revoke/clear any admin session or admin role so a member never gets admin privileges
    clearCurrentAdminSession(targetTenantId);
    saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, null, targetTenantId);
    setCurrentAdminSession(null);
    setRole('member');
    saveData(KEYS.ROLE, 'member');

    // 2. Update member record and save member session for their association
    const targetMembersList =
      targetTenantId === activeTenantId ? members : getStoredMembers(targetTenantId);
    const updatedMembers = targetMembersList.some((m) => m.id === member.id)
      ? targetMembersList.map((m) => (m.id === member.id ? member : m))
      : [member, ...targetMembersList];
    saveMembers(updatedMembers, targetTenantId);
    saveLoggedInMemberId(member.id, targetTenantId);

    if (targetTenant && targetTenant.id !== activeTenantId) {
      switchTenant(targetTenant.id, false, targetTenant);
    } else {
      setMembers(updatedMembers);
    }

    setLoggedInMember(member);
    setIsMemberAuthOpen(false);
    // Direct the member to the general public interface of the association they belong to
    setActiveTab('home');

    const updatedLogs = addAuditLog(
      'login',
      'member',
      `تسجيل دخول المنخرط: ${member.fullName} (${member.memberCode})`,
      member.fullName,
      undefined,
      undefined,
      targetTenantId
    );
    if (targetTenantId === activeTenantId) {
      setAuditLogs(updatedLogs);
    }

    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (e) {}

    const assocName = targetTenant?.name || currentTenant.name;
    addToast('success', `مرحبًا بك يا ${member.fullName} في واجهة «${assocName}»!`);
  };

  const handleMemberRegistrationSuccess = async (newMember: Member, plainPassword?: string) => {
    // Ensure member role and clear any admin session
    clearCurrentAdminSession();
    saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, null, activeTenantId);
    setCurrentAdminSession(null);
    setRole('member');
    saveData(KEYS.ROLE, 'member');

    // Add to members list and save
    const updatedMembers = [newMember, ...members];
    saveMembers(updatedMembers);
    setMembers(updatedMembers);

    // If there is an annual fee assigned, create corresponding financial record
    const fee = Number(newMember.annualFee) || 0;
    const chosenPaymentMethod = (newMember.membershipPaymentMethod as PaymentMethodType) || 'bank_transfer';
    if (fee > 0) {
      const feeDate = newMember.joinDate || new Date().toISOString().slice(0, 10);
      const feeOpId = `op-fee-${newMember.id}`;
      const feeContribId = `contrib-fee-${newMember.id}`;

      const newOperation: FinancialOperation = {
        id: feeOpId,
        code: `REC-${new Date().getFullYear()}-${newMember.memberCode}`,
        title: `واجب انخراط سنوي: ${newMember.fullName} (${newMember.memberCode})`,
        description: `واجب الانخراط السنوي عند التسجيل الذاتي بتاريخ ${feeDate}`,
        type: 'income',
        category: 'membership_fee',
        amount: fee,
        date: feeDate,
        memberId: newMember.id,
        memberName: newMember.fullName,
        paymentMethod: chosenPaymentMethod,
        addedBy: 'التسجيل الذاتي للمنخرط',
        createdAt: new Date().toISOString(),
        proofUrls: newMember.proofImageUrl ? [newMember.proofImageUrl] : (newMember.receiptUrl ? [newMember.receiptUrl] : undefined),
      };

      const newContrib: MemberContribution = {
        id: feeContribId,
        memberId: newMember.id,
        memberCode: newMember.memberCode,
        memberName: newMember.fullName,
        amount: fee,
        date: feeDate,
        time: new Date().toTimeString().slice(0, 8),
        createdAt: new Date().toISOString(),
        status: 'pending',
        category: 'membership_fee',
        paymentMethod: chosenPaymentMethod,
        notes: `واجب الانخراط السنوي - تسجيل إلكتروني جديد (قيد المراجعة)`,
        financialOperationId: feeOpId,
        proofImageUrl: newMember.proofImageUrl || newMember.receiptUrl,
        receiptUrl: newMember.proofImageUrl || newMember.receiptUrl,
      };

      const updatedOps = [newOperation, ...operations];
      const updatedContribs = [newContrib, ...contributions];
      const calculated = calculateFinancials(updatedOps);

      await saveContributionsAndOperations(updatedContribs, calculated.processedOperations, activeTenantId);
      setContributions(updatedContribs);
      setOperations(calculated.processedOperations);
    }

    // Add audit log
    const updatedLogs = addAuditLog(
      'create',
      'member',
      `تسجيل منخرط جديد ذاتياً عبر البوابة: ${newMember.fullName} (${newMember.memberCode}) - الهاتف: ${newMember.phone}`,
      newMember.fullName
    );
    setAuditLogs(updatedLogs);

    // Log the member in automatically and direct to the association's general public interface
    setLoggedInMember(newMember);
    saveLoggedInMemberId(newMember.id);
    setActiveTab('home');

    try {
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.6 },
      });
    } catch (e) {}

    addToast('success', `تهانينا يا ${newMember.fullName}! تم تسجيل طلب انخراطك بنجاح (${newMember.memberCode}) وإضافته إلى سجل المنخرطين بالجمعية.`);
  };

  const handleMemberLogout = () => {
    firestoreSyncService.logout().catch(console.warn);
    setLoggedInMember(null);
    clearLoggedInMemberId();
    if (activeTab === 'my-account') {
      setActiveTab('home');
    }
    addToast('info', 'تم تسجيل الخروج من فضاء المنخرطين بنجاح.');
  };

  const handleUpdateMemberProfile = (updatedData: Partial<Member>) => {
    if (!loggedInMember) return;
    const updated: Member = {
      ...loggedInMember,
      ...updatedData,
    };
    const updatedMembers = members.map((m) => (m.id === loggedInMember.id ? updated : m));
    saveMembers(updatedMembers);
    setMembers(updatedMembers);
    setLoggedInMember(updated);

    const updatedLogs = addAuditLog(
      'update',
      'member',
      `تحديث المنخرط (${updated.fullName}) لبيانات حسابه الشخصي`,
      updated.fullName
    );
    setAuditLogs(updatedLogs);

    addToast('success', 'تم حفظ وتحديث بيانات حسابك الشخصي بنجاح!');
  };

  const handleChangeMemberPassword = async (
    currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!loggedInMember) {
      return { success: false, message: 'لم يتم العثور على جلسة المنخرط.' };
    }

    const isValid = await verifyMemberPassword(
      currentPass,
      loggedInMember.passwordHash,
      loggedInMember.passwordSalt,
      loggedInMember
    );

    if (!isValid) {
      return { success: false, message: 'كلمة المرور الحالية غير صحيحة.' };
    }

    if (!newPass || newPass.trim().length < 4) {
      return { success: false, message: 'يجب أن تتكون كلمة المرور الجديدة من 4 أحرف أو أرقام على الأقل.' };
    }

    const salt = generateSalt();
    const hash = await hashPasswordWithSalt(newPass, salt);

    const updated: Member = {
      ...loggedInMember,
      passwordHash: hash,
      passwordSalt: salt,
    };

    const updatedMembers = members.map((m) => (m.id === loggedInMember.id ? updated : m));
    saveMembers(updatedMembers);
    setMembers(updatedMembers);
    setLoggedInMember(updated);

    const updatedLogs = addAuditLog(
      'update',
      'member',
      `تغيير كلمة المرور للحساب الشخصي: ${updated.fullName}`,
      updated.fullName
    );
    setAuditLogs(updatedLogs);

    addToast('success', 'تم تغيير وتأمين كلمة المرور بنجاح! 🔒');
    return { success: true, message: 'تم تغيير وتحديث كلمة المرور بنجاح!' };
  };

  // ---------------- SETTINGS & RESTORE HANDLERS ----------------
  const handleUpdateSettings = async (newSettings: AssociationSettings): Promise<boolean> => {
    const currentTenant = (!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;

    // 1. Persist permanently to backend database FIRST and verify
    const res = await apiSyncSettings(newSettings, currentAdminSession, currentTenant);
    if (!res || !res.success || !res.settings) {
      addToast('error', res?.error || 'تعذر حفظ الإعدادات في قاعدة البيانات الدائمة.');
      return false;
    }

    const authoritativeSettings = res.settings;
    const now = Date.now();
    setSettingsTimestamp(now, currentTenant);
    saveSettings(authoritativeSettings, true, currentTenant);
    setSettings(authoritativeSettings);

    if (currentTenant && currentTenant !== 'portal') {
      updateTenantDetails(currentTenant, {
        name: authoritativeSettings.name,
        nameFr: authoritativeSettings.nameFr,
        nameEn: authoritativeSettings.nameEn,
        tagline: authoritativeSettings.tagline,
        logoUrl: authoritativeSettings.logoUrl,
        bannerImageUrl: authoritativeSettings.bannerImageUrl,
        ownerPhone: authoritativeSettings.phone,
        whatsapp: authoritativeSettings.whatsapp,
        enablePublicDonations: authoritativeSettings.enablePublicDonations,
      });
    }

    const updatedLogs = addAuditLog(
      'update',
      'settings',
      'تحديث الإعدادات العامة وهوية الجمعية',
      currentAdminSession?.fullName || authoritativeSettings.name || 'إدارة الجمعية'
    );
    setAuditLogs(updatedLogs);
    return true;
  };

  const handleUpdateRegistrationFields = async (fields: MemberRegistrationField[]) => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'fields', 'canEdit');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: لا تملك صلاحية تعديل حقول التسجيل.');
      return;
    }
    const normalized = ensureMandatoryPasswordFields(fields);
    // Immediately update UI state so the registration form reflects field visibility changes right away
    setRegistrationFields(normalized);
    const ok = await saveRegistrationFields(normalized, activeTenantId, true);
    if (!ok) {
      addToast('error', 'تعذر حفظ حقول التسجيل في قاعدة البيانات الدائمة. يرجى المحاولة مجدداً.');
      return;
    }
    addToast('success', 'تم حفظ وتحديث حقول التسجيل بشكل دائم في قاعدة البيانات الرئيسية!');
  };

  const handleUpdateBoardMembers = async (updated: BoardMember[]) => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'boardMembers', 'canEdit');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: لا تملك صلاحية تعديل أعضاء المكتب.');
      return;
    }
    const ok = await saveBoardMembers(updated, activeTenantId, true);
    if (!ok) {
      addToast('error', 'تعذر حفظ قائمة أعضاء المكتب في قاعدة البيانات الدائمة. يرجى المحاولة مجدداً.');
      return;
    }
    setBoardMembers(updated);
    addToast('success', 'تم حفظ وتحديث قائمة أعضاء مكتب الجمعية بشكل دائم في قاعدة البيانات الرئيسية!');
  };

  const handleUpdateMemberCardSettings = async (cardSettings: MemberCardSettings) => {
    const ok = await saveMemberCardSettings(cardSettings, activeTenantId, true);
    if (!ok) {
      addToast('error', 'تعذر حفظ إعدادات بطاقة المنخرط في قاعدة البيانات الدائمة. يرجى المحاولة مجدداً.');
      return;
    }
    setMemberCardSettings(getStoredMemberCardSettings(activeTenantId));
    addToast('success', 'تم حفظ وتحديث تصميم وإعدادات بطاقة المنخرط بشكل دائم في قاعدة البيانات الرئيسية!');
  };

  const handleUpdateUIElements = async (updated: UIElementConfig[]) => {
    const currentTenant = (!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId;
    setUIElementsTimestamp(Date.now(), currentTenant);
    saveUIElements(updated, currentTenant, true);
    setUIElements(updated);
    try {
      const res = await saveUIElementsListApi(updated, currentTenant, currentAdminSession?.fullName || 'الأدمن');
      if (res && res.success && Array.isArray(res.elements)) {
        setUIElements(res.elements);
        saveUIElements(res.elements, currentTenant, false);
        addToast('success', 'تم حفظ وتحديث إعدادات عناصر الواجهة بنجاح في قاعدة البيانات!');
      } else {
        addToast('error', 'تعذر حفظ إعدادات عناصر الواجهة في الخادم.');
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'حدث خطأ أثناء حفظ إعدادات عناصر الواجهة.');
    }
  };

  // ---------------- POLLS & VOTING HANDLERS ----------------
  const handleUpdatePolls = (updated: Poll[]) => {
    savePolls(updated, activeTenantId);
    setPolls(updated);
    const cleanTenant = !activeTenantId || activeTenantId === 'portal' ? 'tenant_nour' : activeTenantId;
    fetch(`/api/polls/sync?tenantId=${encodeURIComponent(cleanTenant)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': cleanTenant,
      },
      body: JSON.stringify({ polls: updated }),
    }).catch(console.warn);
  };

  const handleVote = async (pollId: string, vote: PollVote) => {
    const cleanTenant = !activeTenantId || activeTenantId === 'portal' ? 'tenant_nour' : activeTenantId;
    const result = recordPollVote(pollId, vote, cleanTenant);
    if (!result.success || !result.poll) {
      addToast('error', result.message || VOTING_RESTRICTED_MESSAGE);
      return;
    }

    const previousPolls = polls;
    const updated = polls.map((p) => (p.id === pollId ? result.poll! : p));
    setPolls(updated);

    const serverRes = await apiVotePoll(pollId, vote, cleanTenant);
    if (!serverRes.success) {
      setPolls(previousPolls);
      savePolls(previousPolls, cleanTenant);
      addToast('error', serverRes.error || VOTING_RESTRICTED_MESSAGE);
      return;
    }

    if (Array.isArray(serverRes.polls)) {
      setPolls(serverRes.polls);
    }

    addToast('success', result.message);

    const targetPoll = polls.find((p) => p.id === pollId);
    const logDesc = `مشاركة العضو (${vote.memberName}) في التصويت السري على القرار: "${targetPoll?.title || pollId}"`;
    const updatedLogs = addAuditLog('create', 'poll', logDesc, vote.memberName);
    setAuditLogs(updatedLogs);
  };

  const isUIElementVisible = (id: string) => {
    return isSectionVisibleForUser(id, {
      isAdmin: role === 'admin',
      isMember: !!loggedInMember,
      uiElements,
    });
  };

  // ---------------- CONTRIBUTIONS & SUBSCRIPTIONS HANDLERS ----------------
  const handleAddContribution = async (
    contributionData: Omit<MemberContribution, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; message: string; contribution?: MemberContribution }> => {
    const isMembershipFee =
      contributionData.category === 'membership_fee' ||
      (contributionData.notes && contributionData.notes.includes('انخراط')) ||
      (contributionData.contributionTypeName && contributionData.contributionTypeName.includes('انخراط'));
    const finalStatus: ContributionStatus = isMembershipFee
      ? 'pending'
      : (contributionData.status || 'pending');

    const id = `contrib-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newOpId = `op-contrib-${Date.now()}`;
    const newContribution: MemberContribution = {
      ...contributionData,
      id,
      status: finalStatus,
      financialOperationId: newOpId,
      tenantId: contributionData.tenantId || activeTenantId,
      associationId: contributionData.associationId || activeTenantId,
      createdAt: new Date().toISOString(),
    };

    const updatedContribs = [newContribution, ...contributions];

    // Also register the income operation in the general financial ledger
    const newOperation: FinancialOperation = {
      id: newOpId,
      code: `OP-${new Date().getFullYear()}-${String(operations.length + 1).padStart(3, '0')}`,
      type: 'income',
      category: 'membership_fee',
      title: `مساهمة/انخراط: ${contributionData.memberName} (${contributionData.memberCode})`,
      description: contributionData.notes || `مساهمة ذاتية من حساب المنخرط (${contributionData.paymentMethod})`,
      amount: Number(contributionData.amount),
      date: contributionData.date || new Date().toISOString().slice(0, 10),
      memberId: contributionData.memberId,
      memberName: contributionData.memberName,
      addedBy: contributionData.memberName,
      createdAt: new Date().toISOString(),
      tenantId: activeTenantId,
      associationId: activeTenantId,
    };
    const updatedOps = [newOperation, ...operations];

    // Reconcile unpaid contribution deductions if initial status is 'لم يتم الدفع'
    const {
      reconciledContributions,
      reconciledOperations,
      removedOperationIds,
    } = reconcileUnpaidContributionDeductions(updatedContribs, updatedOps, activeTenantId);

    setContributions(reconciledContributions);
    setOperations(reconciledOperations);
    await saveContributionsAndOperations(
      reconciledContributions,
      reconciledOperations,
      activeTenantId,
      removedOperationIds
    );

    // Audit log
    const updatedLogs = addAuditLog(
      'create',
      'member',
      `تسجيل مساهمة/انخراط جديد للمنخرط ${contributionData.memberName} (${contributionData.memberCode}) بمبلغ ${contributionData.amount} د.م`,
      contributionData.memberName,
      undefined,
      undefined,
      activeTenantId
    );
    setAuditLogs(updatedLogs);

    addToast('success', `تم تسجيل وتوثيق مساهمتك بمبلغ ${contributionData.amount} د.م بنجاح!`);
    return { success: true, message: 'تم تسجيل وتوثيق المساهمة بنجاح!', contribution: newContribution };
  };

  const handleUpdateContributionStatus = (id: string, newStatus: ContributionStatus) => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'contributions', 'canEdit');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: لا تملك صلاحية تعديل حالة المساهمات.');
      return;
    }

    const targetContrib = contributions.find((c) => c.id === id);
    if (!targetContrib) return;

    const previousStatus = targetContrib.status;
    if (previousStatus === newStatus) return;

    const updatedContribs = contributions.map((c) =>
      c.id === id ? { ...c, status: newStatus } : c
    );

    const {
      reconciledContributions,
      reconciledOperations,
      removedOperationIds,
    } = reconcileUnpaidContributionDeductions(updatedContribs, operations, activeTenantId);

    setContributions(reconciledContributions);
    setOperations(reconciledOperations);

    saveContributionsAndOperations(
      reconciledContributions,
      reconciledOperations,
      activeTenantId,
      removedOperationIds
    );

    const wasUnpaid = isUnpaidContributionStatus(previousStatus);
    const isNowUnpaid = isUnpaidContributionStatus(newStatus);
    const amountNum = Number(targetContrib.amount) || 0;
    const newFinancials = calculateFinancials(reconciledOperations);
    const adminActorName = currentAdminSession?.fullName || 'إدارة الجمعية';

    if (!wasUnpaid && isNowUnpaid) {
      const updatedLogs = addAuditLog(
        'update',
        'operation',
        `تغيير حالة مساهمة المنخرط ${targetContrib.memberName} (${targetContrib.memberCode}) إلى «لم يتم الدفع» وخصم مبلغ ${amountNum.toLocaleString()} د.م من الرصيد المالي للجمعية (الرصيد الجديد: ${newFinancials.currentBalance.toLocaleString()} د.م)`,
        adminActorName,
        currentAdminSession?.type,
        currentAdminSession?.phone,
        activeTenantId
      );
      setAuditLogs(updatedLogs);
      addToast(
        'info',
        `تم تغيير الحالة إلى «لم يتم الدفع» وخصم مبلغ ${amountNum.toLocaleString()} د.م من الرصيد المالي للجمعية وتوثيقه في السجل المالي.`
      );
    } else if (wasUnpaid && !isNowUnpaid) {
      const statusLabel =
        newStatus === 'completed'
          ? 'مكتملة وموثقة'
          : newStatus === 'pending'
          ? 'قيد المراجعة'
          : 'مرفوضة';
      const updatedLogs = addAuditLog(
        'update',
        'operation',
        `تغيير حالة مساهمة المنخرط ${targetContrib.memberName} (${targetContrib.memberCode}) من «لم يتم الدفع» إلى «${statusLabel}» وإلغاء خصم مبلغ ${amountNum.toLocaleString()} د.م (الرصيد الجديد: ${newFinancials.currentBalance.toLocaleString()} د.م)`,
        adminActorName,
        currentAdminSession?.type,
        currentAdminSession?.phone,
        activeTenantId
      );
      setAuditLogs(updatedLogs);
      addToast(
        'success',
        `تم تحديث حالة المساهمة إلى «${statusLabel}» واسترجاع مبلغ ${amountNum.toLocaleString()} د.م إلى الرصيد المالي للجمعية.`
      );
    } else {
      addToast('success', 'تم تحديث حالة المساهمة بنجاح');
    }
  };

  const handleDeleteContribution = (id: string) => {
    const permCheck = checkAdminPermission(currentAdminSession, subAdmins, 'contributions', 'canDelete');
    if (!permCheck.allowed) {
      addToast('error', permCheck.reason || 'تم رفض العملية أمنياً: لا تملك صلاحية حذف المساهمات.');
      return;
    }
    const contribToDelete = contributions.find((c) => c.id === id);
    if (!contribToDelete) return;

    // Preserve all original contribution data and transition status from 'pending' to 'unpaid' («لم يتم الدفع») with '-' sign
    const updatedContribs = contributions.map((c) =>
      c.id === id
        ? {
            ...c,
            status: 'unpaid' as const,
            isNegative: true,
            amountSign: '-' as const,
          }
        : c
    );

    // Also transition any linked CampaignContribution (`contrib-don-${cc.id}`) to 'unpaid' with '-' sign and persist to backend & Firebase
    const linkedCcId = id.startsWith('contrib-don-')
      ? id.replace('contrib-don-', '')
      : contribToDelete.financialOperationId?.startsWith('op-camp-')
      ? contribToDelete.financialOperationId.replace('op-camp-', '')
      : id;

    const hasLinkedCc = campaignContributions.some((cc) => cc.id === linkedCcId);
    if (hasLinkedCc) {
      const updatedCc = campaignContributions.map((cc) =>
        cc.id === linkedCcId
          ? {
              ...cc,
              status: 'unpaid' as const,
              isNegative: true,
              amountSign: '-' as const,
            }
          : cc
      );
      setCampaignContributions(updatedCc);
      saveCampaignContributions(updatedCc, activeTenantId);
      campaignsApi.saveContributions(updatedCc, activeTenantId).catch(() => {});
    }

    const {
      reconciledContributions,
      reconciledOperations,
      removedOperationIds,
    } = reconcileUnpaidContributionDeductions(updatedContribs, operations, activeTenantId);

    setContributions(reconciledContributions);
    setOperations(reconciledOperations);

    saveContributionsAndOperations(
      reconciledContributions,
      reconciledOperations,
      activeTenantId,
      removedOperationIds
    );

    window.dispatchEvent(new CustomEvent('transparency_records_updated', { detail: { tenantId: activeTenantId } }));
    addToast('info', 'تم تحويل حالة العملية إلى «لم يتم الدفع» وتحديث إشارة المبلغ إلى (-) في سجل الشفافية المباشر.');
  };

  const handleRefreshTransparencyRecords = async () => {
    try {
      const rawActive = getActiveTenantId();
      const currentActive = (!rawActive || rawActive === 'portal') ? MASTER_TEMPLATE_TENANT_ID : rawActive;
      const [syncedRecords, remoteCampaignContribs, remoteCampaigns] = await Promise.all([
        syncTenantRecordsFromBackend(currentActive).catch(() => null),
        campaignsApi.getContributions(undefined, currentActive).catch(() => []),
        campaignsApi.getCampaigns(currentActive).catch(() => []),
      ]);
      if (syncedRecords) {
        if (Array.isArray(syncedRecords.contributions)) {
          setContributions(syncedRecords.contributions);
        }
        if (Array.isArray(syncedRecords.operations)) {
          setOperations(syncedRecords.operations);
        }
      }
      if (remoteCampaignContribs && Array.isArray(remoteCampaignContribs)) {
        setCampaignContributions(remoteCampaignContribs);
      }
      if (remoteCampaigns && Array.isArray(remoteCampaigns)) {
        setCampaigns(remoteCampaigns);
      }
      addToast('success', 'تم تحديث سجل الشفافية والمساهمات المباشر بنجاح!');
    } catch (err) {
      console.warn('Failed to refresh transparency records:', err);
      addToast('info', 'تم التحقق من مطابقة سجل الشفافية.');
    }
  };

  const handleResetDefaults = () => {
    resetToDefaults();
    setMembers(getStoredMembers());
    setBoardMembers(getStoredBoardMembers());
    setContributions(getStoredContributions());
    setOperations(getStoredOperations());
    setActivities(getStoredActivities());
    setAuditLogs(getStoredAuditLogs());
    setSettings(getStoredSettings());
    setRegistrationFields(getStoredRegistrationFields());
    setMemberCardSettings(getStoredMemberCardSettings());
    setUIElements(getStoredUIElements());
    setPolls(getStoredPolls());
    setCampaigns(getStoredCampaigns());
    setCampaignContributions(getStoredCampaignContributions());
    setContributionTypes(getStoredContributionTypes());
    addToast('info', 'تمت استعادة البيانات النموذجية الأولية للجمعية بما في ذلك حملات التبرع.');
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.members && parsed.operations) {
          saveMembers(parsed.members);
          if (parsed.boardMembers) saveBoardMembers(parsed.boardMembers);
          if (parsed.contributions) saveContributions(parsed.contributions);
          saveOperations(parsed.operations);
          if (parsed.activities) saveActivities(parsed.activities);
          if (parsed.settings) saveSettings(parsed.settings);
          if (parsed.auditLogs) saveAuditLogs(parsed.auditLogs);
          if (parsed.registrationFields) saveRegistrationFields(parsed.registrationFields);
          if (parsed.memberCardSettings) saveMemberCardSettings(parsed.memberCardSettings);
          if (parsed.uiElements) saveUIElements(parsed.uiElements);
          if (parsed.polls) savePolls(parsed.polls);
          if (parsed.campaigns) saveCampaigns(parsed.campaigns);
          if (parsed.campaignContributions) saveCampaignContributions(parsed.campaignContributions);
          if (parsed.contributionTypes) saveContributionTypes(parsed.contributionTypes);

          setMembers(parsed.members);
          setBoardMembers(parsed.boardMembers || getStoredBoardMembers());
          setContributions(parsed.contributions || getStoredContributions());
          setOperations(parsed.operations);
          setActivities(parsed.activities || []);
          setSettings(parsed.settings || getStoredSettings());
          setAuditLogs(parsed.auditLogs || []);
          setRegistrationFields(parsed.registrationFields || getStoredRegistrationFields());
          setMemberCardSettings(parsed.memberCardSettings || getStoredMemberCardSettings());
          setUIElements(parsed.uiElements || getStoredUIElements());
          setPolls(parsed.polls || getStoredPolls());
          if (parsed.campaigns) setCampaigns(parsed.campaigns);
          if (parsed.campaignContributions) setCampaignContributions(parsed.campaignContributions);
          if (parsed.contributionTypes) setContributionTypes(parsed.contributionTypes);

          addToast('success', 'تم استيراد النسخة الاحتياطية بنجاح!');
        } else {
          addToast('error', 'صيغة ملف النسخة الاحتياطية غير متوافقة.');
        }
      } catch (err) {
        addToast('error', 'حدث خطأ أثناء قراءة ملف النسخة الاحتياطية.');
      }
    };
    reader.readAsText(file);
  };

  // 1. SaaS Main Platform Portal View
  if (activeTenantId === 'portal') {
    if (isMasterAdminOpen && getMasterAdminSession()?.isMaster) {
      return (
        <div className="min-h-screen bg-slate-900 text-white" dir="rtl">
          <MasterPlatformAdmin
            onBackToPortal={handleBackToPortal}
            onSwitchToTenant={handleSwitchToTenantFromMasterAdmin}
            onOpenCreateWizard={() => setIsCreateWizardOpen(true)}
            onShowToast={(msg, type) => addToast(type, msg)}
          />
          <CreateAssociationWizardModal
            isOpen={isCreateWizardOpen}
            onClose={() => setIsCreateWizardOpen(false)}
            onAssociationCreated={(newTenant) => {
              setIsCreateWizardOpen(false);
              setTenantsVersion((v) => v + 1);
              window.dispatchEvent(new CustomEvent('chayef-tenants-changed', { detail: getAllTenants() }));
              addToast('success', `تم تدشين وحفظ منصة «${newTenant.name}» بشكل دائم وظهرت الآن في قائمة الجمعيات!`);
            }}
          />
          <Toast toasts={toasts} onDismiss={dismissToast} />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800" dir="rtl">
        <MainPlatformPortal
          onSelectTenant={switchTenant}
          onOpenCreateWizard={() => setIsCreateWizardOpen(true)}
          onOpenMasterAdmin={() => setIsMasterAdminAuthModalOpen(true)}
          onOpenLoginModal={() => setIsAssociationLoginOpen(true)}
          onDirectDonate={handleDirectDonateToAssociation}
          initialDonationsOpen={isDonationsPageOpenInPortal}
          onDonationsPageOpenChange={(isOpen) => {
            setIsDonationsPageOpenInPortal(isOpen);
            if (!isOpen) {
              setReturnToDonations(false);
              try {
                sessionStorage.removeItem('nav_from_donations');
              } catch {}
            }
          }}
        />
        <CreateAssociationWizardModal
          isOpen={isCreateWizardOpen}
          onClose={() => setIsCreateWizardOpen(false)}
          onAssociationCreated={(newTenant) => {
            setIsCreateWizardOpen(false);
            switchTenant(newTenant.id, false, newTenant);
            if (newTenant.status === 'active') {
              const ownerSession = getStoredCurrentAdminSession(newTenant.id);
              if (ownerSession) {
                setCurrentAdminSession(ownerSession);
                setRole('admin');
              }
              addToast('success', `تم إنشاء وتفعيل منصة «${newTenant.name}» وحفظها بنجاح!`);
            } else {
              setCurrentAdminSession(null);
              setRole('member');
              setActiveTab('home');
              addToast('info', `تم إنشاء منصة «${newTenant.name}» بحالة «في انتظار الدفع». يرجى تسديد مبلغ الاشتراك المطلوب لتفعيل المنصة بعد التحقق وموافقة الإدارة العامة.`);
            }
          }}
        />
        <AssociationLoginModal
          isOpen={isAssociationLoginOpen}
          onClose={() => setIsAssociationLoginOpen(false)}
          onLoginSuccess={handleAssociationLoginSuccess}
          onOpenCreateWizard={() => {
            setIsAssociationLoginOpen(false);
            setIsCreateWizardOpen(true);
          }}
          onShowToast={(msg, type) => addToast(type, msg)}
        />
        <MasterAdminAuthModal
          isOpen={isMasterAdminAuthModalOpen}
          onClose={() => setIsMasterAdminAuthModalOpen(false)}
          onSuccess={() => {
            setIsMasterAdminAuthModalOpen(false);
            setIsMasterAdminOpen(true);
          }}
          onShowToast={(msg, type) => addToast(type, msg)}
        />
        {donationModalCampaign && (
          <CampaignDonationModal
            isOpen={Boolean(donationModalCampaign)}
            onClose={() => setDonationModalCampaign(null)}
            campaign={donationModalCampaign}
            contributionTypes={
              donationModalCampaign.tenantId && donationModalCampaign.tenantId !== activeTenantId
                ? getStoredContributionTypes(donationModalCampaign.tenantId)
                : contributionTypes
            }
            presetAmounts={getStoredDonationPresets(donationModalCampaign.tenantId || activeTenantId)}
            settings={
              donationModalCampaign.tenantId && donationModalCampaign.tenantId !== activeTenantId
                ? getStoredSettings(donationModalCampaign.tenantId)
                : settings
            }
            associationId={
              donationModalCampaign.tenantId ||
              donationModalCampaign.associationId ||
              (activeTenantId !== 'portal' ? activeTenantId : 'tenant_nour')
            }
            addToast={addToast}
            onDonationSuccess={(newContrib, updatedCamp, targetTenant) => {
              handleDonationCompleted(newContrib, updatedCamp, targetTenant);
            }}
          />
        )}
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // 2. Individual Association Platform View (Scoped Tenant)
  if (isMasterAdminOpen && getMasterAdminSession()?.isMaster) {
    return (
      <div className="min-h-screen bg-slate-900 text-white" dir="rtl">
        <MasterPlatformAdmin
          onBackToPortal={handleBackToPortal}
          onSwitchToTenant={handleSwitchToTenantFromMasterAdmin}
          onOpenCreateWizard={() => setIsCreateWizardOpen(true)}
          onShowToast={(msg, type) => addToast(type, msg)}
        />
        <CreateAssociationWizardModal
          isOpen={isCreateWizardOpen}
          onClose={() => setIsCreateWizardOpen(false)}
          onAssociationCreated={(newTenant) => {
            setIsCreateWizardOpen(false);
            setTenantsVersion((v) => v + 1);
            window.dispatchEvent(new CustomEvent('chayef-tenants-changed', { detail: getAllTenants() }));
            addToast('success', `تم تدشين وحفظ منصة «${newTenant.name}» بشكل دائم وظهرت الآن في قائمة الجمعيات!`);
          }}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // Check if current user is the Master Super Admin entering the control panel
  const masterAdminSession = getMasterAdminSession();
  const isMasterAdminEnteringDashboard =
    role === 'admin' && currentAdminSession?.isMasterPlatformAdmin === true;

  // If the association is in pending_subscription or pending_activation status (and not Master Admin), show the activation screen
  if (
    (currentTenant.status === 'pending_subscription' || currentTenant.status === 'pending_activation') &&
    !isMasterAdminEnteringDashboard
  ) {
    return (
      <div className="min-h-screen bg-slate-900 text-white" dir="rtl">
        <PlatformActivationScreen
          tenant={currentTenant}
          isNewlyCreated={true}
          onBackToPortal={returnToDonations ? handleBackToDonations : handleBackToPortal}
          onLogout={returnToDonations ? handleBackToDonations : handleBackToPortal}
          onActivated={() => {
            setTenantsVersion((v) => v + 1);
            const updated = getTenantById(currentTenant.id);
            if (updated && updated.status === 'active') {
              const ownerSession = getStoredCurrentAdminSession(currentTenant.id);
              if (ownerSession) {
                setCurrentAdminSession(ownerSession);
                setRole('admin');
                saveData(KEYS.ROLE, 'admin');
                setActiveTab('admin');
              }
              addToast('success', 'تم تفعيل منصة جمعيتك بنجاح بعد موافقة الإدارة العامة! أهلاً بك في لوحة التحكم.');
            }
          }}
        />
        <CreateAssociationWizardModal
          isOpen={isCreateWizardOpen}
          onClose={() => setIsCreateWizardOpen(false)}
          onAssociationCreated={(newTenant) => {
            setIsCreateWizardOpen(false);
            switchTenant(newTenant.id, false, newTenant);
            addToast('info', `تم إنشاء منصة «${newTenant.name}» بحالة «في انتظار الدفع». يرجى تسديد مبلغ الاشتراك المطلوب لتفعيل المنصة.`);
          }}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // If the association has been disabled/suspended by the Super Admin, block regular user access while preserving all data!
  // (Unless the Super Admin is accessing the dashboard)
  if (currentTenant.status === 'inactive' && !isMasterAdminEnteringDashboard) {
    return (
      <div className="min-h-screen bg-slate-900 text-white" dir="rtl">
        <SuspendedAssociationScreen
          tenant={currentTenant}
          onBackToPortal={returnToDonations ? handleBackToDonations : handleBackToPortal}
          onOpenMasterAdmin={() => setIsMasterAdminAuthModalOpen(true)}
        />
        <CreateAssociationWizardModal
          isOpen={isCreateWizardOpen}
          onClose={() => setIsCreateWizardOpen(false)}
          onAssociationCreated={(newTenant) => {
            setIsCreateWizardOpen(false);
            switchTenant(newTenant.id, false, newTenant);
            addToast('info', `تم إنشاء منصة جمعيتك بحالة «في انتظار الدفع». يرجى تسديد مبلغ الاشتراك المطلوب لتفعيل منصتك، علماً أن تفعيلها سيتم بعد تأكيد الدفع وموافقة الإدارة العامة.`);
          }}
        />
        <MasterAdminAuthModal
          isOpen={isMasterAdminAuthModalOpen}
          onClose={() => setIsMasterAdminAuthModalOpen(false)}
          onSuccess={() => {
            setIsMasterAdminAuthModalOpen(false);
            setIsMasterAdminOpen(true);
          }}
          onShowToast={(msg, type) => addToast(type, msg)}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col transition-colors duration-300 pb-20 lg:pb-12 storefront-root"
      style={{
        backgroundColor: settings.themeColors?.backgroundColor || '#f8fafc',
        color: settings.themeColors?.textColor || '#334155',
      }}
    >
      {/* SaaS Multi-Tenant Top Banner */}
      <AssociationTopBanner
        currentTenant={currentTenant}
        lang={lang}
        onBackToPortal={handleBackToPortal}
        onSwitchTenant={switchTenant}
        onOpenCreateWizard={() => setIsCreateWizardOpen(true)}
        onOpenLoginModal={() => setIsAssociationLoginOpen(true)}
        returnToDonations={returnToDonations}
        onBackToDonations={handleBackToDonations}
        onOpenMasterAdmin={() => {
          setIsMasterAdminOpen(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isMasterPlatformAdmin={
          !loggedInMember &&
          (currentAdminSession?.isMasterPlatformAdmin === true ||
            masterAdminSession?.isMaster === true ||
            masterAdminSession?.role === 'super_admin')
        }
      />

      {/* Return to Donations Bar when visited from donations section */}
      {returnToDonations && (
        <div 
          id="bar-return-to-donations"
          className="bg-emerald-800 text-white border-b border-emerald-700/80 px-4 sm:px-6 py-2 transition-all shadow-xs"
          dir="rtl"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-700 text-emerald-200 flex-shrink-0 text-xs font-bold shadow-xs">
                <HeartHandshake className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black text-white truncate">
                  تتصفح الآن منصة: {currentTenant.name}
                </p>
                <p className="text-[10px] sm:text-[11px] text-emerald-200 hidden sm:block">
                  تم الانتقال من قسم «تبرع وشارك في مشاريع التنمية»
                </p>
              </div>
            </div>
            <button
              id="btn-back-to-donations"
              onClick={handleBackToDonations}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs sm:text-sm shadow-sm hover:shadow transition-all cursor-pointer active:scale-95 flex-shrink-0"
              title="الرجوع إلى صفحة تبرع وشارك في مشاريع التنمية"
            >
              <ArrowRight className="w-4 h-4 stroke-[2.5] text-emerald-800" />
              <span>رجوع</span>
              <span className="hidden md:inline text-xs font-bold text-emerald-700">
                (مشاريع التنمية والتبرع)
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        role={role}
        onRequestAdmin={() => setIsAdminAuthOpen(true)}
        onLogoutAdmin={handleAdminLogout}
        currentAdminSession={currentAdminSession}
        lang={lang}
        setLang={setLang}
        settings={settings}
        currentBalance={currentBalance}
        uiElements={uiElements}
        loggedInMember={loggedInMember}
        onRequestMemberLogin={() => setIsMemberAuthOpen(true)}
        onRequestRegisterMember={() => setIsMemberRegistrationOpen(true)}
        onLogoutMember={handleMemberLogout}
        isMasterPlatformAdmin={isMasterAdminEnteringDashboard}
      />

      {/* Main Content Area */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 ${activeTab !== 'admin' ? 'storefront-area' : ''}`}>
        {/* Clear Return to Main Platform Home Button in Certified Model (النموذج المعتمد) */}
        {(currentTenant.isTemplate || activeTenantId === MASTER_TEMPLATE_TENANT_ID) && activeTab !== 'admin' && (
          <div
            className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:px-5 sm:py-3.5 rounded-2xl border border-amber-300/80 shadow-sm"
            dir="rtl"
          >
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 shrink-0">
                <span>النموذج المعتمد</span>
              </span>
              <span className="text-xs sm:text-sm font-black text-slate-800 truncate">
                {currentTenant.name}
              </span>
            </div>
            <button
              type="button"
              id="btn-return-to-main-platform-home"
              onClick={handleBackToPortal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95"
              title="الرجوع إلى الصفحة الرئيسية للمنصة"
            >
              <ArrowRight className="w-4 h-4 shrink-0" />
              <span>الرجوع إلى الصفحة الرئيسية للمنصة</span>
            </button>
          </div>
        )}

        {activeTab === 'home' && (
          <HomeSection
            settings={settings}
            members={members}
            boardMembers={boardMembers}
            activities={activities.filter((a) => a.isActive !== false && (a as any).isActive !== 'false')}
            operations={operations}
            campaigns={campaigns}
            lang={lang}
            role={role}
            polls={polls}
            loggedInMember={loggedInMember}
            currentAdminSession={currentAdminSession}
            activeTenantId={activeTenantId}
            onRequestMemberLogin={() => setIsMemberAuthOpen(true)}
            onRequestRegisterMember={() => setIsMemberRegistrationOpen(true)}
            onVote={handleVote}
            setActiveTab={(tab) => {
              setSelectedActivityIdForView(null);
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectActivity={(activityId) => {
              setSelectedActivityIdForView(activityId);
              setActiveTab('activities');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenMediaModal={handleOpenMediaModal}
            onOpenReportModal={() => setReceiptModalData({ type: 'financial_statement' })}
            onOpenDonationModal={(campaign) => setDonationModalCampaign(campaign)}
            uiElements={uiElements}
          />
        )}

        {activeTab === 'activities' && (
          !isUIElementVisible('featured_activities') ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 text-center max-w-xl mx-auto my-12 shadow-sm space-y-4" dir="rtl">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                قسم «الأنشطة والأعمال الخيرية» متاح حصرياً للمنخرطين
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                تم تخصيص هذا القسم ليكون مرئياً ومتاحاً فقط للمنخرطين المسجلين في الجمعية. إذا كنت منخرطاً، يرجى تسجيل الدخول إلى حسابك لعرض هذا القسم فوراً.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  onClick={() => setIsMemberAuthOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>تسجيل دخول المنخرطين</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('home');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all cursor-pointer"
                >
                  العودة للواجهة الرئيسية
                </button>
              </div>
            </div>
          ) : (
            <ActivitiesSection
              activities={activities.filter((a) => a.isActive !== false && (a as any).isActive !== 'false')}
              role={role}
              lang={lang}
              uiElements={uiElements}
              loggedInMember={loggedInMember}
              initialSelectedActivityId={selectedActivityIdForView}
              canAdd={role === 'admin' ? checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canAdd').allowed : false}
              canEdit={role === 'admin' ? checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canEdit').allowed : false}
              canDelete={role === 'admin' ? checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canDelete').allowed : false}
              onOpenAddActivity={() => {
                if (role === 'admin' && !checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canAdd').allowed) return;
                setEditingActivity(null);
                setIsAddActivityOpen(true);
              }}
              onEditActivity={(act) => {
                if (role === 'admin' && !checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canEdit').allowed) return;
                setEditingActivity(act);
                setIsAddActivityOpen(true);
              }}
              onDeleteActivity={handleDeleteActivity}
              onOpenMediaModal={handleOpenMediaModal}
              onBackToHome={() => {
                setSelectedActivityIdForView(null);
                setActiveTab('home');
              }}
            />
          )
        )}

        {activeTab === 'members' && (
          !isUIElementVisible('gateway_members') ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 text-center max-w-xl mx-auto my-12 shadow-sm space-y-4" dir="rtl">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                قسم «سجل المنخرطين والمشتركين» متاح حصرياً للمنخرطين
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                تم تخصيص هذا القسم ليكون مرئياً ومتاحاً فقط للمنخرطين المسجلين في الجمعية. إذا كنت منخرطاً، يرجى تسجيل الدخول إلى حسابك لعرض هذا القسم فوراً.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  onClick={() => setIsMemberAuthOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>تسجيل دخول المنخرطين</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('home');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all cursor-pointer"
                >
                  العودة للواجهة الرئيسية
                </button>
              </div>
            </div>
          ) : (
            <MembersSection
              members={members}
              boardMembers={boardMembers}
              settings={settings}
              contributions={contributions}
              role={role}
              lang={lang}
              uiElements={uiElements}
              loggedInMember={loggedInMember}
              canAdd={role === 'admin' ? checkAdminPermission(currentAdminSession, subAdmins, 'members', 'canAdd').allowed : false}
              canEdit={role === 'admin' ? checkAdminPermission(currentAdminSession, subAdmins, 'members', 'canEdit').allowed : false}
              canDelete={role === 'admin' ? checkAdminPermission(currentAdminSession, subAdmins, 'members', 'canDelete').allowed : false}
              onRequestMemberLogin={() => setIsMemberAuthOpen(true)}
              onRequestRegisterMember={() => setIsMemberRegistrationOpen(true)}
              onOpenAddMember={() => {
                if (role === 'admin' && !checkAdminPermission(currentAdminSession, subAdmins, 'members', 'canAdd').allowed) return;
                setEditingMember(null);
                setIsMemberFormOpen(true);
              }}
              onEditMember={(m) => {
                if (role === 'admin' && !checkAdminPermission(currentAdminSession, subAdmins, 'members', 'canEdit').allowed) return;
                setEditingMember(m);
                setIsMemberFormOpen(true);
              }}
              onDeleteMember={handleDeleteMember}
              onToggleMemberStatus={handleToggleMemberStatus}
              onPrintMemberCard={(m) => setReceiptModalData({ type: 'member_card', member: m })}
              onNavigateToBoardMembers={() => setActiveTab('board-members')}
              onBackToHome={() => setActiveTab('home')}
            />
          )
        )}

        {activeTab === 'board-members' && (
          !isUIElementVisible('board_members') ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 text-center max-w-xl mx-auto my-12 shadow-sm space-y-4" dir="rtl">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                قسم «أعضاء مكتب الجمعية» متاح حصرياً للمنخرطين
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                تم تخصيص هذا القسم ليكون مرئياً ومتاحاً فقط للمنخرطين المسجلين في الجمعية. إذا كنت منخرطاً، يرجى تسجيل الدخول إلى حسابك لعرض هذا القسم فوراً.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  onClick={() => setIsMemberAuthOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>تسجيل دخول المنخرطين</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('home');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all cursor-pointer"
                >
                  العودة للواجهة الرئيسية
                </button>
              </div>
            </div>
          ) : (
            <BoardMembersPage
              boardMembers={boardMembers}
              members={members}
              settings={settings}
              lang={lang}
              role={role}
              onBack={() => setActiveTab('home')}
            />
          )
        )}

        {activeTab === 'ledger' && (
          !isUIElementVisible('gateway_ledger') ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 text-center max-w-xl mx-auto my-12 shadow-sm space-y-4" dir="rtl">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                قسم «سجل الشفافية المباشر» متاح حصرياً للمنخرطين
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                تم تخصيص هذا القسم ليكون مرئياً ومتاحاً فقط للمنخرطين المسجلين في الجمعية. إذا كنت منخرطاً، يرجى تسجيل الدخول إلى حسابك لعرض هذا القسم فوراً.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  onClick={() => setIsMemberAuthOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>تسجيل دخول المنخرطين</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('home');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all cursor-pointer"
                >
                  العودة للواجهة الرئيسية
                </button>
              </div>
            </div>
          ) : (
            <ExpensesLedger
              operations={operations}
              contributions={contributions}
              campaignContributions={campaignContributions}
              contributionTypes={contributionTypes}
              campaigns={campaigns}
              role={role}
              lang={lang}
              tenantId={activeTenantId}
              tenantName={currentTenant.name}
              currency={settings.currency || 'د.م'}
              loggedInMember={loggedInMember}
              canAdd={role === 'admin' ? checkAdminPermission(currentAdminSession, subAdmins, 'operations', 'canAdd').allowed : false}
              canEdit={role === 'admin' ? checkAdminPermission(currentAdminSession, subAdmins, 'operations', 'canEdit').allowed : false}
              canDelete={role === 'admin' ? checkAdminPermission(currentAdminSession, subAdmins, 'operations', 'canDelete').allowed : false}
              onOpenAddOperation={() => {
                if (role === 'admin' && !checkAdminPermission(currentAdminSession, subAdmins, 'operations', 'canAdd').allowed) return;
                setIsAddOperationOpen(true);
              }}
              onOpenReceiptModal={(op) => setReceiptModalData({ type: 'operation_receipt', operation: op })}
              onOpenContributionReceipt={(c) => {
                const isUnpaid = c.status === 'unpaid' || c.isNegative || c.amountSign === '-';
                const syntheticOp: FinancialOperation = {
                  id: c.financialOperationId || `op-${c.id}`,
                  code: c.receiptNumber || `REC-${c.id.slice(-6).toUpperCase()}`,
                  type: isUnpaid ? 'expense' : 'income',
                  category: c.category as any,
                  title: `${c.typeNameAr}: ${c.donorName}`,
                  description: c.campaignTitle
                    ? `مساهمة موجهة لصالح: ${c.campaignTitle}${c.notes ? ` • ${c.notes}` : ''}`
                    : c.notes || (isUnpaid ? 'لم يتم الدفع' : 'مساهمة مالية معتمدة وموثقة بالجمعية'),
                  amount: c.amount,
                  date: c.date,
                  memberId: c.id,
                  memberName: c.donorName,
                  addedBy: 'إدارة وأمانة مال الجمعية',
                  createdAt: c.createdAt,
                  tenantId: c.tenantId,
                  associationId: c.tenantId,
                };
                setReceiptModalData({ type: 'operation_receipt', operation: syntheticOp });
              }}
              onOpenMediaModal={handleOpenMediaModal}
              onExportCSV={() => exportOperationsCSV(operations)}
              onPrintReport={() => setReceiptModalData({ type: 'financial_statement' })}
              onDeleteOperation={role === 'admin' ? handleDeleteOperation : undefined}
              onBackToHome={() => setActiveTab('home')}
              onRefreshLiveRecords={handleRefreshTransparencyRecords}
            />
          )
        )}

        {activeTab === 'my-account' && loggedInMember && (
          <MyAccountSection
            member={loggedInMember}
            allOperations={operations}
            contributions={contributions}
            onAddContribution={handleAddContribution}
            polls={polls}
            lang={lang}
            onUpdateProfile={handleUpdateMemberProfile}
            onChangePassword={handleChangeMemberPassword}
            onLogout={handleMemberLogout}
            onPrintMemberCard={(member) => setReceiptModalData({ type: 'member_card', member })}
            onVote={handleVote}
            setActiveTab={handleSelectTab}
          />
        )}

        {activeTab === 'admin' &&
          !loggedInMember &&
          isValidAdminSessionForTenant(currentAdminSession, role, activeTenantId, subAdmins) &&
          (currentTenant.status === 'active' || isMasterAdminEnteringDashboard) && (
          <AdminPanel
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            memberCardSettings={memberCardSettings}
            onUpdateMemberCardSettings={handleUpdateMemberCardSettings}
            registrationFields={registrationFields}
            onUpdateRegistrationFields={handleUpdateRegistrationFields}
            uiElements={uiElements}
            onUpdateUIElements={handleUpdateUIElements}
            polls={polls}
            onUpdatePolls={handleUpdatePolls}
            boardMembers={boardMembers}
            onUpdateBoardMembers={handleUpdateBoardMembers}
            contributions={contributions}
            onAddContribution={handleAddContribution}
            onUpdateContributionStatus={handleUpdateContributionStatus}
            onDeleteContribution={handleDeleteContribution}
            auditLogs={auditLogs}
            members={members}
            operations={operations}
            activities={activities}
            campaigns={campaigns}
            onUpdateCampaigns={handleUpdateCampaigns}
            campaignContributions={campaignContributions}
            onUpdateCampaignContributions={handleUpdateCampaignContributions}
            contributionTypes={contributionTypes}
            onUpdateContributionTypes={handleUpdateContributionTypes}
            activeTenantId={activeTenantId}
            addToast={addToast}
            lang={lang}
            onOpenAddMember={() => {
              setEditingMember(null);
              setIsMemberFormOpen(true);
            }}
            onEditMember={(member) => {
              setEditingMember(member);
              setIsMemberFormOpen(true);
            }}
            onDeleteMember={(id) => handleDeleteMember(id, true)}
            onToggleMemberStatus={handleToggleMemberStatus}
            onPrintMemberCard={(member) => setReceiptModalData({ type: 'member_card', member })}
            onPrintContributionReceipt={(contribution) => {
              const op = operations.find((o) => o.id === contribution.financialOperationId) || {
                id: contribution.financialOperationId || `op-${contribution.id}`,
                code: `OP-${contribution.id.slice(-6)}`,
                type: 'income' as const,
                category: contribution.category as any,
                title: `مساهمة: ${contribution.memberName}`,
                description: `مساهمة ${contribution.category === 'donation' ? 'تبرع' : 'انخراط'} (${contribution.status === 'pending' ? 'قيد المراجعة' : contribution.status === 'completed' ? 'مكتملة وموثقة' : isUnpaidContributionStatus(contribution.status) ? 'لم يتم الدفع' : 'مرفوضة'}) - ${contribution.notes || ''}`,
                amount: contribution.amount,
                date: contribution.date,
                addedBy: contribution.memberName,
                createdAt: contribution.createdAt,
                tenantId: contribution.tenantId,
                associationId: contribution.associationId,
              };
              setReceiptModalData({ type: 'operation_receipt', operation: op });
            }}
            onOpenAddOperation={() => setIsAddOperationOpen(true)}
            onSaveOperation={handleSaveOperation}
            onDeleteOperation={handleDeleteOperation}
            totalIncomes={totalIncomes}
            totalExpenses={totalExpenses}
            currentBalance={currentBalance}
            onOpenAddActivity={() => {
              setEditingActivity(null);
              setIsAddActivityOpen(true);
            }}
            onEditActivity={(act) => {
              setEditingActivity(act);
              setIsAddActivityOpen(true);
            }}
            onDeleteActivity={handleDeleteActivity}
            onToggleActivityStatus={handleToggleActivityStatus}
            onAddGalleryImages={handleAddActivityGalleryImages}
            onDeleteGalleryImage={handleDeleteActivityGalleryImage}
            onDeleteAllGalleryImages={handleDeleteAllActivityGalleryImages}
            onOpenMediaModal={(media) => setMediaModalData(media)}
            onExportBackup={exportBackupJSON}
            onResetDefaults={handleResetDefaults}
            onImportBackup={handleImportBackup}
            subAdmins={subAdmins}
            onUpdateSubAdmins={handleUpdateSubAdmins}
            currentAdminSession={currentAdminSession}
            isMasterTemplate={!activeTenantId || activeTenantId === MASTER_TEMPLATE_TENANT_ID || activeTenantId === 'portal'}
            onPublishReferenceActivities={handlePublishReferenceActivities}
            onSyncReferenceActivities={handleSyncReferenceActivities}
            onLogAudit={(action, desc) => {
              const perfBy = currentAdminSession?.fullName || settings.name || 'إدارة الجمعية';
              const admType = currentAdminSession?.type;
              const admPhone = currentAdminSession?.phone;
              const updated = addAuditLog(action, 'field', desc, perfBy, admType, admPhone);
              setAuditLogs(updated);
            }}
            onBackToMasterAdmin={() => {
              setIsMasterAdminOpen(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onLogoutAdmin={() => handleAdminLogout(true)}
          />
        )}

        {activeTab === 'my-account' && !loggedInMember && (
          <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">فضاء المنخرطين</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              هذا الفضاء مخصص لمنخرطي الجمعية. يرجى تسجيل الدخول أو تقديم طلب انخراط جديد للوصول إلى حسابك.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setIsMemberAuthOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                تسجيل دخول المنخرط
              </button>
              <button
                onClick={() => setIsMemberRegistrationOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-sm transition-all cursor-pointer"
              >
                طلب انخراط جديد
              </button>
              <button
                onClick={() => setActiveTab('home')}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
              >
                الرئيسية
              </button>
            </div>
          </div>
        )}

        {activeTab === 'admin' && !loggedInMember && role !== 'admin' && !isMasterAdminEnteringDashboard && (
          <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">لوحة التحكم الإدارية</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              هذا القسم مخصص لإدارة الجمعية ومجلس الإدارة. يرجى تسجيل الدخول للوصول إلى لوحة التحكم.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setIsAdminAuthOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                تسجيل الدخول كمسؤول
              </button>
              <button
                onClick={() => setActiveTab('home')}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        )}

        {!['home', 'activities', 'members', 'board-members', 'ledger', 'my-account', 'admin'].includes(activeTab) && (
          <HomeSection
            settings={settings}
            members={members}
            boardMembers={boardMembers}
            activities={activities}
            operations={operations}
            campaigns={campaigns}
            lang={lang}
            role={role}
            polls={polls}
            loggedInMember={loggedInMember}
            currentAdminSession={currentAdminSession}
            activeTenantId={activeTenantId}
            onRequestMemberLogin={() => setIsMemberAuthOpen(true)}
            onRequestRegisterMember={() => setIsMemberRegistrationOpen(true)}
            onVote={handleVote}
            setActiveTab={(tab) => {
              setSelectedActivityIdForView(null);
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectActivity={(activityId) => {
              setSelectedActivityIdForView(activityId);
              setActiveTab('activities');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenMediaModal={handleOpenMediaModal}
            onOpenReportModal={() => setReceiptModalData({ type: 'financial_statement' })}
            onOpenDonationModal={(campaign) => setDonationModalCampaign(campaign)}
            uiElements={uiElements}
          />
        )}
      </main>

      {/* Global Footer & Bottom Access Section */}
      <footer 
        className="text-slate-300 border-t border-slate-800/80 pt-10 pb-20 lg:pb-10 mt-12 transition-colors duration-300"
        style={{
          backgroundColor: settings.themeColors?.secondaryColor || '#0f172a',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Col 1: Association Brand */}
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-3">
                {settings.logoUrl ? (
                  <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-md overflow-hidden flex-shrink-0">
                    <img src={settings.logoUrl} alt={settings.name} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-md flex-shrink-0">
                    ش
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-white text-base">
                    {lang === 'ar' ? settings.name : lang === 'fr' ? settings.nameFr : settings.nameEn}
                  </h3>
                  <p className="text-xs text-emerald-400 font-medium">منصة الحكامة والشفافية الرقمية</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                {lang === 'ar' ? settings.tagline : lang === 'fr' ? settings.taglineFr : settings.taglineEn}. 
                نلتزم بنشر كافة التفاصيل المالية وسجلات المنخرطين والأعمال الخيرية لضمان الشفافية المطلقة.
              </p>
            </div>

            {/* Col 2: Direct Gateways to Ledgers (القسم السفلي للسجلات) */}
            {isUIElementVisible('footer_quick_links') && (
              <div className="space-y-3">
                <h4 className="font-bold text-white text-sm">السجلات والحسابات (القسم السفلي)</h4>
                <ul className="space-y-2 text-xs">
                  <li>
                    <button
                      onClick={() => {
                        setActiveTab('ledger');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>سجل الشفافية المباشر</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        setActiveTab('members');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span>سجل المنخرطين والمشتركين</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        setActiveTab('activities');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      <span>الأعمال والأنشطة الميدانية</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}

            {/* Col 3: Bank & Contact */}
            {isUIElementVisible('footer_contact_info') && (
              <div className="space-y-3 text-xs">
                <h4 className="font-bold text-white text-sm">بيانات التواصل والبنك</h4>
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1.5">
                  <span className="text-slate-400 block text-[11px]">رقم الحساب البنكي (RIB):</span>
                  <span className="font-mono text-emerald-400 font-bold block text-xs break-all">
                    {settings.ribBank}
                  </span>
                  <span className="text-[10px] text-slate-500 block">{settings.bankName}</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  الهاتف: {settings.phone} {settings.whatsapp && settings.whatsapp !== settings.phone ? `| واتساب: ${settings.whatsapp} ` : ''}| المقر: {settings.city || settings.address || 'المغرب'}
                </p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} {settings.name || 'الجمعية'}. جميع الحقوق محفوظة.</p>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-emerald-400 font-medium">نظام شفافية ومسؤولية معتمد</span>
              {!loggedInMember && (settings.showAdminLoginButton ?? false) && (
                <>
                  <span>•</span>
                  <button
                    onClick={() => setIsAdminAuthOpen(true)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    دخول الإدارة
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Bar for iOS & Android feel */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        role={role}
        lang={lang}
        uiElements={uiElements}
        loggedInMember={loggedInMember}
        onRequestMemberLogin={() => setIsMemberAuthOpen(true)}
        onRequestRegisterMember={() => setIsMemberRegistrationOpen(true)}
        settings={settings}
        isMasterPlatformAdmin={isMasterAdminEnteringDashboard}
      />

      {/* Member Authentication & Login Modal */}
      <MemberAuthModal
        isOpen={isMemberAuthOpen}
        onClose={() => setIsMemberAuthOpen(false)}
        onLoginSuccess={handleMemberLogin}
        onAdminLoginSuccess={(session, targetTenant) => {
          if (targetTenant && targetTenant.id && targetTenant.id !== currentTenant.id) {
            handleAssociationLoginSuccess(targetTenant, session, 'admin');
            return;
          }
          const effectiveTenantId =
            !activeTenantId || activeTenantId === 'portal'
              ? currentTenant?.id || 'tenant_nour'
              : activeTenantId;
          setLoggedInMember(null);
          clearLoggedInMemberId(effectiveTenantId);
          setRole('admin');
          saveData(KEYS.ROLE, 'admin');
          const isSecondary = session?.type === 'sub_admin' || session?.role === 'secondary_admin';
          const adminSess: CurrentAdminSession = {
            ...session,
            type: isSecondary ? 'sub_admin' : 'super_admin',
            role: isSecondary ? 'secondary_admin' : 'main_admin',
            tenantId: session.tenantId || effectiveTenantId,
            isMasterPlatformAdmin: false,
          };

          if (isSecondary && (adminSess.id || adminSess.subAdmin)) {
            const currentStored = getStoredSubAdmins(effectiveTenantId);
            const baseList = currentStored.length >= subAdmins.length ? currentStored : subAdmins;
            const hasMatch = baseList.some((a) => a.id === adminSess.id);
            const updatedAdmins = hasMatch
              ? baseList.map((a) =>
                  a.id === adminSess.id
                    ? { ...a, ...(adminSess.subAdmin || {}), lastLoginAt: new Date().toISOString() }
                    : a
                )
              : adminSess.subAdmin
                ? [{ ...adminSess.subAdmin, lastLoginAt: new Date().toISOString() }, ...baseList]
                : baseList;
            setSubAdmins(updatedAdmins);
            saveSubAdmins(updatedAdmins, false, effectiveTenantId);
          }

          setCurrentAdminSession(adminSess);
          saveCurrentAdminSession(adminSess, effectiveTenantId);
          saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, adminSess, effectiveTenantId);
          setIsMemberAuthOpen(false);
          setActiveTab('admin');

          const updatedLogs = addAuditLog(
            'login',
            'auth',
            `تسجيل الدخول إلى لوحة التحكم الإدارية: ${adminSess.fullName} (${isSecondary ? 'أدمن من الدرجة الثانية' : 'الأدمن الرئيسي'})`,
            adminSess.fullName,
            adminSess.type,
            adminSess.phone
          );
          setAuditLogs(updatedLogs);

          if (isSecondary) {
            addToast('success', `مرحبًا بك يا ${adminSess.fullName}! تم تسجيل الدخول كأدمن من الدرجة الثانية.`);
          } else {
            addToast('success', 'مرحبًا بك! تم تسجيل الدخول كأدمن رئيسي (Super Admin) بصلاحيات كاملة.');
          }
        }}
        members={members}
        subAdmins={subAdmins}
        lang={lang}
        onOpenRegisterModal={() => setIsMemberRegistrationOpen(true)}
      />

      {/* Member Registration Modal (تسجيل منخرط جديد) */}
      <MemberRegistrationModal
        isOpen={isMemberRegistrationOpen}
        onClose={() => setIsMemberRegistrationOpen(false)}
        onRegisterSuccess={handleMemberRegistrationSuccess}
        members={members}
        lang={lang}
        registrationFields={registrationFields}
        associationName={currentTenant.name}
        settings={settings}
        onOpenLoginModal={() => setIsMemberAuthOpen(true)}
      />

      {/* Admin Authentication PIN / Sub-Admin Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthOpen}
        onClose={() => setIsAdminAuthOpen(false)}
        subAdmins={subAdmins}
        onSuccess={(session) => {
          const effectiveTenantId =
            !activeTenantId || activeTenantId === 'portal'
              ? currentTenant?.id || 'tenant_nour'
              : activeTenantId;
          setLoggedInMember(null);
          clearLoggedInMemberId(effectiveTenantId);
          setRole('admin');
          saveData(KEYS.ROLE, 'admin');
          const isSecondary = session?.type === 'sub_admin' || session?.role === 'secondary_admin';
          const adminSess: CurrentAdminSession = session
            ? {
                ...session,
                type: isSecondary ? 'sub_admin' : 'super_admin',
                role: isSecondary ? 'secondary_admin' : 'main_admin',
                tenantId: session.tenantId || effectiveTenantId,
              }
            : {
                type: 'super_admin',
                role: 'main_admin',
                fullName: 'الأدمن الرئيسي (Super Admin)',
                tenantId: effectiveTenantId,
              };

          if (isSecondary && (adminSess.id || adminSess.subAdmin)) {
            const currentStored = getStoredSubAdmins(effectiveTenantId);
            const baseList = currentStored.length >= subAdmins.length ? currentStored : subAdmins;
            const hasMatch = baseList.some((a) => a.id === adminSess.id);
            const updatedAdmins = hasMatch
              ? baseList.map((a) =>
                  a.id === adminSess.id
                    ? { ...a, ...(adminSess.subAdmin || {}), lastLoginAt: new Date().toISOString() }
                    : a
                )
              : adminSess.subAdmin
                ? [{ ...adminSess.subAdmin, lastLoginAt: new Date().toISOString() }, ...baseList]
                : baseList;
            setSubAdmins(updatedAdmins);
            saveSubAdmins(updatedAdmins, false, effectiveTenantId);
          }

          setCurrentAdminSession(adminSess);
          saveCurrentAdminSession(adminSess, effectiveTenantId);
          saveTenantData(TENANT_DATA_KEYS.CURRENT_ADMIN_SESSION, adminSess, effectiveTenantId);
          setIsAdminAuthOpen(false);
          setActiveTab('admin');

          const updatedLogs = addAuditLog(
            'login',
            'auth',
            `تسجيل الدخول إلى لوحة التحكم الإدارية: ${adminSess.fullName} (${isSecondary ? 'أدمن من الدرجة الثانية' : 'الأدمن الرئيسي'})`,
            adminSess.fullName,
            adminSess.type,
            adminSess.phone
          );
          setAuditLogs(updatedLogs);

          if (isSecondary) {
            addToast('success', `مرحبًا بك يا ${adminSess.fullName}! تم تسجيل الدخول كأدمن من الدرجة الثانية.`);
          } else {
            addToast('success', 'مرحبًا بك! تم تسجيل الدخول كأدمن رئيسي (Super Admin) بصلاحيات كاملة.');
          }
        }}
        adminPin={settings.adminPin}
        lang={lang}
      />

      {/* Add / Record Operation Modal */}
      <AddOperationModal
        isOpen={isAddOperationOpen}
        onClose={() => setIsAddOperationOpen(false)}
        onSave={handleSaveOperation}
        members={members}
        lang={lang}
      />

      {/* Add / Edit Activity Modal */}
      <AddActivityModal
        isOpen={isAddActivityOpen}
        onClose={() => {
          setIsAddActivityOpen(false);
          setEditingActivity(null);
        }}
        onSave={handleSaveActivity}
        editingActivity={editingActivity}
        lang={lang}
        canEdit={role === 'admin' ? checkAdminPermission(currentAdminSession, subAdmins, 'activities', 'canEdit').allowed : false}
        currentAdminSession={currentAdminSession}
        activeTenantId={(!activeTenantId || activeTenantId === 'portal') ? MASTER_TEMPLATE_TENANT_ID : activeTenantId}
        onAddGalleryImages={handleAddActivityGalleryImages}
        onDeleteGalleryImage={handleDeleteActivityGalleryImage}
        onDeleteAllGalleryImages={handleDeleteAllActivityGalleryImages}
      />

      {/* Add / Edit Member Modal (Admin Panel) */}
      <MemberFormModal
        isOpen={isMemberFormOpen}
        onClose={() => {
          setIsMemberFormOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
        editingMember={editingMember}
        existingMembersCount={members.length}
        members={members}
        lang={lang}
        registrationFields={registrationFields}
        associationName={currentTenant.name}
        settings={settings}
      />

      {/* Media & Proof Document Viewer Modal */}
      {mediaModalData && (
        <MediaViewerModal
          isOpen={Boolean(mediaModalData)}
          onClose={() => setMediaModalData(null)}
          title={mediaModalData.title}
          mediaUrl={mediaModalData.url}
          type={mediaModalData.type}
          description={mediaModalData.description}
          lang={lang}
        />
      )}

      {/* Printable Receipt & Financial Statement Modal */}
      {receiptModalData && (
        <ReceiptModal
          isOpen={Boolean(receiptModalData)}
          onClose={() => setReceiptModalData(null)}
          type={receiptModalData.type}
          member={receiptModalData.member}
          operation={receiptModalData.operation}
          operations={operations}
          members={members}
          contributions={contributions}
          settings={settings}
          cardSettings={memberCardSettings}
          lang={lang}
          canViewBalance={role === 'admin' || Boolean(loggedInMember) || isMasterAdminEnteringDashboard}
        />
      )}

      {/* Campaign Donation Modal */}
      {donationModalCampaign && (
        <CampaignDonationModal
          isOpen={Boolean(donationModalCampaign)}
          onClose={() => setDonationModalCampaign(null)}
          campaign={donationModalCampaign}
          contributionTypes={
            donationModalCampaign.tenantId && donationModalCampaign.tenantId !== activeTenantId
              ? getStoredContributionTypes(donationModalCampaign.tenantId)
              : contributionTypes
          }
          presetAmounts={getStoredDonationPresets(donationModalCampaign.tenantId || activeTenantId)}
          settings={
            donationModalCampaign.tenantId && donationModalCampaign.tenantId !== activeTenantId
              ? getStoredSettings(donationModalCampaign.tenantId)
              : settings
          }
          associationId={
            donationModalCampaign.tenantId ||
            donationModalCampaign.associationId ||
            (activeTenantId !== 'portal' ? activeTenantId : 'tenant_nour')
          }
          addToast={addToast}
          onDonationSuccess={(newContrib, updatedCamp, targetTenant) => {
            handleDonationCompleted(newContrib, updatedCamp, targetTenant);
          }}
        />
      )}

      {/* Create New Association Wizard Modal */}
      <CreateAssociationWizardModal
        isOpen={isCreateWizardOpen}
        onClose={() => setIsCreateWizardOpen(false)}
        onAssociationCreated={(newTenant) => {
          setIsCreateWizardOpen(false);
          switchTenant(newTenant.id, false, newTenant);
          addToast('info', `تم إنشاء منصة «${newTenant.name}» بحالة «في انتظار الدفع». يرجى تسديد مبلغ الاشتراك المطلوب لتفعيل المنصة بعد التحقق وموافقة الإدارة العامة.`);
        }}
      />

      {/* Association Owner / Admin Login Modal */}
      <AssociationLoginModal
        isOpen={isAssociationLoginOpen}
        onClose={() => setIsAssociationLoginOpen(false)}
        onLoginSuccess={handleAssociationLoginSuccess}
        onOpenCreateWizard={() => {
          setIsAssociationLoginOpen(false);
          setIsCreateWizardOpen(true);
        }}
        onShowToast={(msg, type) => addToast(type, msg)}
      />

      {/* Master Admin Auth Modal */}
      <MasterAdminAuthModal
        isOpen={isMasterAdminAuthModalOpen}
        onClose={() => setIsMasterAdminAuthModalOpen(false)}
        onSuccess={() => {
          setIsMasterAdminAuthModalOpen(false);
          setIsMasterAdminOpen(true);
        }}
        onShowToast={(msg, type) => addToast(type, msg)}
      />

      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
