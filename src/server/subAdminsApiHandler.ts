import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { initialSubAdmins } from '../initialData';
import type { SubAdmin } from '../types';
import {
  DATA_DIR,
  ensureStorageDirectories,
  readJsonFileSync,
  readLargeJsonBody,
  writeJsonFileAtomicSync,
  normalizeTenantId,
} from './storageEngine';
import {
  syncTenantCollectionToFirebaseServer,
  listCollectionFromFirebaseServer,
  deleteDocFromFirebaseServer,
} from './firebaseServerStorage';
import { readTenantRecordsFromDisk, writeTenantRecordsToDisk } from './tenantRecordsApiHandler';

interface SubAdminsDatabase {
  subAdmins: SubAdmin[];
  deletedSubAdminIds?: string[];
  lastUpdated: string;
}

interface AdminSessionPayload {
  type: 'super_admin' | 'sub_admin';
  role?: 'main_admin' | 'secondary_admin';
  id?: string;
  fullName: string;
  phone?: string;
  tenantId?: string;
  subAdmin?: SubAdmin;
}

const DB_FILE = path.join(DATA_DIR, 'subadmins_database.json');

function syncSubAdminsToTenantRecordOnDisk(subAdmins: SubAdmin[], tenantId: string = 'tenant_nour', deletedIds: string[] = []): void {
  try {
    const cleanTenant = normalizeTenantId(tenantId);
    const rec = readTenantRecordsFromDisk(cleanTenant);
    const delSet = new Set(deletedIds);
    const tenantSubs = subAdmins.filter(
      (s) => s && s.id && !delSet.has(s.id) && (!s.tenantId || normalizeTenantId(s.tenantId) === cleanTenant)
    );
    const existingSubs = Array.isArray(rec.subAdmins) ? rec.subAdmins : [];
    const map = new Map<string, SubAdmin>();
    for (const ex of existingSubs) {
      if (ex && ex.id && !delSet.has(ex.id)) {
        map.set(ex.id, ex);
      }
    }
    for (const s of tenantSubs) {
      if (s && s.id && !delSet.has(s.id)) {
        const prev = map.get(s.id);
        map.set(s.id, prev ? { ...prev, ...s } : s);
      }
    }
    rec.subAdmins = Array.from(map.values());
    writeTenantRecordsToDisk(rec, cleanTenant, false);
  } catch (err) {
    console.warn('[subAdminsApiHandler] Could not sync subAdmins to tenant record:', err);
  }
}

export function loadSubAdminsDatabase(): SubAdminsDatabase {
  ensureStorageDirectories();
  const parsed = readJsonFileSync<SubAdminsDatabase | null>(DB_FILE, null);
  const deletedIds = Array.isArray(parsed?.deletedSubAdminIds) ? parsed!.deletedSubAdminIds! : [];
  const delSet = new Set(deletedIds);

  const map = new Map<string, SubAdmin>();
  let changed = false;

  // 1. Seed with initialSubAdmins (unless explicitly deleted)
  for (const seed of Array.isArray(initialSubAdmins) ? initialSubAdmins : []) {
    if (seed && seed.id && !delSet.has(seed.id)) {
      map.set(seed.id, { ...seed, tenantId: seed.tenantId || 'tenant_nour' });
    }
  }

  // 2. Merge from tenant_nour records on disk if any
  try {
    const nourRec = readTenantRecordsFromDisk('tenant_nour');
    if (Array.isArray(nourRec.subAdmins)) {
      for (const s of nourRec.subAdmins) {
        if (s && s.id && !delSet.has(s.id)) {
          const prev = map.get(s.id);
          map.set(s.id, prev ? { ...prev, ...s } : { ...s, tenantId: s.tenantId || 'tenant_nour' });
        }
      }
    }
  } catch {}

  // 3. Merge from subadmins_database.json
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.subAdmins)) {
    for (const adm of parsed.subAdmins) {
      if (!adm || !adm.id || delSet.has(adm.id)) continue;
      let enriched = { ...adm, tenantId: adm.tenantId || 'tenant_nour' };
      if (!enriched.username) {
        const found = initialSubAdmins.find((i) => i.id === adm.id);
        if (found?.username) {
          enriched = { ...enriched, username: found.username };
          changed = true;
        }
      }
      const prev = map.get(enriched.id);
      map.set(enriched.id, prev ? { ...prev, ...enriched } : enriched);
    }
    const mergedList = Array.from(map.values());
    if (changed || mergedList.length !== parsed.subAdmins.length) {
      const updatedDb: SubAdminsDatabase = {
        subAdmins: mergedList,
        deletedSubAdminIds: deletedIds,
        lastUpdated: new Date().toISOString(),
      };
      writeJsonFileAtomicSync(DB_FILE, updatedDb);
      syncSubAdminsToTenantRecordOnDisk(mergedList, 'tenant_nour', deletedIds);
      return updatedDb;
    }
    return {
      subAdmins: mergedList,
      deletedSubAdminIds: deletedIds,
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  }

  const seeded: SubAdminsDatabase = {
    subAdmins: Array.from(map.values()),
    deletedSubAdminIds: deletedIds,
    lastUpdated: new Date().toISOString(),
  };

  saveSubAdminsDatabase(seeded);
  syncSubAdminsToTenantRecordOnDisk(seeded.subAdmins, 'tenant_nour', deletedIds);
  return seeded;
}

export function saveSubAdminsDatabase(db: SubAdminsDatabase): boolean {
  return Boolean(writeJsonFileAtomicSync(DB_FILE, db));
}

let firestoreHydrationPromise: Promise<SubAdmin[]> | null = null;
export async function hydrateSubAdminsFromFirestore(): Promise<SubAdmin[]> {
  if (firestoreHydrationPromise) return firestoreHydrationPromise;
  firestoreHydrationPromise = (async () => {
    try {
      const db = loadSubAdminsDatabase();
      const delSet = new Set(db.deletedSubAdminIds || []);
      const cloudDocs = await listCollectionFromFirebaseServer<SubAdmin>('sub_admins');
      if (!Array.isArray(cloudDocs) || cloudDocs.length === 0) {
        return db.subAdmins;
      }
      const map = new Map<string, SubAdmin>();
      for (const local of db.subAdmins) {
        if (local && local.id && !delSet.has(local.id)) {
          map.set(local.id, local);
        }
      }
      let addedOrUpdated = false;
      const touchedTenants = new Set<string>(['tenant_nour']);
      for (const docItem of cloudDocs) {
        if (!docItem || !docItem.id || delSet.has(docItem.id)) continue;
        const cleanTenant = normalizeTenantId(docItem.tenantId || docItem.associationId || 'tenant_nour');
        touchedTenants.add(cleanTenant);
        const existing = map.get(docItem.id);
        if (!existing) {
          map.set(docItem.id, { ...docItem, tenantId: cleanTenant });
          addedOrUpdated = true;
        } else if (!existing.username && docItem.username) {
          map.set(docItem.id, { ...existing, ...docItem, tenantId: cleanTenant });
          addedOrUpdated = true;
        }
      }
      const finalSubs = Array.from(map.values());
      if (addedOrUpdated) {
        db.subAdmins = finalSubs;
        db.lastUpdated = new Date().toISOString();
        saveSubAdminsDatabase(db);
        for (const tId of touchedTenants) {
          syncSubAdminsToTenantRecordOnDisk(finalSubs, tId, db.deletedSubAdminIds || []);
        }
      }
      return finalSubs;
    } catch (err) {
      console.warn('[subAdminsApiHandler] hydrateSubAdminsFromFirestore warning:', err);
      return loadSubAdminsDatabase().subAdmins;
    } finally {
      setTimeout(() => {
        firestoreHydrationPromise = null;
      }, 5000);
    }
  })();
  return firestoreHydrationPromise;
}

// Hydrate from Cloud Firestore on server startup
setTimeout(() => {
  hydrateSubAdminsFromFirestore().catch(() => {});
}, 1000);

function readBody(req: IncomingMessage): Promise<any> {
  return readLargeJsonBody(req);
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
  res.end(JSON.stringify(data));
}

function parseAdminSession(req: IncomingMessage): AdminSessionPayload | null {
  const sessionHeader = req.headers['x-admin-session'] as string | undefined;
  if (!sessionHeader) return null;
  try {
    return JSON.parse(decodeURIComponent(sessionHeader));
  } catch {
    try {
      return JSON.parse(sessionHeader);
    } catch {
      return null;
    }
  }
}

function isMainAdmin(session: AdminSessionPayload | null): boolean {
  if (!session) {
    // Fallback: If in dev mode without header, we allow read, but require header for mutations if passed
    return true;
  }
  return session.type === 'super_admin' || session.role === 'main_admin' || (session as any).isMasterPlatformAdmin === true;
}

export async function handleSubAdminsApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/subadmins')) {
    return false;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  const db = loadSubAdminsDatabase();
  const session = parseAdminSession(req);
  const parsedUrl = new URL(url, 'http://localhost:3000');
  const pathname = parsedUrl.pathname;
  const reqTenantId = normalizeTenantId(
    (req.headers['x-tenant-id'] as string) ||
      parsedUrl.searchParams.get('tenantId') ||
      session?.tenantId ||
      'tenant_nour'
  );

  // 1. GET /api/subadmins - Retrieve latest sub-admins list
  if (req.method === 'GET' && (pathname === '/api/subadmins' || pathname === '/api/subadmins/')) {
    await hydrateSubAdminsFromFirestore().catch(() => {});
    const freshDb = loadSubAdminsDatabase();
    sendJson(res, 200, {
      success: true,
      subAdmins: freshDb.subAdmins,
      lastUpdated: freshDb.lastUpdated,
    });
    return true;
  }

  // All modification actions below require Main Admin privileges
  if (session && !isMainAdmin(session)) {
    sendJson(res, 403, {
      success: false,
      statusCode: 403,
      error: 'Access Denied (403 Forbidden): إدارة وتعيين وحذف وتفعيل حسابات الأدمن مخصصة حصرياً للأدمن الرئيسي.',
    });
    return true;
  }

  // 2. POST /api/subadmins/sync - Non-destructive bulk synchronization
  if (req.method === 'POST' && pathname === '/api/subadmins/sync') {
    try {
      const body = await readBody(req);
      const incomingList = Array.isArray(body) ? body : body.subAdmins;

      if (!Array.isArray(incomingList)) {
        sendJson(res, 400, { success: false, error: 'قائمة حسابات الأدمن غير صالحة' });
        return true;
      }

      const delSet = new Set(db.deletedSubAdminIds || []);
      const map = new Map<string, SubAdmin>();

      // Preserve existing sub-admins on server so stale client caches never overwrite created accounts
      for (const existing of db.subAdmins) {
        if (existing && existing.id && !delSet.has(existing.id)) {
          map.set(existing.id, existing);
        }
      }

      // Merge incoming items
      for (const item of incomingList) {
        if (!item || !item.id || delSet.has(item.id)) continue;
        const prev = map.get(item.id);
        map.set(item.id, prev ? { ...prev, ...item, tenantId: item.tenantId || prev.tenantId || reqTenantId } : { ...item, tenantId: item.tenantId || reqTenantId });
      }

      db.subAdmins = Array.from(map.values());
      db.lastUpdated = new Date().toISOString();
      saveSubAdminsDatabase(db);
      syncSubAdminsToTenantRecordOnDisk(db.subAdmins, reqTenantId, db.deletedSubAdminIds || []);
      syncTenantCollectionToFirebaseServer('sub_admins', reqTenantId, db.subAdmins).catch(() => {});

      sendJson(res, 200, {
        success: true,
        message: 'تمت مزامنة حسابات الأدمن في قاعدة البيانات بنجاح',
        subAdmins: db.subAdmins,
        lastUpdated: db.lastUpdated,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ في معالجة طلب المزامنة' });
      return true;
    }
  }

  // 3. DELETE /api/subadmins/:id - Permanent deletion from database
  if (req.method === 'DELETE' && pathname.startsWith('/api/subadmins/')) {
    const adminId = decodeURIComponent(pathname.replace('/api/subadmins/', '')).trim();

    if (!adminId) {
      sendJson(res, 400, { success: false, error: 'معرف الأدمن غير محدد' });
      return true;
    }

    // Security check: Prevent deleting main admin / super admin
    if (adminId === 'main_admin' || adminId === 'super_admin' || adminId.startsWith('super-')) {
      sendJson(res, 403, {
        success: false,
        error: 'محظور أمنياً: لا يمكن حذف حساب الأدمن الرئيسي نهائياً.',
      });
      return true;
    }

    // Prevent sub-admin from deleting self (double check)
    if (session && session.id === adminId && session.type !== 'super_admin' && session.role !== 'main_admin') {
      sendJson(res, 403, {
        success: false,
        error: 'محظور أمنياً: لا يمكن للأدمن من الدرجة الثانية حذف حسابه بنفسه.',
      });
      return true;
    }

    const targetSub = db.subAdmins.find((a) => a.id === adminId);
    const targetTenant = normalizeTenantId(targetSub?.tenantId || reqTenantId);

    db.subAdmins = db.subAdmins.filter((a) => a.id !== adminId);
    db.deletedSubAdminIds = Array.from(new Set([...(db.deletedSubAdminIds || []), adminId]));
    db.lastUpdated = new Date().toISOString();
    saveSubAdminsDatabase(db);
    syncSubAdminsToTenantRecordOnDisk(db.subAdmins, targetTenant, db.deletedSubAdminIds);
    deleteDocFromFirebaseServer('sub_admins', `${targetTenant}_${adminId}`.replace(/[^a-zA-Z0-9_.-]/g, '_')).catch(() => {});

    sendJson(res, 200, {
      success: true,
      message: 'تم حذف حساب الأدمن من قاعدة البيانات نهائياً.',
      subAdmins: db.subAdmins,
      lastUpdated: db.lastUpdated,
      deletedId: adminId,
    });
    return true;
  }

  // 4. PATCH /api/subadmins/:id/status - Toggle active/disabled status
  if (req.method === 'PATCH' && pathname.includes('/status')) {
    const parts = pathname.split('/');
    // /api/subadmins/:id/status
    const adminId = decodeURIComponent(parts[3] || '').trim();

    if (!adminId) {
      sendJson(res, 400, { success: false, error: 'معرف الأدمن غير محدد' });
      return true;
    }

    try {
      const body = await readBody(req);
      const newStatus: 'active' | 'inactive' = body.status === 'active' ? 'active' : 'inactive';

      let found = false;
      db.subAdmins = db.subAdmins.map((a) => {
        if (a.id === adminId) {
          found = true;
          // Strictly preserve all existing permissions, data, notes, and password
          return {
            ...a,
            status: newStatus,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      });

      if (!found) {
        sendJson(res, 404, { success: false, error: 'لم يتم العثور على حساب الأدمن المحدد' });
        return true;
      }

      db.lastUpdated = new Date().toISOString();
      saveSubAdminsDatabase(db);
      syncSubAdminsToTenantRecordOnDisk(db.subAdmins, reqTenantId, db.deletedSubAdminIds || []);
      syncTenantCollectionToFirebaseServer('sub_admins', reqTenantId, db.subAdmins).catch(() => {});

      sendJson(res, 200, {
        success: true,
        message: newStatus === 'active' ? 'تم تفعيل الأدمن بنجاح.' : 'تم تعطيل الأدمن بنجاح.',
        status: newStatus,
        subAdmins: db.subAdmins,
        lastUpdated: db.lastUpdated,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ في تعديل حالة الأدمن' });
      return true;
    }
  }

  // 5. POST /api/subadmins - Create new sub-admin
  if (req.method === 'POST' && (pathname === '/api/subadmins' || pathname === '/api/subadmins/')) {
    try {
      const body = await readBody(req);
      const newAdmin: SubAdmin = body.subAdmin || body;

      if (!newAdmin || !newAdmin.fullName || !newAdmin.phone) {
        sendJson(res, 400, { success: false, error: 'بيانات الأدمن غير مكتملة (الاسم الكامل ورقم الهاتف إلزاميان)' });
        return true;
      }

      const cleanPhone = (newAdmin.phone || '').trim().replace(/[\s\-\.\(\)]/g, '');
      const existingPhone = db.subAdmins.find(
        (a) => a.id !== newAdmin.id && a.phone.replace(/[\s\-\.\(\)]/g, '') === cleanPhone
      );
      if (existingPhone) {
        sendJson(res, 400, { success: false, error: 'يوجد بالفعل حساب أدمن مسجل بهذا الرقم في قاعدة البيانات.' });
        return true;
      }

      const cleanUsername = (newAdmin.username || '').trim();
      if (cleanUsername) {
        const existingUsername = db.subAdmins.find(
          (a) =>
            a.id !== newAdmin.id &&
            a.username &&
            a.username.trim().toLowerCase() === cleanUsername.toLowerCase()
        );
        if (existingUsername) {
          sendJson(res, 400, { success: false, error: 'اسم المستخدم هذا مستخدم بالفعل من طرف حساب آخر في قاعدة البيانات.' });
          return true;
        }
      }

      const tenantId = normalizeTenantId((newAdmin as any).tenantId || reqTenantId);

      const adminToSave: SubAdmin & { tenantId?: string } = {
        ...newAdmin,
        id: newAdmin.id || `subadmin-${Date.now()}`,
        fullName: newAdmin.fullName.trim(),
        username: cleanUsername || undefined,
        phone: cleanPhone,
        status: newAdmin.status === 'inactive' ? 'inactive' : 'active',
        createdAt: newAdmin.createdAt || new Date().toISOString(),
        permissions: newAdmin.permissions || ({} as any),
        tenantId,
      };

      // If this ID was previously in deletedSubAdminIds, remove it
      if (Array.isArray(db.deletedSubAdminIds) && db.deletedSubAdminIds.includes(adminToSave.id)) {
        db.deletedSubAdminIds = db.deletedSubAdminIds.filter((id) => id !== adminToSave.id);
      }

      const existingIdx = db.subAdmins.findIndex((a) => a.id === adminToSave.id);
      if (existingIdx >= 0) {
        db.subAdmins[existingIdx] = adminToSave;
      } else {
        db.subAdmins = [adminToSave, ...db.subAdmins];
      }
      db.lastUpdated = new Date().toISOString();
      saveSubAdminsDatabase(db);
      syncSubAdminsToTenantRecordOnDisk(db.subAdmins, tenantId, db.deletedSubAdminIds || []);
      syncTenantCollectionToFirebaseServer('sub_admins', tenantId, db.subAdmins).catch(() => {});

      sendJson(res, 201, {
        success: true,
        message: `تم إنشاء حساب الأدمن «${adminToSave.fullName}» في قاعدة البيانات بنجاح.`,
        subAdmin: adminToSave,
        subAdmins: db.subAdmins,
        lastUpdated: db.lastUpdated,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ في إنشاء حساب الأدمن' });
      return true;
    }
  }

  // 6. PUT /api/subadmins/:id or PUT /api/subadmins - Update existing sub-admin
  if (req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const incoming: SubAdmin = body.subAdmin || body;
      const urlId = pathname.replace('/api/subadmins', '').replace(/^\//, '');
      const targetId = urlId || incoming.id;

      if (!targetId) {
        sendJson(res, 400, { success: false, error: 'معرف الأدمن غير محدد' });
        return true;
      }

      if (incoming.username) {
        const cleanIncomingUser = incoming.username.trim();
        const existingUsername = db.subAdmins.find(
          (a) => a.id !== targetId && a.username && a.username.trim().toLowerCase() === cleanIncomingUser.toLowerCase()
        );
        if (existingUsername) {
          sendJson(res, 400, { success: false, error: 'اسم المستخدم هذا مستخدم بالفعل من طرف حساب آخر في قاعدة البيانات.' });
          return true;
        }
      }

      const tenantId = normalizeTenantId((incoming as any).tenantId || reqTenantId);
      let found = false;
      db.subAdmins = db.subAdmins.map((a) => {
        if (a.id === targetId) {
          found = true;
          return {
            ...a,
            ...incoming,
            id: a.id, // Immutable ID
            createdAt: a.createdAt, // Immutable creation date
            username: incoming.username !== undefined ? (incoming.username ? incoming.username.trim() : undefined) : a.username,
            permissions: incoming.permissions !== undefined ? incoming.permissions : a.permissions,
            tenantId: (incoming as any).tenantId || a.tenantId || tenantId,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      });

      if (!found) {
        // Upsert if not found on disk yet
        const upserted: SubAdmin = {
          ...incoming,
          id: targetId,
          createdAt: incoming.createdAt || new Date().toISOString(),
          tenantId,
          updatedAt: new Date().toISOString(),
        };
        db.subAdmins = [upserted, ...db.subAdmins];
      }

      db.lastUpdated = new Date().toISOString();
      saveSubAdminsDatabase(db);
      syncSubAdminsToTenantRecordOnDisk(db.subAdmins, tenantId, db.deletedSubAdminIds || []);
      syncTenantCollectionToFirebaseServer('sub_admins', tenantId, db.subAdmins).catch(() => {});

      sendJson(res, 200, {
        success: true,
        message: 'تم تحديث بيانات الأدمن في قاعدة البيانات بنجاح.',
        subAdmins: db.subAdmins,
        lastUpdated: db.lastUpdated,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ في تحديث حساب الأدمن' });
      return true;
    }
  }

  return false;
}
