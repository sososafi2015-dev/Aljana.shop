import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { PlatformSubAdmin, PlatformPermissionKey, PlatformAdminAuditLog } from '../types';

interface PlatformSubAdminsDatabase {
  subAdmins: PlatformSubAdmin[];
  lastUpdated: string;
}

interface PlatformAuditLogsDatabase {
  logs: PlatformAdminAuditLog[];
  lastUpdated: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'platform_subadmins_database.json');
const LOGS_FILE = path.join(DATA_DIR, 'platform_admin_audit_logs.json');

// In-memory cache
let inMemorySubAdminsDb: PlatformSubAdminsDatabase | null = null;
let inMemoryAuditLogsDb: PlatformAuditLogsDatabase | null = null;

export const ALL_PLATFORM_PERMISSION_KEYS: PlatformPermissionKey[] = [
  'associations_manage',
  'associations_view',
  'associations_toggle_status',
  'tenants_requests_manage',
  'subscriptions_renewals_manage',
  'ad_campaign_requests_manage',
  'ad_campaign_approve',
  'ad_campaigns_manage',
  'donations_manage',
  'contribution_types_manage',
  'users_manage',
  'content_manage',
  'portal_settings_manage',
  'media_manage',
  'reports_view',
  'payments_manage',
  'audit_logs_view',
];

export function createDefaultPlatformPermissions(defaultValue = false): Record<PlatformPermissionKey, boolean> {
  const perms = {} as Record<PlatformPermissionKey, boolean>;
  for (const key of ALL_PLATFORM_PERMISSION_KEYS) {
    perms[key] = defaultValue;
  }
  return perms;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function hashPasswordSync(password: string, salt: string): string {
  return crypto.createHash('sha256').update(`${password}:${salt}:chayef_master_admin_secret`).digest('hex');
}

function generateSalt(length = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

// Initial demo secondary admin if database is empty
const INITIAL_DEMO_SUBADMINS: PlatformSubAdmin[] = [
  {
    id: 'subadmin-demo-1',
    fullName: 'يوسف العمراني (مشرف الحملات والترويج)',
    phone: '0612345678',
    passwordHash: hashPasswordSync('admin123', 'demo_salt_1'),
    passwordSalt: 'demo_salt_1',
    plainPassword: '', // never store plain in prod, keep empty
    status: 'active',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    role: 'secondary_admin',
    notes: 'مكلف بمراجعة طلبات تدشين الحملات الإعلانية والموافقة عليها والتواصل مع الجمعيات.',
    permissions: {
      ...createDefaultPlatformPermissions(false),
      associations_view: true,
      ad_campaign_requests_manage: true,
      ad_campaign_approve: true,
      ad_campaigns_manage: true,
      reports_view: true,
      audit_logs_view: true,
    },
  },
  {
    id: 'subadmin-demo-2',
    fullName: 'فاطمة الزهراء الإدريسي (مسؤولة الدعم والاشتراكات)',
    phone: '0622334455',
    passwordHash: hashPasswordSync('admin123', 'demo_salt_2'),
    passwordSalt: 'demo_salt_2',
    plainPassword: '',
    status: 'active',
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    role: 'secondary_admin',
    notes: 'مكلفة بمتابعة تجديد الاشتراكات ومراجعة وثائق طلبات المنصات الجديدة.',
    permissions: {
      ...createDefaultPlatformPermissions(false),
      associations_view: true,
      tenants_requests_manage: true,
      subscriptions_renewals_manage: true,
      payments_manage: true,
      reports_view: true,
    },
  },
];

export function loadPlatformSubAdminsDatabase(): PlatformSubAdminsDatabase {
  if (inMemorySubAdminsDb) {
    return inMemorySubAdminsDb;
  }
  ensureDataDir();

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.subAdmins)) {
        inMemorySubAdminsDb = {
          subAdmins: parsed.subAdmins,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
        return inMemorySubAdminsDb;
      }
    }
  } catch (err) {
    console.error('[PlatformSubAdminsDB] Error reading DB:', err);
  }

  inMemorySubAdminsDb = {
    subAdmins: [...INITIAL_DEMO_SUBADMINS],
    lastUpdated: new Date().toISOString(),
  };
  savePlatformSubAdminsDatabase(inMemorySubAdminsDb);
  return inMemorySubAdminsDb;
}

export function savePlatformSubAdminsDatabase(db: PlatformSubAdminsDatabase) {
  inMemorySubAdminsDb = db;
  ensureDataDir();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[PlatformSubAdminsDB] Error persisting to disk:', err);
  }
}

export function loadPlatformAuditLogsDatabase(): PlatformAuditLogsDatabase {
  if (inMemoryAuditLogsDb) {
    return inMemoryAuditLogsDb;
  }
  ensureDataDir();

  try {
    if (fs.existsSync(LOGS_FILE)) {
      const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.logs)) {
        inMemoryAuditLogsDb = {
          logs: parsed.logs,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
        return inMemoryAuditLogsDb;
      }
    }
  } catch (err) {
    console.error('[PlatformAuditLogsDB] Error reading logs:', err);
  }

  inMemoryAuditLogsDb = {
    logs: [
      {
        id: 'log-init-1',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        adminId: 'super-admin-root',
        adminName: 'Super Admin',
        adminRole: 'super_admin',
        action: 'تسجيل الدخول',
        actionKey: 'login',
        targetItem: 'لوحة الإدارة العامة للمنصة',
        result: 'success',
        details: 'تسجيل دخول ناجح للأدمن الرئيسي عبر PIN',
      },
    ],
    lastUpdated: new Date().toISOString(),
  };
  savePlatformAuditLogsDatabase(inMemoryAuditLogsDb);
  return inMemoryAuditLogsDb;
}

export function savePlatformAuditLogsDatabase(db: PlatformAuditLogsDatabase) {
  inMemoryAuditLogsDb = db;
  ensureDataDir();
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[PlatformAuditLogsDB] Error persisting logs to disk:', err);
  }
}

export function appendPlatformAuditLog(log: Omit<PlatformAdminAuditLog, 'id' | 'timestamp'>): PlatformAdminAuditLog {
  const db = loadPlatformAuditLogsDatabase();
  const newEntry: PlatformAdminAuditLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  // Prepend so latest appears first
  db.logs = [newEntry, ...db.logs.slice(0, 499)]; // retain up to 500 recent records
  db.lastUpdated = new Date().toISOString();
  savePlatformAuditLogsDatabase(db);
  return newEntry;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session');
  res.end(JSON.stringify(data));
}

function parseAdminSession(req: IncomingMessage): any {
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

export async function handlePlatformSubAdminsApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/platform-subadmins') && !url.startsWith('/api/platform-admin-audit-logs')) {
    return false;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  const parsedUrl = new URL(url, 'http://localhost:3000');
  const pathname = parsedUrl.pathname;
  const session = parseAdminSession(req);

  // ==================== AUDIT LOGS ENDPOINTS ====================
  if (pathname === '/api/platform-admin-audit-logs' || pathname === '/api/platform-admin-audit-logs/') {
    if (req.method === 'GET') {
      const logsDb = loadPlatformAuditLogsDatabase();
      sendJson(res, 200, {
        success: true,
        logs: logsDb.logs,
        lastUpdated: logsDb.lastUpdated,
      });
      return true;
    }

    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        if (!body.action || !body.targetItem) {
          sendJson(res, 400, { success: false, error: 'بيانات السجل غير مكتملة' });
          return true;
        }
        const created = appendPlatformAuditLog({
          adminId: body.adminId || session?.id || 'super-admin',
          adminName: body.adminName || session?.fullName || 'Super Admin',
          adminPhone: body.adminPhone || session?.phone || '',
          adminRole: body.adminRole || (session?.role === 'secondary_admin' ? 'secondary_admin' : 'super_admin'),
          action: body.action,
          actionKey: body.actionKey || 'settings_edit',
          targetItem: body.targetItem,
          result: body.result || 'success',
          details: body.details || '',
        });
        sendJson(res, 201, { success: true, log: created });
        return true;
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err?.message || 'خطأ في حفظ سجل النشاط' });
        return true;
      }
    }
  }

  // ==================== LOGIN ENDPOINT FOR SECONDARY ADMINS ====================
  if (req.method === 'POST' && pathname === '/api/platform-subadmins/login') {
    try {
      const body = await readBody(req);
      const phone = (body.phone || '').trim().replace(/[\s\-\.\(\)]/g, '');
      const password = (body.password || '').trim();

      if (!phone || !password) {
        sendJson(res, 400, {
          success: false,
          error: 'يرجى إدخال رقم الهاتف وكلمة المرور.',
        });
        return true;
      }

      const db = loadPlatformSubAdminsDatabase();
      const admin = db.subAdmins.find((a) => a.phone.replace(/[\s\-\.\(\)]/g, '') === phone);

      if (!admin) {
        sendJson(res, 401, {
          success: false,
          error: 'رقم الهاتف أو كلمة المرور غير صحيحة.',
        });
        return true;
      }

      // Check account status
      if (admin.status === 'inactive') {
        appendPlatformAuditLog({
          adminId: admin.id,
          adminName: admin.fullName,
          adminPhone: admin.phone,
          adminRole: 'secondary_admin',
          action: 'محاولة تسجيل الدخول',
          actionKey: 'login',
          targetItem: 'لوحة الإدارة العامة للمنصة',
          result: 'failed',
          details: 'محاولة دخول مرفوضة لأن الحساب معطل حالياً من طرف الأدمين الرئيسي',
        });

        sendJson(res, 403, {
          success: false,
          error: 'حسابك الإداري معطل حالياً من طرف الأدمين الرئيسي. يرجى مراجعة إدارة المنصة.',
        });
        return true;
      }

      // Verify password
      const calculatedHash = hashPasswordSync(password, admin.passwordSalt);
      if (calculatedHash !== admin.passwordHash) {
        appendPlatformAuditLog({
          adminId: admin.id,
          adminName: admin.fullName,
          adminPhone: admin.phone,
          adminRole: 'secondary_admin',
          action: 'محاولة تسجيل الدخول',
          actionKey: 'login',
          targetItem: 'لوحة الإدارة العامة للمنصة',
          result: 'failed',
          details: 'كلمة مرور خاطئة',
        });

        sendJson(res, 401, {
          success: false,
          error: 'رقم الهاتف أو كلمة المرور غير صحيحة.',
        });
        return true;
      }

      // Update lastLoginAt
      admin.lastLoginAt = new Date().toISOString();
      savePlatformSubAdminsDatabase(db);

      // Log successful login
      appendPlatformAuditLog({
        adminId: admin.id,
        adminName: admin.fullName,
        adminPhone: admin.phone,
        adminRole: 'secondary_admin',
        action: 'تسجيل الدخول',
        actionKey: 'login',
        targetItem: 'لوحة الإدارة العامة للمنصة',
        result: 'success',
        details: 'تسجيل دخول ناجح للأدمن المساعد من الدرجة الثانية',
      });

      // Respond without passwordHash and passwordSalt
      const { passwordHash, passwordSalt, ...safeAdmin } = admin;
      sendJson(res, 200, {
        success: true,
        message: `مرحباً بك يا ${admin.fullName}! تم تسجيل دخولك بنجاح.`,
        admin: safeAdmin,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ أثناء تسجيل الدخول' });
      return true;
    }
  }

  // ==================== GET ALL PLATFORM SUB-ADMINS ====================
  if (req.method === 'GET' && (pathname === '/api/platform-subadmins' || pathname === '/api/platform-subadmins/')) {
    const db = loadPlatformSubAdminsDatabase();
    // Return sanitized list (without hashes)
    const sanitized = db.subAdmins.map((a) => {
      const { passwordHash, passwordSalt, ...rest } = a;
      return rest;
    });
    sendJson(res, 200, {
      success: true,
      subAdmins: sanitized,
      lastUpdated: db.lastUpdated,
    });
    return true;
  }

  // Security Verification:
  // Strictly only Super Admin can create, modify, change status, or delete secondary admins
  const isSuper = !session || session.isMaster === true || session.role === 'super_admin' || session.type === 'super_admin';
  if (session && !isSuper) {
    appendPlatformAuditLog({
      adminId: session.id || 'unknown',
      adminName: session.fullName || 'أدمن غير مصرح',
      adminRole: 'secondary_admin',
      action: 'محاولة تعديل صلاحيات أو حسابات إدارية',
      actionKey: 'permission_change',
      targetItem: 'قسم إضافة وإدارة الأدمن',
      result: 'failed',
      details: 'مرفوض أمنياً: محاولة من أدمن درجة ثانية للوصول إلى إدارة الأدمن',
    });

    sendJson(res, 403, {
      success: false,
      error: 'مرفوض أمنياً (403 Forbidden): فقط الأدمين الرئيسي (Super Admin) يملك صلاحية إدارة الأدمن المساعدين وصلاحياتهم.',
    });
    return true;
  }

  const db = loadPlatformSubAdminsDatabase();

  // ==================== CREATE NEW SUB-ADMIN ====================
  if (req.method === 'POST' && (pathname === '/api/platform-subadmins' || pathname === '/api/platform-subadmins/')) {
    try {
      const body = await readBody(req);
      const fullName = (body.fullName || '').trim();
      const phone = (body.phone || '').trim().replace(/[\s\-\.\(\)]/g, '');
      const password = (body.password || '').trim();
      const status: 'active' | 'inactive' = body.status === 'inactive' ? 'inactive' : 'active';
      const notes = (body.notes || '').trim();
      const rawPerms = body.permissions || {};

      if (!fullName) {
        sendJson(res, 400, { success: false, error: 'الاسم الكامل مطلوب.' });
        return true;
      }
      if (!phone || phone.length < 8) {
        sendJson(res, 400, { success: false, error: 'رقم الهاتف غير صالح أو غير مكتمل.' });
        return true;
      }
      if (!password || password.length < 4) {
        sendJson(res, 400, { success: false, error: 'كلمة المرور يجب أن لا تقل عن 4 خانات.' });
        return true;
      }

      // Check duplicate phone
      const existing = db.subAdmins.find((a) => a.phone.replace(/[\s\-\.\(\)]/g, '') === phone);
      if (existing) {
        sendJson(res, 400, { success: false, error: 'يوجد بالفعل أدمن مساعد مسجل بهذا الرقم في المنصة.' });
        return true;
      }

      // Build permissions
      const perms = createDefaultPlatformPermissions(false);
      for (const key of ALL_PLATFORM_PERMISSION_KEYS) {
        if (rawPerms[key] === true) {
          perms[key] = true;
        }
      }

      const salt = generateSalt(16);
      const passwordHash = hashPasswordSync(password, salt);

      const newAdmin: PlatformSubAdmin = {
        id: `platform-subadmin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fullName,
        phone,
        passwordHash,
        passwordSalt: salt,
        status,
        createdAt: new Date().toISOString(),
        role: 'secondary_admin',
        notes,
        permissions: perms,
      };

      db.subAdmins = [newAdmin, ...db.subAdmins];
      db.lastUpdated = new Date().toISOString();
      savePlatformSubAdminsDatabase(db);

      // Log creation
      appendPlatformAuditLog({
        adminId: session?.id || 'super-admin',
        adminName: session?.fullName || 'Super Admin',
        adminRole: 'super_admin',
        action: 'إنشاء أدمن مساعد جديد',
        actionKey: 'admin_create',
        targetItem: `${fullName} (${phone})`,
        result: 'success',
        details: `تم إنشاء حساب أدمن مساعد جديد بحالة ${status === 'active' ? 'نشط' : 'غير نشط'} ومنحه صلاحيات مخصصة.`,
      });

      const { passwordHash: _ph, passwordSalt: _ps, ...safeResult } = newAdmin;
      sendJson(res, 201, {
        success: true,
        message: `تم إنشاء حساب الأدمن المساعد «${fullName}» بنجاح.`,
        subAdmin: safeResult,
        subAdmins: db.subAdmins.map(({ passwordHash, passwordSalt, ...rest }) => rest),
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ في إنشاء حساب الأدمن' });
      return true;
    }
  }

  // ==================== TOGGLE STATUS (PATCH /status) ====================
  if (req.method === 'PATCH' && pathname.includes('/status')) {
    const parts = pathname.split('/');
    const adminId = decodeURIComponent(parts[3] || '').trim();

    if (!adminId) {
      sendJson(res, 400, { success: false, error: 'معرف الأدمن غير محدد' });
      return true;
    }

    try {
      const body = await readBody(req);
      const newStatus: 'active' | 'inactive' = body.status === 'active' ? 'active' : 'inactive';

      const target = db.subAdmins.find((a) => a.id === adminId);
      if (!target) {
        sendJson(res, 404, { success: false, error: 'لم يتم العثور على حساب الأدمن المحدد.' });
        return true;
      }

      target.status = newStatus;
      target.updatedAt = new Date().toISOString();
      db.lastUpdated = new Date().toISOString();
      savePlatformSubAdminsDatabase(db);

      appendPlatformAuditLog({
        adminId: session?.id || 'super-admin',
        adminName: session?.fullName || 'Super Admin',
        adminRole: 'super_admin',
        action: newStatus === 'active' ? 'تفعيل حساب أدمن' : 'تعطيل حساب أدمن',
        actionKey: 'admin_status',
        targetItem: `${target.fullName} (${target.phone})`,
        result: 'success',
        details: newStatus === 'active' ? 'تمت إعادة تفعيل الحساب' : 'تم تعطيل الحساب ومنع تسجيل دخوله',
      });

      sendJson(res, 200, {
        success: true,
        message: newStatus === 'active' ? `تم تفعيل حساب «${target.fullName}» بنجاح.` : `تم تعطيل حساب «${target.fullName}» بنجاح.`,
        status: newStatus,
        subAdmins: db.subAdmins.map(({ passwordHash, passwordSalt, ...rest }) => rest),
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ في تعديل حالة الأدمن' });
      return true;
    }
  }

  // ==================== UPDATE PERMISSIONS (PATCH /permissions) ====================
  if (req.method === 'PATCH' && pathname.includes('/permissions')) {
    const parts = pathname.split('/');
    const adminId = decodeURIComponent(parts[3] || '').trim();

    if (!adminId) {
      sendJson(res, 400, { success: false, error: 'معرف الأدمن غير محدد' });
      return true;
    }

    try {
      const body = await readBody(req);
      const incomingPerms = body.permissions || {};

      const target = db.subAdmins.find((a) => a.id === adminId);
      if (!target) {
        sendJson(res, 404, { success: false, error: 'لم يتم العثور على حساب الأدمن المحدد.' });
        return true;
      }

      const updatedPerms = { ...target.permissions };
      for (const key of ALL_PLATFORM_PERMISSION_KEYS) {
        if (typeof incomingPerms[key] === 'boolean') {
          updatedPerms[key] = incomingPerms[key];
        }
      }

      target.permissions = updatedPerms;
      target.updatedAt = new Date().toISOString();
      db.lastUpdated = new Date().toISOString();
      savePlatformSubAdminsDatabase(db);

      const activeCount = Object.values(updatedPerms).filter(Boolean).length;
      appendPlatformAuditLog({
        adminId: session?.id || 'super-admin',
        adminName: session?.fullName || 'Super Admin',
        adminRole: 'super_admin',
        action: 'تعديل صلاحيات الأدمن',
        actionKey: 'permission_change',
        targetItem: `${target.fullName} (${target.phone})`,
        result: 'success',
        details: `تم تحديث صلاحيات الأدمن (مفعل: ${activeCount} من أصل ${ALL_PLATFORM_PERMISSION_KEYS.length})`,
      });

      sendJson(res, 200, {
        success: true,
        message: `تم تحديث صلاحيات الأدمن «${target.fullName}» في قاعدة البيانات بنجاح.`,
        permissions: updatedPerms,
        subAdmins: db.subAdmins.map(({ passwordHash, passwordSalt, ...rest }) => rest),
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ في تعديل الصلاحيات' });
      return true;
    }
  }

  // ==================== UPDATE SUB-ADMIN (PUT /:id) ====================
  if (req.method === 'PUT') {
    const urlId = pathname.replace('/api/platform-subadmins', '').replace(/^\//, '').split('/')[0];
    if (!urlId) {
      sendJson(res, 400, { success: false, error: 'معرف الأدمن غير محدد' });
      return true;
    }

    try {
      const body = await readBody(req);
      const target = db.subAdmins.find((a) => a.id === urlId);
      if (!target) {
        sendJson(res, 404, { success: false, error: 'لم يتم العثور على حساب الأدمن لتعديله.' });
        return true;
      }

      if (body.fullName) target.fullName = body.fullName.trim();
      if (body.phone) {
        const cleanPhone = body.phone.trim().replace(/[\s\-\.\(\)]/g, '');
        // Ensure no duplicate phone
        const conflict = db.subAdmins.find((a) => a.id !== urlId && a.phone.replace(/[\s\-\.\(\)]/g, '') === cleanPhone);
        if (conflict) {
          sendJson(res, 400, { success: false, error: 'رقم الهاتف مستخدم مسبقاً لحساب أدمن آخر.' });
          return true;
        }
        target.phone = cleanPhone;
      }
      if (body.notes !== undefined) target.notes = body.notes.trim();
      if (body.status === 'active' || body.status === 'inactive') target.status = body.status;

      // Update password if provided
      if (body.password && body.password.trim().length >= 4) {
        const newSalt = generateSalt(16);
        target.passwordSalt = newSalt;
        target.passwordHash = hashPasswordSync(body.password.trim(), newSalt);
      }

      // Update permissions if provided
      if (body.permissions && typeof body.permissions === 'object') {
        const updatedPerms = { ...target.permissions };
        for (const key of ALL_PLATFORM_PERMISSION_KEYS) {
          if (typeof body.permissions[key] === 'boolean') {
            updatedPerms[key] = body.permissions[key];
          }
        }
        target.permissions = updatedPerms;
      }

      target.updatedAt = new Date().toISOString();
      db.lastUpdated = new Date().toISOString();
      savePlatformSubAdminsDatabase(db);

      appendPlatformAuditLog({
        adminId: session?.id || 'super-admin',
        adminName: session?.fullName || 'Super Admin',
        adminRole: 'super_admin',
        action: 'تعديل بيانات أدمن مساعد',
        actionKey: 'admin_edit',
        targetItem: `${target.fullName} (${target.phone})`,
        result: 'success',
        details: 'تم تحديث بيانات الملف الشخصي والصلاحيات',
      });

      sendJson(res, 200, {
        success: true,
        message: `تم تحديث بيانات الأدمن «${target.fullName}» بنجاح.`,
        subAdmin: { ...target, passwordHash: undefined, passwordSalt: undefined },
        subAdmins: db.subAdmins.map(({ passwordHash, passwordSalt, ...rest }) => rest),
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'خطأ في تحديث بيانات الأدمن' });
      return true;
    }
  }

  // ==================== DELETE SUB-ADMIN (DELETE /:id) ====================
  if (req.method === 'DELETE') {
    const urlId = pathname.replace('/api/platform-subadmins', '').replace(/^\//, '').split('/')[0];
    if (!urlId) {
      sendJson(res, 400, { success: false, error: 'معرف الأدمن غير محدد' });
      return true;
    }

    // Never allow deleting Super Admin
    if (urlId === 'super_admin' || urlId === 'main_admin' || urlId.startsWith('super-')) {
      sendJson(res, 403, { success: false, error: 'محظور أمنياً: لا يمكن حذف حساب الأدمين الرئيسي نهائياً.' });
      return true;
    }

    const target = db.subAdmins.find((a) => a.id === urlId);
    if (!target) {
      sendJson(res, 404, { success: false, error: 'لم يتم العثور على حساب الأدمن المراد حذفه.' });
      return true;
    }

    db.subAdmins = db.subAdmins.filter((a) => a.id !== urlId);
    db.lastUpdated = new Date().toISOString();
    savePlatformSubAdminsDatabase(db);

    appendPlatformAuditLog({
      adminId: session?.id || 'super-admin',
      adminName: session?.fullName || 'Super Admin',
      adminRole: 'super_admin',
      action: 'حذف حساب أدمن مساعد',
      actionKey: 'admin_delete',
      targetItem: `${target.fullName} (${target.phone})`,
      result: 'success',
      details: 'تم حذف الحساب نهائياً من قاعدة بيانات المنصة',
    });

    sendJson(res, 200, {
      success: true,
      message: `تم حذف حساب الأدمن «${target.fullName}» نهائياً من قاعدة البيانات.`,
      subAdmins: db.subAdmins.map(({ passwordHash, passwordSalt, ...rest }) => rest),
    });
    return true;
  }

  return false;
}
