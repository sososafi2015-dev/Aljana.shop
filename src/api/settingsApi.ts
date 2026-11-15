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
          const merged = { ...data.settings, ...firestoreSettings };
          merged.ribBank =
            (firestoreSettings.ribBank && String(firestoreSettings.ribBank).trim()) ||
            (data.settings.ribBank && String(data.settings.ribBank).trim()) ||
            '011 780 0000 123456789012 45';
          merged.bankName =
            (firestoreSettings.bankName && String(firestoreSettings.bankName).trim()) ||
            (data.settings.bankName && String(data.settings.bankName).trim()) ||
            'التجاري وفا بنك / Attijariwafa Bank';
          return {
            settings: merged,
            lastUpdated: (firestoreSettings as any)._updatedAt,
          };
        }

        const safeServerSettings = {
          ...data.settings,
          ribBank:
            (data.settings.ribBank && String(data.settings.ribBank).trim()) ||
            (firestoreSettings?.ribBank && String(firestoreSettings.ribBank).trim()) ||
            '011 780 0000 123456789012 45',
          bankName:
            (data.settings.bankName && String(data.settings.bankName).trim()) ||
            (firestoreSettings?.bankName && String(firestoreSettings.bankName).trim()) ||
            'التجاري وفا بنك / Attijariwafa Bank',
        };
        return {
          settings: safeServerSettings,
          lastUpdated: data.lastUpdated,
        };
      }
    }

    if (firestoreSettings) {
      return {
        settings: {
          ...firestoreSettings,
          ribBank: (firestoreSettings.ribBank && String(firestoreSettings.ribBank).trim()) || '011 780 0000 123456789012 45',
          bankName: (firestoreSettings.bankName && String(firestoreSettings.bankName).trim()) || 'التجاري وفا بنك / Attijariwafa Bank',
        },
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

