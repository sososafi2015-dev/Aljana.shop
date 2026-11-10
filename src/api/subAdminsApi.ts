import { SubAdmin, CurrentAdminSession } from '../types';

export interface SubAdminsWithMeta {
  subAdmins: SubAdmin[];
  lastUpdated?: string;
}

function getAuthHeaders(session?: CurrentAdminSession | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session) {
    headers['x-admin-session'] = encodeURIComponent(JSON.stringify(session));
  }
  let storedTenant: string | null = null;
  if (typeof localStorage !== 'undefined') {
    try {
      const rawV2 = localStorage.getItem('chayef_active_tenant_id_v2');
      storedTenant = rawV2 ? JSON.parse(rawV2) : localStorage.getItem('chayef_active_tenant_id');
    } catch {
      storedTenant = localStorage.getItem('chayef_active_tenant_id');
    }
  }
  const tenantId =
    session?.tenantId ||
    (storedTenant && storedTenant !== 'portal' ? storedTenant : null) ||
    'tenant_nour';
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }
  return headers;
}

/**
 * Fetch all sub-admins from the server database along with lastUpdated metadata
 */
export async function apiFetchSubAdminsWithMeta(): Promise<SubAdminsWithMeta | null> {
  try {
    const res = await fetch('/api/subadmins', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.subAdmins)) {
        return {
          subAdmins: data.subAdmins,
          lastUpdated: data.lastUpdated,
        };
      }
    }
  } catch (err) {
    console.warn('[SubAdminsAPI] Fetch subadmins failed, falling back to local storage:', err);
  }
  return null;
}

/**
 * Fetch list of sub-admins
 */
export async function apiFetchSubAdmins(): Promise<SubAdmin[] | null> {
  const meta = await apiFetchSubAdminsWithMeta();
  return meta ? meta.subAdmins : null;
}

/**
 * Sync entire sub-admins list with server database
 */
export async function apiSyncSubAdmins(
  subAdmins: SubAdmin[],
  session?: CurrentAdminSession | null
): Promise<{ success: boolean; subAdmins?: SubAdmin[]; error?: string }> {
  try {
    const res = await fetch('/api/subadmins/sync', {
      method: 'POST',
      headers: getAuthHeaders(session),
      body: JSON.stringify({ subAdmins }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, subAdmins: data.subAdmins };
    }
    return { success: false, error: data.error || 'فشلت مزامنة بيانات الأدمن' };
  } catch (err: any) {
    console.warn('[SubAdminsAPI] Sync error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Create a new sub-admin on the server database
 */
export async function apiCreateSubAdmin(
  newAdmin: SubAdmin,
  session?: CurrentAdminSession | null
): Promise<{ success: boolean; subAdmin?: SubAdmin; subAdmins?: SubAdmin[]; error?: string }> {
  try {
    const res = await fetch('/api/subadmins', {
      method: 'POST',
      headers: getAuthHeaders(session),
      body: JSON.stringify({ subAdmin: newAdmin }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, subAdmin: data.subAdmin, subAdmins: data.subAdmins };
    }
    return { success: false, error: data.error || 'فشل إنشاء حساب الأدمن في قاعدة البيانات' };
  } catch (err: any) {
    console.error('[SubAdminsAPI] Create error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Update an existing sub-admin in the server database
 */
export async function apiUpdateSubAdmin(
  admin: SubAdmin,
  session?: CurrentAdminSession | null
): Promise<{ success: boolean; subAdmins?: SubAdmin[]; error?: string }> {
  try {
    const res = await fetch(`/api/subadmins/${encodeURIComponent(admin.id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(session),
      body: JSON.stringify({ subAdmin: admin }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, subAdmins: data.subAdmins };
    }
    return { success: false, error: data.error || 'فشل تحديث بيانات الأدمن في قاعدة البيانات' };
  } catch (err: any) {
    console.error('[SubAdminsAPI] Update error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Toggle sub-admin active/disabled status in the server database
 */
export async function apiToggleSubAdminStatus(
  adminId: string,
  newStatus: 'active' | 'inactive',
  session?: CurrentAdminSession | null
): Promise<{ success: boolean; status?: 'active' | 'inactive'; subAdmins?: SubAdmin[]; error?: string }> {
  try {
    const res = await fetch(`/api/subadmins/${encodeURIComponent(adminId)}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(session),
      body: JSON.stringify({ status: newStatus }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        status: data.status,
        subAdmins: data.subAdmins,
      };
    }
    return { success: false, error: data.error || 'فشل تغيير حالة الأدمن في قاعدة البيانات' };
  } catch (err: any) {
    console.error('[SubAdminsAPI] Status toggle error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Permanently delete a sub-admin from the server database
 */
export async function apiDeleteSubAdmin(
  adminId: string,
  session?: CurrentAdminSession | null
): Promise<{ success: boolean; subAdmins?: SubAdmin[]; error?: string }> {
  try {
    const res = await fetch(`/api/subadmins/${encodeURIComponent(adminId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(session),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, subAdmins: data.subAdmins };
    }
    return { success: false, error: data.error || 'فشل حذف حساب الأدمن من قاعدة البيانات' };
  } catch (err: any) {
    console.error('[SubAdminsAPI] Delete error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}
