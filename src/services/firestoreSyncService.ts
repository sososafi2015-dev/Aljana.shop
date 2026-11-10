import { 
  db, 
  auth, 
  storage, 
  saveToFirestore, 
  getFromFirestore, 
  getAllFromFirestore, 
  deleteFromFirestore,
  uploadToFirebaseStorage,
  BOOTSTRAP_ADMIN_EMAIL
} from '../firebase';
import { 
  doc, 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  getDoc
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  ActivityItem,
  AssociationSettings,
  FinancialOperation,
  Member,
  BoardMember,
  DonationCampaign,
  Poll,
  UIElementConfig,
  SubAdmin,
  MemberContribution
} from '../types';

/**
 * Service to manage seamless bi-directional synchronization with Cloud Firestore
 */
class FirestoreSyncService {
  private isInitialized = false;
  private currentUser: User | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      onAuthStateChanged(auth, (user) => {
        this.currentUser = user;
        if (user) {
          console.log(`[Firebase Auth] Logged in user: ${user.email} (${user.uid})`);
          this.ensureUserProfile(user).catch(console.error);
        } else {
          console.log('[Firebase Auth] User signed out / anonymous.');
        }
      });
    }
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Ensures the user document in Firestore contains their role and profile metadata
   */
  public async ensureUserProfile(
    user: User,
    extra?: { displayName?: string; role?: string; tenantId?: string; username?: string }
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const isSuper = user.email === BOOTSTRAP_ADMIN_EMAIL;
      const resolvedRole = isSuper ? 'admin' : (extra?.role || 'tenant_admin');
      const resolvedName =
        extra?.displayName || user.displayName || user.email?.split('@')[0] || 'User';

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: resolvedName,
          ...(extra?.username ? { username: extra.username } : {}),
          ...(extra?.tenantId ? { tenantId: extra.tenantId } : {}),
          role: resolvedRole,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        const updatePayload: Record<string, any> = {
          updatedAt: new Date().toISOString(),
        };
        if (isSuper && userSnap.data()?.role !== 'admin') {
          updatePayload.role = 'admin';
        } else if (extra?.role) {
          updatePayload.role = extra.role;
        }
        if (extra?.displayName) updatePayload.displayName = extra.displayName;
        if (extra?.tenantId) updatePayload.tenantId = extra.tenantId;
        if (extra?.username) updatePayload.username = extra.username;
        await setDoc(userRef, updatePayload, { merge: true });
      }
    } catch (e) {
      console.warn('[Firestore] Could not sync user profile record:', e);
    }
  }

  /**
   * Firebase Authentication login
   */
  public async loginWithEmail(email: string, pass: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    await this.ensureUserProfile(cred.user);
    return cred.user;
  }

  /**
   * Firebase Authentication registration
   */
  public async registerWithEmail(email: string, pass: string, displayName?: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (displayName && displayName.trim()) {
      try {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      } catch {}
    }
    await this.ensureUserProfile(cred.user, { displayName: displayName?.trim() });
    return cred.user;
  }

  /**
   * Synchronizes a platform login/registration (by username & password) with Firebase Authentication
   * and the Firestore `users` collection so sessions and roles are backed by Firebase Auth.
   */
  public async syncPlatformSessionWithFirebaseAuth(params: {
    username: string;
    password?: string;
    fullName?: string;
    role: 'admin' | 'tenant_admin' | 'member';
    tenantId?: string;
  }): Promise<User | null> {
    if (typeof window === 'undefined') return null;
    try {
      const rawUser = (params.username || '').trim().toLowerCase();
      if (!rawUser) return null;
      const safeHandle = rawUser.replace(/[^a-z0-9._-]/g, (ch) => `u${ch.charCodeAt(0).toString(16)}`);
      const syntheticEmail = rawUser.includes('@') ? rawUser : `${safeHandle}@users.aljana.org`;
      const rawPass = (params.password || 'AljanaAuth#2026').trim();
      const firebasePass = rawPass.length >= 6 ? rawPass : `${rawPass}_aljana26`;

      let user: User | null = null;
      try {
        const cred = await signInWithEmailAndPassword(auth, syntheticEmail, firebasePass);
        user = cred.user;
      } catch (signInErr: any) {
        const code = String(signInErr?.code || '');
        if (
          code.includes('user-not-found') ||
          code.includes('invalid-credential') ||
          code.includes('invalid-login-credentials')
        ) {
          try {
            const created = await createUserWithEmailAndPassword(auth, syntheticEmail, firebasePass);
            user = created.user;
            if (params.fullName) {
              await updateProfile(user, { displayName: params.fullName }).catch(() => {});
            }
          } catch {
            // Account already exists with a previous password or cannot be auto-created
          }
        }
      }

      if (user) {
        await this.ensureUserProfile(user, {
          displayName: params.fullName,
          role: params.role === 'admin' ? 'admin' : params.role,
          tenantId: params.tenantId,
          username: rawUser,
        });
      }
      return user;
    } catch (err) {
      console.warn('[Firebase Auth] Platform session sync notice:', err);
      return null;
    }
  }

  /**
   * Firebase Authentication logout
   */
  public async logout(): Promise<void> {
    await signOut(auth);
  }

  // ==========================================
  // ACTIVITIES SYNC (WITH DELETION RECONCILIATION)
  // ==========================================
  public async syncActivitiesToFirestore(tenantId: string, activities: ActivityItem[]): Promise<boolean> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const col = collection(db, 'activities');
      const keepDocIds = new Set<string>();

      for (const act of activities) {
        if (!act || !act.id) continue;
        const docId = `${cleanTenant}_${act.id}`;
        keepDocIds.add(docId);
        const docRef = doc(col, docId);
        const payload = JSON.parse(
          JSON.stringify({
            ...act,
            tenantId: cleanTenant,
            _updatedAt: new Date().toISOString(),
          })
        );
        await setDoc(docRef, payload, { merge: true });
      }

      // Remove any deleted activities for this tenant from Firestore
      try {
        const q = query(col, where('tenantId', '==', cleanTenant));
        const existingSnap = await getDocs(q);
        const deletions: Promise<void>[] = [];
        existingSnap.forEach((docSnap) => {
          if (!keepDocIds.has(docSnap.id)) {
            deletions.push(deleteDoc(doc(col, docSnap.id)));
          }
        });
        if (deletions.length > 0) {
          await Promise.all(deletions);
        }
      } catch {}

      return true;
    } catch (err) {
      console.warn('[Firestore] Sync activities error:', err);
      return false;
    }
  }

  public async fetchActivitiesFromFirestore(tenantId: string): Promise<ActivityItem[]> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const col = collection(db, 'activities');
      const q = query(col, where('tenantId', '==', cleanTenant));
      const snap = await getDocs(q);
      const items: ActivityItem[] = [];
      snap.forEach(d => {
        const data = d.data() as ActivityItem;
        items.push(data);
      });
      return items;
    } catch (err) {
      console.warn('[Firestore] Fetch activities error:', err);
      return [];
    }
  }

  public async deleteActivityFromFirestore(tenantId: string, activityId: string): Promise<void> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const docRef = doc(db, 'activities', `${cleanTenant}_${activityId}`);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('[Firestore] Delete activity notice:', err);
    }
  }

  // ==========================================
  // SETTINGS & UI ELEMENTS SYNC
  // ==========================================
  public async saveSettingsToFirestore(tenantId: string, settings: AssociationSettings): Promise<boolean> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const docRef = doc(db, 'settings', cleanTenant);
      const payload = JSON.parse(
        JSON.stringify({
          ...settings,
          tenantId: cleanTenant,
          _updatedAt: new Date().toISOString(),
        })
      );
      await setDoc(docRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('[Firestore] Save settings error:', err);
      return false;
    }
  }

  public async fetchSettingsFromFirestore(tenantId: string): Promise<AssociationSettings | null> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const docRef = doc(db, 'settings', cleanTenant);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as AssociationSettings;
      }
      return null;
    } catch (err) {
      console.warn('[Firestore] Fetch settings error:', err);
      return null;
    }
  }

  public async saveUIElementsToFirestore(tenantId: string, elements: UIElementConfig[]): Promise<boolean> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const docRef = doc(db, 'ui_elements', cleanTenant);
      const payload = JSON.parse(
        JSON.stringify({
          tenantId: cleanTenant,
          elements: elements || [],
          _updatedAt: new Date().toISOString(),
        })
      );
      await setDoc(docRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('[Firestore] Save UI elements error:', err);
      return false;
    }
  }

  // ==========================================
  // TUTORIALS & VIDEOS SYNC
  // ==========================================
  public async saveTutorialToFirestore(tutorial: any): Promise<boolean> {
    try {
      const docId = tutorial.id || `tut_${Date.now()}`;
      const docRef = doc(db, 'tutorials', String(docId));
      await setDoc(docRef, {
        ...tutorial,
        id: docId,
        _updatedAt: new Date().toISOString()
      }, { merge: true });
      return true;
    } catch (err) {
      console.warn('[Firestore] Save tutorial error:', err);
      return false;
    }
  }

  /**
   * Saves the complete ordered list of tutorials to Firestore.
   * - When tenantId === 'main_portal_watch_videos', saves exclusively to `portal_settings/main_portal_watch_videos`
   *   and `settings/main_portal_watch_videos` (isolated for «شاهد شرح بالفيديو كيفية استخدام المنصة»).
   * - Otherwise, saves to `portal_settings/platform_tutorials`, `settings/platform_tutorials`, and `tutorials`
   *   collection (isolated for «تعلم كيفية استخدام المنصة»).
   */
  public async saveAllTutorialsToFirestore(tutorials: any[], lastUpdated?: string, tenantId?: string): Promise<boolean> {
    const isMainPortalWatch = (tenantId || '').trim() === 'main_portal_watch_videos';
    const docKey = isMainPortalWatch ? 'main_portal_watch_videos' : 'platform_tutorials';
    const timestamp = lastUpdated || new Date().toISOString();
    const normalized = (Array.isArray(tutorials) ? tutorials : []).map((t, idx) => ({
      ...t,
      order: idx + 1,
      updatedAt: t.updatedAt || timestamp,
    }));

    const payload = {
      tutorials: normalized,
      lastUpdated: timestamp,
      isCustomized: true,
      scope: docKey,
      _updatedAt: timestamp,
    };

    let savedMaster = false;
    try {
      await setDoc(doc(db, 'portal_settings', docKey), payload);
      savedMaster = true;
    } catch (err) {
      console.warn(`[Firestore] portal_settings/${docKey} save notice:`, err);
    }

    try {
      await setDoc(doc(db, 'settings', docKey), payload);
      savedMaster = true;
    } catch (err) {
      console.warn(`[Firestore] settings/${docKey} save notice:`, err);
    }

    // Only sync the `tutorials` collection for the association tutorials section («تعلم كيفية استخدام المنصة»)
    if (!isMainPortalWatch) {
      try {
        const keepIds = new Set(normalized.map((t) => String(t.id)));
        await Promise.all(
          normalized.map((tut) =>
            setDoc(
              doc(db, 'tutorials', String(tut.id)),
              {
                ...tut,
                id: String(tut.id),
                order: tut.order,
                _updatedAt: timestamp,
              },
              { merge: true }
            )
          )
        );

        const existingSnap = await getDocs(collection(db, 'tutorials'));
        const deletions: Promise<void>[] = [];
        existingSnap.forEach((docSnap) => {
          if (!keepIds.has(docSnap.id)) {
            deletions.push(deleteDoc(doc(db, 'tutorials', docSnap.id)));
          }
        });
        if (deletions.length > 0) {
          await Promise.all(deletions);
        }
        savedMaster = true;
      } catch (err) {
        console.warn('[Firestore] tutorials collection sync notice:', err);
      }
    }

    return savedMaster;
  }

  public async fetchPlatformTutorialsBundleFromFirestore(tenantId?: string): Promise<{
    tutorials: any[];
    lastUpdated: string;
    isCustomized: boolean;
  } | null> {
    const isMainPortalWatch = (tenantId || '').trim() === 'main_portal_watch_videos';
    const docKey = isMainPortalWatch ? 'main_portal_watch_videos' : 'platform_tutorials';

    // 1. Check authoritative bundle in portal_settings/{docKey}
    try {
      const portalSnap = await getDoc(doc(db, 'portal_settings', docKey));
      if (portalSnap.exists()) {
        const data = portalSnap.data();
        if (data && Array.isArray(data.tutorials)) {
          return {
            tutorials: data.tutorials,
            lastUpdated: data.lastUpdated || data._updatedAt || '2020-01-01T00:00:00.000Z',
            isCustomized: data.isCustomized === true,
          };
        }
      }
    } catch (err) {
      console.warn(`[Firestore] Read portal_settings/${docKey} notice:`, err);
    }

    // 2. Fallback to settings/{docKey}
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', docKey));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        if (data && Array.isArray(data.tutorials)) {
          return {
            tutorials: data.tutorials,
            lastUpdated: data.lastUpdated || data._updatedAt || '2020-01-01T00:00:00.000Z',
            isCustomized: data.isCustomized === true,
          };
        }
      }
    } catch (err) {
      console.warn(`[Firestore] Read settings/${docKey} notice:`, err);
    }

    // 3. Fallback to individual documents in 'tutorials' collection ONLY for association tutorials
    if (!isMainPortalWatch) {
      try {
        const col = collection(db, 'tutorials');
        const snap = await getDocs(col);
        const list: any[] = [];
        let newestTimestamp = '2020-01-01T00:00:00.000Z';
        snap.forEach((d) => {
          const item = d.data();
          list.push(item);
          const itemTs = item._updatedAt || item.updatedAt || item.createdAt || '';
          if (itemTs > newestTimestamp) {
            newestTimestamp = itemTs;
          }
        });
        if (list.length > 0) {
          list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
          return {
            tutorials: list,
            lastUpdated: newestTimestamp,
            isCustomized: true,
          };
        }
      } catch (err) {
        console.warn('[Firestore] Fetch tutorials collection notice:', err);
      }
    }

    return null;
  }

  public async fetchTutorialsFromFirestore(tenantId?: string): Promise<any[]> {
    const bundle = await this.fetchPlatformTutorialsBundleFromFirestore(tenantId);
    return bundle ? bundle.tutorials : [];
  }

  public async deleteTutorialFromFirestore(tutorialId: string, tenantId?: string): Promise<void> {
    const isMainPortalWatch = (tenantId || '').trim() === 'main_portal_watch_videos';
    if (isMainPortalWatch) {
      return;
    }
    try {
      const docRef = doc(db, 'tutorials', String(tutorialId));
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('[Firestore] Delete tutorial notice:', err);
    }
  }

  // ==========================================
  // GENERIC TENANT COLLECTION SYNC HELPER
  // ==========================================
  private async syncTenantCollectionWithDeletions<T extends { id?: string }>(
    collectionName: string,
    tenantId: string,
    items: T[]
  ): Promise<boolean> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const col = collection(db, collectionName);
      const keepDocIds = new Set<string>();
      const nowIso = new Date().toISOString();

      for (const item of items || []) {
        if (!item || !item.id) continue;
        const docId = `${cleanTenant}_${item.id}`;
        keepDocIds.add(docId);
        const payload = JSON.parse(
          JSON.stringify({
            ...item,
            tenantId: cleanTenant,
            _updatedAt: nowIso,
          })
        );
        await setDoc(doc(col, docId), payload, { merge: true });
      }

      try {
        const q = query(col, where('tenantId', '==', cleanTenant));
        const existingSnap = await getDocs(q);
        const deletions: Promise<void>[] = [];
        existingSnap.forEach((docSnap) => {
          if (!keepDocIds.has(docSnap.id)) {
            deletions.push(deleteDoc(doc(col, docSnap.id)));
          }
        });
        if (deletions.length > 0) {
          await Promise.all(deletions);
        }
      } catch {}

      return true;
    } catch (err) {
      console.warn(`[Firestore] Sync ${collectionName} error:`, err);
      return false;
    }
  }

  // ==========================================
  // FINANCIAL OPERATIONS SYNC
  // ==========================================
  public async saveOperationToFirestore(tenantId: string, operation: FinancialOperation): Promise<boolean> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const docRef = doc(db, 'operations', `${cleanTenant}_${operation.id}`);
      const payload = JSON.parse(
        JSON.stringify({
          ...operation,
          tenantId: cleanTenant,
          _updatedAt: new Date().toISOString(),
        })
      );
      await setDoc(docRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('[Firestore] Save operation error:', err);
      return false;
    }
  }

  public async syncOperationsToFirestore(tenantId: string, operations: FinancialOperation[]): Promise<boolean> {
    return this.syncTenantCollectionWithDeletions('operations', tenantId, operations);
  }

  public async deleteOperationFromFirestore(tenantId: string, operationId: string): Promise<void> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const docRef = doc(db, 'operations', `${cleanTenant}_${operationId}`);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('[Firestore] Delete operation error:', err);
    }
  }

  public async fetchOperationsFromFirestore(tenantId: string): Promise<FinancialOperation[]> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const col = collection(db, 'operations');
      const q = query(col, where('tenantId', '==', cleanTenant));
      const snap = await getDocs(q);
      const ops: FinancialOperation[] = [];
      snap.forEach(d => ops.push(d.data() as FinancialOperation));
      return ops;
    } catch (err) {
      console.warn('[Firestore] Fetch operations error:', err);
      return [];
    }
  }

  // ==========================================
  // MEMBERS, BOARD MEMBERS & SUB-ADMINS SYNC
  // ==========================================
  public async syncMembersToFirestore(tenantId: string, members: Member[]): Promise<boolean> {
    return this.syncTenantCollectionWithDeletions('members', tenantId, members);
  }

  public async fetchMembersFromFirestore(tenantId: string): Promise<Member[]> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const col = collection(db, 'members');
      const q = query(col, where('tenantId', '==', cleanTenant));
      const snap = await getDocs(q);
      const members: Member[] = [];
      snap.forEach(d => members.push(d.data() as Member));
      return members;
    } catch (err) {
      console.warn('[Firestore] Fetch members error:', err);
      return [];
    }
  }

  public async syncBoardMembersToFirestore(tenantId: string, boardMembers: BoardMember[]): Promise<boolean> {
    return this.syncTenantCollectionWithDeletions('board_members', tenantId, boardMembers);
  }

  public async syncSubAdminsToFirestore(tenantId: string, subAdmins: SubAdmin[]): Promise<boolean> {
    return this.syncTenantCollectionWithDeletions('sub_admins', tenantId, subAdmins);
  }

  public async fetchSubAdminsFromFirestore(tenantId: string): Promise<SubAdmin[]> {
    try {
      const cleanTenant = !tenantId || tenantId === 'portal' ? 'tenant_nour' : tenantId;
      const col = collection(db, 'sub_admins');
      const q = query(col, where('tenantId', '==', cleanTenant));
      const snap = await getDocs(q);
      const list: SubAdmin[] = [];
      snap.forEach((d) => {
        const data = d.data() as SubAdmin;
        if (data && data.id) {
          list.push(data);
        }
      });
      return list;
    } catch (err) {
      console.warn('[Firestore] Fetch subAdmins error:', err);
      return [];
    }
  }

  public async deleteSubAdminFromFirestore(tenantId: string, adminId: string): Promise<void> {
    try {
      const cleanTenant = !tenantId || tenantId === 'portal' ? 'tenant_nour' : tenantId;
      const docRef = doc(db, 'sub_admins', `${cleanTenant}_${adminId}`);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('[Firestore] Delete subAdmin notice:', err);
    }
  }

  // ==========================================
  // CAMPAIGNS, CONTRIBUTIONS & POLLS SYNC
  // ==========================================
  public async syncCampaignsToFirestore(tenantId: string, campaigns: DonationCampaign[]): Promise<boolean> {
    return this.syncTenantCollectionWithDeletions('campaigns', tenantId, campaigns);
  }

  public async fetchCampaignsFromFirestore(tenantId: string): Promise<DonationCampaign[]> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const col = collection(db, 'campaigns');
      const q = query(col, where('tenantId', '==', cleanTenant));
      const snap = await getDocs(q);
      const list: DonationCampaign[] = [];
      snap.forEach((d) => list.push(d.data() as DonationCampaign));
      return list;
    } catch (err) {
      console.warn('[Firestore] Fetch campaigns error:', err);
      return [];
    }
  }

  public async deleteCampaignFromFirestore(tenantId: string, campaignId: string): Promise<void> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const docRef = doc(db, 'campaigns', `${cleanTenant}_${campaignId}`);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('[Firestore] Delete campaign notice:', err);
    }
  }

  public async syncContributionsToFirestore(tenantId: string, contributions: MemberContribution[]): Promise<boolean> {
    return this.syncTenantCollectionWithDeletions('contributions', tenantId, contributions);
  }

  public async saveMemberCardSettingsToFirestore(tenantId: string, cardSettings: any): Promise<boolean> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const docRef = doc(db, 'settings', `${cleanTenant}_member_card`);
      const payload = JSON.parse(
        JSON.stringify({
          ...cardSettings,
          tenantId: cleanTenant,
          _updatedAt: new Date().toISOString(),
        })
      );
      await setDoc(docRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('[Firestore] Save member card settings error:', err);
      return false;
    }
  }

  public async fetchMemberCardSettingsFromFirestore(tenantId: string): Promise<any | null> {
    try {
      const cleanTenant = tenantId || 'tenant_nour';
      const docRef = doc(db, 'settings', `${cleanTenant}_member_card`);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[Firestore] Fetch member card settings error:', err);
      return null;
    }
  }

  public async syncPollsToFirestore(tenantId: string, polls: Poll[]): Promise<boolean> {
    return this.syncTenantCollectionWithDeletions('polls', tenantId, polls);
  }

  // ==========================================
  // PORTAL & PLATFORM IDENTITY SYNC
  // ==========================================
  public async savePortalSettingsToFirestore(portalSettings: any): Promise<boolean> {
    try {
      const docRef = doc(db, 'portal_settings', 'main');
      const payload = JSON.parse(
        JSON.stringify({
          ...portalSettings,
          _updatedAt: new Date().toISOString(),
        })
      );
      await setDoc(docRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('[Firestore] Save portal settings error:', err);
      return false;
    }
  }

  public async fetchPortalSettingsFromFirestore(): Promise<any | null> {
    try {
      const docRef = doc(db, 'portal_settings', 'main');
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[Firestore] Fetch portal settings error:', err);
      return null;
    }
  }

  public async savePlatformIdentityToFirestore(identity: any): Promise<boolean> {
    try {
      const docRef = doc(db, 'platform_identity', 'main');
      const payload = JSON.parse(
        JSON.stringify({
          ...identity,
          _updatedAt: new Date().toISOString(),
        })
      );
      await setDoc(docRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('[Firestore] Save platform identity error:', err);
      return false;
    }
  }

  public async fetchPlatformIdentityFromFirestore(): Promise<any | null> {
    try {
      const docRef = doc(db, 'platform_identity', 'main');
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[Firestore] Fetch platform identity error:', err);
      return null;
    }
  }

  public async saveRegistrationFieldsToFirestore(
    tenantId: string,
    fields: any[],
    isGlobal: boolean = false
  ): Promise<boolean> {
    try {
      const cleanTenant = !tenantId || tenantId === 'portal' ? 'tenant_nour' : tenantId;
      const sanitizedFields = JSON.parse(JSON.stringify(Array.isArray(fields) ? fields : []));
      const updatedAt = new Date().toISOString();
      const docRef = doc(db, 'settings', `${cleanTenant}_registration_fields`);
      await setDoc(
        docRef,
        {
          tenantId: cleanTenant,
          registrationFields: sanitizedFields,
          _updatedAt: updatedAt,
        },
        { merge: true }
      );
      if (isGlobal) {
        const globalRef = doc(db, 'settings', 'global_registration_fields');
        await setDoc(
          globalRef,
          {
            tenantId: 'global',
            registrationFields: sanitizedFields,
            _updatedAt: updatedAt,
          },
          { merge: true }
        );
      }
      return true;
    } catch (err) {
      console.warn('[Firestore] Save registration fields error:', err);
      return false;
    }
  }

  public async fetchRegistrationFieldsFromFirestore(tenantId?: string): Promise<any[] | null> {
    try {
      if (tenantId === 'global') {
        const globalSnap = await getDoc(doc(db, 'settings', 'global_registration_fields'));
        if (globalSnap.exists() && Array.isArray(globalSnap.data()?.registrationFields)) {
          return globalSnap.data().registrationFields;
        }
        return null;
      }
      const cleanTenant = !tenantId || tenantId === 'portal' ? 'tenant_nour' : tenantId;
      const docSnap = await getDoc(doc(db, 'settings', `${cleanTenant}_registration_fields`));
      if (docSnap.exists() && Array.isArray(docSnap.data()?.registrationFields)) {
        return docSnap.data().registrationFields;
      }
      const globalSnap = await getDoc(doc(db, 'settings', 'global_registration_fields'));
      if (globalSnap.exists() && Array.isArray(globalSnap.data()?.registrationFields)) {
        return globalSnap.data().registrationFields;
      }
      return null;
    } catch (err) {
      console.warn('[Firestore] Fetch registration fields error:', err);
      return null;
    }
  }

  // ==========================================
  // MEDIA UPLOAD WITH STORAGE & FIRESTORE LOG
  // ==========================================
  public async uploadMediaPermanently(
    fileOrBase64: File | Blob | string, 
    fileName: string, 
    category = 'images',
    tenantId?: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    try {
      const cleanName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const url = await uploadToFirebaseStorage(fileOrBase64, category, {
        tenantId,
        category,
        fileName: cleanName,
        onProgress: (pct) => onProgress?.(pct),
      });
      return url;
    } catch (storageErr) {
      console.warn('[Firebase Storage] Primary upload failed, will fallback to server disk API:', storageErr);
      throw storageErr;
    }
  }
}

export const firestoreSyncService = new FirestoreSyncService();
