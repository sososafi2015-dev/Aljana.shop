import type { AssociationSettings } from '../types';
import { firestoreSyncService } from '../services/firestoreSyncService';

export interface SettingsApiResponse {
  success: boolean;
  settings?: AssociationSettings;
  message?: string;
  error?: string;
}

export interface SettingsWithMeta {
  settings: AssociationSettings;
  lastUpdated?: string;
}

export async function apiFetchSettingsWithMeta(tenantId?: string): Promise<SettingsWithMeta | null> {
  const activeTenant = tenantId || 'tenant_nour';
  try {
    const [res, firestoreSettings] = await Promise.all([
      fetch(`/api/settings?tenantId=${encodeURIComponent(activeTenant)}&ts=${Date.now()}`, {
        headers: {
          'Accept': 'application/json',
          'x-tenant-id': activeTenant,
        },
        cache: 'no-store',
      }).catch(() => null),
      firestoreSyncService.fetchSettingsFromFirestore(activeTenant).catch(() => null),
    ]);

    if (res && res.ok) {
      const data = await res.json();
      if (data.success && data.settings) {
        const serverTs = data.lastUpdated ? new Date(data.lastUpdated).getTime() : 0;
        const fbTs = (firestoreSettings as any)?._updatedAt
          ? new Date((firestoreSettings as any)._updatedAt).getTime()
          : 0;

        if (firestoreSettings && fbTs > serverTs) {
          return {
            settings: { ...data.settings, ...firestoreSettings },
            lastUpdated: (firestoreSettings as any)._updatedAt,
          };
        }

        return {
          settings: data.settings,
          lastUpdated: data.lastUpdated,
        };
      }
    }

    if (firestoreSettings) {
      return {
        settings: firestoreSettings,
        lastUpdated: (firestoreSettings as any)._updatedAt,
      };
    }

    return null;
  } catch (err) {
    console.warn('[SettingsApi] Could not fetch settings from server, relying on local storage fallback:', err);
    return null;
  }
}

export async function apiFetchSettings(tenantId?: string): Promise<AssociationSettings | null> {
  const result = await apiFetchSettingsWithMeta(tenantId);
  return result ? result.settings : null;
}

export async function apiSyncSettings(
  settings: AssociationSettings,
  adminSession?: any,
  tenantId?: string
): Promise<SettingsApiResponse> {
  const activeTenant = tenantId || 'tenant_nour';
  // Mirror permanently to Cloud Firestore
  firestoreSyncService.saveSettingsToFirestore(activeTenant, settings).catch(() => {});

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': activeTenant,
    };
    if (adminSession) {
      try {
        headers['x-admin-session'] = encodeURIComponent(JSON.stringify(adminSession));
      } catch {
        // Ignore serialization issues
      }
    }

    const res = await fetch(`/api/settings?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ settings, adminSession, tenantId: activeTenant }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[SettingsApi] Error syncing settings to server:', err);
    return {
      success: false,
      error: err.message || 'فشل الاتصال بالخادم لحفظ الإعدادات',
    };
  }
}

