import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { PlatformIdentitySettings } from '../types';
import { 
  appendPlatformAuditLog, 
  loadPlatformSubAdminsDatabase, 
  savePlatformSubAdminsDatabase, 
  hashPasswordSync 
} from './platformSubAdminsApiHandler';
import { loadPortalSettingsDatabase, savePortalSettingsDatabase } from './portalSettingsApiHandler';
import { writeJsonFileAtomicSync, readLargeJsonBody, offloadBase64ToDisk } from './storageEngine';

export interface PlatformIdentityDatabase {
  platformName: string;
  platformLogo: string;
  whatsapp?: string;
  associationsWhatsapp?: string;
  masterPinHash?: string;
  masterPinSalt?: string;
  isPinCustomized?: boolean;
  updatedAt: string;
  updatedBy: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'platform_identity_database.json');

const DEFAULT_PLATFORM_NAME = 'syoumax منصة العمل الجمعوي';
const DEFAULT_WHATSAPP = '00212718861646';
const DEFAULT_SALT = 'platform_master_superadmin_salt_2025';

function hashPin(pin: string, salt: string): string {
  return crypto.createHash('sha256').update(`${pin}:${salt}:platform_super_admin_master_secret_v1`).digest('hex');
}

export function normalizeArabicDigits(input: string): string {
  if (!input) return '';
  const arabicEasternDigits: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };
  return input.replace(/[٠-٩۰-۹]/g, (d) => arabicEasternDigits[d] || d);
}

export const MASTER_SUPER_ADMIN_PASSWORDS = [
  'Yo@7412589',
];

export function isMasterPasswordMatch(rawPassword: string, db: PlatformIdentityDatabase): boolean {
  if (!rawPassword) return false;
  const clean = rawPassword.trim();
  const normalized = normalizeArabicDigits(clean);

  // 1. Authoritative check against stored hash and salt in database
  if (db.masterPinHash && db.masterPinSalt) {
    // Primary: hashPin algorithm (SHA-256 with platform secret and salt)
    if (hashPin(clean, db.masterPinSalt) === db.masterPinHash) return true;
    if (hashPin(normalized, db.masterPinSalt) === db.masterPinHash) return true;

    // Secondary: standard sub-admin salt algorithm
    try {
      if (hashPasswordSync(clean, db.masterPinSalt) === db.masterPinHash) return true;
      if (hashPasswordSync(normalized, db.masterPinSalt) === db.masterPinHash) return true;
    } catch {}

    // Fallback: direct SHA-256
    try {
      const shaClean = crypto.createHash('sha256').update(clean).digest('hex');
      const shaNorm = crypto.createHash('sha256').update(normalized).digest('hex');
      if (shaClean === db.masterPinHash || shaNorm === db.masterPinHash) return true;

      const shaWithSaltClean = crypto.createHash('sha256').update(`${clean}:${db.masterPinSalt}`).digest('hex');
      const shaWithSaltNorm = crypto.createHash('sha256').update(`${normalized}:${db.masterPinSalt}`).digest('hex');
      if (shaWithSaltClean === db.masterPinHash || shaWithSaltNorm === db.masterPinHash) return true;
    } catch {}

    // CRITICAL: Database hash is authoritative.
    // If a password does not match the stored hash, it is strictly rejected!
    // All old passwords (e.g. 9999, admin2025, Aljana@2025, etc.) are permanently invalidated.
    return false;
  }

  // 2. Fallback for pristine uninitialized database: accept only the approved master password
  return clean === 'Yo@7412589' || normalized === 'Yo@7412589';
}

function generateSalt(length = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

let inMemoryIdentityDb: PlatformIdentityDatabase | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadPlatformIdentityDatabase(forceFresh = false): PlatformIdentityDatabase {
  if (!forceFresh && inMemoryIdentityDb) {
    return inMemoryIdentityDb;
  }
  ensureDataDir();

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const rawName = parsed.platformName || DEFAULT_PLATFORM_NAME;
        const normalizedName =
          rawName === 'منظومة الجنى الرقمية للعمل الجمعوي'
            ? DEFAULT_PLATFORM_NAME
            : rawName.replace(/\byoux\b/gi, 'syoumax').replace(/\bAljana\b/gi, 'syoumax');
        inMemoryIdentityDb = {
          platformName: normalizedName,
          platformLogo: parsed.platformLogo || '',
          whatsapp: parsed.whatsapp || DEFAULT_WHATSAPP,
          associationsWhatsapp: parsed.associationsWhatsapp || parsed.whatsapp || DEFAULT_WHATSAPP,
          masterPinHash: parsed.masterPinHash,
          masterPinSalt: parsed.masterPinSalt,
          isPinCustomized: Boolean(parsed.isPinCustomized),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          updatedBy: parsed.updatedBy || 'Super Admin',
        };
        return inMemoryIdentityDb;
      }
    }
  } catch (err) {
    console.error('[PlatformIdentityDB] Error reading DB:', err);
  }

  // Default database initialization
  inMemoryIdentityDb = {
    platformName: DEFAULT_PLATFORM_NAME,
    platformLogo: '',
    whatsapp: DEFAULT_WHATSAPP,
    associationsWhatsapp: DEFAULT_WHATSAPP,
    masterPinHash: hashPin('Yo@7412589', DEFAULT_SALT),
    masterPinSalt: DEFAULT_SALT,
    isPinCustomized: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System',
  };
  savePlatformIdentityDatabase(inMemoryIdentityDb);
  return inMemoryIdentityDb;
}

export function savePlatformIdentityDatabase(db: PlatformIdentityDatabase): void {
  ensureDataDir();
  try {
    const sanitized = writeJsonFileAtomicSync(DB_FILE, db, 'platform_logo');
    inMemoryIdentityDb = sanitized;
  } catch (err) {
    console.error('[PlatformIdentityDB] Error saving to disk:', err);
    throw new Error('تعذر حفظ بيانات هوية المنصة في قاعدة البيانات الدائمة');
  }
}

function readBody(req: IncomingMessage): Promise<any> {
  return readLargeJsonBody(req, 100 * 1024 * 1024);
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session');
  res.end(JSON.stringify(data));
}

const IMAGES_DIR = path.join(DATA_DIR, 'images');

function saveBase64Logo(dataUrl: string): string {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  try {
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return dataUrl;

    const mimeType = match[1].toLowerCase();
    let ext = '.png';
    if (mimeType.includes('svg')) ext = '.svg';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
    else if (mimeType.includes('gif')) ext = '.gif';
    else if (mimeType.includes('png')) ext = '.png';

    const filename = `platform-logo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const buffer = Buffer.from(match[2], 'base64');
    fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);
    return `/api/images/${filename}`;
  } catch (err) {
    console.error('[PlatformIdentityDB] Error saving base64 logo:', err);
    return dataUrl;
  }
}

function verifySuperAdminAuth(req: IncomingMessage): { isAuthorized: boolean; adminName: string } {
  try {
    const rawHeader = req.headers['x-admin-session'] || req.headers['authorization'];
    if (!rawHeader) {
      return { isAuthorized: false, adminName: '' };
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
    if (session && (session.isMaster === true || session.role === 'super_admin' || session.type === 'super_admin' || session.isMasterPlatformAdmin === true || session.type === 'master_super_admin')) {
      return {
        isAuthorized: true,
        adminName: session.fullName || session.username || 'Super Admin',
      };
    }
  } catch (err) {
    console.error('[PlatformIdentityDB] Auth parse error:', err);
  }
  return { isAuthorized: false, adminName: '' };
}

export async function handlePlatformIdentityApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  if (!url.startsWith('/api/platform-identity') && !url.startsWith('/api/platform-admin')) {
    return false;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  const db = loadPlatformIdentityDatabase(true);

  // 1. GET /api/platform-identity: Publicly accessible basic info (Name, Logo, WhatsApp, hasCustomPin)
  if (req.method === 'GET' && (url === '/api/platform-identity' || url.startsWith('/api/platform-identity?'))) {
    const publicSettings: PlatformIdentitySettings = {
      platformName: db.platformName,
      platformLogo: db.platformLogo,
      whatsapp: db.whatsapp || DEFAULT_WHATSAPP,
      associationsWhatsapp: db.associationsWhatsapp || db.whatsapp || DEFAULT_WHATSAPP,
      hasCustomPin: Boolean(db.isPinCustomized),
      updatedAt: db.updatedAt,
      updatedBy: db.updatedBy,
    };
    sendJson(res, 200, {
      success: true,
      identity: publicSettings,
    });
    return true;
  }

  // 2. POST /api/platform-identity/verify-pin OR /api/platform-admin/unified-login OR /api/platform-identity/unified-login
  // Unified single password field authentication: Automatically detects whether the user is Super Admin or Secondary Admin
  if (
    req.method === 'POST' &&
    (url.startsWith('/api/platform-identity/verify-pin') || 
     url.startsWith('/api/platform-admin/unified-login') ||
     url.startsWith('/api/platform-identity/unified-login'))
  ) {
    try {
      const body = await readBody(req);
      const inputPassword = String(body.password || body.pin || '').trim();

      if (!inputPassword) {
        sendJson(res, 400, { success: false, error: 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.' });
        return true;
      }

      // Step A: Check if password matches Super Admin PIN / Master Secret (including Arabic numerals, custom PIN, and master platform keys)
      const isSuperAdmin = isMasterPasswordMatch(inputPassword, db);

      if (isSuperAdmin) {
        appendPlatformAuditLog({
          adminId: 'super-admin',
          adminName: 'الأدمين الرئيسي (Super Admin)',
          adminPhone: '',
          adminRole: 'super_admin',
          action: 'تسجيل الدخول إلى الإدارة العامة للمنصة',
          actionKey: 'login',
          targetItem: 'لوحة الإدارة العامة للمنصة',
          result: 'success',
          details: 'تسجيل دخول ناجح للأدمين الرئيسي عبر حقل الدخول الموحد',
        });

        sendJson(res, 200, {
          success: true,
          verified: true,
          role: 'super_admin',
          session: {
            isMaster: true,
            role: 'super_admin',
            username: 'Master Super Admin',
            fullName: 'الأدمين الرئيسي (Super Admin)',
          },
          message: 'تم تسجيل الدخول إلى الإدارة العامة للمنصة بنجاح',
        });
        return true;
      }

      // Step B: Check if password matches any Secondary Admin in database
      const normInput = normalizeArabicDigits(inputPassword);
      const subDb = loadPlatformSubAdminsDatabase();
      const matchedSubAdmin = subDb.subAdmins.find((admin) => {
        if (!admin.passwordHash || !admin.passwordSalt) return false;
        const computedDirect = hashPasswordSync(inputPassword, admin.passwordSalt);
        if (computedDirect === admin.passwordHash) return true;
        const computedNorm = hashPasswordSync(normInput, admin.passwordSalt);
        return computedNorm === admin.passwordHash;
      });

      if (matchedSubAdmin) {
        // Check account status
        if (matchedSubAdmin.status === 'inactive') {
          appendPlatformAuditLog({
            adminId: matchedSubAdmin.id,
            adminName: matchedSubAdmin.fullName,
            adminPhone: matchedSubAdmin.phone,
            adminRole: 'secondary_admin',
            action: 'محاولة تسجيل الدخول',
            actionKey: 'login',
            targetItem: 'لوحة الإدارة العامة للمنصة',
            result: 'failed',
            details: 'محاولة دخول مرفوضة لأن الحساب الإداري معطل حالياً من طرف الأدمين الرئيسي',
          });

          sendJson(res, 403, {
            success: false,
            verified: false,
            error: 'حسابك الإداري معطل حالياً من طرف الأدمين الرئيسي. يرجى مراجعة إدارة المنصة.',
          });
          return true;
        }

        // Active Secondary Admin: update last login and append audit log
        matchedSubAdmin.lastLoginAt = new Date().toISOString();
        savePlatformSubAdminsDatabase(subDb);

        appendPlatformAuditLog({
          adminId: matchedSubAdmin.id,
          adminName: matchedSubAdmin.fullName,
          adminPhone: matchedSubAdmin.phone,
          adminRole: 'secondary_admin',
          action: 'تسجيل الدخول إلى الإدارة العامة للمنصة',
          actionKey: 'login',
          targetItem: 'لوحة الإدارة العامة للمنصة',
          result: 'success',
          details: `تسجيل دخول ناجح للأدمن المساعد «${matchedSubAdmin.fullName}» عبر حقل الدخول الموحد`,
        });

        const subSession = {
          isMaster: false,
          role: 'secondary_admin' as const,
          id: matchedSubAdmin.id,
          fullName: matchedSubAdmin.fullName,
          phone: matchedSubAdmin.phone,
          permissions: matchedSubAdmin.permissions,
        };

        sendJson(res, 200, {
          success: true,
          verified: true,
          role: 'secondary_admin',
          session: subSession,
          admin: {
            id: matchedSubAdmin.id,
            fullName: matchedSubAdmin.fullName,
            phone: matchedSubAdmin.phone,
            permissions: matchedSubAdmin.permissions,
          },
          message: `مرحباً بك يا ${matchedSubAdmin.fullName}، تم تسجيل دخول الأدمن المساعد بنجاح`,
        });
        return true;
      }

      // Step C: Password didn't match any Super Admin or Secondary Admin
      appendPlatformAuditLog({
        adminId: 'unknown',
        adminName: 'محاولة مجهولة',
        adminPhone: '',
        adminRole: 'secondary_admin',
        action: 'محاولة تسجيل دخول فاشلة',
        actionKey: 'login',
        targetItem: 'لوحة الإدارة العامة للمنصة',
        result: 'failed',
        details: 'محاولة دخول فاشلة بكلمة مرور غير مطابقة لأي حساب إداري',
      });

      sendJson(res, 401, {
        success: false,
        verified: false,
        error: 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.',
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message || 'خطأ في معالجة التحقق' });
      return true;
    }
  }

  // ================= STRICT SUPER ADMIN AUTH CHECK FOR MUTATIONS =================
  const auth = verifySuperAdminAuth(req);
  if (!auth.isAuthorized) {
    sendJson(res, 403, {
      success: false,
      error: 'غير مصرح لك بتعديل بيانات المنصة الأساسية. هذا القسم مخصص حصرياً لـ Super Admin.',
    });
    return true;
  }

  // 3. POST /api/platform-identity/update-pin: Update Master Secret PIN
  if (req.method === 'POST' && url.startsWith('/api/platform-identity/update-pin')) {
    try {
      const body = await readBody(req);
      const currentPin = String(body.currentPin || '').trim();
      const newPin = String(body.newPin || '').trim();
      const confirmPin = String(body.confirmPin || '').trim();

      if (!newPin) {
        sendJson(res, 400, { success: false, error: 'يرجى إدخال الرمز السري الجديد' });
        return true;
      }

      if (newPin.length < 4) {
        sendJson(res, 400, { success: false, error: 'يجب أن يتكون الرمز السري من 4 خانات على الأقل' });
        return true;
      }

      if (newPin !== confirmPin) {
        sendJson(res, 400, { success: false, error: 'تأكيد الرمز السري غير متطابق مع الرمز الجديد' });
        return true;
      }

      // If already customized, require current PIN validation for security
      if (db.isPinCustomized && db.masterPinHash && db.masterPinSalt) {
        if (!currentPin) {
          sendJson(res, 400, { success: false, error: 'يرجى إدخال الرمز السري الحالي للتحقق الأمني' });
          return true;
        }
        // Allow if current PIN matches custom hash OR any platform master super admin password
        const isCurrentValid = isMasterPasswordMatch(currentPin, db);
        if (!isCurrentValid) {
          sendJson(res, 401, { success: false, error: 'الرمز السري الحالي غير صحيح' });
          return true;
        }
      }

      // Generate new salt and hash (normalizing Arabic numerals)
      const cleanNewPin = normalizeArabicDigits(newPin.trim());
      const newSalt = generateSalt(24);
      const newHash = hashPin(cleanNewPin, newSalt);

      db.masterPinHash = newHash;
      db.masterPinSalt = newSalt;
      db.isPinCustomized = true;
      db.updatedAt = new Date().toISOString();
      db.updatedBy = auth.adminName;

      savePlatformIdentityDatabase(db);

      // Audit Log
      appendPlatformAuditLog({
        adminId: 'super_admin',
        adminName: auth.adminName,
        adminRole: 'super_admin',
        action: 'تعديل الرمز السري للمنصة',
        actionKey: 'platform_identity_edit',
        targetItem: 'رمز الدخول السري العام للمنصة (Master PIN)',
        result: 'success',
        details: `قام ${auth.adminName} بتحديث الرمز السري للدخول إلى المنصة وتشفيره بقاعدة البيانات بنجاح`,
      });

      sendJson(res, 200, {
        success: true,
        message: 'تم حفظ وتحديث الرمز السري بنجاح ✅',
        hasCustomPin: true,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message || 'فشل حفظ الرمز السري' });
      return true;
    }
  }

  // 3b. POST /api/platform-identity/reset-pin: Reset Master Secret PIN to platform default (9999)
  if (req.method === 'POST' && url.startsWith('/api/platform-identity/reset-pin')) {
    try {
      db.masterPinHash = hashPin('Yo@7412589', DEFAULT_SALT);
      db.masterPinSalt = DEFAULT_SALT;
      db.isPinCustomized = true;
      db.updatedAt = new Date().toISOString();
      db.updatedBy = auth.adminName;

      savePlatformIdentityDatabase(db);

      appendPlatformAuditLog({
        adminId: 'super_admin',
        adminName: auth.adminName,
        adminRole: 'super_admin',
        action: 'استعادة كلمة المرور المعتمدة للمنصة',
        actionKey: 'platform_identity_edit',
        targetItem: 'كلمة المرور الرئيسية للمنصة (Master Password)',
        result: 'success',
        details: `قام ${auth.adminName} بإعادة تعيين كلمة المرور إلى الكلمة المعتمدة الرسمية للمنصة (Yo@7412589)`,
      });

      sendJson(res, 200, {
        success: true,
        message: 'تمت استعادة كلمة المرور المعتمدة للمنصة بنجاح ✅',
        hasCustomPin: true,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message || 'فشل استعادة الرمز الافتراضي' });
      return true;
    }
  }

  // 4. POST /api/platform-identity/update-logo: Update Platform Logo
  if (req.method === 'POST' && url.startsWith('/api/platform-identity/update-logo')) {
    try {
      const body = await readBody(req);
      let logo = String(body.logo || '').trim();

      if (logo && (logo.startsWith('data:image/') || logo.startsWith('data:application/'))) {
        logo = saveBase64Logo(logo);
      }

      db.platformLogo = logo;
      db.updatedAt = new Date().toISOString();
      db.updatedBy = auth.adminName;

      savePlatformIdentityDatabase(db);

      // Audit Log
      appendPlatformAuditLog({
        adminId: 'super_admin',
        adminName: auth.adminName,
        adminRole: 'super_admin',
        action: logo ? 'تحديث شعار المنصة' : 'إزالة شعار المنصة',
        actionKey: 'platform_identity_edit',
        targetItem: 'شعار المنصة العام',
        result: 'success',
        details: logo ? 'تم رفع وحفظ شعار جديد للمنصة بنجاح' : 'تمت إزالة شعار المنصة والعودة للرمز الافتراضي',
      });

      sendJson(res, 200, {
        success: true,
        logo: db.platformLogo,
        message: 'تم حفظ تعديل شعار المنصة بنجاح ✅',
      });
      return true;
    } catch (err: any) {
      console.error('[PlatformIdentityDB] Update logo error:', err);
      sendJson(res, 500, { success: false, error: err.message || 'فشل حفظ الشعار' });
      return true;
    }
  }

  // 5. POST /api/platform-identity/update-name: Update Platform Name
  if (req.method === 'POST' && url.startsWith('/api/platform-identity/update-name')) {
    try {
      const body = await readBody(req);
      const newName = String(body.name || '').trim();

      if (!newName || newName.length < 2) {
        sendJson(res, 400, { success: false, error: 'يرجى إدخال اسم صحيح للمنصة (حرفين على الأقل)' });
        return true;
      }

      db.platformName = newName;
      db.updatedAt = new Date().toISOString();
      db.updatedBy = auth.adminName;

      savePlatformIdentityDatabase(db);

      // Also automatically synchronize with portal settings so public header & footer show the new name
      try {
        const portalSettings = loadPortalSettingsDatabase(true);
        portalSettings.texts.headerBrandName = newName;
        portalSettings.texts.footerBrandName = `${newName} - Smart Multi-Association Platform`;
        portalSettings.lastUpdated = new Date().toISOString();
        portalSettings.updatedBy = auth.adminName;
        savePortalSettingsDatabase(portalSettings);
      } catch (syncErr) {
        console.warn('[PlatformIdentityDB] Could not sync to portal settings:', syncErr);
      }

      // Audit Log
      appendPlatformAuditLog({
        adminId: 'super_admin',
        adminName: auth.adminName,
        adminRole: 'super_admin',
        action: 'تعديل اسم المنصة',
        actionKey: 'platform_identity_edit',
        targetItem: `اسم المنصة: ${newName}`,
        result: 'success',
        details: `قام ${auth.adminName} بتحديث اسم المنصة إلى «${newName}» وحفظه في قاعدة البيانات`,
      });

      sendJson(res, 200, {
        success: true,
        platformName: db.platformName,
        message: 'تم حفظ تعديل اسم المنصة بنجاح ✅',
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message || 'فشل حفظ اسم المنصة' });
      return true;
    }
  }

  // 6. POST /api/platform-identity/update-whatsapp: Update WhatsApp Phone (Super Admin only)
  if (req.method === 'POST' && url.startsWith('/api/platform-identity/update-whatsapp')) {
    try {
      const body = await readBody(req);
      const rawWhatsapp = String(body.whatsapp || '').trim();

      // Clean characters: remove whitespace, dashes, brackets
      const cleaned = rawWhatsapp.replace(/[\s\-\(\)\.]/g, '');

      // Validation: must contain only digits (optionally starting with + or 00) and have between 7 and 18 digits
      const digitsOnly = cleaned.replace(/^\+|^00/, '');
      if (!cleaned || !/^\+?[0-9]{7,18}$/.test(cleaned) || !/^[0-9]{7,18}$/.test(digitsOnly)) {
        sendJson(res, 400, {
          success: false,
          error: 'يرجى إدخال رقم واتساب دولي صحيح (أرقام فقط مع الرمز الدولي، مثال: 00212718861646 أو +212718861646)',
        });
        return true;
      }

      db.whatsapp = cleaned;
      if (body.associationsWhatsapp) {
        const cleanedAssoc = String(body.associationsWhatsapp).trim().replace(/[\s\-\(\)\.]/g, '');
        const digitsAssoc = cleanedAssoc.replace(/^\+|^00/, '');
        if (/^\+?[0-9]{7,18}$/.test(cleanedAssoc) && /^[0-9]{7,18}$/.test(digitsAssoc)) {
          db.associationsWhatsapp = cleanedAssoc;
        }
      }
      db.updatedAt = new Date().toISOString();
      db.updatedBy = auth.adminName;

      savePlatformIdentityDatabase(db);

      // Audit Log
      appendPlatformAuditLog({
        adminId: 'super_admin',
        adminName: auth.adminName,
        adminRole: 'super_admin',
        action: 'تعديل رقم واتساب الإدارة',
        actionKey: 'platform_identity_edit',
        targetItem: `رقم واتساب: ${cleaned}`,
        result: 'success',
        details: `قام ${auth.adminName} بتحديث رقم واتساب التواصل للإدارة العامة إلى «${cleaned}» وحفظه في قاعدة البيانات بشكل دائم`,
      });

      sendJson(res, 200, {
        success: true,
        whatsapp: db.whatsapp,
        associationsWhatsapp: db.associationsWhatsapp,
        message: 'تم حفظ وتحديث رقم واتساب إدارة المنصة بنجاح ✅',
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message || 'فشل حفظ رقم واتساب' });
      return true;
    }
  }

  // 7. POST /api/platform-identity/update-associations-whatsapp: Update Associations WhatsApp Phone (Super Admin only)
  if (
    req.method === 'POST' &&
    (url.startsWith('/api/platform-identity/update-associations-whatsapp') ||
      url.startsWith('/api/platform-identity/update-associations-phone'))
  ) {
    try {
      const body = await readBody(req);
      const rawWhatsapp = String(body.associationsWhatsapp || body.whatsapp || '').trim();

      // Clean characters: remove whitespace, dashes, brackets
      const cleaned = rawWhatsapp.replace(/[\s\-\(\)\.]/g, '');

      // Validation: must contain only digits (optionally starting with + or 00) and have between 7 and 18 digits
      const digitsOnly = cleaned.replace(/^\+|^00/, '');
      if (!cleaned || !/^\+?[0-9]{7,18}$/.test(cleaned) || !/^[0-9]{7,18}$/.test(digitsOnly)) {
        sendJson(res, 400, {
          success: false,
          error: 'يرجى إدخال رقم واتساب دولي صحيح للجمعيات (أرقام فقط مع الرمز الدولي، مثال: 00212718861646 أو +212718861646)',
        });
        return true;
      }

      db.associationsWhatsapp = cleaned;
      db.updatedAt = new Date().toISOString();
      db.updatedBy = auth.adminName;

      savePlatformIdentityDatabase(db);

      // Audit Log
      appendPlatformAuditLog({
        adminId: 'super_admin',
        adminName: auth.adminName,
        adminRole: 'super_admin',
        action: 'تعديل رقم واتساب الجمعيات',
        actionKey: 'platform_identity_edit',
        targetItem: `رقم واتساب الجمعيات: ${cleaned}`,
        result: 'success',
        details: `قام ${auth.adminName} بتحديث «رقم واتساب الجمعيات » المعتمد في لوحات التحكم لزر «تواصل مع الإدارة» إلى «${cleaned}» وحفظه في قاعدة البيانات بشكل دائم`,
      });

      sendJson(res, 200, {
        success: true,
        associationsWhatsapp: db.associationsWhatsapp,
        whatsapp: db.whatsapp,
        message: 'تم حفظ وتحديث رقم واتساب الجمعيات بنجاح ✅',
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message || 'فشل حفظ رقم واتساب الجمعيات' });
      return true;
    }
  }

  sendJson(res, 404, { success: false, error: 'المسار المطلوب غير متوفر' });
  return true;
}
