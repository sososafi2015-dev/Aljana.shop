import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import type { TutorialVideo } from '../types';
import {
  initialTutorialVideos,
  initialMainPortalWatchVideos,
  MAIN_PORTAL_WATCH_VIDEOS_SCOPE,
} from '../initialTutorials';
import {
  DATA_DIR as DB_DIR,
  ensureStorageDirectories,
  readLargeJsonBody,
  writeJsonFileAtomicSync,
} from './storageEngine';

export { initialTutorialVideos, initialMainPortalWatchVideos, MAIN_PORTAL_WATCH_VIDEOS_SCOPE };

interface TutorialsDatabase {
  version: number;
  tenantId?: string;
  tutorials: TutorialVideo[];
  lastUpdated: string;
  isCustomized?: boolean;
}

ensureStorageDirectories();

// In-memory cache per tenant/scope for fast access
const inMemoryTutorialsDbMap = new Map<string, TutorialsDatabase>();

function getCleanTenantId(tenantId?: string): string {
  const clean = (tenantId || 'tenant_nour').replace(/[^a-zA-Z0-9_\-]/g, '').trim();
  return clean || 'tenant_nour';
}

function isMainPortalWatchScope(tenantId?: string): boolean {
  return getCleanTenantId(tenantId) === MAIN_PORTAL_WATCH_VIDEOS_SCOPE;
}

function getDbFile(tenantId?: string): string {
  const clean = getCleanTenantId(tenantId);
  if (clean === MAIN_PORTAL_WATCH_VIDEOS_SCOPE) {
    return path.join(DB_DIR, 'main_portal_watch_videos_database.json');
  }
  if (clean === 'tenant_nour' || clean === 'portal') {
    return path.join(DB_DIR, 'tutorials_database.json');
  }
  return path.join(DB_DIR, `tutorials_database_${clean}.json`);
}

function getTenantIdFromRequest(req: IncomingMessage, parsedUrl?: URL): string {
  const hTenant = (req.headers['x-tenant-id'] as string | undefined)?.trim();
  if (hTenant) return hTenant;
  if (parsedUrl) {
    const qTenant = parsedUrl.searchParams.get('tenantId')?.trim();
    if (qTenant) return qTenant;
  }
  return 'tenant_nour';
}

function loadDatabase(tenantId?: string): TutorialsDatabase {
  const cleanTenant = getCleanTenantId(tenantId);

  // Completely isolated branch for «شاهد شرح بالفيديو كيفية استخدام المنصة»
  if (isMainPortalWatchScope(cleanTenant)) {
    const watchDbFile = getDbFile(MAIN_PORTAL_WATCH_VIDEOS_SCOPE);
    try {
      if (fs.existsSync(watchDbFile)) {
        const raw = fs.readFileSync(watchDbFile, 'utf-8');
        const parsed = JSON.parse(raw) as TutorialsDatabase;
        if (parsed && Array.isArray(parsed.tutorials)) {
          const dbObj: TutorialsDatabase = {
            version: parsed.version || 1,
            tenantId: MAIN_PORTAL_WATCH_VIDEOS_SCOPE,
            tutorials: parsed.tutorials,
            lastUpdated: parsed.lastUpdated || '2020-01-01T00:00:00.000Z',
            isCustomized: parsed.isCustomized === true,
          };
          inMemoryTutorialsDbMap.set(MAIN_PORTAL_WATCH_VIDEOS_SCOPE, dbObj);
          return dbObj;
        }
      }
    } catch (err) {
      console.error(`[TutorialsAPI] Failed reading watch videos db file ${watchDbFile}:`, err);
    }

    const cachedWatch = inMemoryTutorialsDbMap.get(MAIN_PORTAL_WATCH_VIDEOS_SCOPE);
    if (cachedWatch) return cachedWatch;

    const freshWatchDb: TutorialsDatabase = {
      version: 1,
      tenantId: MAIN_PORTAL_WATCH_VIDEOS_SCOPE,
      tutorials: JSON.parse(JSON.stringify(initialMainPortalWatchVideos)),
      lastUpdated: '2020-01-01T00:00:00.000Z',
      isCustomized: false,
    };

    try {
      writeJsonFileAtomicSync(watchDbFile, freshWatchDb, 'tutorial_thumb');
      inMemoryTutorialsDbMap.set(MAIN_PORTAL_WATCH_VIDEOS_SCOPE, freshWatchDb);
    } catch {}
    return freshWatchDb;
  }

  // Branch for «تعلم كيفية استخدام المنصة» (Associations & Nour template)
  const masterFile = getDbFile('tenant_nour');
  const dbFile = getDbFile(cleanTenant);

  try {
    if (fs.existsSync(masterFile)) {
      const raw = fs.readFileSync(masterFile, 'utf-8');
      const parsed = JSON.parse(raw) as TutorialsDatabase;
      if (parsed && Array.isArray(parsed.tutorials)) {
        const dbObj: TutorialsDatabase = {
          version: parsed.version || 1,
          tenantId: cleanTenant,
          tutorials: parsed.tutorials,
          lastUpdated: parsed.lastUpdated || '2020-01-01T00:00:00.000Z',
          isCustomized: parsed.isCustomized === true,
        };
        inMemoryTutorialsDbMap.set(cleanTenant, dbObj);
        return dbObj;
      }
    }
    if (fs.existsSync(dbFile)) {
      const raw = fs.readFileSync(dbFile, 'utf-8');
      const parsed = JSON.parse(raw) as TutorialsDatabase;
      if (parsed && Array.isArray(parsed.tutorials)) {
        inMemoryTutorialsDbMap.set(cleanTenant, parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.error(`[TutorialsAPI] Failed reading db file ${dbFile}:`, err);
  }

  const cached = inMemoryTutorialsDbMap.get(cleanTenant);
  if (cached) return cached;

  // Fallback fresh initial database for association tutorials (not yet customized by admin)
  const freshDb: TutorialsDatabase = {
    version: 1,
    tenantId: cleanTenant,
    tutorials: JSON.parse(JSON.stringify(initialTutorialVideos)),
    lastUpdated: '2020-01-01T00:00:00.000Z',
    isCustomized: false,
  };

  try {
    writeJsonFileAtomicSync(masterFile, freshDb, 'tutorial_thumb');
    inMemoryTutorialsDbMap.set(cleanTenant, freshDb);
  } catch {}
  return freshDb;
}

function saveDatabase(db: TutorialsDatabase, tenantId?: string, explicitLastUpdated?: string): boolean {
  const cleanTenant = getCleanTenantId(tenantId);
  const dbFile = getDbFile(cleanTenant);

  try {
    db.lastUpdated = explicitLastUpdated || new Date().toISOString();
    db.isCustomized = true;
    const sanitizedDb = writeJsonFileAtomicSync(dbFile, db, 'tutorial_thumb');
    db.tutorials = sanitizedDb.tutorials;
    inMemoryTutorialsDbMap.set(cleanTenant, sanitizedDb);

    // If saving «شاهد شرح بالفيديو كيفية استخدام المنصة», DO NOT touch association tutorial files!
    if (isMainPortalWatchScope(cleanTenant)) {
      return true;
    }

    // Otherwise, sync «تعلم كيفية استخدام المنصة» across association tenants ONLY (never touching main_portal_watch_videos)
    const masterFile = getDbFile('tenant_nour');
    if (dbFile !== masterFile) {
      const masterDb: TutorialsDatabase = {
        version: (sanitizedDb.version || 1) + 1,
        tenantId: 'tenant_nour',
        tutorials: JSON.parse(JSON.stringify(sanitizedDb.tutorials)),
        lastUpdated: sanitizedDb.lastUpdated,
        isCustomized: true,
      };
      writeJsonFileAtomicSync(masterFile, masterDb, 'tutorial_thumb');
      inMemoryTutorialsDbMap.set('tenant_nour', masterDb);
      inMemoryTutorialsDbMap.set('portal', masterDb);
    }

    try {
      if (fs.existsSync(DB_DIR)) {
        const files = fs.readdirSync(DB_DIR);
        for (const file of files) {
          if (
            file.startsWith('tutorials_database_') &&
            file.endsWith('.json') &&
            !file.includes(MAIN_PORTAL_WATCH_VIDEOS_SCOPE)
          ) {
            const otherTenantPath = path.join(DB_DIR, file);
            const otherTenantMatch = file.match(/^tutorials_database_(.+)\.json$/);
            const otherTenantId = otherTenantMatch ? otherTenantMatch[1] : '';
            if (otherTenantId === MAIN_PORTAL_WATCH_VIDEOS_SCOPE) continue;
            const syncedDb: TutorialsDatabase = {
              version: (sanitizedDb.version || 1) + 1,
              tenantId: otherTenantId || cleanTenant,
              tutorials: JSON.parse(JSON.stringify(sanitizedDb.tutorials)),
              lastUpdated: sanitizedDb.lastUpdated,
              isCustomized: true,
            };
            writeJsonFileAtomicSync(otherTenantPath, syncedDb, 'tutorial_thumb');
            if (otherTenantId) {
              inMemoryTutorialsDbMap.set(otherTenantId, syncedDb);
            }
          }
        }
      }
      // Update any other in-memory cached association tenants (excluding MAIN_PORTAL_WATCH_VIDEOS_SCOPE)
      for (const [key] of inMemoryTutorialsDbMap.entries()) {
        if (key !== cleanTenant && key !== MAIN_PORTAL_WATCH_VIDEOS_SCOPE) {
          inMemoryTutorialsDbMap.set(key, {
            version: (sanitizedDb.version || 1) + 1,
            tenantId: key,
            tutorials: JSON.parse(JSON.stringify(sanitizedDb.tutorials)),
            lastUpdated: sanitizedDb.lastUpdated,
            isCustomized: true,
          });
        }
      }
    } catch (propagateErr) {
      console.warn('[TutorialsAPI] Could not propagate global tutorials to tenants:', propagateErr);
    }

    return true;
  } catch (err) {
    console.error(`[TutorialsAPI] Error writing db file ${dbFile}:`, err);
    return false;
  }
}

function readBody(req: IncomingMessage): Promise<any> {
  return readLargeJsonBody(req);
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
  res.end(JSON.stringify(data));
}

/**
 * Verify whether the incoming request is authorized by the Master Platform Super Admin
 * or an authorized Platform Admin with association_sections_manage permission.
 * Association accounts (Nour association and all other associations) are strictly forbidden from mutations.
 */
function verifyMasterSuperAdminAuth(req: IncomingMessage): { isAuthorized: boolean; adminName: string; reason?: string } {
  try {
    const rawHeader = req.headers['x-admin-session'] || req.headers['authorization'];
    if (!rawHeader) {
      return {
        isAuthorized: false,
        adminName: '',
        reason: 'لا تتوفر جلسة إدارية مصرحة. صلاحية إضافة وتعديل وحذف فيديوهات الشرح محصورة حصراً بأدمن المنصة الرئيسية (Super Admin).',
      };
    }

    let session: any = null;
    if (typeof rawHeader === 'string') {
      try {
        session = JSON.parse(decodeURIComponent(rawHeader));
      } catch {
        try {
          session = JSON.parse(rawHeader);
        } catch {
          session = null;
        }
      }
    } else {
      session = rawHeader;
    }

    if (!session) {
      return {
        isAuthorized: false,
        adminName: '',
        reason: 'بيانات جلسة الأدمن غير صالحة.',
      };
    }

    // Check if the session belongs to the Master Platform Super Admin or authorized Platform Admin
    const isMasterAdmin = (
      session.isMaster === true ||
      session.isMasterPlatformAdmin === true ||
      session.type === 'master_super_admin' ||
      (session.role === 'super_admin' && !session.tenantId && !session.subAdminId) ||
      (session.permissions && session.permissions.association_sections_manage === true && !session.tenantId)
    );

    if (isMasterAdmin) {
      return {
        isAuthorized: true,
        adminName: session.fullName || session.username || 'أدمن المنصة الرئيسية',
      };
    }

    return {
      isAuthorized: false,
      adminName: session.fullName || '',
      reason: 'عذراً، تملك حسابات الجمعيات صلاحية عرض ومشاهدة الفيديوهات فقط. جميع صلاحيات الإضافة والتعديل والحذف محصورة حصراً بأدمن المنصة الرئيسية (Super Admin).',
    };
  } catch (err) {
    console.error('[TutorialsAPI] Auth parse error:', err);
    return {
      isAuthorized: false,
      adminName: '',
      reason: 'حدث خطأ أثناء التحقق من صلاحيات إدارة الفيديوهات.',
    };
  }
}

/**
 * Tutorials API Request Handler
 */
export async function handleTutorialsApi(
  req: IncomingMessage,
  res: ServerResponse,
  _url?: string
): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/tutorials')) {
    return false;
  }

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
    res.end();
    return true;
  }

  const parsedUrl = new URL(url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const tenantId = getTenantIdFromRequest(req, parsedUrl);

  // 1. GET /api/tutorials -> List all tutorials (Available for viewing to all associations and visitors)
  if (pathname === '/api/tutorials' && req.method === 'GET') {
    const db = loadDatabase(tenantId);
    sendJson(res, 200, {
      success: true,
      tutorials: db.tutorials,
      tenantId: db.tenantId || tenantId,
      lastUpdated: db.lastUpdated,
      isCustomized: Boolean(db.isCustomized),
    });
    return true;
  }

  // 1b. PUT or POST /api/tutorials/sync (or /api/tutorials/save-all) -> Bulk save & verify all tutorials
  if (
    (pathname === '/api/tutorials/sync' || pathname === '/api/tutorials/save-all') &&
    (req.method === 'PUT' || req.method === 'POST')
  ) {
    const auth = verifyMasterSuperAdminAuth(req);
    if (!auth.isAuthorized) {
      sendJson(res, 403, {
        success: false,
        error: auth.reason || 'غير مصرح: حفظ تعديلات قسم الفيديوهات محصور بأدمن المنصة الرئيسية فقط.',
      });
      return true;
    }

    try {
      const body = await readBody(req);
      if (!body || !Array.isArray(body.tutorials)) {
        sendJson(res, 400, {
          success: false,
          error: 'بيانات قائمة الفيديوهات غير صالحة للحفظ.',
        });
        return true;
      }

      const currentDb = loadDatabase(tenantId);
      const seenIds = new Set<string>();
      const normalizedTutorials: TutorialVideo[] = [];

      body.tutorials.forEach((rawItem: any, idx: number) => {
        if (!rawItem || typeof rawItem !== 'object') return;
        const title = String(rawItem.title || '').trim();
        const videoUrl = String(rawItem.videoUrl || '').trim();
        if (!title || !videoUrl) return;

        const id = String(rawItem.id || `tut-${Date.now()}-${idx}`).trim();
        if (seenIds.has(id)) return;
        seenIds.add(id);

        const cleanThumb =
          typeof rawItem.thumbnailUrl === 'string' && rawItem.thumbnailUrl.trim() !== ''
            ? rawItem.thumbnailUrl.trim()
            : undefined;

        normalizedTutorials.push({
          id,
          title,
          description: rawItem.description !== undefined ? String(rawItem.description || '').trim() : '',
          sourceType: rawItem.sourceType === 'upload' ? 'upload' : 'url',
          videoUrl,
          originalFilename: rawItem.originalFilename ? String(rawItem.originalFilename) : undefined,
          fileSize: rawItem.fileSize ? Number(rawItem.fileSize) : undefined,
          duration: rawItem.duration ? String(rawItem.duration).trim() : undefined,
          thumbnailUrl: cleanThumb,
          aspectRatio:
            rawItem.aspectRatio === 'portrait' || rawItem.aspectRatio === 'landscape' || rawItem.aspectRatio === 'auto'
              ? rawItem.aspectRatio
              : undefined,
          createdAt: rawItem.createdAt || new Date().toISOString(),
          updatedAt: rawItem.updatedAt || new Date().toISOString(),
          tenantId: getCleanTenantId(tenantId),
          addedBy: rawItem.addedBy || auth.adminName || 'أدمن المنصة الرئيسية',
          order: idx + 1,
        });
      });

      const updatedDb: TutorialsDatabase = {
        version: (currentDb.version || 1) + 1,
        tenantId: getCleanTenantId(tenantId),
        tutorials: normalizedTutorials,
        lastUpdated: body.lastUpdated || new Date().toISOString(),
        isCustomized: true,
      };

      const savedOk = saveDatabase(updatedDb, tenantId, updatedDb.lastUpdated);
      if (!savedOk) {
        sendJson(res, 500, {
          success: false,
          error: 'تعذر كتابة التعديلات في قاعدة البيانات الدائمة.',
        });
        return true;
      }

      // Re-read from disk to verify persistence
      const verifiedDb = loadDatabase(tenantId);

      sendJson(res, 200, {
        success: true,
        message: 'تم حفظ التعديلات بنجاح',
        tutorials: verifiedDb.tutorials,
        lastUpdated: verifiedDb.lastUpdated,
        isCustomized: true,
      });
      return true;
    } catch (err: any) {
      console.error('[TutorialsAPI] Error syncing tutorials:', err);
      sendJson(res, 500, {
        success: false,
        error: `حدث خطأ أثناء حفظ التعديلات في قاعدة البيانات: ${err?.message || 'خطأ غير متوقع'}`,
      });
      return true;
    }
  }

  // 2. POST /api/tutorials -> Add a new tutorial video (Master Super Admin ONLY)
  if (pathname === '/api/tutorials' && req.method === 'POST') {
    const auth = verifyMasterSuperAdminAuth(req);
    if (!auth.isAuthorized) {
      sendJson(res, 403, {
        success: false,
        error: auth.reason || 'غير مصرح: إضافة فيديوهات الشرح محصورة بأدمن المنصة الرئيسية فقط.',
      });
      return true;
    }

    try {
      const body = await readBody(req);
      const title = (body.title || '').trim();
      const videoUrl = (body.videoUrl || '').trim();
      const sourceType = body.sourceType === 'upload' ? 'upload' : 'url';

      if (!title) {
        sendJson(res, 400, {
          success: false,
          error: 'حقل عنوان الفيديو إلزامي ولا يمكن تركه فارغاً.',
        });
        return true;
      }

      if (!videoUrl) {
        sendJson(res, 400, {
          success: false,
          error: 'يرجى إدخال رابط الفيديو أو رفع ملف فيديو صالح.',
        });
        return true;
      }

      const db = loadDatabase(tenantId);
      const cleanThumbnail =
        typeof body.thumbnailUrl === 'string' && body.thumbnailUrl.trim() !== ''
          ? body.thumbnailUrl.trim()
          : undefined;

      const newTutorial: TutorialVideo = {
        id: body.id && String(body.id).trim() ? String(body.id).trim() : `tut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title,
        description: (body.description || '').trim(),
        sourceType,
        videoUrl,
        originalFilename: body.originalFilename || undefined,
        fileSize: body.fileSize ? Number(body.fileSize) : undefined,
        duration: body.duration ? String(body.duration).trim() : undefined,
        thumbnailUrl: cleanThumbnail,
        aspectRatio: body.aspectRatio || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: getCleanTenantId(tenantId),
        addedBy: body.addedBy || auth.adminName || 'أدمن المنصة الرئيسية',
        order: 1,
      };

      // Add to beginning of list so the newest video appears first, and normalize order
      db.tutorials = [newTutorial, ...db.tutorials.filter((t) => t.id !== newTutorial.id)];
      db.tutorials.forEach((item, idx) => {
        item.order = idx + 1;
      });

      const savedOk = saveDatabase(db, tenantId);
      if (!savedOk) {
        sendJson(res, 500, {
          success: false,
          error: 'تعذر كتابة بيانات الفيديو في قاعدة البيانات الدائمة.',
        });
        return true;
      }

      const verifiedDb = loadDatabase(tenantId);
      const persistedNew = verifiedDb.tutorials.find((t) => t.id === newTutorial.id) || newTutorial;

      sendJson(res, 201, {
        success: true,
        message: 'تمت إضافة فيديو الشرح التعليمي بنجاح وحفظه بشكل دائم.',
        tutorial: persistedNew,
        tutorials: verifiedDb.tutorials,
        lastUpdated: verifiedDb.lastUpdated,
      });
      return true;
    } catch (err: any) {
      console.error('[TutorialsAPI] Error creating tutorial:', err);
      sendJson(res, 500, {
        success: false,
        error: `حدث خطأ أثناء حفظ الفيديو التعليمي: ${err?.message || 'خطأ غير متوقع'}`,
      });
      return true;
    }
  }

  // 2b. PUT /api/tutorials/reorder -> Reorder all tutorials (Master Super Admin ONLY)
  if (pathname === '/api/tutorials/reorder' && req.method === 'PUT') {
    const auth = verifyMasterSuperAdminAuth(req);
    if (!auth.isAuthorized) {
      sendJson(res, 403, {
        success: false,
        error: auth.reason || 'غير مصرح: إعادة ترتيب الفيديوهات محصورة بأدمن المنصة الرئيسية فقط.',
      });
      return true;
    }

    try {
      const body = await readBody(req);
      const orderedIds: string[] = Array.isArray(body.orderedIds) ? body.orderedIds : [];
      if (!orderedIds.length) {
        sendJson(res, 400, {
          success: false,
          error: 'قائمة ترتيب الفيديوهات مطلوبة.',
        });
        return true;
      }

      const db = loadDatabase(tenantId);
      const idMap = new Map(db.tutorials.map((t) => [t.id, t]));
      const newTutorialsList: TutorialVideo[] = [];

      orderedIds.forEach((id, idx) => {
        const item = idMap.get(id);
        if (item) {
          newTutorialsList.push({
            ...item,
            order: idx + 1,
            updatedAt: new Date().toISOString(),
          });
          idMap.delete(id);
        }
      });

      // Append any remaining items that weren't in orderedIds
      idMap.forEach((remaining) => {
        newTutorialsList.push({
          ...remaining,
          order: newTutorialsList.length + 1,
        });
      });

      db.tutorials = newTutorialsList;
      const savedOk = saveDatabase(db, tenantId);
      if (!savedOk) {
        sendJson(res, 500, {
          success: false,
          error: 'تعذر حفظ ترتيب الفيديوهات في قاعدة البيانات.',
        });
        return true;
      }

      const verifiedDb = loadDatabase(tenantId);
      sendJson(res, 200, {
        success: true,
        message: 'تم تحديث ترتيب فيديوهات الشرح بنجاح.',
        tutorials: verifiedDb.tutorials,
        lastUpdated: verifiedDb.lastUpdated,
      });
      return true;
    } catch (err: any) {
      console.error('[TutorialsAPI] Error reordering tutorials:', err);
      sendJson(res, 500, {
        success: false,
        error: `حدث خطأ أثناء إعادة ترتيب الفيديوهات: ${err?.message || 'خطأ غير متوقع'}`,
      });
      return true;
    }
  }

  // 3. PUT /api/tutorials/:id -> Edit an existing tutorial video in-place (Master Super Admin ONLY)
  const putMatch = pathname.match(/^\/api\/tutorials\/([^/]+)$/);
  if (putMatch && putMatch[1] !== 'reorder' && putMatch[1] !== 'sync' && putMatch[1] !== 'save-all' && (req.method === 'PUT' || req.method === 'PATCH')) {
    const auth = verifyMasterSuperAdminAuth(req);
    if (!auth.isAuthorized) {
      sendJson(res, 403, {
        success: false,
        error: auth.reason || 'غير مصرح: تعديل فيديوهات الشرح محصور بأدمن المنصة الرئيسية فقط.',
      });
      return true;
    }

    const videoId = decodeURIComponent(putMatch[1]).trim();
    try {
      const body = await readBody(req);
      const title = body.title !== undefined ? (body.title || '').trim() : undefined;
      const videoUrl = body.videoUrl !== undefined ? (body.videoUrl || '').trim() : undefined;

      if (title !== undefined && !title) {
        sendJson(res, 400, {
          success: false,
          error: 'حقل عنوان الفيديو إلزامي ولا يمكن تركه فارغاً.',
        });
        return true;
      }

      if (videoUrl !== undefined && !videoUrl) {
        sendJson(res, 400, {
          success: false,
          error: 'حقل رابط أو ملف الفيديو إلزامي ولا يمكن تركه فارغاً.',
        });
        return true;
      }

      const db = loadDatabase(tenantId);
      const index = db.tutorials.findIndex((t) => t.id === videoId);

      if (index === -1) {
        sendJson(res, 404, {
          success: false,
          error: `فيديو الشرح بالمعرف «${videoId}» غير موجود في قاعدة البيانات.`,
        });
        return true;
      }

      const current = db.tutorials[index];
      const resolvedThumbnailUrl =
        body.thumbnailUrl !== undefined
          ? (typeof body.thumbnailUrl === 'string' && body.thumbnailUrl.trim() !== ''
              ? body.thumbnailUrl.trim()
              : undefined)
          : current.thumbnailUrl;

      const resolvedDuration =
        body.duration !== undefined
          ? (typeof body.duration === 'string' && body.duration.trim() !== ''
              ? body.duration.trim()
              : undefined)
          : current.duration;

      const updated: TutorialVideo = {
        ...current,
        id: current.id, // Guarantee same ID, never duplicate
        title: title !== undefined ? title : current.title,
        description: body.description !== undefined ? (body.description || '').trim() : current.description,
        sourceType: body.sourceType ? (body.sourceType === 'upload' ? 'upload' : 'url') : current.sourceType,
        videoUrl: videoUrl !== undefined && videoUrl !== '' ? videoUrl : current.videoUrl,
        originalFilename: body.originalFilename !== undefined ? body.originalFilename : current.originalFilename,
        fileSize: body.fileSize !== undefined ? Number(body.fileSize) : current.fileSize,
        duration: resolvedDuration,
        thumbnailUrl: resolvedThumbnailUrl,
        aspectRatio: body.aspectRatio !== undefined ? body.aspectRatio : current.aspectRatio,
        updatedAt: new Date().toISOString(),
      };

      // Strictly update in-place and deduplicate any accidental duplicate IDs
      db.tutorials[index] = updated;
      const seenIds = new Set<string>();
      db.tutorials = db.tutorials.filter((item) => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });

      const savedOk = saveDatabase(db, tenantId);
      if (!savedOk) {
        sendJson(res, 500, {
          success: false,
          error: 'تعذر حفظ التعديلات في قاعدة البيانات الدائمة.',
        });
        return true;
      }

      const verifiedDb = loadDatabase(tenantId);
      const persistedTutorial = verifiedDb.tutorials.find((t) => t.id === videoId) || updated;

      sendJson(res, 200, {
        success: true,
        message: 'تم حفظ التعديلات بنجاح',
        tutorial: persistedTutorial,
        tutorials: verifiedDb.tutorials,
        lastUpdated: verifiedDb.lastUpdated,
        isCustomized: true,
      });
      return true;
    } catch (err: any) {
      console.error('[TutorialsAPI] Error updating tutorial:', err);
      sendJson(res, 500, {
        success: false,
        error: `حدث خطأ أثناء تعديل الفيديو: ${err?.message || 'خطأ غير متوقع'}`,
      });
      return true;
    }
  }

  // 4. DELETE /api/tutorials/:id -> Delete a tutorial video (Master Super Admin ONLY)
  const deleteMatch = pathname.match(/^\/api\/tutorials\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const auth = verifyMasterSuperAdminAuth(req);
    if (!auth.isAuthorized) {
      sendJson(res, 403, {
        success: false,
        error: auth.reason || 'غير مصرح: حذف فيديوهات الشرح محصور بأدمن المنصة الرئيسية فقط.',
      });
      return true;
    }

    const videoId = decodeURIComponent(deleteMatch[1]).trim();
    try {
      const db = loadDatabase(tenantId);
      const index = db.tutorials.findIndex((t) => t.id === videoId);

      if (index === -1) {
        // Even if the video was already removed from disk, return 200 so the client cache clears it cleanly
        saveDatabase(db, tenantId);
        const verifiedDb = loadDatabase(tenantId);
        sendJson(res, 200, {
          success: true,
          message: 'تم حذف فيديو الشرح التعليمي بنجاح من قاعدة البيانات.',
          id: videoId,
          tutorials: verifiedDb.tutorials,
          lastUpdated: verifiedDb.lastUpdated,
          isCustomized: true,
        });
        return true;
      }

      const removed = db.tutorials.splice(index, 1)[0];
      db.tutorials.forEach((item, idx) => {
        item.order = idx + 1;
      });
      saveDatabase(db, tenantId);
      const verifiedDb = loadDatabase(tenantId);

      sendJson(res, 200, {
        success: true,
        message: 'تم حذف فيديو الشرح التعليمي بنجاح من قاعدة البيانات.',
        id: videoId,
        title: removed.title,
        tutorials: verifiedDb.tutorials,
        lastUpdated: verifiedDb.lastUpdated,
        isCustomized: true,
      });
      return true;
    } catch (err: any) {
      console.error('[TutorialsAPI] Error deleting tutorial:', err);
      sendJson(res, 500, {
        success: false,
        error: `حدث خطأ أثناء حذف الفيديو: ${err?.message || 'خطأ غير متوقع'}`,
      });
      return true;
    }
  }

  sendJson(res, 404, {
    success: false,
    error: 'مسار إدارة الفيديوهات التعليمية غير موجود.',
  });
  return true;
}
