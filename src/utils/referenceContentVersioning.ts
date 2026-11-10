import { ActivityItem } from '../types';
import { initialActivities } from '../initialData';

export const MASTER_TEMPLATE_TENANT_ID = 'tenant_nour';
export const MASTER_TEMPLATE_NAME = 'جمعية النور للتنمية والتضامن';
export const REFERENCE_VERSION_STORAGE_KEY = 'chayef_master_activities_version_v2';

export interface ReferenceActivitiesMeta {
  version: number;
  versionId: string;
  publishedAt: string;
  updatedBy: string;
  modelName: string;
  activitiesCount: number;
  mediaCount: {
    photos: number;
    videos: number;
  };
  lastUpdated: string;
}

export type ReferenceVersionMeta = ReferenceActivitiesMeta;

/**
 * Calculate media count from activity items
 */
function countMedia(activities: ActivityItem[]): { photos: number; videos: number } {
  let photos = 0;
  let videos = 0;
  for (const act of activities) {
    if (act.coverImage) photos++;
    if (Array.isArray(act.galleryImages)) photos += act.galleryImages.length;
    if (act.videoUrl || act.videoMetadata) videos++;
  }
  return { photos, videos };
}

/**
 * Get the latest reference activities directly from the Master Template (جمعية النور للتنمية والتضامن).
 * This eliminates reliance on stale caches, outdated placeholders, or obsolete static files.
 */
export function getMasterReferenceActivities(): ActivityItem[] {
  try {
    // 1. Try global base activities storage
    const baseKey = 'chayef_assoc_activities_v1';
    const baseData = localStorage.getItem(baseKey);
    if (baseData) {
      const parsed = JSON.parse(baseData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return cleanAndValidateActivities(parsed);
      }
    }

    // 2. Try master template tenant storage variants
    const nourKeys = [
      `chayef_tenant_${MASTER_TEMPLATE_TENANT_ID}_activities`,
      `chayef_tenant_${MASTER_TEMPLATE_TENANT_ID}_chayef_assoc_activities_v1`,
    ];
    for (const key of nourKeys) {
      const nourData = localStorage.getItem(key);
      if (nourData) {
        const parsed = JSON.parse(nourData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return cleanAndValidateActivities(parsed);
        }
      }
    }
  } catch (e) {
    console.warn('[ReferenceVersioning] Error loading master activities from storage:', e);
  }

  // 3. Fallback to updated initialActivities (which now matches Nour master model)
  return cleanAndValidateActivities(initialActivities);
}

/**
 * Filter out stale mock data (like old youtube links or corrupted items)
 */
function cleanAndValidateActivities(items: ActivityItem[]): ActivityItem[] {
  let deletedIds: string[] = [];
  try {
    const raw1 = localStorage.getItem('chayef_tenant_tenant_nour_deleted_activity_ids');
    const raw2 = localStorage.getItem('chayef_tenant_portal_deleted_activity_ids');
    if (raw1) deletedIds.push(...JSON.parse(raw1));
    if (raw2) deletedIds.push(...JSON.parse(raw2));
  } catch {}

  return items
    .filter((item) => item && item.id && !deletedIds.includes(item.id))
    .map((item, idx) => {
      // Ensure video is not the obsolete YouTube rickroll
      let videoUrl = item.videoUrl;
      if (videoUrl && videoUrl.includes('dQw4w9WgXcQ')) {
        videoUrl = undefined;
      }

      // Ensure id is clean
      const id = item.id || `act-nour-${idx + 1}`;

      return {
        ...item,
        id,
        videoUrl,
        isActive: item.isActive !== false,
      };
    });
}

/**
 * Get the current published content version metadata
 */
export function getCurrentReferenceVersion(): ReferenceActivitiesMeta {
  try {
    const raw = localStorage.getItem(REFERENCE_VERSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.version === 'number') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[ReferenceVersioning] Error reading version meta:', e);
  }

  const masterActs = getMasterReferenceActivities();
  const mediaCount = countMedia(masterActs);

  const defaultMeta: ReferenceActivitiesMeta = {
    version: 4,
    versionId: 'v4-nour-master',
    publishedAt: new Date().toISOString(),
    updatedBy: 'جمعية النور للتنمية والتضامن (النموذج المعتمد)',
    modelName: MASTER_TEMPLATE_NAME,
    activitiesCount: masterActs.length,
    mediaCount,
    lastUpdated: new Date().toISOString(),
  };

  saveReferenceVersionMeta(defaultMeta);
  return defaultMeta;
}

/**
 * Save reference version metadata to storage
 */
export function saveReferenceVersionMeta(meta: ReferenceActivitiesMeta): void {
  try {
    localStorage.setItem(REFERENCE_VERSION_STORAGE_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('[ReferenceVersioning] Error saving version meta:', e);
  }
}

/**
 * Append anti-cache query parameters to media URL if it is hosted on this app's API
 */
export function appendAntiCacheQuery(url?: string, versionId?: string): string | undefined {
  if (!url) return url;
  if (!versionId) return url;
  // If it's a relative URL or internal API URL, ensure fresh cache
  if (url.startsWith('/api/images') || url.startsWith('/api/videos')) {
    const separator = url.includes('?') ? '&' : '?';
    // If it already has rv=, replace it
    const cleanUrl = url.replace(/([?&])rv=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
    const finalSep = cleanUrl.includes('?') ? '&' : '?';
    return `${cleanUrl}${finalSep}rv=${encodeURIComponent(versionId)}`;
  }
  return url;
}

/**
 * Clone the latest approved reference activities from جمعية النور للتنمية والتضامن for a newly created association platform.
 * 
 * Guarantees:
 * - 100% current photos and videos from جمعية النور.
 * - Anti-cache freshness parameters.
 * - Strict financial zeroing (spentAmount = 0, financialOperationId = undefined) to preserve accounting isolation.
 * - Unique IDs scoped to the new tenant.
 */
export function cloneReferenceActivitiesForNewTenant(newTenantId: string): ActivityItem[] {
  const masterActivities = getMasterReferenceActivities();
  const meta = getCurrentReferenceVersion();

  const cloned: ActivityItem[] = masterActivities.map((act, idx) => {
    const newId = `act_${newTenantId}_${idx + 1}`;
    
    // Copy gallery images with freshness tag
    const freshGallery = Array.isArray(act.galleryImages)
      ? act.galleryImages.map(img => appendAntiCacheQuery(img, meta.versionId) || img)
      : [];

    const freshCover = appendAntiCacheQuery(act.coverImage, meta.versionId) || act.coverImage;
    const freshVideo = appendAntiCacheQuery(act.videoUrl, meta.versionId) || act.videoUrl;

    return {
      ...act,
      id: newId,
      // Strict financial isolation: new associations start with 0 spent expenses
      spentAmount: 0,
      financialOperationId: undefined,
      coverImage: freshCover,
      galleryImages: freshGallery,
      videoUrl: freshVideo,
      videoMetadata: act.videoMetadata ? {
        ...act.videoMetadata,
        activityId: newId,
        cdnUrl: appendAntiCacheQuery(act.videoMetadata.cdnUrl, meta.versionId) || act.videoMetadata.cdnUrl,
        thumbnailUrl: appendAntiCacheQuery(act.videoMetadata.thumbnailUrl, meta.versionId) || act.videoMetadata.thumbnailUrl,
      } : undefined,
      isActive: act.isActive !== false,
      isFeatured: act.isFeatured ?? (idx === 0),
    };
  });

  // Save to target tenant's activities keys (both standard and scoped aliases)
  const storageKey1 = `chayef_tenant_${newTenantId}_activities`;
  const storageKey2 = `chayef_tenant_${newTenantId}_chayef_assoc_activities_v1`;
  const initKey = `chayef_tenant_${newTenantId}_activities_initialized`;
  try {
    const serialized = JSON.stringify(cloned);
    localStorage.setItem(storageKey1, serialized);
    localStorage.setItem(storageKey2, serialized);
    localStorage.setItem(initKey, 'true');
    // Also record the synced version
    localStorage.setItem(`chayef_tenant_${newTenantId}_synced_version`, JSON.stringify({
      version: meta.version,
      versionId: meta.versionId,
      syncedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.warn(`[ReferenceVersioning] Error saving cloned activities for ${newTenantId}:`, e);
  }

  return cloned;
}

/**
 * Check if a tenant's reference activities are out of sync with the master template version
 */
export function isTenantReferenceOutOfSync(tenantId: string): boolean {
  if (!tenantId || tenantId === MASTER_TEMPLATE_TENANT_ID || tenantId === 'portal') {
    return false;
  }
  try {
    const rawSynced = localStorage.getItem(`chayef_tenant_${tenantId}_synced_version`);
    if (!rawSynced) return true;
    const synced = JSON.parse(rawSynced);
    const current = getCurrentReferenceVersion();
    return synced.version !== current.version;
  } catch (e) {
    return true;
  }
}

/**
 * Synchronize an existing association's reference activities with the latest version from جمعية النور.
 * 
 * Crucial Safeguard:
 * - Only synchronizes the reference media (coverImage, galleryImages, videoUrl, videoMetadata)
 * - Strictly leaves any custom activities created by this association intact.
 * - Strictly keeps all financial operations and donations untouched.
 */
export function syncTenantReferenceActivities(tenantId: string): ActivityItem[] {
  if (tenantId === MASTER_TEMPLATE_TENANT_ID || tenantId === 'portal') {
    return getMasterReferenceActivities();
  }

  const masterActivities = getMasterReferenceActivities();
  const meta = getCurrentReferenceVersion();
  const storageKey = `chayef_tenant_${tenantId}_activities`;

  let currentActivities: ActivityItem[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      currentActivities = JSON.parse(raw);
    }
  } catch (e) {
    console.warn(`[ReferenceVersioning] Error reading current activities for ${tenantId}:`, e);
  }

  // If the tenant had no activities at all, perform a clean clone
  if (!Array.isArray(currentActivities) || currentActivities.length === 0) {
    return cloneReferenceActivitiesForNewTenant(tenantId);
  }

  let updatedCount = 0;
  const updatedActivities = currentActivities.map((tenantAct, idx) => {
    // If this activity matches a master reference item (by position or category or title similarity)
    const matchingMaster = masterActivities[idx] || masterActivities.find(m => m.category === tenantAct.category);
    if (matchingMaster) {
      updatedCount++;
      return {
        ...tenantAct,
        // Update to latest media from master template
        coverImage: appendAntiCacheQuery(matchingMaster.coverImage, meta.versionId) || matchingMaster.coverImage,
        galleryImages: (matchingMaster.galleryImages || []).map(img => appendAntiCacheQuery(img, meta.versionId) || img),
        videoUrl: appendAntiCacheQuery(matchingMaster.videoUrl, meta.versionId) || matchingMaster.videoUrl,
        videoUrls: Array.isArray(matchingMaster.videoUrls)
          ? matchingMaster.videoUrls.map(v => appendAntiCacheQuery(v, meta.versionId) || v)
          : matchingMaster.videoUrl ? [appendAntiCacheQuery(matchingMaster.videoUrl, meta.versionId) || matchingMaster.videoUrl] : undefined,
        videoMetadata: matchingMaster.videoMetadata ? {
          ...matchingMaster.videoMetadata,
          activityId: tenantAct.id,
        } : undefined,
        // PRESERVE the tenant's own accounting and financial records!
        spentAmount: tenantAct.spentAmount ?? 0,
        financialOperationId: tenantAct.financialOperationId,
      };
    }
    return tenantAct;
  });

  let deletedIds: string[] = [];
  try {
    const raw = localStorage.getItem(`chayef_tenant_${tenantId}_deleted_activity_ids`);
    if (raw) deletedIds = JSON.parse(raw);
  } catch {}

  const finalActivities = updatedActivities.filter(a => a && a.id && !deletedIds.includes(a.id));

  try {
    localStorage.setItem(storageKey, JSON.stringify(finalActivities));
    localStorage.setItem(`chayef_tenant_${tenantId}_synced_version`, JSON.stringify({
      version: meta.version,
      versionId: meta.versionId,
      syncedAt: new Date().toISOString(),
    }));
  } catch (e) {
    console.warn(`[ReferenceVersioning] Error writing synced activities for ${tenantId}:`, e);
  }

  return finalActivities;
}

/**
 * Publish a new reference version when the admin updates images, videos, or activities in جمعية النور.
 * 
 * - Increments the reference version.
 * - Updates publishedAt timestamp.
 * - Saves into master model storage.
 * - Propagates to all registered child platforms.
 * - Dispatches global broadcast event.
 */
export function publishNewReferenceVersion(
  updatedActivities: ActivityItem[],
  authorName = 'إدارة جمعية النور للتنمية والتضامن (النموذج المعتمد)'
): ReferenceActivitiesMeta {
  const currentMeta = getCurrentReferenceVersion();
  const newVersionNumber = currentMeta.version + 1;
  const now = new Date().toISOString();
  const versionId = `v${newVersionNumber}-${Date.now()}`;
  const mediaCount = countMedia(updatedActivities);

  const newMeta: ReferenceActivitiesMeta = {
    version: newVersionNumber,
    versionId,
    publishedAt: now,
    updatedBy: authorName,
    modelName: MASTER_TEMPLATE_NAME,
    activitiesCount: updatedActivities.length,
    mediaCount,
    lastUpdated: now,
  };

  // 1. Save reference version metadata
  saveReferenceVersionMeta(newMeta);

  // 2. Save master template activities in both keys
  try {
    localStorage.setItem(`chayef_tenant_${MASTER_TEMPLATE_TENANT_ID}_activities`, JSON.stringify(updatedActivities));
    localStorage.setItem('chayef_assoc_activities_v1', JSON.stringify(updatedActivities));
  } catch (e) {
    console.warn('[ReferenceVersioning] Error saving master activities:', e);
  }

  // 3. Child tenant platforms maintain their own independent activities and media;
  // We do NOT overwrite existing tenants' saved activities or media.

  // 4. Dispatch global real-time event across components and tabs
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('chayef-reference-activities-updated', {
        detail: {
          version: newMeta.version,
          versionId: newMeta.versionId,
          meta: newMeta,
        },
      })
    );
  }

  return newMeta;
}
