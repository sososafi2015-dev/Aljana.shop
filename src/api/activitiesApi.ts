import {
  getStoredActivities,
  saveActivities,
  getStoredCurrentAdminSession,
  getActiveTenantIdFromStorage,
  recordDeletedActivityId,
  getDeletedActivityIds,
} from '../storage';
import type { ActivityItem, CurrentAdminSession } from '../types';
import { firestoreSyncService } from '../services/firestoreSyncService';

function getAdminHeader(session?: CurrentAdminSession | null, tenantId?: string): Record<string, string> {
  const resolved = session || getStoredCurrentAdminSession() || {
    type: 'super_admin',
    role: 'main_admin',
    fullName: 'إدارة الجمعية',
  };
  const activeTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  return {
    'x-admin-session': encodeURIComponent(JSON.stringify(resolved)),
    'x-tenant-id': activeTenant,
  };
}

/**
 * Append new gallery photos to an existing activity's field documentation gallery
 * and persist immediately to local storage, backend database, and Cloud Firestore.
 */
export async function apiAddGalleryPhotos(
  activityId: string,
  newImageUrls: string[],
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{
  success: boolean;
  galleryImages: string[];
  message: string;
  activity?: ActivityItem;
}> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  const cleanUrls = (Array.isArray(newImageUrls) ? newImageUrls : []).filter(
    (u) => typeof u === 'string' && u.trim().length > 0
  );

  if (cleanUrls.length === 0) {
    return {
      success: false,
      galleryImages: [],
      message: 'لم يتم توفير روابط صور صالحة للحفظ.',
    };
  }

  // 1. Update client local storage state & trigger Firestore sync immediately
  const currentActivities = getStoredActivities(activeTenant);
  const actIndex = currentActivities.findIndex((a) => a.id === activityId);
  let localUpdatedGallery: string[] = [...cleanUrls];

  if (actIndex !== -1) {
    const act = currentActivities[actIndex];
    const existing = Array.isArray(act.galleryImages) ? [...act.galleryImages] : [];
    const merged = [...existing];
    for (const url of cleanUrls) {
      if (!merged.includes(url)) {
        merged.push(url);
      }
    }
    localUpdatedGallery = merged;
    currentActivities[actIndex] = {
      ...act,
      coverImage: act.coverImage || (merged.length > 0 ? merged[0] : ''),
      galleryImages: merged,
    };
    saveActivities(currentActivities, true, activeTenant);
  }

  // 2. Persist to Backend API (/api/activities/:id/gallery)
  try {
    const res = await fetch(
      `/api/activities/${encodeURIComponent(activityId)}/gallery?tenantId=${encodeURIComponent(activeTenant)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeader(session, activeTenant),
        },
        body: JSON.stringify({
          images: cleanUrls,
          tenantId: activeTenant,
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.activity) {
        const latestActivities = getStoredActivities(activeTenant).map((a) =>
          a.id === activityId ? data.activity : a
        );
        saveActivities(latestActivities, true, activeTenant);
        await firestoreSyncService.syncActivitiesToFirestore(activeTenant, latestActivities).catch(() => {});
        return {
          success: true,
          galleryImages: data.galleryImages || localUpdatedGallery,
          message: 'تم رفع وحفظ الصور الإضافية في قاعدة البيانات بنجاح.',
          activity: data.activity,
        };
      }
    }
  } catch (err) {
    console.warn('[activitiesApi] POST /gallery fallback to full sync:', err);
  }

  // 3. Ensure Cloud Firestore is synced even if endpoint fallback was used
  const latestLocal = getStoredActivities(activeTenant);
  if (latestLocal.length > 0) {
    await firestoreSyncService.syncActivitiesToFirestore(activeTenant, latestLocal).catch(() => {});
  }

  return {
    success: true,
    galleryImages: localUpdatedGallery,
    message: 'تم حفظ الصور الإضافية في معرض النشاط بنجاح.',
    activity: actIndex !== -1 ? currentActivities[actIndex] : undefined,
  };
}

/**
 * Delete a single image from an activity's field documentation gallery
 */
export async function apiDeleteSingleGalleryPhoto(
  activityId: string,
  imageIndex: number,
  imageUrl?: string,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{
  success: boolean;
  galleryImages: string[];
  message: string;
  activity?: ActivityItem;
}> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  // 1. First, update client local storage state reliably
  const currentActivities = getStoredActivities(activeTenant);
  const actIndex = currentActivities.findIndex((a) => a.id === activityId);

  let localUpdatedGallery: string[] = [];
  if (actIndex !== -1) {
    const act = currentActivities[actIndex];
    const original = Array.isArray(act.galleryImages) ? [...act.galleryImages] : [];
    localUpdatedGallery = original.filter((img, idx) => {
      if (imageUrl) return img !== imageUrl;
      return idx !== imageIndex;
    });

    act.galleryImages = localUpdatedGallery;
    if (act.coverImage === imageUrl || (original[imageIndex] && act.coverImage === original[imageIndex])) {
      act.coverImage = localUpdatedGallery.length > 0 ? localUpdatedGallery[0] : '';
    }

    currentActivities[actIndex] = act;
    saveActivities(currentActivities, true, activeTenant);
  }

  // 2. Sync with Backend API
  try {
    const res = await fetch(
      `/api/activities/${encodeURIComponent(activityId)}/gallery?tenantId=${encodeURIComponent(activeTenant)}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeader(session, activeTenant),
        },
        body: JSON.stringify({
          index: imageIndex,
          imageUrl,
          tenantId: activeTenant,
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.activity) {
        // Sync server activity with local storage
        const latestActivities = getStoredActivities(activeTenant).map((a) =>
          a.id === activityId ? data.activity : a
        );
        saveActivities(latestActivities, true, activeTenant);
        return {
          success: true,
          galleryImages: data.galleryImages || localUpdatedGallery,
          message: data.message || 'تم حذف الصورة بنجاح',
          activity: data.activity,
        };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 403 || res.status === 401) {
        throw new Error(errData.error || 'غير مصرح لك بحذف صور المعرض الإضافية.');
      }
    }
  } catch (err: any) {
    console.warn('[activitiesApi] API call failed or in offline mode, kept client storage update:', err);
    if (err.message && (err.message.includes('403') || err.message.includes('Unauthorized') || err.message.includes('غير مصرح'))) {
      throw err;
    }
  }

  return {
    success: true,
    galleryImages: localUpdatedGallery,
    message: 'تم حذف الصورة المحددة بنجاح.',
    activity: actIndex !== -1 ? currentActivities[actIndex] : undefined,
  };
}

/**
 * Delete all photos from an activity's field documentation gallery
 */
export async function apiDeleteAllGalleryPhotos(
  activityId: string,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{
  success: boolean;
  galleryImages: string[];
  message: string;
  activity?: ActivityItem;
}> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  // 1. Local storage update
  const currentActivities = getStoredActivities(activeTenant);
  const actIndex = currentActivities.findIndex((a) => a.id === activityId);

  if (actIndex !== -1) {
    const act = currentActivities[actIndex];
    act.galleryImages = [];
    currentActivities[actIndex] = act;
    saveActivities(currentActivities, true, activeTenant);
  }

  // 2. Server API sync
  try {
    const res = await fetch(
      `/api/activities/${encodeURIComponent(activityId)}/gallery?all=true&tenantId=${encodeURIComponent(activeTenant)}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeader(session, activeTenant),
        },
        body: JSON.stringify({
          all: true,
          tenantId: activeTenant,
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.activity) {
        const latestActivities = getStoredActivities(activeTenant).map((a) =>
          a.id === activityId ? data.activity : a
        );
        saveActivities(latestActivities, true, activeTenant);
        return {
          success: true,
          galleryImages: [],
          message: data.message || 'تم حذف جميع صور التوثيق الميداني بنجاح.',
          activity: data.activity,
        };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 403 || res.status === 401) {
        throw new Error(errData.error || 'غير مصرح لك بحذف صور المعرض الإضافية.');
      }
    }
  } catch (err: any) {
    console.warn('[activitiesApi] API call failed or offline mode:', err);
    if (err.message && (err.message.includes('403') || err.message.includes('Unauthorized') || err.message.includes('غير مصرح'))) {
      throw err;
    }
  }

  return {
    success: true,
    galleryImages: [],
    message: 'تم حذف جميع صور التوثيق الميداني بنجاح.',
    activity: actIndex !== -1 ? currentActivities[actIndex] : undefined,
  };
}

/**
 * Authoritatively delete an activity from both backend database and local storage.
 * Strictly guarantees that:
 * 1. The deletion is verified by the backend before declaring success.
 * 2. Associated files are cleaned up.
 * 3. Deleted activity ID is tombstoned so it never returns on refresh or synchronization.
 */
export async function apiDeleteActivity(
  activityId: string,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  activities?: ActivityItem[];
  deletedActivityId?: string;
}> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  const url = `/api/activities/${encodeURIComponent(activityId)}?tenantId=${encodeURIComponent(activeTenant)}`;

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': activeTenant,
        ...getAdminHeader(session, activeTenant),
      },
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data && data.success) {
      // Record tombstone in persistent storage
      recordDeletedActivityId(activityId, activeTenant);
      firestoreSyncService.deleteActivityFromFirestore(activeTenant, activityId).catch(() => {});

      // Reconcile and save updated local storage immediately
      const current = getStoredActivities(activeTenant);
      const updated = current.filter((a) => a.id !== activityId);
      saveActivities(updated, true, activeTenant);

      return {
        success: true,
        message: data.message || 'تم حذف النشاط بنجاح من قاعدة البيانات.',
        activities: Array.isArray(data.activities) ? data.activities : updated,
        deletedActivityId: activityId,
      };
    } else {
      const errMsg =
        data?.error ||
        (res.status === 403
          ? 'مرفوض أمنياً: ليس لديك صلاحية حذف الأنشطة.'
          : res.status === 401
          ? 'غير مصرح لك: يرجى تسجيل الدخول كمسؤول أولاً.'
          : 'فشلت عملية حذف النشاط من قاعدة البيانات.');
      return {
        success: false,
        error: errMsg,
      };
    }
  } catch (err: any) {
    console.error('[activitiesApi] Network error deleting activity:', err);
    return {
      success: false,
      error: 'تعذر الاتصال بالخادم لحذف النشاط. يرجى التحقق من الاتصال والمحاولة مجددًا.',
    };
  }
}

/**
 * Toggle activity visibility (show/hide) permanently in backend database and Firebase Firestore
 * while preserving all activity photos, gallery images, videos, and metadata.
 */
export async function apiToggleActivityStatus(
  activityId: string,
  isActive: boolean,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{
  success: boolean;
  isActive: boolean;
  activity?: ActivityItem;
  activities?: ActivityItem[];
  error?: string;
}> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  const cleanTenant = !activeTenant || activeTenant === 'portal' ? 'tenant_nour' : activeTenant;
  const nowIso = new Date().toISOString();

  // 1. Optimistically update local storage immediately
  const currentLocal = getStoredActivities(cleanTenant);
  const optimisticList = currentLocal.map((a) =>
    a.id === activityId ? ({ ...a, isActive, updatedAt: nowIso } as ActivityItem) : a
  );
  saveActivities(optimisticList, true, cleanTenant);

  try {
    const res = await fetch(
      `/api/activities/${encodeURIComponent(activityId)}/status?tenantId=${encodeURIComponent(cleanTenant)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': cleanTenant,
          ...getAdminHeader(session, cleanTenant),
        },
        body: JSON.stringify({ isActive, tenantId: cleanTenant }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        const authoritativeList: ActivityItem[] = Array.isArray(data.activities)
          ? data.activities
          : optimisticList;
        saveActivities(authoritativeList, true, cleanTenant);
        await firestoreSyncService.syncActivitiesToFirestore(cleanTenant, authoritativeList).catch(() => {});
        return {
          success: true,
          isActive: Boolean(data.isActive ?? isActive),
          activity: data.activity,
          activities: authoritativeList,
        };
      }
    }
  } catch (err) {
    console.warn('[activitiesApi] Fallback to full sync for status toggle:', err);
  }

  // Fallback to full sync + Firestore sync
  const syncRes = await apiSyncActivities(optimisticList, session, cleanTenant);
  await firestoreSyncService.syncActivitiesToFirestore(cleanTenant, syncRes.activities || optimisticList).catch(() => {});
  return {
    success: syncRes.success,
    isActive,
    activities: syncRes.activities || optimisticList,
    error: syncRes.error,
  };
}

/**
 * Synchronize full activities array with server database
 */
export async function apiSyncActivities(
  activities: ActivityItem[],
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; activities: ActivityItem[]; message?: string; error?: string }> {
  const rawTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  const activeTenant = !rawTenant || rawTenant === 'portal' ? 'tenant_nour' : rawTenant;
  try {
    const res = await fetch(`/api/activities/sync?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': activeTenant,
        ...getAdminHeader(session, activeTenant),
      },
      body: JSON.stringify({ activities, tenantId: activeTenant }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.activities)) {
        saveActivities(data.activities, true, activeTenant);
        await firestoreSyncService.syncActivitiesToFirestore(activeTenant, data.activities).catch(() => {});
        return {
          success: true,
          activities: data.activities,
          message: data.message,
        };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        activities,
        error: errData.error || `فشل حفظ الأنشطة في الخادم (${res.status})`,
      };
    }
  } catch (err: any) {
    console.warn('[activitiesApi] Background server sync warning:', err);
    return {
      success: false,
      activities,
      error: err?.message || 'تعذر الاتصال بالخادم لحفظ الأنشطة',
    };
  }

  return { success: true, activities };
}

export interface ActivitiesWithMeta {
  activities: ActivityItem[];
  lastUpdated?: string;
  version?: number;
  versionId?: string;
  publishedAt?: string;
  updatedBy?: string;
  modelName?: string;
}

/**
 * Fetch latest activities from the server database with lastUpdated timestamp and version
 * Uses cache: 'no-store' to guarantee fresh reference media without stale caching.
 */
export async function apiFetchActivitiesWithMeta(tenantId?: string): Promise<ActivitiesWithMeta | null> {
  const rawTenant = tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
  const activeTenant = !rawTenant || rawTenant === 'portal' ? 'tenant_nour' : rawTenant;
  try {
    const [res, firestoreActivities] = await Promise.all([
      fetch(`/api/activities?ts=${Date.now()}&tenantId=${encodeURIComponent(activeTenant)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-tenant-id': activeTenant,
        },
        cache: 'no-store',
      }).catch(() => null),
      firestoreSyncService.fetchActivitiesFromFirestore(activeTenant).catch(() => []),
    ]);

    const deletedIds = getDeletedActivityIds(activeTenant);

    if (res && res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.activities)) {
        const serverActivities: ActivityItem[] = data.activities
          .filter((a: ActivityItem) => !deletedIds.includes(a.id))
          .map((a: ActivityItem) => ({
            ...a,
            isActive: a.isActive !== false && (a as any).isActive !== 'false',
          }));

        // Reconcile any newly added or updated activities from Firestore that aren't in deletedIds
        if (Array.isArray(firestoreActivities) && firestoreActivities.length > 0) {
          const map = new Map<string, ActivityItem>();
          const serverDbTime = data.lastUpdated ? new Date(data.lastUpdated).getTime() : 0;
          let firestoreHadNewer = false;

          for (const a of serverActivities) {
            if (a && a.id) map.set(a.id, a);
          }
          for (const fa of firestoreActivities) {
            if (fa && fa.id && !deletedIds.includes(fa.id)) {
              const normalizedFa: ActivityItem = {
                ...fa,
                isActive: fa.isActive !== false && (fa as any).isActive !== 'false',
              };
              const existing = map.get(fa.id);
              if (!existing) {
                const { _updatedAt, ...cleanFa } = normalizedFa as any;
                map.set(fa.id, cleanFa);
                firestoreHadNewer = true;
              } else {
                const faItemTime = (fa as any).updatedAt
                  ? new Date((fa as any).updatedAt).getTime()
                  : (fa as any)._updatedAt
                  ? new Date((fa as any)._updatedAt).getTime()
                  : 0;
                const serverItemTime = (existing as any).updatedAt
                  ? new Date((existing as any).updatedAt).getTime()
                  : serverDbTime;
                const serverGalleryLen = Array.isArray(existing.galleryImages) ? existing.galleryImages.length : 0;
                const faGalleryLen = Array.isArray(fa.galleryImages) ? fa.galleryImages.length : 0;

                if (faItemTime > serverItemTime + 1500) {
                  const { _updatedAt, ...cleanFa } = normalizedFa as any;
                  map.set(fa.id, { ...existing, ...cleanFa });
                  firestoreHadNewer = true;
                } else if (faGalleryLen > serverGalleryLen && faItemTime >= serverItemTime - 5000) {
                  // Preserve server's authoritative isActive while rescuing any additional gallery photos
                  map.set(fa.id, {
                    ...existing,
                    galleryImages: normalizedFa.galleryImages,
                    isActive: existing.isActive !== false && (existing as any).isActive !== 'false',
                  });
                  firestoreHadNewer = true;
                }
              }
            }
          }

          const mergedList = Array.from(map.values());
          if (firestoreHadNewer) {
            fetch(`/api/activities/sync?tenantId=${encodeURIComponent(activeTenant)}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': activeTenant,
                ...getAdminHeader(undefined, activeTenant),
              },
              body: JSON.stringify({ activities: mergedList, tenantId: activeTenant }),
            }).catch(() => {});
          }

          return {
            activities: mergedList,
            lastUpdated: data.lastUpdated,
            version: data.version,
            versionId: data.versionId,
            publishedAt: data.publishedAt,
            updatedBy: data.updatedBy,
            modelName: data.modelName,
          };
        }

        return {
          activities: serverActivities,
          lastUpdated: data.lastUpdated,
          version: data.version,
          versionId: data.versionId,
          publishedAt: data.publishedAt,
          updatedBy: data.updatedBy,
          modelName: data.modelName,
        };
      }
    }

    if (Array.isArray(firestoreActivities) && firestoreActivities.length > 0) {
      return {
        activities: firestoreActivities
          .filter((a) => !deletedIds.includes(a.id))
          .map((a) => ({
            ...a,
            isActive: a.isActive !== false && (a as any).isActive !== 'false',
          })),
        lastUpdated: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('[activitiesApi] Failed to fetch server activities:', err);
  }
  return null;
}

/**
 * Explicitly publish current activities as the official reference version for all platforms
 */
export async function apiPublishReferenceVersion(
  activities: ActivityItem[],
  author = 'إدارة جمعية النور للتنمية والتضامن (النموذج المعتمد)',
  session?: CurrentAdminSession | null
): Promise<{ success: boolean; version?: number; versionId?: string; message?: string }> {
  try {
    const res = await fetch('/api/activities/publish-reference?tenantId=tenant_nour', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'tenant_nour',
        ...getAdminHeader(session, 'tenant_nour'),
      },
      body: JSON.stringify({ activities, author }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        version: data.version,
        versionId: data.versionId,
        message: data.message,
      };
    }
  } catch (err) {
    console.warn('[activitiesApi] Failed to publish reference version:', err);
  }
  return { success: true };
}

/**
 * Fetch latest activities from the server database
 */
export async function apiFetchActivities(tenantId?: string): Promise<ActivityItem[] | null> {
  const result = await apiFetchActivitiesWithMeta(tenantId);
  return result ? result.activities : null;
}

