import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import type { ActivityItem } from '../types';
import { initialActivities } from '../initialData';
import {
  DATA_DIR,
  ensureStorageDirectories,
  normalizeTenantId,
  offloadBase64ToDisk,
  offloadEmbeddedMediaDeep,
  readJsonFileSync,
  writeJsonFileAtomicSync,
  readLargeJsonBody,
} from './storageEngine';
import {
  syncTenantCollectionToFirebaseServer,
  deleteDocFromFirebaseServer,
  fetchTenantCollectionFromFirebaseServer,
  saveDocToFirebaseServer,
  getDocFromFirebaseServer,
  awaitPendingOffloadBackups,
} from './firebaseServerStorage';

const activitiesCloudReconcileCache = new Map<string, number>();
const ACTIVITIES_RECONCILE_TTL_MS = 2000;
const COLD_SEED_EPOCH = '1970-01-01T00:00:00.000Z';

export interface ActivitiesDatabase {
  activities: ActivityItem[];
  referenceVersionId: string;
  referencePublishedAt: string;
  referencePublishedBy: string;
  lastUpdated: string;
}

function getTenantActivitiesFile(tenantId?: string | null): string {
  const cleanTenant = normalizeTenantId(tenantId);
  if (cleanTenant === 'tenant_nour') {
    return path.join(DATA_DIR, 'activities_database.json');
  }
  return path.join(DATA_DIR, `activities_database_${cleanTenant}.json`);
}

function sanitizeActivityMedia(activity: ActivityItem): ActivityItem {
  if (!activity || typeof activity !== 'object') return activity;
  const clone: ActivityItem = offloadEmbeddedMediaDeep({ ...activity }, 'activity');

  if (typeof clone.coverImage === 'string' && clone.coverImage.startsWith('data:')) {
    clone.coverImage = offloadBase64ToDisk(clone.coverImage, 'activity_cover');
  }
  if (Array.isArray(clone.galleryImages)) {
    clone.galleryImages = clone.galleryImages.map((img) =>
      typeof img === 'string' && img.startsWith('data:') ? offloadBase64ToDisk(img, 'activity_gallery') : img
    );
  }
  if (typeof clone.proofDocumentUrl === 'string' && clone.proofDocumentUrl.startsWith('data:')) {
    clone.proofDocumentUrl = offloadBase64ToDisk(clone.proofDocumentUrl, 'activity_proof');
  }
  if (clone.proofAttachment && typeof clone.proofAttachment.url === 'string' && clone.proofAttachment.url.startsWith('data:')) {
    clone.proofAttachment = {
      ...clone.proofAttachment,
      url: offloadBase64ToDisk(clone.proofAttachment.url, 'activity_proof'),
    };
  }
  if (clone.videoMetadata && typeof clone.videoMetadata.thumbnailUrl === 'string' && clone.videoMetadata.thumbnailUrl.startsWith('data:')) {
    clone.videoMetadata = {
      ...clone.videoMetadata,
      thumbnailUrl: offloadBase64ToDisk(clone.videoMetadata.thumbnailUrl, 'activity_video_thumb'),
    };
  }
  clone.isActive = activity.isActive !== false && (activity as any).isActive !== 'false';
  return clone;
}

export function getMasterActivitiesOnServer(): {
  activities: ActivityItem[];
  referenceVersionId: string;
  referencePublishedAt: string;
  referencePublishedBy: string;
} {
  const masterFile = path.join(DATA_DIR, 'activities_database.json');
  if (fs.existsSync(masterFile)) {
    const parsed = readJsonFileSync<ActivitiesDatabase | null>(masterFile, () => null);
    if (parsed && Array.isArray(parsed.activities) && parsed.activities.length > 0) {
      return {
        activities: parsed.activities.map(sanitizeActivityMedia),
        referenceVersionId: parsed.referenceVersionId || 'v1.0.0',
        referencePublishedAt: parsed.referencePublishedAt || new Date().toISOString(),
        referencePublishedBy: parsed.referencePublishedBy || 'إدارة جمعية النور للتنمية والتضامن (النموذج المعتمد)',
      };
    }
  }

  return {
    activities: [...initialActivities],
    referenceVersionId: 'v1.0.0',
    referencePublishedAt: new Date().toISOString(),
    referencePublishedBy: 'إدارة جمعية النور للتنمية والتضامن (النموذج المعتمد)',
  };
}

export function cloneReferenceActivitiesForServerTenant(tenantId: string): ActivityItem[] {
  const cleanTenant = normalizeTenantId(tenantId);
  const master = getMasterActivitiesOnServer();

  return master.activities.map((act, idx) => {
    const newId = `act_${cleanTenant}_${idx + 1}`;
    return {
      ...act,
      id: newId,
      // Strict financial isolation: new associations start with 0 spent expenses
      spentAmount: 0,
      financialOperationId: undefined,
      videoMetadata: act.videoMetadata
        ? {
            ...act.videoMetadata,
            activityId: newId,
          }
        : undefined,
      isActive: act.isActive !== false,
      isFeatured: act.isFeatured ?? (idx === 0),
    };
  });
}

export function loadActivitiesDatabase(tenantId?: string | null): ActivitiesDatabase {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const dbFile = getTenantActivitiesFile(cleanTenant);

  if (fs.existsSync(dbFile)) {
    const parsed = readJsonFileSync<ActivitiesDatabase | null>(dbFile, () => null);
    if (parsed && Array.isArray(parsed.activities)) {
      // If a non-master tenant's database exists on disk with 0 activities and was never explicitly updated,
      // keep cold epoch so Cloud Firestore reconciliation runs first instead of overwriting cloud data.
      if (cleanTenant !== 'tenant_nour' && parsed.activities.length === 0 && parsed.lastUpdated === COLD_SEED_EPOCH) {
        const cloned = cloneReferenceActivitiesForServerTenant(cleanTenant);
        const master = getMasterActivitiesOnServer();
        const seededDb: ActivitiesDatabase = {
          activities: cloned,
          referenceVersionId: master.referenceVersionId,
          referencePublishedAt: master.referencePublishedAt,
          referencePublishedBy: master.referencePublishedBy,
          lastUpdated: COLD_SEED_EPOCH,
        };
        saveActivitiesDatabase(seededDb, cleanTenant, false, false);
        return seededDb;
      }

      return {
        activities: parsed.activities.map(sanitizeActivityMedia),
        referenceVersionId: parsed.referenceVersionId || 'v1.0.0',
        referencePublishedAt: parsed.referencePublishedAt || new Date().toISOString(),
        referencePublishedBy: parsed.referencePublishedBy || 'إدارة جمعية النور للتنمية والتضامن',
        lastUpdated: parsed.lastUpdated || COLD_SEED_EPOCH,
      };
    }
  }

  // Cold start / missing disk file: initialize locally with epoch timestamp and do NOT overwrite Cloud Firestore
  const master = getMasterActivitiesOnServer();
  const activitiesToSave =
    cleanTenant === 'tenant_nour'
      ? master.activities
      : cloneReferenceActivitiesForServerTenant(cleanTenant);

  const defaultDb: ActivitiesDatabase = {
    activities: activitiesToSave,
    referenceVersionId: master.referenceVersionId,
    referencePublishedAt: master.referencePublishedAt,
    referencePublishedBy: master.referencePublishedBy,
    lastUpdated: COLD_SEED_EPOCH,
  };

  saveActivitiesDatabase(defaultDb, cleanTenant, false, false);
  return defaultDb;
}

export function initializeTenantActivities(tenantId: string): ActivitiesDatabase {
  const cleanTenant = normalizeTenantId(tenantId);
  return loadActivitiesDatabase(cleanTenant);
}

export function saveActivitiesDatabase(
  db: ActivitiesDatabase,
  tenantId?: string | null,
  syncFirestore = true,
  reconcileDeletions = true
): void {
  const cleanTenant = normalizeTenantId(tenantId);
  const dbFile = getTenantActivitiesFile(cleanTenant);
  const sanitizedActivities = Array.isArray(db.activities)
    ? db.activities.map((a) => sanitizeActivityMedia(a))
    : [];
  const cleanDb: ActivitiesDatabase = {
    ...db,
    activities: sanitizedActivities,
    lastUpdated: db.lastUpdated || new Date().toISOString(),
  };

  writeJsonFileAtomicSync(dbFile, cleanDb, 'activity');
  if (cleanDb.lastUpdated !== COLD_SEED_EPOCH) {
    activitiesCloudReconcileCache.set(cleanTenant, Date.now());
  }

  // Mirror activities (including galleryImages & deletions) permanently to Cloud Firestore
  if (syncFirestore) {
    syncTenantCollectionToFirebaseServer('activities', cleanTenant, sanitizedActivities, [], {
      reconcileDeletions,
    }).catch(() => {});
    saveDocToFirebaseServer('settings', `${cleanTenant}_activities_meta`, {
      tenantId: cleanTenant,
      lastUpdated: cleanDb.lastUpdated,
      _updatedAt: cleanDb.lastUpdated,
      count: sanitizedActivities.length,
    }).catch(() => {});
  }
}

async function persistActivitiesDatabaseAndCloud(
  db: ActivitiesDatabase,
  tenantId?: string | null,
  removedIds: string[] = [],
  reconcileDeletions = true
): Promise<ActivitiesDatabase> {
  const cleanTenant = normalizeTenantId(tenantId);
  const nowIso = db.lastUpdated && db.lastUpdated !== COLD_SEED_EPOCH ? db.lastUpdated : new Date().toISOString();
  const sanitizedActivities = Array.isArray(db.activities)
    ? db.activities.map((a) => ({
        ...sanitizeActivityMedia(a),
        tenantId: cleanTenant,
        associationId: cleanTenant,
      }))
    : [];
  const cleanDb: ActivitiesDatabase = {
    ...db,
    activities: sanitizedActivities,
    lastUpdated: nowIso,
  };

  saveActivitiesDatabase(cleanDb, cleanTenant, false, false);
  activitiesCloudReconcileCache.set(cleanTenant, Date.now());

  await Promise.all([
    awaitPendingOffloadBackups(),
    syncTenantCollectionToFirebaseServer('activities', cleanTenant, sanitizedActivities, removedIds, {
      reconcileDeletions,
    }),
    saveDocToFirebaseServer('settings', `${cleanTenant}_activities_meta`, {
      tenantId: cleanTenant,
      lastUpdated: nowIso,
      _updatedAt: nowIso,
      count: sanitizedActivities.length,
    }),
  ]);

  return cleanDb;
}

async function reconcileActivitiesFromCloudFirestore(
  tenantId: string,
  force = false
): Promise<ActivitiesDatabase> {
  const cleanTenant = normalizeTenantId(tenantId);
  const localDb = loadActivitiesDatabase(cleanTenant);
  const isColdLocal = localDb.lastUpdated === COLD_SEED_EPOCH;
  const lastCheck = activitiesCloudReconcileCache.get(cleanTenant) || 0;
  if (!force && !isColdLocal && Date.now() - lastCheck < ACTIVITIES_RECONCILE_TTL_MS) {
    return localDb;
  }
  activitiesCloudReconcileCache.set(cleanTenant, Date.now());

  try {
    const [cloudActivities, cloudMeta] = await Promise.all([
      fetchTenantCollectionFromFirebaseServer<ActivityItem>('activities', cleanTenant),
      getDocFromFirebaseServer<any>('settings', `${cleanTenant}_activities_meta`),
    ]);

    const localTs = isColdLocal ? 0 : new Date(localDb.lastUpdated || 0).getTime();
    let maxCloudTs = cloudMeta
      ? new Date(cloudMeta._updatedAt || cloudMeta.lastUpdated || 0).getTime()
      : 0;

    if (Array.isArray(cloudActivities)) {
      for (const act of cloudActivities) {
        const ts = new Date((act as any)._updatedAt || (act as any).updatedAt || (act as any).createdAt || act.date || 0).getTime();
        if (ts > maxCloudTs) maxCloudTs = ts;
      }
    }

    const hasCloudActivities = Array.isArray(cloudActivities) && cloudActivities.length > 0;
    const hasAuthoritativeMeta = Boolean(cloudMeta && (cloudMeta._updatedAt || cloudMeta.lastUpdated));

    if ((hasCloudActivities || hasAuthoritativeMeta) && (isColdLocal || maxCloudTs > localTs)) {
      const cleaned = (cloudActivities || [])
        .filter((a) => a && a.id)
        .map((a) => sanitizeActivityMedia(a))
        .sort((a, b) => new Date(b.date || (b as any).createdAt || 0).getTime() - new Date(a.date || (a as any).createdAt || 0).getTime());
      const reconciledDb: ActivitiesDatabase = {
        ...localDb,
        activities: cleaned,
        lastUpdated: maxCloudTs > 0 ? new Date(maxCloudTs).toISOString() : new Date().toISOString(),
      };
      saveActivitiesDatabase(reconciledDb, cleanTenant, false, false);
      return reconciledDb;
    }
  } catch {}

  return localDb;
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
  res.end(JSON.stringify(data));
}

export async function handleActivitiesApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  if (!url.startsWith('/api/activities')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return true;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    parsedUrl = new URL('http://localhost' + url);
  }
  const headerTenant = (req.headers['x-tenant-id'] as string | undefined)?.trim();
  const queryTenant = parsedUrl.searchParams.get('tenantId')?.trim();
  const tenantId = normalizeTenantId(headerTenant || queryTenant);

  const cleanPath = url.split('?')[0];

  const forceCloud = parsedUrl.searchParams.get('force') === 'true';

  // 1. GET /api/activities
  if (req.method === 'GET' && cleanPath === '/api/activities') {
    const db = await reconcileActivitiesFromCloudFirestore(tenantId, forceCloud);
    sendJson(res, 200, {
      success: true,
      tenantId,
      activities: db.activities,
      referenceVersionId: db.referenceVersionId,
      referencePublishedAt: db.referencePublishedAt,
      referencePublishedBy: db.referencePublishedBy,
      lastUpdated: db.lastUpdated,
    });
    return true;
  }

  // 2. POST /api/activities/sync or PUT /api/activities
  if (
    (req.method === 'POST' && cleanPath === '/api/activities/sync') ||
    (req.method === 'PUT' && cleanPath === '/api/activities') ||
    (req.method === 'POST' && cleanPath === '/api/activities')
  ) {
    try {
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body.tenantId || tenantId);
      const targetDb = await reconcileActivitiesFromCloudFirestore(targetTenant, true);

      // Single activity create/upsert support
      if (body.activity && typeof body.activity === 'object' && !Array.isArray(body.activities)) {
        const nowIso = new Date().toISOString();
        const incomingAct = sanitizeActivityMedia({ ...body.activity, updatedAt: nowIso } as ActivityItem);
        if (!incomingAct.id) {
          incomingAct.id = `act-${Date.now()}`;
        }
        const idx = targetDb.activities.findIndex((a) => a.id === incomingAct.id);
        if (idx >= 0) {
          targetDb.activities[idx] = { ...targetDb.activities[idx], ...incomingAct, updatedAt: nowIso } as ActivityItem;
        } else {
          targetDb.activities.unshift(incomingAct);
        }
        targetDb.lastUpdated = nowIso;
        const savedDb = await persistActivitiesDatabaseAndCloud(targetDb, targetTenant, [], true);

        sendJson(res, 200, {
          success: true,
          tenantId: targetTenant,
          activity: savedDb.activities.find((a) => a.id === incomingAct.id) || incomingAct,
          activities: savedDb.activities,
          lastUpdated: savedDb.lastUpdated,
        });
        return true;
      }

      if (!Array.isArray(body.activities)) {
        sendJson(res, 400, { success: false, error: 'Invalid activities array' });
        return true;
      }

      const nowIso = new Date().toISOString();
      targetDb.activities = body.activities.map((a: ActivityItem) =>
        sanitizeActivityMedia({ ...a, updatedAt: (a as any)?.updatedAt || nowIso } as ActivityItem)
      );
      targetDb.lastUpdated = nowIso;
      if (body.referenceVersionId) {
        targetDb.referenceVersionId = body.referenceVersionId;
      }
      if (body.referencePublishedBy) {
        targetDb.referencePublishedBy = body.referencePublishedBy;
      }

      const savedDb = await persistActivitiesDatabaseAndCloud(targetDb, targetTenant, [], true);

      sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        activities: savedDb.activities,
        lastUpdated: savedDb.lastUpdated,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'Failed to sync activities' });
      return true;
    }
  }

  // 3. POST /api/activities/publish-reference
  if (req.method === 'POST' && cleanPath === '/api/activities/publish-reference') {
    try {
      const body = await readLargeJsonBody(req);
      const masterDb = await reconcileActivitiesFromCloudFirestore('tenant_nour', true);
      if (Array.isArray(body.activities)) {
        masterDb.activities = body.activities.map((a: ActivityItem) => sanitizeActivityMedia(a));
      }
      const nextNum =
        (parseInt((masterDb.referenceVersionId || 'v1.0.0').replace(/[^0-9]/g, ''), 10) || 100) + 1;
      const major = Math.floor(nextNum / 100);
      const minor = Math.floor((nextNum % 100) / 10);
      const patch = nextNum % 10;

      masterDb.referenceVersionId = body.versionId || `v${major}.${minor}.${patch}`;
      masterDb.referencePublishedAt = new Date().toISOString();
      masterDb.referencePublishedBy =
        body.publishedBy || 'إدارة جمعية النور للتنمية والتضامن (النموذج المعتمد)';
      masterDb.lastUpdated = new Date().toISOString();

      const savedMaster = await persistActivitiesDatabaseAndCloud(masterDb, 'tenant_nour', [], true);

      sendJson(res, 200, {
        success: true,
        referenceVersionId: savedMaster.referenceVersionId,
        referencePublishedAt: savedMaster.referencePublishedAt,
        referencePublishedBy: savedMaster.referencePublishedBy,
        activitiesCount: savedMaster.activities.length,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'Failed to publish reference' });
      return true;
    }
  }

  // 3b. POST / PATCH / PUT /api/activities/:id/status -> Toggle show/hide visibility permanently
  const statusPathMatch = cleanPath.match(/^\/api\/activities\/([^/]+)\/status$/);
  if ((req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') && statusPathMatch) {
    try {
      const activityId = decodeURIComponent(statusPathMatch[1]);
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body.tenantId || tenantId);
      const targetDb = await reconcileActivitiesFromCloudFirestore(targetTenant, true);
      const actIndex = targetDb.activities.findIndex((a) => a.id === activityId);

      if (actIndex === -1) {
        sendJson(res, 404, { success: false, error: 'Activity not found' });
        return true;
      }

      const currentAct = targetDb.activities[actIndex];
      const nextIsActive =
        typeof body.isActive === 'boolean'
          ? body.isActive
          : body.isActive === 'false'
          ? false
          : body.isActive === 'true'
          ? true
          : !(currentAct.isActive !== false && (currentAct as any).isActive !== 'false');

      const nowIso = new Date().toISOString();
      targetDb.activities[actIndex] = {
        ...currentAct,
        isActive: nextIsActive,
        updatedAt: nowIso,
      } as ActivityItem;
      targetDb.lastUpdated = nowIso;
      const savedDb = await persistActivitiesDatabaseAndCloud(targetDb, targetTenant, [], true);

      sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        activityId,
        isActive: nextIsActive,
        activity: savedDb.activities[actIndex],
        activities: savedDb.activities,
        lastUpdated: savedDb.lastUpdated,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'Failed to update activity visibility status' });
      return true;
    }
  }

  // 4. POST /api/activities/:id/gallery -> Append additional gallery images to an existing activity
  const galleryPathMatch = cleanPath.match(/^\/api\/activities\/([^/]+)\/gallery$/);
  if (req.method === 'POST' && galleryPathMatch) {
    try {
      const activityId = decodeURIComponent(galleryPathMatch[1]);
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body.tenantId || tenantId);
      const targetDb = await reconcileActivitiesFromCloudFirestore(targetTenant, true);
      const actIndex = targetDb.activities.findIndex((a) => a.id === activityId);

      if (actIndex === -1) {
        sendJson(res, 404, { success: false, error: 'Activity not found' });
        return true;
      }

      const incomingImagesRaw: string[] = Array.isArray(body.images)
        ? body.images
        : Array.isArray(body.galleryImages)
        ? body.galleryImages
        : typeof body.imageUrl === 'string'
        ? [body.imageUrl]
        : [];

      const sanitizedNewImages = incomingImagesRaw
        .filter((img) => typeof img === 'string' && img.trim().length > 0)
        .map((img) => (img.startsWith('data:') ? offloadBase64ToDisk(img, 'activity_gallery') : img));

      const existingGallery = Array.isArray(targetDb.activities[actIndex].galleryImages)
        ? [...targetDb.activities[actIndex].galleryImages!]
        : [];

      // Append new images while preserving all existing images in order
      const mergedGallery = [...existingGallery];
      for (const img of sanitizedNewImages) {
        if (!mergedGallery.includes(img)) {
          mergedGallery.push(img);
        }
      }

      const currentCover = targetDb.activities[actIndex].coverImage;
      const updatedCover = currentCover || (mergedGallery.length > 0 ? mergedGallery[0] : '');
      const nowIso = new Date().toISOString();

      targetDb.activities[actIndex] = {
        ...targetDb.activities[actIndex],
        coverImage: updatedCover,
        galleryImages: mergedGallery,
        updatedAt: nowIso,
      } as ActivityItem;
      targetDb.lastUpdated = nowIso;
      const savedDb = await persistActivitiesDatabaseAndCloud(targetDb, targetTenant, [], true);

      sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        activityId,
        galleryImages: mergedGallery,
        activity: savedDb.activities[actIndex],
        activities: savedDb.activities,
        lastUpdated: savedDb.lastUpdated,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'Failed to append gallery images' });
      return true;
    }
  }

  // 4b. DELETE /api/activities/:id/gallery -> Delete ALL or SINGLE gallery image for an activity
  if (req.method === 'DELETE' && galleryPathMatch) {
    const activityId = decodeURIComponent(galleryPathMatch[1]);
    let body: any = {};
    try {
      body = await readLargeJsonBody(req);
    } catch {
      body = {};
    }
    const targetTenant = normalizeTenantId(body?.tenantId || tenantId);
    const targetDb = await reconcileActivitiesFromCloudFirestore(targetTenant, true);
    const actIndex = targetDb.activities.findIndex((a) => a.id === activityId);

    if (actIndex === -1) {
      sendJson(res, 404, { success: false, error: 'Activity not found' });
      return true;
    }

    const isDeleteAll =
      parsedUrl.searchParams.get('all') === 'true' ||
      body?.all === true;

    const nowIso = new Date().toISOString();

    if (!isDeleteAll && (typeof body?.index === 'number' || typeof body?.imageUrl === 'string')) {
      const currentGallery = Array.isArray(targetDb.activities[actIndex].galleryImages)
        ? [...targetDb.activities[actIndex].galleryImages!]
        : [];
      const targetIndex = typeof body.index === 'number' ? body.index : -1;
      const targetUrl = typeof body.imageUrl === 'string' ? body.imageUrl : undefined;

      const updatedGallery = currentGallery.filter((img, idx) => {
        if (targetUrl) return img !== targetUrl;
        return idx !== targetIndex;
      });

      let updatedCover = targetDb.activities[actIndex].coverImage;
      if (
        (targetUrl && updatedCover === targetUrl) ||
        (targetIndex >= 0 && currentGallery[targetIndex] && updatedCover === currentGallery[targetIndex])
      ) {
        updatedCover = updatedGallery.length > 0 ? updatedGallery[0] : '';
      }

      targetDb.activities[actIndex] = {
        ...targetDb.activities[actIndex],
        coverImage: updatedCover,
        galleryImages: updatedGallery,
        updatedAt: nowIso,
      } as ActivityItem;
      targetDb.lastUpdated = nowIso;
      const savedDb = await persistActivitiesDatabaseAndCloud(targetDb, targetTenant, [], true);

      sendJson(res, 200, {
        success: true,
        activityId,
        galleryImages: updatedGallery,
        activity: savedDb.activities[actIndex],
      });
      return true;
    }

    targetDb.activities[actIndex] = {
      ...targetDb.activities[actIndex],
      galleryImages: [],
      updatedAt: nowIso,
    } as ActivityItem;
    targetDb.lastUpdated = nowIso;
    const savedDb = await persistActivitiesDatabaseAndCloud(targetDb, targetTenant, [], true);

    sendJson(res, 200, {
      success: true,
      activityId,
      galleryImages: [],
      activity: savedDb.activities[actIndex],
    });
    return true;
  }

  // 5. DELETE /api/activities/:id/gallery/:index -> Delete a SINGLE gallery image
  const deleteSingleMatch = cleanPath.match(/^\/api\/activities\/([^/]+)\/gallery\/(\d+)$/);
  if (req.method === 'DELETE' && deleteSingleMatch) {
    const activityId = decodeURIComponent(deleteSingleMatch[1]);
    const targetIndex = parseInt(deleteSingleMatch[2], 10);
    const db = await reconcileActivitiesFromCloudFirestore(tenantId, true);

    const actIndex = db.activities.findIndex((a) => a.id === activityId);
    if (actIndex === -1) {
      sendJson(res, 404, { success: false, error: 'Activity not found' });
      return true;
    }

    const currentGallery = Array.isArray(db.activities[actIndex].galleryImages)
      ? [...db.activities[actIndex].galleryImages!]
      : [];

    if (targetIndex < 0 || targetIndex >= currentGallery.length) {
      sendJson(res, 400, { success: false, error: 'Invalid gallery image index' });
      return true;
    }

    const removedUrl = currentGallery[targetIndex];
    const updatedGallery = currentGallery.filter((_, idx) => idx !== targetIndex);

    let updatedCover = db.activities[actIndex].coverImage;
    if (updatedCover === removedUrl) {
      updatedCover = updatedGallery.length > 0 ? updatedGallery[0] : '';
    }

    const nowIso = new Date().toISOString();
    db.activities[actIndex] = {
      ...db.activities[actIndex],
      coverImage: updatedCover,
      galleryImages: updatedGallery,
      updatedAt: nowIso,
    } as ActivityItem;
    db.lastUpdated = nowIso;
    const savedDb = await persistActivitiesDatabaseAndCloud(db, tenantId, [], true);

    sendJson(res, 200, {
      success: true,
      activityId,
      removedIndex: targetIndex,
      removedUrl,
      galleryImages: updatedGallery,
      activity: savedDb.activities[actIndex],
    });
    return true;
  }

  // 6. DELETE /api/activities/:id -> Permanently delete an activity
  const deleteActivityMatch = cleanPath.match(/^\/api\/activities\/([^/]+)$/);
  if (req.method === 'DELETE' && deleteActivityMatch) {
    const activityId = decodeURIComponent(deleteActivityMatch[1]);
    if (activityId === 'sync' || activityId === 'publish-reference') {
      return false;
    }

    const db = await reconcileActivitiesFromCloudFirestore(tenantId, true);
    const actIndex = db.activities.findIndex((a) => a.id === activityId);
    if (actIndex === -1) {
      await deleteDocFromFirebaseServer('activities', `${tenantId}_${activityId}`).catch(() => {});
      sendJson(res, 200, {
        success: true,
        deletedId: activityId,
        activities: db.activities,
        lastUpdated: db.lastUpdated,
        message: 'تم حذف النشاط من قاعدة البيانات بنجاح.',
      });
      return true;
    }

    const deletedActivity = db.activities[actIndex];
    db.activities = db.activities.filter((a) => a.id !== activityId);
    db.lastUpdated = new Date().toISOString();

    try {
      const savedDb = await persistActivitiesDatabaseAndCloud(db, tenantId, [activityId], true);
      await deleteDocFromFirebaseServer('activities', `${tenantId}_${activityId}`).catch(() => {});
      sendJson(res, 200, {
        success: true,
        deletedId: activityId,
        deletedActivity,
        activities: savedDb.activities,
        lastUpdated: savedDb.lastUpdated,
        message: 'تم حذف النشاط نهائيًا من قاعدة البيانات بنجاح.',
      });
    } catch (err: any) {
      sendJson(res, 500, {
        success: false,
        error: err?.message || 'فشل حذف النشاط من قاعدة البيانات على الخادم.',
      });
    }
    return true;
  }

  return false;
}
