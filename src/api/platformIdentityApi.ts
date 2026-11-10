import { useState, useEffect } from 'react';
import type { PlatformIdentitySettings, MasterAdminSession } from '../types';

export const PLATFORM_IDENTITY_STORAGE_KEY = 'smart_platform_identity_v1';
export const PLATFORM_IDENTITY_EVENT = 'platform-identity-changed';

export const DEFAULT_PLATFORM_IDENTITY: PlatformIdentitySettings = {
  platformName: 'syoumax منصة العمل الجمعوي',
  platformLogo: '',
  whatsapp: '00212718861646',
  associationsWhatsapp: '00212718861646',
  hasCustomPin: false,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System',
};

function normalizeBrandName(name?: string): string {
  if (!name) return DEFAULT_PLATFORM_IDENTITY.platformName;
  if (name === 'منظومة الجنى الرقمية للعمل الجمعوي') {
    return DEFAULT_PLATFORM_IDENTITY.platformName;
  }
  return name.replace(/\byoux\b/gi, 'syoumax').replace(/\bAljana\b/gi, 'syoumax');
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

/**
 * Fetches fresh identity settings from backend database
 */
export async function fetchPlatformIdentity(): Promise<PlatformIdentitySettings> {
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
        const fresh: PlatformIdentitySettings = {
          platformName: normalizeBrandName(data.identity.platformName),
          platformLogo: data.identity.platformLogo || '',
          whatsapp: data.identity.whatsapp || DEFAULT_PLATFORM_IDENTITY.whatsapp,
          associationsWhatsapp: data.identity.associationsWhatsapp || data.identity.whatsapp || DEFAULT_PLATFORM_IDENTITY.associationsWhatsapp,
          hasCustomPin: Boolean(data.identity.hasCustomPin),
          updatedAt: data.identity.updatedAt,
          updatedBy: data.identity.updatedBy,
        };
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

        if (hasDifferences && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(PLATFORM_IDENTITY_EVENT, { detail: fresh }));
        }
        return fresh;
      }
    }
  } catch (err) {
    console.warn('[PlatformIdentityApi] Failed to fetch identity from backend:', err);
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
 * Updates Platform Logo (Super Admin only)
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
      return { success: false, error: data.error || 'فشل حفظ وتحديث الشعار' };
    }
    const fresh = await fetchPlatformIdentity();
    return {
      success: true,
      logo: fresh.platformLogo,
      message: data.message || 'تم حفظ تعديل شعار المنصة بنجاح ✅',
    };
  } catch (err: any) {
    console.error('[PlatformIdentityApi] updatePlatformLogo error:', err);
    return { success: false, error: err.message || 'حدث خطأ أثناء حفظ الشعار' };
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
