import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { checkAdminPermission } from '../security';
import type { CurrentAdminSession, AdminSectionKey } from '../types';
import { handleVideoApi } from './videoApiHandler';
import { handleActivitiesApi } from './activitiesApiHandler';
import { handleSubAdminsApi, loadSubAdminsDatabase } from './subAdminsApiHandler';
import { handlePollsApi } from './pollsApiHandler';
import { handleSettingsApi } from './settingsApiHandler';
import { handleCampaignsApi } from './campaignsApiHandler';
import { handleGeoApi } from './geoApiHandler';
import { handleTenantsApi } from './tenantsApiHandler';
import { handlePortalSettingsApi } from './portalSettingsApiHandler';
import { handlePlatformIdentityApi } from './platformIdentityApiHandler';
import { handlePlatformSubAdminsApi } from './platformSubAdminsApiHandler';
import { handleUIElementsApi } from './uiElementsApiHandler';
import { handleCardSettingsApi } from './cardSettingsApiHandler';
import { handleTenantRecordsApi, readTenantRecordsFromDisk, writeTenantRecordsToDisk } from './tenantRecordsApiHandler';
import { handleTutorialsApi } from './tutorialsApiHandler';
import { handleImageApi } from './imageApiHandler';
import { handleAssociationSectionsApi } from './associationSectionsApiHandler';
import { handlePlatformPaymentsApi } from './platformPaymentsApiHandler';
import { handlePlatformSupportApi } from './platformSupportApiHandler';
import { handleSetupServiceApi } from './setupServiceApiHandler';
import { handlePayPalApi } from './paypalApiHandler';
import {
  getStorageSystemMetrics,
  normalizeTenantId,
  offloadEmbeddedMediaDeep,
  readLargeJsonBody,
  sendNoCacheJson,
} from './storageEngine';

function parseAdminSession(req: IncomingMessage): CurrentAdminSession | null {
  try {
    const rawHeader = req.headers['x-admin-session'];
    if (!rawHeader) return null;
    const headerStr = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const decoded = decodeURIComponent(headerStr);
    return JSON.parse(decoded) as CurrentAdminSession;
  } catch (e) {
    return null;
  }
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  sendNoCacheJson(res, statusCode, data);
}

/**
 * Vite Middleware Plugin providing Backend API Endpoints & RBAC Security Enforcement
 */
export function associationApiPlugin(): Plugin {
  return {
    name: 'association-rbac-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        if (!url.startsWith('/api/')) {
          return next();
        }

        try {
          // Handle CORS Preflight
          if (req.method === 'OPTIONS') {
            sendJson(res, 200, { ok: true });
            return;
          }

        // Storage Health & Capacity Endpoint (/api/storage/status)
        if (url === '/api/storage/status' || url.startsWith('/api/storage/status?')) {
          sendJson(res, 200, {
            success: true,
            ...getStorageSystemMetrics(),
          });
          return;
        }

        // 0. Handle Persistent Image Storage (/api/images/*)
        const handledByImage = await handleImageApi(req, res, url);
        if (handledByImage) {
          return;
        }

        // 0.0 Handle Persistent Tutorials Database (/api/tutorials*)
        const handledByTutorials = await handleTutorialsApi(req, res, url);
        if (handledByTutorials) {
          return;
        }

        // 0.0b Handle Association Sections Visibility & Ordering (/api/association-sections*)
        const handledByAssocSections = await handleAssociationSectionsApi(req, res);
        if (handledByAssocSections) {
          return;
        }

        // 0.0c Handle Platform Activation Fees, Subscriptions & Ad Payments (/api/platform-payments*)
        const handledByPlatformPayments = await handlePlatformPaymentsApi(req, res);
        if (handledByPlatformPayments) {
          return;
        }

        // 0.0d Handle Platform Support Payment Settings & Donations (/api/platform-support*)
        const handledByPlatformSupport = await handlePlatformSupportApi(req, res);
        if (handledByPlatformSupport) {
          return;
        }

        // 0.0e Handle Platform Setup Service Config & Requests (/api/setup-service*)
        const handledBySetupService = await handleSetupServiceApi(req, res);
        if (handledBySetupService) {
          return;
        }

        // 0.0f Handle PayPal REST API Orders & Verification (/api/paypal*)
        const handledByPayPal = await handlePayPalApi(req, res);
        if (handledByPayPal) {
          return;
        }

        // 0.1 Handle Persistent Polls & Member Voting (/api/polls*)
        const handledByPolls = await handlePollsApi(req, res, url);
        if (handledByPolls) {
          return;
        }

        // 0.2 Handle Persistent Association Settings & Branding (/api/settings*)
        const handledBySettings = await handleSettingsApi(req, res, url);
        if (handledBySettings) {
          return;
        }

        // 0.3 Handle Persistent Donation Campaigns & Contributions (/api/campaigns*)
        const handledByCampaigns = await handleCampaignsApi(req, res, url);
        if (handledByCampaigns) {
          return;
        }

        // 0.4 Handle Visitor Country Detection (/api/geo*)
        const handledByGeo = await handleGeoApi(req, res);
        if (handledByGeo) {
          return;
        }

        // 0.5 Handle Multi-Tenant Platform Directory & Management (/api/tenants*)
        const handledByTenants = await handleTenantsApi(req, res);
        if (handledByTenants) {
          return;
        }

        // 0.6 Handle Public Portal Settings Management (/api/portal-settings*)
        const handledByPortalSettings = await handlePortalSettingsApi(req, res);
        if (handledByPortalSettings) {
          return;
        }

        // 0.7 Handle Platform Identity Settings Management (/api/platform-identity* & unified login)
        const handledByPlatformIdentity = await handlePlatformIdentityApi(req, res, url);
        if (handledByPlatformIdentity) {
          return;
        }

        // 0.8 Handle Platform Secondary Admins & Audit Logs (/api/platform-subadmins* & /api/platform-audit-logs*)
        const handledByPlatformSubAdmins = await handlePlatformSubAdminsApi(req, res);
        if (handledByPlatformSubAdmins) {
          return;
        }

        // 0.9 Handle Dynamic UI Elements & Visibility Settings (/api/ui-elements* & /api/visibility-settings*)
        const handledByUIElements = await handleUIElementsApi(req, res);
        if (handledByUIElements) {
          return;
        }

        // 0.10 Handle Official Stamp, Signature & Card Settings (/api/card-settings*)
        const handledByCardSettings = await handleCardSettingsApi(req, res);
        if (handledByCardSettings) {
          return;
        }

        // 0.11 Handle Persistent Tenant Records (/api/tenant-records*)
        const handledByTenantRecords = await handleTenantRecordsApi(req, res);
        if (handledByTenantRecords) {
          return;
        }

        // 1. Handle Persistent Video Object Storage & Streaming (/api/videos/*)
        const handledByVideo = await handleVideoApi(req, res, url);
        if (handledByVideo) {
          return;
        }

        // 2. Handle Persistent Activities Database (/api/activities*)
        const handledByActivities = await handleActivitiesApi(req, res, url);
        if (handledByActivities) {
          return;
        }

        // 3. Handle Persistent Sub-Admins Database (/api/subadmins*)
        const handledBySubAdmins = await handleSubAdminsApi(req, res);
        if (handledBySubAdmins) {
          return;
        }

        const session = parseAdminSession(req);
        const liveSubAdmins = loadSubAdminsDatabase().subAdmins;
        const headerTenant = (req.headers['x-tenant-id'] as string | undefined)?.trim();
        const tenantId = normalizeTenantId(headerTenant || session?.tenantId);

        // Route: /api/operations*
        if (url.startsWith('/api/operations')) {
          const section: AdminSectionKey = 'operations';

          // GET /api/operations -> Requires canView AND returns persistent operations
          if (req.method === 'GET') {
            const check = checkAdminPermission(session, liveSubAdmins, section, 'canView');
            if (!check.allowed) {
              sendJson(res, 403, {
                error: check.reason || 'Access Denied (403 Forbidden): غير مصرح لك بعرض هذا القسم.',
                statusCode: 403,
              });
              return;
            }

            const canEdit = checkAdminPermission(session, liveSubAdmins, section, 'canEdit').allowed;
            const canAdd = checkAdminPermission(session, liveSubAdmins, section, 'canAdd').allowed;
            const canDelete = checkAdminPermission(session, liveSubAdmins, section, 'canDelete').allowed;
            const db = readTenantRecordsFromDisk(tenantId);

            sendJson(res, 200, {
              success: true,
              status: 'ok',
              canView: true,
              canEdit,
              canAdd,
              canDelete,
              operations: db.operations,
            });
            return;
          }

          // POST /api/operations -> Requires canAdd AND persists operation to disk
          if (req.method === 'POST') {
            const check = checkAdminPermission(session, liveSubAdmins, section, 'canAdd');
            if (!check.allowed) {
              sendJson(res, 403, {
                error: check.reason || 'Access Denied (403 Forbidden): لا تملك صلاحية إضافة عمليات مالية.',
                statusCode: 403,
              });
              return;
            }

            const body = await readLargeJsonBody(req);
            const resolvedTenant = normalizeTenantId(body?.tenantId || body?.associationId || tenantId);
            const sanitizedOp = offloadEmbeddedMediaDeep(body, `op_${resolvedTenant}`);
            const id = sanitizedOp.id || `op-${Date.now()}`;
            const newOperation = {
              ...sanitizedOp,
              id,
              tenantId: resolvedTenant,
              associationId: resolvedTenant,
              createdAt: sanitizedOp.createdAt || new Date().toISOString(),
            };

            const db = readTenantRecordsFromDisk(resolvedTenant);
            const existingIdx = db.operations.findIndex((o: any) => o && o.id === id);
            if (existingIdx >= 0) {
              db.operations[existingIdx] = { ...db.operations[existingIdx], ...newOperation };
            } else {
              db.operations.unshift(newOperation);
            }
            const savedDb = writeTenantRecordsToDisk(db, resolvedTenant, true);
            const persistedOp = savedDb.operations.find((o: any) => o && o.id === id) || newOperation;

            sendJson(res, 201, {
              success: true,
              status: 'ok',
              message: 'Operation creation authorized and persisted to database',
              operation: persistedOp,
            });
            return;
          }

          // PUT or PATCH /api/operations/:id -> Strictly Requires canEdit AND updates disk record
          if (req.method === 'PUT' || req.method === 'PATCH') {
            const check = checkAdminPermission(session, liveSubAdmins, section, 'canEdit');
            if (!check.allowed) {
              sendJson(res, 403, {
                error:
                  check.reason ||
                  'Access Denied (403 Forbidden): غير مصرح لك بتعديل العمليات المالية. صلاحية العرض لا تمنح صلاحية التعديل.',
                statusCode: 403,
              });
              return;
            }

            const body = await readLargeJsonBody(req);
            if (!body || (!body.id && !body.updatedData)) {
              sendJson(res, 400, {
                error: 'Bad Request: Missing operation ID or update payload',
                statusCode: 400,
              });
              return;
            }

            const resolvedTenant = normalizeTenantId(
              body?.tenantId || body?.updatedData?.tenantId || tenantId
            );
            const sanitizedUpdates = offloadEmbeddedMediaDeep(body.updatedData || body, `op_${resolvedTenant}`);
            const targetId = body.id || url.replace('/api/operations/', '').split('?')[0];
            const db = readTenantRecordsFromDisk(resolvedTenant);
            const idx = db.operations.findIndex((o: any) => o && o.id === targetId);
            if (idx >= 0) {
              const updatedOp = {
                ...db.operations[idx],
                ...sanitizedUpdates,
                id: targetId,
                tenantId: resolvedTenant,
                associationId: resolvedTenant,
                updatedAt: new Date().toISOString(),
              };
              db.operations[idx] = updatedOp;

              // Also keep any linked MemberContribution in sync
              db.contributions = (db.contributions || []).map((c: any) => {
                if (c && (c.financialOperationId === targetId || c.id === `contrib-op-${targetId}`)) {
                  return {
                    ...c,
                    amount: Number(updatedOp.amount) || c.amount,
                    date: updatedOp.date || c.date,
                    paymentMethod: updatedOp.paymentMethod || c.paymentMethod,
                    notes: updatedOp.description
                      ? `${updatedOp.title} - ${updatedOp.description}`
                      : updatedOp.title || c.notes,
                    tenantId: resolvedTenant,
                    associationId: resolvedTenant,
                  };
                }
                return c;
              });

              writeTenantRecordsToDisk(db, resolvedTenant, true);
            }

            sendJson(res, 200, {
              success: true,
              status: 'ok',
              message: 'In-place operation update authorized and persisted to database',
              id: targetId,
              updatedData: sanitizedUpdates,
            });
            return;
          }

          // DELETE /api/operations/:id -> Strictly Requires canDelete AND removes from disk
          if (req.method === 'DELETE') {
            const check = checkAdminPermission(session, liveSubAdmins, section, 'canDelete');
            if (!check.allowed) {
              sendJson(res, 403, {
                error: check.reason || 'Access Denied (403 Forbidden): لا تملك صلاحية حذف العمليات المالية.',
                statusCode: 403,
              });
              return;
            }

            const targetId = decodeURIComponent(url.replace('/api/operations/', '').split('?')[0]);
            if (targetId) {
              const db = readTenantRecordsFromDisk(tenantId);
              const opToDelete = db.operations.find((o: any) => o && o.id === targetId);
              const linkedContribIds = (db.contributions || [])
                .filter(
                  (c: any) =>
                    c &&
                    (c.financialOperationId === targetId ||
                      c.id === `contrib-op-${targetId}` ||
                      (opToDelete?.memberId && c.id === `contrib-fee-${opToDelete.memberId}`))
                )
                .map((c: any) => c.id);

              db.deletedOperationIds = Array.from(new Set([...(db.deletedOperationIds || []), targetId]));
              db.deletedContributionIds = Array.from(
                new Set([...(db.deletedContributionIds || []), `contrib-op-${targetId}`, ...linkedContribIds])
              );
              db.operations = db.operations.filter((o: any) => o && o.id !== targetId);
              db.contributions = (db.contributions || []).filter(
                (c: any) => c && !linkedContribIds.includes(c.id) && c.id !== `contrib-op-${targetId}`
              );
              writeTenantRecordsToDisk(db, tenantId, true);
            }

            sendJson(res, 200, {
              success: true,
              status: 'ok',
              message: 'Operation deletion authorized and persisted to database',
            });
            return;
          }
        }

        // Route: /api/permissions/verify -> General RBAC verification endpoint for any section
        if (url.startsWith('/api/permissions/verify') && req.method === 'POST') {
          const body = await readLargeJsonBody(req);
          const { section, action } = body;
          if (!section || !action) {
            sendJson(res, 400, { error: 'Missing section or action' });
            return;
          }

          const check = checkAdminPermission(session, liveSubAdmins, section, action);
          if (!check.allowed) {
            sendJson(res, 403, {
              allowed: false,
              error: check.reason,
              statusCode: 403,
            });
            return;
          }

          sendJson(res, 200, {
            allowed: true,
            statusCode: 200,
          });
          return;
        }

        if (!res.writableEnded) {
          sendJson(res, 404, {
            success: false,
            error: `مسار واجهة البرمجة غير موجود (${url})`,
          });
        }
        } catch (err: any) {
          console.error('[API Middleware Error]:', err);
          if (!res.writableEnded) {
            sendJson(res, 500, {
              success: false,
              error: err?.message || 'حدث خطأ داخلي في الخادم أثناء معالجة الطلب.',
            });
          }
        }
      });
    },
  };
}
export const apiPlugin = associationApiPlugin;

