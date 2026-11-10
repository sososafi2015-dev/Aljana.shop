import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { serverDb } from './firebaseServerStorage';
import type {
  AdminSectionKey,
  AssociationSectionsConfig,
  AssociationSectionsVisibilityMap,
} from '../types';

const ALL_SECTION_KEYS: AdminSectionKey[] = [
  'overview',
  'operations',
  'contributions',
  'donationsBenefit',
  'activities',
  'campaigns',
  'members',
  'boardMembers',
  'fields',
  'branding',
  'memberCard',
  'uiElements',
  'createAd',
  'polls',
  'nonMemberVisibility',
  'accessControl',
  'settings',
  'subAdmins',
  'audit',
  'backup',
  'subscriptionRenewal',
  'platformTutorials',
  'platformSetupService',
];

export function getDefaultServerSectionsVisibilityMap(): AssociationSectionsVisibilityMap {
  const map: Partial<AssociationSectionsVisibilityMap> = {};
  for (const key of ALL_SECTION_KEYS) {
    map[key] = true;
  }
  return map as AssociationSectionsVisibilityMap;
}

export const DEFAULT_SERVER_ASSOCIATION_SECTIONS_CONFIG: AssociationSectionsConfig = {
  sectionsVisibility: getDefaultServerSectionsVisibilityMap(),
  sectionTitles: {
    donationsBenefit: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
  },
  sectionBrandNames: {
    donationsBenefit: 'syoumax',
  },
  hideBoardMembersPublicContact: true,
  lastUpdated: new Date().toISOString(),
  updatedBy: 'الإدارة العامة للمنصة',
  version: 1,
};

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'association_sections_database.json');

let inMemorySectionsConfig: AssociationSectionsConfig | null = null;
let firestoreInitialSyncPromise: Promise<void> | null = null;

export async function syncFromFirestoreIfNeeded(): Promise<void> {
  if (firestoreInitialSyncPromise) return firestoreInitialSyncPromise;
  firestoreInitialSyncPromise = (async () => {
    try {
      const snap = await getDoc(doc(serverDb, 'portal_settings', 'association_sections_config'));
      if (snap.exists()) {
        const firestoreData = snap.data() as any;
        if (firestoreData && firestoreData.sectionsVisibility) {
          const firestoreVer = typeof firestoreData.version === 'number' ? firestoreData.version : 1;
          const currentVer = inMemorySectionsConfig?.version || 0;
          if (firestoreVer >= currentVer) {
            const mergedVisibility: AssociationSectionsVisibilityMap = {
              ...getDefaultServerSectionsVisibilityMap(),
              ...(firestoreData.sectionsVisibility || {}),
            };
            const synced: AssociationSectionsConfig = {
              sectionsVisibility: mergedVisibility,
              sectionTitles: {
                ...(firestoreData.sectionTitles || {}),
                donationsBenefit: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
              },
              sectionBrandNames: {
                ...(firestoreData.sectionBrandNames || {}),
                donationsBenefit: 'syoumax',
              },
              hideBoardMembersPublicContact: true,
              lastUpdated: firestoreData.lastUpdated || new Date().toISOString(),
              updatedBy: firestoreData.updatedBy || 'الإدارة العامة للمنصة',
              version: firestoreVer,
            };
            inMemorySectionsConfig = synced;
            if (!fs.existsSync(DB_DIR)) {
              fs.mkdirSync(DB_DIR, { recursive: true });
            }
            fs.writeFileSync(DB_FILE, JSON.stringify(synced, null, 2), 'utf-8');
          } else if (inMemorySectionsConfig) {
            // Local database version is newer (e.g. updated section title or brand name), push to Firestore
            setDoc(
              doc(serverDb, 'portal_settings', 'association_sections_config'),
              {
                ...inMemorySectionsConfig,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            ).catch(() => {});
          }
        }
      } else if (inMemorySectionsConfig) {
        setDoc(
          doc(serverDb, 'portal_settings', 'association_sections_config'),
          {
            ...inMemorySectionsConfig,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        ).catch(() => {});
      }
    } catch {
      // Fallback silently to local disk database if Firestore is temporarily unreachable
    }
  })();
  return firestoreInitialSyncPromise;
}

export function loadAssociationSectionsDatabase(forceFresh = false): AssociationSectionsConfig {
  if (!forceFresh && inMemorySectionsConfig) {
    return inMemorySectionsConfig;
  }

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const mergedVisibility: AssociationSectionsVisibilityMap = {
          ...getDefaultServerSectionsVisibilityMap(),
          ...(parsed.sectionsVisibility || {}),
        };
        inMemorySectionsConfig = {
          sectionsVisibility: mergedVisibility,
          sectionTitles: {
            ...(parsed.sectionTitles || {}),
            donationsBenefit: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
          },
          sectionBrandNames: {
            ...(parsed.sectionBrandNames || {}),
            donationsBenefit: 'syoumax',
          },
          hideBoardMembersPublicContact: true,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          updatedBy: parsed.updatedBy || 'الإدارة العامة للمنصة',
          version: typeof parsed.version === 'number' ? parsed.version : 1,
        };
        // Trigger non-blocking cloud check in background
        syncFromFirestoreIfNeeded().catch(() => {});
        return inMemorySectionsConfig;
      }
    }
  } catch (err) {
    console.error('[AssociationSectionsDB] Error loading database:', err);
  }

  inMemorySectionsConfig = {
    ...DEFAULT_SERVER_ASSOCIATION_SECTIONS_CONFIG,
    sectionsVisibility: getDefaultServerSectionsVisibilityMap(),
    sectionTitles: {
      donationsBenefit: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
    },
    sectionBrandNames: {
      donationsBenefit: 'syoumax',
    },
    hideBoardMembersPublicContact: true,
  };
  saveAssociationSectionsDatabase(inMemorySectionsConfig);
  syncFromFirestoreIfNeeded().catch(() => {});
  return inMemorySectionsConfig;
}

export function saveAssociationSectionsDatabase(config: AssociationSectionsConfig): AssociationSectionsConfig {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const mergedVisibility: AssociationSectionsVisibilityMap = {
      ...getDefaultServerSectionsVisibilityMap(),
      ...(config.sectionsVisibility || {}),
    };
    const normalized: AssociationSectionsConfig = {
      sectionsVisibility: mergedVisibility,
      sectionTitles: {
        ...(config.sectionTitles || {}),
        donationsBenefit: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
      },
      sectionBrandNames: {
        ...(config.sectionBrandNames || {}),
        donationsBenefit: 'syoumax',
      },
      hideBoardMembersPublicContact: true,
      lastUpdated: config.lastUpdated || new Date().toISOString(),
      updatedBy: config.updatedBy || 'الإدارة العامة للمنصة',
      version: typeof config.version === 'number' ? config.version : 1,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
    inMemorySectionsConfig = normalized;

    // Asynchronously mirror to Firestore so it is permanently preserved in Firebase
    setDoc(
      doc(serverDb, 'portal_settings', 'association_sections_config'),
      {
        ...normalized,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ).catch(() => {});

    return normalized;
  } catch (err) {
    console.error('[AssociationSectionsDB] Error saving database:', err);
    throw new Error('تعذر حفظ إعدادات أقسام الجمعيات في قاعدة البيانات الدائمة');
  }
}

export function isAssociationSectionEnabledOnServer(sectionKey: AdminSectionKey | string): boolean {
  const config = loadAssociationSectionsDatabase(true);
  const val = config.sectionsVisibility[sectionKey as AdminSectionKey];
  return val !== false;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
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
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
  res.end(JSON.stringify(data));
}

export async function handleAssociationSectionsApi(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/association-sections')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  const currentConfig = loadAssociationSectionsDatabase(true);

  // 1. Check specific section permission/status endpoint: GET /api/association-sections/check?section=...
  if (req.method === 'GET' && url.startsWith('/api/association-sections/check')) {
    const queryIndex = url.indexOf('?');
    const params = new URLSearchParams(queryIndex !== -1 ? url.slice(queryIndex) : '');
    const sectionKey = params.get('section') || '';
    if (!sectionKey) {
      sendJson(res, 400, { success: false, statusCode: 400, error: 'يرجى تحديد مفتاح القسم المطلوب فحصه.' });
      return true;
    }
    const enabled = isAssociationSectionEnabledOnServer(sectionKey);
    if (!enabled) {
      sendJson(res, 403, {
        success: false,
        statusCode: 403,
        section: sectionKey,
        enabled: false,
        error: `Access Denied (403 Forbidden): القسم (${sectionKey}) معطل حالياً من طرف الإدارة العامة للمنصة.`,
      });
      return true;
    }
    sendJson(res, 200, {
      success: true,
      statusCode: 200,
      section: sectionKey,
      enabled: true,
    });
    return true;
  }

  // 2. GET /api/association-sections - retrieve global sections configuration
  if (req.method === 'GET') {
    sendJson(res, 200, {
      success: true,
      config: currentConfig,
    });
    return true;
  }

  // 3. POST /api/association-sections/reset - reset all sections to enabled
  if (req.method === 'POST' && (url === '/api/association-sections/reset' || url.startsWith('/api/association-sections/reset?'))) {
    try {
      const body = await readBody(req);
      const resetConfig: AssociationSectionsConfig = {
        sectionsVisibility: getDefaultServerSectionsVisibilityMap(),
        lastUpdated: new Date().toISOString(),
        updatedBy: body.updatedBy || 'الإدارة العامة للمنصة',
        version: (currentConfig.version || 1) + 1,
      };
      const saved = saveAssociationSectionsDatabase(resetConfig);
      sendJson(res, 200, {
        success: true,
        message: 'تمت إعادة تفعيل جميع أقسام الجمعيات بنجاح في قاعدة البيانات الدائمة',
        config: saved,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message || 'خطأ في إعادة ضبط أقسام الجمعيات' });
      return true;
    }
  }

  // 4. POST or PUT /api/association-sections - update global sections configuration
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const incoming = body.config || body;
      if (!incoming || typeof incoming !== 'object') {
        sendJson(res, 400, { success: false, error: 'بيانات إعدادات أقسام الجمعيات غير صالحة' });
        return true;
      }

      const incomingVis = incoming.sectionsVisibility || incoming;
      const mergedVisibility: AssociationSectionsVisibilityMap = {
        ...currentConfig.sectionsVisibility,
        ...(typeof incomingVis === 'object' ? incomingVis : {}),
      };

      const nextConfig: AssociationSectionsConfig = {
        sectionsVisibility: mergedVisibility,
        lastUpdated: new Date().toISOString(),
        updatedBy: incoming.updatedBy || body.updatedBy || 'الإدارة العامة للمنصة',
        version:
          typeof incoming.version === 'number' && incoming.version > currentConfig.version
            ? incoming.version
            : (currentConfig.version || 1) + 1,
      };

      const saved = saveAssociationSectionsDatabase(nextConfig);
      sendJson(res, 200, {
        success: true,
        message: 'تم حفظ حالة تفعيل أقسام الجمعيات بشكل دائم وتعميمها على جميع الجمعيات',
        config: saved,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message || 'خطأ في حفظ إعدادات أقسام الجمعيات' });
      return true;
    }
  }

  return false;
}
