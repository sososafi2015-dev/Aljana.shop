import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

interface VisibilityDatabase {
  [key: string]: any;
  lastUpdated?: string;
  updatedBy?: string;
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'section_visibility.json');

const DEFAULT_VISIBILITY: Record<string, boolean> = {
  featured_activities: true,
  gateway_members: true,
  board_members: true,
  campaigns_section: true,
  gateway_ledger: true,
  members_voting_section: true,
  member_card: true,
  hero_banner: true,
  transparency_pledge: true,
  bottom_records_section: true,
  bank_rib_card: true,
  nav_report_button: true,
  proof_document_preview: true,
  current_financial_balance: false,
};

const SERVER_SECTION_ALIASES: Record<string, string> = {
  proof_document: 'proof_document_preview',
  proof_preview: 'proof_document_preview',
  activity_proof: 'proof_document_preview',
  activity_proof_preview: 'proof_document_preview',
  current_balance: 'current_financial_balance',
  currentBalance: 'current_financial_balance',
  nav_balance_badge: 'current_financial_balance',
};

let inMemoryVisibility: VisibilityDatabase | null = null;

export function loadVisibilityDatabase(): VisibilityDatabase {
  if (inMemoryVisibility) {
    return inMemoryVisibility;
  }

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        delete (parsed as any).pillars_section;
        delete (parsed as any).gateway_financials;
        inMemoryVisibility = { ...DEFAULT_VISIBILITY, ...parsed, current_financial_balance: false };
        return inMemoryVisibility;
      }
    }
  } catch (err) {
    console.warn('[VisibilityDB] Error reading visibility database, falling back to defaults:', err);
  }

  const initialDb: VisibilityDatabase = {
    ...DEFAULT_VISIBILITY,
    current_financial_balance: false,
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System Initialization',
  };

  inMemoryVisibility = initialDb;
  saveVisibilityDatabase(initialDb);
  return initialDb;
}

export function saveVisibilityDatabase(db: VisibilityDatabase): boolean {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    delete (db as any).pillars_section;
    delete (db as any).gateway_financials;
    db.current_financial_balance = false;
    db.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    inMemoryVisibility = db;
    return true;
  } catch (err) {
    console.error('[VisibilityDB] Error saving visibility database:', err);
    return false;
  }
}

/**
 * Server-side authoritative verification:
 * Checks whether the incoming request is permitted to access a given section.
 */
export function isSectionAllowedOnServer(sectionId: string, req: IncomingMessage): boolean {
  if (sectionId === 'gateway_financials' || sectionId === 'financials' || sectionId === 'nav_tab_financials') {
    return false;
  }

  // Check if caller is admin via header
  const adminHeader = req.headers['x-admin-session'] as string | undefined;
  if (adminHeader && adminHeader.trim().length > 0) {
    return true;
  }

  // Check if caller is logged-in member via header
  const memberIdHeader = req.headers['x-member-id'] as string | undefined;
  const memberCodeHeader = req.headers['x-member-code'] as string | undefined;
  if ((memberIdHeader && memberIdHeader.trim().length > 0) || (memberCodeHeader && memberCodeHeader.trim().length > 0)) {
    return true;
  }

  // For non-members, current_financial_balance is strictly forbidden
  const canonicalId = SERVER_SECTION_ALIASES[sectionId] || sectionId;
  if (canonicalId === 'current_financial_balance') {
    return false;
  }

  const db = loadVisibilityDatabase();
  const isVisible = db[canonicalId];
  return isVisible !== false;
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-member-id, x-member-code');
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) { // 2MB limit
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

export async function handleVisibilityApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/visibility')) {
    return false;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-member-id, x-member-code');
    res.end();
    return true;
  }

  const method = req.method?.toUpperCase();
  const db = loadVisibilityDatabase();

  // 1. Check access status for a specific section: GET /api/visibility/check?section=:sectionId
  if (method === 'GET' && url.startsWith('/api/visibility/check')) {
    const queryIdx = url.indexOf('?');
    const queryString = queryIdx !== -1 ? url.slice(queryIdx + 1) : '';
    const params = new URLSearchParams(queryString);
    const section = params.get('section') || '';

    const allowed = isSectionAllowedOnServer(section, req);

    if (!allowed) {
      sendJson(res, 403, {
        success: false,
        statusCode: 403,
        section,
        allowed: false,
        error: 'Access Denied (403 Forbidden): هذا القسم محجوب عن غير المنخرطين بقرار من إدارة الجمعية.',
      });
      return true;
    }

    sendJson(res, 200, {
      success: true,
      statusCode: 200,
      section,
      allowed: true,
      message: 'الوصول إلى القسم متاح ومصرح به.',
    });
    return true;
  }

  // 2. Fetch visibility configuration: GET /api/visibility
  if (method === 'GET') {
    sendJson(res, 200, {
      success: true,
      visibility: db,
      lastUpdated: db.lastUpdated,
      updatedBy: db.updatedBy,
    });
    return true;
  }

  // 3. Update visibility configuration: POST or PUT /api/visibility
  if (method === 'POST' || method === 'PUT') {
    const adminHeader = req.headers['x-admin-session'] as string | undefined;
    let performedBy = 'مدير النظام (Admin)';

    if (adminHeader) {
      try {
        const parsed = JSON.parse(decodeURIComponent(adminHeader));
        if (parsed?.fullName) {
          performedBy = parsed.fullName;
        }
      } catch (e) {
        try {
          const parsed = JSON.parse(adminHeader);
          if (parsed?.fullName) {
            performedBy = parsed.fullName;
          }
        } catch (err) {}
      }
    }

    try {
      const body = await readBody(req);
      const newVisibility = body.visibility || body;

      if (!newVisibility || typeof newVisibility !== 'object') {
        sendJson(res, 400, {
          success: false,
          statusCode: 400,
          error: 'بيانات إعدادات الظهور غير صحيحة.',
        });
        return true;
      }

      // Merge new settings with existing database
      const updatedDb: VisibilityDatabase = {
        ...db,
        ...newVisibility,
        lastUpdated: new Date().toISOString(),
        updatedBy: performedBy,
      };

      const saved = saveVisibilityDatabase(updatedDb);

      if (!saved) {
        sendJson(res, 500, {
          success: false,
          statusCode: 500,
          error: 'فشل حفظ إعدادات الظهور في ملف قاعدة البيانات.',
        });
        return true;
      }

      sendJson(res, 200, {
        success: true,
        statusCode: 200,
        message: 'تم حفظ إعدادات ظهور الأقسام للغير المنخرطين بنجاح وتطبيقها على كامل النظام.',
        visibility: updatedDb,
        lastUpdated: updatedDb.lastUpdated,
        updatedBy: updatedDb.updatedBy,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, {
        success: false,
        statusCode: 500,
        error: err?.message || 'خطأ أثناء معالجة تحديث إعدادات الظهور.',
      });
      return true;
    }
  }

  sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  return true;
}
