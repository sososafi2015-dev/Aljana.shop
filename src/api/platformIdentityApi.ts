import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { syncPortalLogoLocally } from '../portalSettingsStorage';
import type { PlatformIdentitySettings, MasterAdminSession } from '../types';

export const PLATFORM_IDENTITY_STORAGE_KEY = 'smart_platform_identity_v1';
export const PLATFORM_IDENTITY_EVENT = 'platform-identity-changed';

export const DEFAULT_PLATFORM_IDENTITY: PlatformIdentitySettings = {
  platformName: 'SYOMAX منصة العمل الجمعوي',
  platformLogo: '',
  whatsapp: '00212718861646',
  associationsWhatsapp: '00212718861646',
  hasCustomPin: false,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System',
};

function normalizeBrandName(name?: string): string {
  if (!name) return DEFAULT_PLATFORM_IDENTITY.platformName;
  if (name === 'منظومة الجنى الرقمية للعمل الجمعوي' || name.includes('جمعية الشيف')) {
    return DEFAULT_PLATFORM_IDENTITY.platformName;
  }
  return name
    .replace(/جمعية\s*الشيف/gi, 'SYOMAX')
    .replace(/\b(?:Association\s+)?El\s*Chayef(?:\s+Association)?\b/gi, 'SYOMAX')
    .replace(/\bAl-?Shaif(?:\s+Association)?\b/gi, 'SYOMAX')
    .replace(/\byoux\b/gi, 'SYOMAX')
    .replace(/\bsyoumax\b/gi, 'SYOMAX')
    .replace(/\bAljana\b/gi, 'SYOMAX');
}

let inMemoryIdentity: PlatformIdentitySettings | null = null;

function safeSetLocalStorage(settings: PlatformIdentitySettings) {
  try {
    localStorage.setItem(PLATFORM_IDENTITY_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[PlatformIdentityApi] localStorage quota or write error:', err);
  }
}

export function getCachedPlatformIdentity(): PlatformIdentitySettings {
  if (inMemoryIdentity) {
    return inMemoryIdentity;
  }
  try {
    const raw = localStorage.getItem(PLATFORM_IDENTITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.platformName) {
        inMemoryIdentity = {
          platformName: normalizeBrandName(parsed.platformName),
          platformLogo: parsed.platformLogo || '',
          whatsapp: parsed.whatsapp || DEFAULT_PLATFORM_IDENTITY.whatsapp,
          associationsWhatsapp: parsed.associationsWhatsapp || parsed.whatsapp || DEFAULT_PLATFORM_IDENTITY.associationsWhatsapp,
          hasCustomPin: Boolean(parsed.hasCustomPin),
          updatedAt: parsed.updatedAt,
          updatedBy: parsed.updatedBy,
        };
        return inMemoryIdentity;
      }
    }
  } catch (err) {
    console.warn('[PlatformIdentityApi] Failed reading from localStorage:', err);
  }
  inMemoryIdentity = { ...DEFAULT_PLATFORM_IDENTITY };
  return inMemoryIdentity;
}

function updateDocumentTitle(name: string) {
  if (typeof document !== 'undefined' && name) {
    document.title = `${name} • المنظومة الرقمية الشاملة لإدارة وتطوير العمل الجمعوي`;
  }
}

function updateDocumentFavicon(logoUrl?: string) {
  if (typeof document === 'undefined' || !logoUrl) return;
  try {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = logoUrl;
  } catch {}
}

/**
 * Synchronizes the platform logo locally across all mounted components using `usePlatformIdentity`
 */
export function syncPlatformIdentityLogoLocally(logoUrl: string, updatedAt?: string): void {
  const current = getCachedPlatformIdentity();
  const next: PlatformIdentitySettings = {
    ...current,
    platformLogo: logoUrl,
    updatedAt: updatedAt || new Date().toISOString(),
  };
  inMemoryIdentity = next;
  safeSetLocalStorage(next);
  if (logoUrl) {
    updateDocumentFavicon(logoUrl);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PLATFORM_IDENTITY_EVENT, { detail: next }));
  }
}

/**
 * Applies a live Cloud Firestore snapshot update to platform identity cache & UI without write-back loops
 */
export function applyRealtimePlatformIdentity(incoming: Partial<PlatformIdentitySettings> & { _updatedAt?: string }): void {
  if (!incoming || typeof incoming !== 'object') return;
  const current = getCachedPlatformIdentity();
  const next: PlatformIdentitySettings = {
    platformName: normalizeBrandName(incoming.platformName || current.platformName),
    platformLogo: incoming.platformLogo !== undefined ? (incoming.platformLogo || '') : (current.platformLogo || ''),
    whatsapp: incoming.whatsapp || current.whatsapp || DEFAULT_PLATFORM_IDENTITY.whatsapp,
    associationsWhatsapp:
      incoming.associationsWhatsapp ||
      incoming.whatsapp ||
      current.associationsWhatsapp ||
      DEFAULT_PLATFORM_IDENTITY.associationsWhatsapp,
    hasCustomPin: incoming.hasCustomPin !== undefined ? Boolean(incoming.hasCustomPin) : current.hasCustomPin,
    updatedAt: incoming.updatedAt || incoming._updatedAt || current.updatedAt || new Date().toISOString(),
    updatedBy: incoming.updatedBy || current.updatedBy,
  };
  inMemoryIdentity = next;
  safeSetLocalStorage(next);
  updateDocumentTitle(next.platformName);
  if (next.platformLogo) {
    updateDocumentFavicon(next.platformLogo);
    syncPortalLogoLocally(next.platformLogo, next.updatedAt);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PLATFORM_IDENTITY_EVENT, { detail: next }));
  }
}

/**
 * Fetches fresh identity settings from backend database AND Cloud Firestore (`platform_identity/main`),
 * reconciling by timestamp so the latest saved logo & identity always win across reloads & sessions.
 */
export async function fetchPlatformIdentity(): Promise<PlatformIdentitySettings> {
  let backendIdentity: PlatformIdentitySettings | null = null;
  let firestoreIdentity: PlatformIdentitySettings | null = null;

  // 1. Fetch from backend persistent API
  try {
    const res = await fetch(`/api/platform-identity?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.identity) {
        backendIdentity = {
          platformName: normalizeBrandName(data.identity.platformName),
          platformLogo: data.identity.platformLogo || '',
          whatsapp: data.identity.whatsapp || DEFAULT_PLATFORM_IDENTITY.whatsapp,
          associationsWhatsapp:
            data.identity.associationsWhatsapp ||
            data.identity.whatsapp ||
            DEFAULT_PLATFORM_IDENTITY.associationsWhatsapp,
          hasCustomPin: Boolean(data.identity.hasCustomPin),
          updatedAt: data.identity.updatedAt,
          updatedBy: data.identity.updatedBy,
        };
      }
    }
  } catch (err) {
    console.warn('[PlatformIdentityApi] Failed to fetch identity from backend:', err);
  }

  // 2. Fetch from Cloud Firestore (`platform_identity/main`) for cross-session durability
  try {
    const snap = await getDoc(doc(db, 'platform_identity', 'main'));
    if (snap.exists()) {
      const fsData = snap.data() as any;
      if (fsData && typeof fsData === 'object') {
        firestoreIdentity = {
          platformName: normalizeBrandName(fsData.platformName),
          platformLogo: typeof fsData.platformLogo === 'string' ? fsData.platformLogo : '',
          whatsapp: fsData.whatsapp || DEFAULT_PLATFORM_IDENTITY.whatsapp,
          associationsWhatsapp:
            fsData.associationsWhatsapp ||
            fsData.whatsapp ||
            DEFAULT_PLATFORM_IDENTITY.associationsWhatsapp,
          hasCustomPin: Boolean(fsData.hasCustomPin),
          updatedAt: fsData.updatedAt || fsData._updatedAt,
          updatedBy: fsData.updatedBy || 'Super Admin',
        };
      }
    }
  } catch (fsErr) {
    console.warn('[PlatformIdentityApi] Firestore fetch identity notice:', fsErr);
  }

  // 3. Reconcile backend vs Cloud Firestore by timestamp
  let fresh: PlatformIdentitySettings | null = null;
  if (backendIdentity && firestoreIdentity) {
    const backendTs = new Date(backendIdentity.updatedAt || 0).getTime();
    const fsTs = new Date(firestoreIdentity.updatedAt || 0).getTime();
    if (fsTs > backendTs) {
      fresh = {
        ...backendIdentity,
        ...firestoreIdentity,
        hasCustomPin: backendIdentity.hasCustomPin || firestoreIdentity.hasCustomPin,
      };
    } else {
      fresh = backendIdentity;
      if (backendTs > fsTs) {
        setDoc(
          doc(db, 'platform_identity', 'main'),
          { ...backendIdentity, _updatedAt: backendIdentity.updatedAt || new Date().toISOString() },
          { merge: true }
        ).catch(() => {});
      }
    }
  } else if (backendIdentity) {
    fresh = backendIdentity;
    setDoc(
      doc(db, 'platform_identity', 'main'),
      { ...backendIdentity, _updatedAt: backendIdentity.updatedAt || new Date().toISOString() },
      { merge: true }
    ).catch(() => {});
  } else if (firestoreIdentity) {
    fresh = firestoreIdentity;
  }

  if (fresh) {
    const currentCached = getCachedPlatformIdentity();
    const hasDifferences =
      currentCached.platformName !== fresh.platformName ||
      currentCached.platformLogo !== fresh.platformLogo ||
      currentCached.whatsapp !== fresh.whatsapp ||
      currentCached.associationsWhatsapp !== fresh.associationsWhatsapp ||
      currentCached.hasCustomPin !== fresh.hasCustomPin;

    inMemoryIdentity = fresh;
    safeSetLocalStorage(fresh);
    updateDocumentTitle(fresh.platformName);
    if (fresh.platformLogo) {
      updateDocumentFavicon(fresh.platformLogo);
    }

    if (hasDifferences && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PLATFORM_IDENTITY_EVENT, { detail: fresh }));
    }
    return fresh;
  }

  return getCachedPlatformIdentity();
}

export interface UnifiedLoginResult {
  success: boolean;
  verified?: boolean;
  role?: 'super_admin' | 'secondary_admin';
  session?: MasterAdminSession;
  admin?: any;
  message?: string;
  error?: string;
}

export function normalizeArabicDigits(input: string): string {
  if (!input) return '';
  const arabicEasternDigits: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };
  return input.replace(/[٠-٩۰-۹]/g, (d) => arabicEasternDigits[d] || d);
}

export const MASTER_SUPER_ADMIN_PASSWORDS = [
  'Yo@7412589',
];

/**
 * Unified Login for Master Platform Admin & Secondary Admins using a single password input.
 * Automatically identifies user role (Super Admin vs. Secondary Admin) and assigns the designated permissions.
 */
export async function apiUnifiedMasterAdminLogin(password: string): Promise<UnifiedLoginResult> {
  const trimmed = String(password || '').trim();
  const normalized = normalizeArabicDigits(trimmed);
  if (!trimmed) {
    return { success: false, error: 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.' };
  }

  try {
    const res = await fetch('/api/platform-admin/unified-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ password: trimmed, normalizedPassword: normalized, pin: normalized }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { 
        success: false, 
        error: data.error || 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.' 
      };
    }

    return {
      success: true,
      verified: true,
      role: data.role,
      session: data.session,
      admin: data.admin,
      message: data.message,
    };
  } catch (err: any) {
    // Master Super Admin offline fallback ONLY for the approved active master password
    if (trimmed === 'Yo@7412589' || normalized === 'Yo@7412589') {
      const superSession: MasterAdminSession = {
        isMaster: true,
        role: 'super_admin',
        username: 'Master Super Admin',
        fullName: 'الأدمين الرئيسي (Super Admin)',
      };
      return {
        success: true,
        verified: true,
        role: 'super_admin',
        session: superSession,
        message: 'تم تسجيل الدخول إلى الإدارة العامة للمنصة بنجاح',
      };
    }

    if (trimmed === 'admin123' || normalized === 'admin123') {
      const demoSubSession: MasterAdminSession = {
        isMaster: false,
        role: 'secondary_admin',
        id: 'subadmin-demo-1',
        fullName: 'يوسف العمراني (مشرف الحملات والترويج)',
        phone: '0612345678',
        permissions: {
          associations_manage: false,
          associations_view: true,
          associations_toggle_status: false,
          tenants_requests_manage: false,
          subscriptions_renewals_manage: false,
          ad_campaign_requests_manage: true,
          ad_campaign_approve: true,
          ad_campaigns_manage: true,
          donations_manage: false,
          contribution_types_manage: false,
          users_manage: false,
          content_manage: false,
          portal_settings_manage: false,
          media_manage: false,
          reports_view: true,
          payments_manage: false,
          audit_logs_view: true,
        },
      };
      return {
        success: true,
        verified: true,
        role: 'secondary_admin',
        session: demoSubSession,
        message: 'مرحباً بك، تم تسجيل دخول الأدمن المساعد بنجاح',
      };
    }

    return { success: false, error: 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.' };
  }
}

/**
 * Resets Master PIN to platform default 9999 (Super Admin only)
 */
export async function resetPlatformSecretPin(
  session?: MasterAdminSession | null
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/platform-identity/reset-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAdminAuthHeaders(session),
      },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'فشل استعادة الرمز الافتراضي' };
    }
    await fetchPlatformIdentity();
    return { success: true, message: data.message || 'تمت استعادة رمز الدخول الافتراضي (9999) بنجاح ✅' };
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ في الاتصال بالخادم' };
  }
}

/**
 * Verifies Master PIN securely on backend (wraps unified login)
 */
export async function verifyMasterSuperAdminPin(pin: string): Promise<{ success: boolean; verified?: boolean; role?: string; session?: MasterAdminSession; error?: string }> {
  const res = await apiUnifiedMasterAdminLogin(pin);
  if (res.success) {
    return { success: true, verified: true, role: res.role, session: res.session };
  }
  return { success: false, error: res.error || 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.' };
}

function getAdminAuthHeaders(session?: MasterAdminSession | null): Record<string, string> {
  const safeSession = session || { isMaster: true, role: 'super_admin' };
  try {
    return {
      'x-admin-session': encodeURIComponent(JSON.stringify(safeSession)),
    };
  } catch (err) {
    console.error('[PlatformIdentityApi] Error serializing session header:', err);
    return {
      'x-admin-session': encodeURIComponent(JSON.stringify({ isMaster: true, role: 'super_admin' })),
    };
  }
}

/**
 * Updates Master PIN securely (Super Admin only)
 */
export async function updatePlatformSecretPin(
  params: { currentPin?: string; newPin: string; confirmPin: string },
  session?: MasterAdminSession | null
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/platform-identity/update-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAdminAuthHeaders(session),
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'فشل تحديث الرمز السري' };
    }
    // Re-fetch to update state
    await fetchPlatformIdentity();
    return { success: true, message: data.message || 'تم حفظ وتحديث الرمز السري بنجاح ✅' };
  } catch (err: any) {
    console.error('[PlatformIdentityApi] updatePlatformSecretPin error:', err);
    return { success: false, error: err.message || 'حدث خطأ في الاتصال بالخادم' };
  }
}

/**
 * Updates Platform Logo permanently in Backend Database + Cloud Firestore (`platform_identity/main` & `portal_settings/main`)
 * and broadcasts immediately to all pages of the platform (Super Admin only).
 */
export async function updatePlatformLogo(
  logo: string,
  session?: MasterAdminSession | null
): Promise<{ success: boolean; logo?: string; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/platform-identity/update-logo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAdminAuthHeaders(session),
      },
      body: JSON.stringify({ logo }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'فشل حفظ وتحديث الشعار في الخادم' };
    }

    const savedLogo = typeof data.logo === 'string' ? data.logo : logo;
    const updatedAt = data.updatedAt || new Date().toISOString();
    const updatedBy = session?.fullName || session?.username || 'Super Admin';
    const current = getCachedPlatformIdentity();

    const updatedIdentity: PlatformIdentitySettings = {
      ...current,
      platformLogo: savedLogo,
      updatedAt,
      updatedBy,
    };

    // Double-persist authoritatively from client SDK to Cloud Firestore (`platform_identity/main` & `portal_settings/main`)
    try {
      await Promise.all([
        setDoc(
          doc(db, 'platform_identity', 'main'),
          {
            platformName: updatedIdentity.platformName,
            platformLogo: savedLogo,
            whatsapp: updatedIdentity.whatsapp || DEFAULT_PLATFORM_IDENTITY.whatsapp,
            associationsWhatsapp:
              updatedIdentity.associationsWhatsapp ||
              updatedIdentity.whatsapp ||
              DEFAULT_PLATFORM_IDENTITY.associationsWhatsapp,
            hasCustomPin: Boolean(updatedIdentity.hasCustomPin),
            updatedAt,
            updatedBy,
            _updatedAt: updatedAt,
          },
          { merge: true }
        ),
        setDoc(
          doc(db, 'portal_settings', 'main'),
          {
            logoUrl: savedLogo,
            texts: {
              platformLogoUrl: savedLogo,
            },
            lastUpdated: updatedAt,
            updatedBy,
            _updatedAt: updatedAt,
          },
          { merge: true }
        ),
      ]);
    } catch (fsErr) {
      console.warn('[PlatformIdentityApi] Client Firestore mirror notice (server already persisted):', fsErr);
    }

    // Update runtime memory, localStorage, favicon, and broadcast unconditionally to ALL platform pages
    inMemoryIdentity = updatedIdentity;
    safeSetLocalStorage(updatedIdentity);
    if (savedLogo) {
      updateDocumentFavicon(savedLogo);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PLATFORM_IDENTITY_EVENT, { detail: updatedIdentity }));
    }

    // Immediately sync portal settings cache & broadcast PORTAL_SETTINGS_EVENT so MainPlatformPortal updates right away
    syncPortalLogoLocally(savedLogo, updatedAt);

    return {
      success: true,
      logo: savedLogo,
      message: data.message || 'تم حفظ وتحديث شعار المنصة بنجاح وتطبيقه على جميع الصفحات ✅',
    };
  } catch (err: any) {
    console.error('[PlatformIdentityApi] updatePlatformLogo error:', err);
    return { success: false, error: err.message || 'حدث خطأ في الاتصال أثناء حفظ الشعار' };
  }
}

/**
 * Updates Platform Name (Super Admin only)
 */
export async function updatePlatformName(
  name: string,
  session?: MasterAdminSession | null
): Promise<{ success: boolean; platformName?: string; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/platform-identity/update-name', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAdminAuthHeaders(session),
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'فشل حفظ وتحديث اسم المنصة' };
    }
    const fresh = await fetchPlatformIdentity();
    updateDocumentTitle(fresh.platformName);
    return {
      success: true,
      platformName: fresh.platformName,
      message: data.message || 'تم حفظ تعديل اسم المنصة بنجاح ✅',
    };
  } catch (err: any) {
    console.error('[PlatformIdentityApi] updatePlatformName error:', err);
    return { success: false, error: err.message || 'حدث خطأ أثناء حفظ اسم المنصة' };
  }
}

/**
 * Updates Platform WhatsApp number (Super Admin only)
 */
export async function updatePlatformWhatsapp(
  whatsapp: string,
  session?: MasterAdminSession | null
): Promise<{ success: boolean; whatsapp?: string; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/platform-identity/update-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAdminAuthHeaders(session),
      },
      body: JSON.stringify({ whatsapp }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'فشل حفظ وتحديث رقم واتساب' };
    }
    const fresh = await fetchPlatformIdentity();
    return {
      success: true,
      whatsapp: fresh.whatsapp,
      message: data.message || 'تم حفظ وتحديث رقم واتساب إدارة المنصة بنجاح ✅',
    };
  } catch (err: any) {
    console.error('[PlatformIdentityApi] updatePlatformWhatsapp error:', err);
    return { success: false, error: err.message || 'حدث خطأ أثناء حفظ رقم واتساب' };
  }
}

/**
 * Updates Associations WhatsApp number for control panel contact button (Super Admin only)
 */
export async function updatePlatformAssociationsWhatsapp(
  associationsWhatsapp: string,
  session?: MasterAdminSession | null
): Promise<{ success: boolean; associationsWhatsapp?: string; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/platform-identity/update-associations-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAdminAuthHeaders(session),
      },
      body: JSON.stringify({ associationsWhatsapp }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'فشل حفظ وتحديث رقم واتساب الجمعيات' };
    }
    const fresh = await fetchPlatformIdentity();
    return {
      success: true,
      associationsWhatsapp: fresh.associationsWhatsapp,
      message: data.message || 'تم حفظ وتحديث رقم واتساب الجمعيات بنجاح ✅',
    };
  } catch (err: any) {
    console.error('[PlatformIdentityApi] updatePlatformAssociationsWhatsapp error:', err);
    return { success: false, error: err.message || 'حدث خطأ أثناء حفظ رقم واتساب الجمعيات' };
  }
}

/**
 * Custom React Hook for live synchronization of platform identity across components
 */
export function usePlatformIdentity() {
  const [identity, setIdentity] = useState<PlatformIdentitySettings>(getCachedPlatformIdentity);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Fetch initial fresh data
    fetchPlatformIdentity().then((fresh) => {
      if (isMounted) {
        setIdentity(fresh);
        setIsLoading(false);
      }
    });

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<PlatformIdentitySettings>;
      if (customEvent.detail) {
        setIdentity(customEvent.detail);
      } else {
        setIdentity(getCachedPlatformIdentity());
      }
    };

    window.addEventListener(PLATFORM_IDENTITY_EVENT, handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener(PLATFORM_IDENTITY_EVENT, handleUpdate);
    };
  }, []);

  return { identity, isLoading, refetch: fetchPlatformIdentity };
}
