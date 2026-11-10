import { PlatformSubAdmin, PlatformPermissionKey, PlatformAdminAuditLog, MasterAdminSession } from '../types';

function getAuthHeaders(session?: MasterAdminSession | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (session) {
    headers['x-admin-session'] = encodeURIComponent(JSON.stringify(session));
  }
  return headers;
}

/**
 * Fetch all platform secondary admins
 */
export async function apiFetchPlatformSubAdmins(
  session?: MasterAdminSession | null
): Promise<{ success: boolean; subAdmins?: PlatformSubAdmin[]; error?: string }> {
  try {
    const res = await fetch('/api/platform-subadmins', {
      method: 'GET',
      headers: getAuthHeaders(session),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, subAdmins: data.subAdmins };
    }
    return { success: false, error: data.error || 'فشل جلب قائمة الأدمن المساعدين' };
  } catch (err: any) {
    console.warn('[PlatformSubAdminsAPI] Fetch error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Create a new secondary admin
 */
export async function apiCreatePlatformSubAdmin(
  newAdmin: {
    fullName: string;
    phone: string;
    password: string;
    status: 'active' | 'inactive';
    notes?: string;
    permissions: Record<PlatformPermissionKey, boolean>;
  },
  session?: MasterAdminSession | null
): Promise<{ success: boolean; subAdmin?: PlatformSubAdmin; subAdmins?: PlatformSubAdmin[]; error?: string }> {
  try {
    const res = await fetch('/api/platform-subadmins', {
      method: 'POST',
      headers: getAuthHeaders(session),
      body: JSON.stringify(newAdmin),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, subAdmin: data.subAdmin, subAdmins: data.subAdmins };
    }
    return { success: false, error: data.error || 'فشل إنشاء حساب الأدمن' };
  } catch (err: any) {
    console.error('[PlatformSubAdminsAPI] Create error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Update an existing secondary admin details
 */
export async function apiUpdatePlatformSubAdmin(
  id: string,
  updatedData: {
    fullName?: string;
    phone?: string;
    password?: string;
    status?: 'active' | 'inactive';
    notes?: string;
    permissions?: Record<PlatformPermissionKey, boolean>;
  },
  session?: MasterAdminSession | null
): Promise<{ success: boolean; subAdmin?: PlatformSubAdmin; subAdmins?: PlatformSubAdmin[]; error?: string }> {
  try {
    const res = await fetch(`/api/platform-subadmins/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(session),
      body: JSON.stringify(updatedData),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, subAdmin: data.subAdmin, subAdmins: data.subAdmins };
    }
    return { success: false, error: data.error || 'فشل تحديث بيانات الأدمن' };
  } catch (err: any) {
    console.error('[PlatformSubAdminsAPI] Update error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Toggle secondary admin status (active / inactive)
 */
export async function apiTogglePlatformSubAdminStatus(
  id: string,
  status: 'active' | 'inactive',
  session?: MasterAdminSession | null
): Promise<{ success: boolean; status?: 'active' | 'inactive'; subAdmins?: PlatformSubAdmin[]; error?: string }> {
  try {
    const res = await fetch(`/api/platform-subadmins/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(session),
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, status: data.status, subAdmins: data.subAdmins };
    }
    return { success: false, error: data.error || 'فشل تغيير حالة الأدمن' };
  } catch (err: any) {
    console.error('[PlatformSubAdminsAPI] Status toggle error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Update secondary admin permissions
 */
export async function apiUpdatePlatformSubAdminPermissions(
  id: string,
  permissions: Record<PlatformPermissionKey, boolean>,
  session?: MasterAdminSession | null
): Promise<{ success: boolean; permissions?: Record<PlatformPermissionKey, boolean>; subAdmins?: PlatformSubAdmin[]; error?: string }> {
  try {
    const res = await fetch(`/api/platform-subadmins/${encodeURIComponent(id)}/permissions`, {
      method: 'PATCH',
      headers: getAuthHeaders(session),
      body: JSON.stringify({ permissions }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, permissions: data.permissions, subAdmins: data.subAdmins };
    }
    return { success: false, error: data.error || 'فشل تحديث صلاحيات الأدمن' };
  } catch (err: any) {
    console.error('[PlatformSubAdminsAPI] Permissions error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Delete a secondary admin
 */
export async function apiDeletePlatformSubAdmin(
  id: string,
  session?: MasterAdminSession | null
): Promise<{ success: boolean; subAdmins?: PlatformSubAdmin[]; error?: string }> {
  try {
    const res = await fetch(`/api/platform-subadmins/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(session),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, subAdmins: data.subAdmins };
    }
    return { success: false, error: data.error || 'فشل حذف حساب الأدمن' };
  } catch (err: any) {
    console.error('[PlatformSubAdminsAPI] Delete error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Login secondary admin using phone and password
 */
export async function apiLoginPlatformSubAdmin(
  phone: string,
  password: string
): Promise<{ success: boolean; admin?: PlatformSubAdmin; error?: string }> {
  try {
    const res = await fetch('/api/platform-subadmins/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, admin: data.admin };
    }
    return { success: false, error: data.error || 'فشل تسجيل الدخول' };
  } catch (err: any) {
    console.error('[PlatformSubAdminsAPI] Login error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Fetch platform admin activity logs
 */
export async function apiFetchPlatformAuditLogs(): Promise<{ success: boolean; logs?: PlatformAdminAuditLog[]; error?: string }> {
  try {
    const res = await fetch('/api/platform-admin-audit-logs', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, logs: data.logs };
    }
    return { success: false, error: data.error || 'فشل جلب سجل العمليات الإدارية' };
  } catch (err: any) {
    console.warn('[PlatformSubAdminsAPI] Fetch logs error:', err);
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

/**
 * Record an activity log
 */
export async function apiLogPlatformAdminActivity(
  entry: {
    action: string;
    actionKey?: PlatformAdminAuditLog['actionKey'];
    targetItem: string;
    result?: 'success' | 'failed';
    details?: string;
    adminId?: string;
    adminName?: string;
    adminPhone?: string;
    adminRole?: 'super_admin' | 'secondary_admin';
  },
  session?: MasterAdminSession | null
): Promise<{ success: boolean; log?: PlatformAdminAuditLog; error?: string }> {
  try {
    const payload = {
      ...entry,
      adminId: entry.adminId || session?.id || 'super-admin',
      adminName: entry.adminName || session?.fullName || (session?.isMaster ? 'Super Admin' : 'أدمن مساعد'),
      adminPhone: entry.adminPhone || session?.phone || '',
      adminRole: entry.adminRole || session?.role || (session?.isMaster ? 'super_admin' : 'secondary_admin'),
      result: entry.result || 'success',
    };

    const res = await fetch('/api/platform-admin-audit-logs', {
      method: 'POST',
      headers: getAuthHeaders(session),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, log: data.log };
    }
    return { success: false, error: data.error };
  } catch (err: any) {
    console.warn('[PlatformSubAdminsAPI] Log activity error:', err);
    return { success: false, error: err?.message };
  }
}

// Re-export Unified Login for convenience
export { apiUnifiedMasterAdminLogin } from './platformIdentityApi';
export type { UnifiedLoginResult } from './platformIdentityApi';
