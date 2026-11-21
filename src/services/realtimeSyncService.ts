import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  FirestoreOperationType,
} from '../firebase';
import type {
  AssociationSettings,
  ActivityItem,
  DonationCampaign,
  Member,
  BoardMember,
  FinancialOperation,
  MemberContribution,
  Poll,
  UIElementConfig,
  MemberCardSettings,
  MemberRegistrationField,
  AssociationTenant,
  PlatformAdCampaign,
  TenantPaymentRecord,
} from '../types';
import { applyRealtimePlatformIdentity } from '../api/platformIdentityApi';
import { applyRealtimePortalSettings } from '../portalSettingsStorage';
import { applyRealtimeTenants } from '../tenantStorage';
import { applyRealtimeAdCampaigns } from '../adCampaignStorage';
import { applyRealtimeTenantPayments } from '../paymentStorage';
import {
  getDeletedActivityIds,
  getDeletedCampaignIds,
  getDeletedOperationIds,
  getDeletedContributionIds,
} from '../storage';

export interface TenantRealtimeHandlers {
  onSettings?: (settings: Partial<AssociationSettings> & { _updatedAt?: string; lastUpdated?: string }) => void;
  onActivities?: (activities: ActivityItem[]) => void;
  onCampaigns?: (campaigns: DonationCampaign[]) => void;
  onMembers?: (members: Member[]) => void;
  onBoardMembers?: (boardMembers: BoardMember[]) => void;
  onOperations?: (operations: FinancialOperation[]) => void;
  onContributions?: (contributions: MemberContribution[]) => void;
  onPolls?: (polls: Poll[]) => void;
  onUIElements?: (elements: UIElementConfig[]) => void;
  onMemberCardSettings?: (cardSettings: Partial<MemberCardSettings>) => void;
  onRegistrationFields?: (fields: MemberRegistrationField[]) => void;
}

function normalizeTenantForRealtime(tenantId?: string | null): string {
  if (!tenantId || tenantId === 'portal' || tenantId === 'default' || tenantId === 'master') {
    return 'tenant_nour';
  }
  return tenantId.trim();
}

function stableSignature(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(Date.now());
  }
}

function reportListenerError(error: unknown, path: string): void {
  try {
    handleFirestoreError(error, FirestoreOperationType.GET, path);
  } catch (err) {
    console.warn(`[RealtimeSync] Listener notice on ${path}:`, err);
  }
}

/**
 * Subscribes to global SYOMAX platform collections & documents via Cloud Firestore `onSnapshot`:
 * - `platform_identity/main` (platform name, logo, WhatsApp)
 * - `portal_settings/main` (public portal layout, texts, logo, theme)
 * - `tenants` (registered associations, branding, status)
 * - `ad_campaigns` (live promotional campaigns)
 *
 * All visitors on any domain or device receive live updates automatically without reloading or clearing cache.
 */
export function subscribePlatformRealtime(): Unsubscribe {
  const unsubscribers: Unsubscribe[] = [];
  const lastSignatures = new Map<string, string>();

  const shouldEmit = (key: string, payload: unknown): boolean => {
    const sig = stableSignature(payload);
    if (lastSignatures.get(key) === sig) return false;
    lastSignatures.set(key, sig);
    return true;
  };

  // 1. Platform Identity (name, logo, WhatsApp)
  unsubscribers.push(
    onSnapshot(
      doc(db, 'platform_identity', 'main'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, any>;
        if (!shouldEmit('platform_identity', data)) return;
        applyRealtimePlatformIdentity(data);
      },
      (error) => reportListenerError(error, 'platform_identity/main')
    )
  );

  // 2. Portal Settings (home page texts, visibility, logo, theme)
  unsubscribers.push(
    onSnapshot(
      doc(db, 'portal_settings', 'main'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, any>;
        if (!shouldEmit('portal_settings', data)) return;
        applyRealtimePortalSettings(data);
      },
      (error) => reportListenerError(error, 'portal_settings/main')
    )
  );

  // 3. Tenants Collection (associations directory, logos, banners, activation status)
  unsubscribers.push(
    onSnapshot(
      collection(db, 'tenants'),
      (snap) => {
        if (snap.empty) return;
        const tenantsList: AssociationTenant[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as AssociationTenant;
          if (data && data.id) {
            tenantsList.push(data);
          }
        });
        if (tenantsList.length === 0) return;
        if (!shouldEmit('tenants', tenantsList)) return;
        applyRealtimeTenants(tenantsList);
      },
      (error) => reportListenerError(error, 'tenants')
    )
  );

  // 4. Live Ad Campaigns
  let adCampaignsSawData = false;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'ad_campaigns'),
      (snap) => {
        const list: PlatformAdCampaign[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as PlatformAdCampaign;
          if (data && data.id) {
            list.push(data);
          }
        });
        if (list.length > 0) {
          adCampaignsSawData = true;
        } else if (!adCampaignsSawData) {
          // Unseeded initial empty collection — keep local defaults until data exists
          return;
        }
        list.sort((a, b) => (a.priorityOrder || 99) - (b.priorityOrder || 99));
        if (!shouldEmit('ad_campaigns', list)) return;
        applyRealtimeAdCampaigns(list);
      },
      (error) => reportListenerError(error, 'ad_campaigns')
    )
  );

  // 5. Live Tenant Activation & Subscription Payments
  let tenantPaymentsSawData = false;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'tenant_payments'),
      (snap) => {
        const list: TenantPaymentRecord[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as TenantPaymentRecord;
          if (data && (data.id || docSnap.id) && data.tenantId) {
            list.push({ ...data, id: data.id || docSnap.id });
          }
        });
        if (list.length > 0) {
          tenantPaymentsSawData = true;
        } else if (!tenantPaymentsSawData) {
          return;
        }
        list.sort(
          (a, b) =>
            new Date(b.submittedAt || b.createdAt || 0).getTime() -
            new Date(a.submittedAt || a.createdAt || 0).getTime()
        );
        if (!shouldEmit('tenant_payments', list)) return;
        applyRealtimeTenantPayments(list);
      },
      (error) => reportListenerError(error, 'tenant_payments')
    )
  );

  return () => {
    for (const unsub of unsubscribers) {
      try {
        unsub();
      } catch {}
    }
    lastSignatures.clear();
  };
}

/**
 * Subscribes to all live Cloud Firestore collections & documents scoped strictly to `tenantId`.
 * Automatically propagates:
 * - Association branding, logo, cover banner & info (`settings/{tenantId}`)
 * - Activities & gallery photos additions/edits/deletions (`activities`)
 * - Donation campaigns & media (`campaigns`)
 * - Members profiles & self-updates (`members`)
 * - Board members (`board_members`)
 * - Financial transparency ledger (`operations` & `contributions`)
 * - Polls & live votes (`polls`)
 * - UI visibility configuration (`ui_elements/{tenantId}`)
 * - Member card settings (`settings/{tenantId}_member_card`)
 * - Global registration fields (`settings/global_registration_fields`)
 */
export function subscribeTenantRealtime(
  tenantId: string,
  handlers: TenantRealtimeHandlers
): Unsubscribe {
  const cleanTenant = normalizeTenantForRealtime(tenantId);
  const unsubscribers: Unsubscribe[] = [];
  const lastSignatures = new Map<string, string>();
  const sawNonEmpty = new Set<string>();

  const shouldEmit = (key: string, payload: unknown): boolean => {
    const sig = stableSignature(payload);
    if (lastSignatures.get(key) === sig) return false;
    lastSignatures.set(key, sig);
    return true;
  };

  // 1. Association Settings (Name, Logo, Cover Banner, Colors, Bank Info, Tagline)
  if (handlers.onSettings) {
    const path = `settings/${cleanTenant}`;
    unsubscribers.push(
      onSnapshot(
        doc(db, 'settings', cleanTenant),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as Record<string, any>;
          if (!shouldEmit(path, data)) return;
          handlers.onSettings?.(data);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  // 2. Activities & Photo Galleries (Live additions, edits, photo uploads & deletions)
  if (handlers.onActivities) {
    const path = `activities[tenantId=${cleanTenant}]`;
    const q = query(collection(db, 'activities'), where('tenantId', '==', cleanTenant));
    unsubscribers.push(
      onSnapshot(
        q,
        (snap) => {
          const deletedIds = new Set(getDeletedActivityIds(cleanTenant));
          const list: ActivityItem[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as ActivityItem;
            if (data && data.id && !deletedIds.has(data.id)) {
              list.push({
                ...data,
                isActive: data.isActive !== false && (data as any).isActive !== 'false',
              });
            }
          });
          if (list.length > 0) {
            sawNonEmpty.add(path);
          } else if (!sawNonEmpty.has(path)) {
            return;
          }
          list.sort(
            (a, b) =>
              new Date(b.date || (b as any).createdAt || 0).getTime() -
              new Date(a.date || (a as any).createdAt || 0).getTime()
          );
          if (!shouldEmit(path, list)) return;
          handlers.onActivities?.(list);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  // 3. Donation Campaigns (Live cover images, videos, collected amounts, additions/deletions)
  if (handlers.onCampaigns) {
    const path = `campaigns[tenantId=${cleanTenant}]`;
    const q = query(collection(db, 'campaigns'), where('tenantId', '==', cleanTenant));
    unsubscribers.push(
      onSnapshot(
        q,
        (snap) => {
          const deletedIds = new Set(getDeletedCampaignIds(cleanTenant));
          const list: DonationCampaign[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as DonationCampaign;
            if (data && data.id && !deletedIds.has(data.id)) {
              list.push(data);
            }
          });
          if (list.length > 0) {
            sawNonEmpty.add(path);
          } else if (!sawNonEmpty.has(path)) {
            return;
          }
          list.sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime()
          );
          if (!shouldEmit(path, list)) return;
          handlers.onCampaigns?.(list);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  // 4. Association Members (Live profile updates, avatars, status changes, registrations)
  if (handlers.onMembers) {
    const path = `members[tenantId=${cleanTenant}]`;
    const q = query(collection(db, 'members'), where('tenantId', '==', cleanTenant));
    unsubscribers.push(
      onSnapshot(
        q,
        (snap) => {
          const list: Member[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as Member;
            if (data && data.id) {
              list.push(data);
            }
          });
          if (list.length > 0) {
            sawNonEmpty.add(path);
          } else if (!sawNonEmpty.has(path)) {
            return;
          }
          if (!shouldEmit(path, list)) return;
          handlers.onMembers?.(list);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  // 5. Board Members
  if (handlers.onBoardMembers) {
    const path = `board_members[tenantId=${cleanTenant}]`;
    const q = query(collection(db, 'board_members'), where('tenantId', '==', cleanTenant));
    unsubscribers.push(
      onSnapshot(
        q,
        (snap) => {
          const list: BoardMember[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as BoardMember;
            if (data && data.id) {
              list.push(data);
            }
          });
          if (list.length > 0) {
            sawNonEmpty.add(path);
          } else if (!sawNonEmpty.has(path)) {
            return;
          }
          if (!shouldEmit(path, list)) return;
          handlers.onBoardMembers?.(list);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  // 6. Financial Operations (Live transparency ledger)
  if (handlers.onOperations) {
    const path = `operations[tenantId=${cleanTenant}]`;
    const q = query(collection(db, 'operations'), where('tenantId', '==', cleanTenant));
    unsubscribers.push(
      onSnapshot(
        q,
        (snap) => {
          const deletedIds = new Set(getDeletedOperationIds(cleanTenant));
          const list: FinancialOperation[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as FinancialOperation;
            if (data && data.id && !deletedIds.has(data.id)) {
              list.push(data);
            }
          });
          if (list.length > 0) {
            sawNonEmpty.add(path);
          } else if (!sawNonEmpty.has(path)) {
            return;
          }
          list.sort(
            (a, b) =>
              new Date(b.date || b.createdAt || 0).getTime() -
              new Date(a.date || a.createdAt || 0).getTime()
          );
          if (!shouldEmit(path, list)) return;
          handlers.onOperations?.(list);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  // 7. Member Contributions
  if (handlers.onContributions) {
    const path = `contributions[tenantId=${cleanTenant}]`;
    const q = query(collection(db, 'contributions'), where('tenantId', '==', cleanTenant));
    unsubscribers.push(
      onSnapshot(
        q,
        (snap) => {
          const deletedIds = new Set(getDeletedContributionIds(cleanTenant));
          const list: MemberContribution[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as MemberContribution;
            if (data && data.id && !deletedIds.has(data.id)) {
              list.push(data);
            }
          });
          if (list.length > 0) {
            sawNonEmpty.add(path);
          } else if (!sawNonEmpty.has(path)) {
            return;
          }
          list.sort(
            (a, b) =>
              new Date(b.createdAt || b.date || 0).getTime() -
              new Date(a.createdAt || a.date || 0).getTime()
          );
          if (!shouldEmit(path, list)) return;
          handlers.onContributions?.(list);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  // 8. Polls & Live Member Voting
  if (handlers.onPolls) {
    const path = `polls[tenantId=${cleanTenant}]`;
    const q = query(collection(db, 'polls'), where('tenantId', '==', cleanTenant));
    unsubscribers.push(
      onSnapshot(
        q,
        (snap) => {
          const list: Poll[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as Poll;
            if (data && data.id) {
              list.push(data);
            }
          });
          if (list.length > 0) {
            sawNonEmpty.add(path);
          } else if (!sawNonEmpty.has(path)) {
            return;
          }
          if (!shouldEmit(path, list)) return;
          handlers.onPolls?.(list);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  // 9. UI Elements Configuration
  if (handlers.onUIElements) {
    const path = `ui_elements/${cleanTenant}`;
    unsubscribers.push(
      onSnapshot(
        doc(db, 'ui_elements', cleanTenant),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as { elements?: UIElementConfig[] };
          if (!Array.isArray(data?.elements) || data.elements.length === 0) return;
          if (!shouldEmit(path, data.elements)) return;
          handlers.onUIElements?.(data.elements);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  // 10. Member Card Settings (official stamp, signature, layout)
  if (handlers.onMemberCardSettings) {
    const path = `settings/${cleanTenant}_member_card`;
    unsubscribers.push(
      onSnapshot(
        doc(db, 'settings', `${cleanTenant}_member_card`),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as Partial<MemberCardSettings>;
          if (!shouldEmit(path, data)) return;
          handlers.onMemberCardSettings?.(data);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  // 11. Global Registration Form Fields
  if (handlers.onRegistrationFields) {
    const path = 'settings/global_registration_fields';
    unsubscribers.push(
      onSnapshot(
        doc(db, 'settings', 'global_registration_fields'),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as { registrationFields?: MemberRegistrationField[] };
          if (!Array.isArray(data?.registrationFields) || data.registrationFields.length === 0) return;
          if (!shouldEmit(path, data.registrationFields)) return;
          handlers.onRegistrationFields?.(data.registrationFields);
        },
        (error) => reportListenerError(error, path)
      )
    );
  }

  return () => {
    for (const unsub of unsubscribers) {
      try {
        unsub();
      } catch {}
    }
    lastSignatures.clear();
    sawNonEmpty.clear();
  };
}
