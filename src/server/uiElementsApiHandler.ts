import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import type { UIElementConfig } from '../types';
import { initialUIElements } from '../initialData';
import {
  DATA_DIR,
  ensureStorageDirectories,
  normalizeTenantId,
  readJsonFileSync,
  writeJsonFileAtomicSync,
  readLargeJsonBody,
} from './storageEngine';

function getUIElementsFile(tenantId?: string | null): string {
  const clean = normalizeTenantId(tenantId);
  if (clean === 'tenant_nour') {
    return path.join(DATA_DIR, 'ui_elements_database.json');
  }
  return path.join(DATA_DIR, `ui_elements_database_${clean}.json`);
}

function getVisibilitySettingsFile(tenantId?: string | null): string {
  const clean = normalizeTenantId(tenantId);
  if (clean === 'tenant_nour') {
    return path.join(DATA_DIR, 'visibility_settings.json');
  }
  return path.join(DATA_DIR, `visibility_settings_${clean}.json`);
}

export function readUIElementsFromDisk(tenantId?: string | null): UIElementConfig[] {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const filePath = getUIElementsFile(cleanTenant);

  if (!fs.existsSync(filePath)) {
    const seeded = initialUIElements
      .filter((el) => el.id !== 'pillars_section' && el.id !== 'gateway_financials')
      .map((el) =>
        el.id === 'current_financial_balance'
          ? { ...el, enabled: true, visibleToNonMembers: false }
          : { ...el }
      );
    writeJsonFileAtomicSync(filePath, seeded, 'ui_elements');
    return seeded;
  }

  const parsed = readJsonFileSync<UIElementConfig[]>(filePath, () => []);
  if (Array.isArray(parsed) && parsed.length > 0) {
    const map = new Map<string, UIElementConfig>();
    for (const def of initialUIElements) {
      if (def.id === 'pillars_section' || def.id === 'gateway_financials') continue;
      map.set(def.id, { ...def });
    }
    for (const item of parsed) {
      if (item && item.id && item.id !== 'pillars_section' && item.id !== 'gateway_financials') {
        const existing = map.get(item.id) || ({} as UIElementConfig);
        const merged = { ...existing, ...item };
        if (merged.id === 'current_financial_balance') {
          merged.enabled = true;
          merged.visibleToNonMembers = false;
        }
        map.set(item.id, merged);
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  return initialUIElements
    .filter((el) => el.id !== 'pillars_section' && el.id !== 'gateway_financials')
    .map((el) =>
      el.id === 'current_financial_balance'
        ? { ...el, enabled: true, visibleToNonMembers: false }
        : { ...el }
    );
}

export function writeUIElementsToDisk(elements: UIElementConfig[], tenantId?: string | null): void {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const filePath = getUIElementsFile(cleanTenant);
  const cleaned = (Array.isArray(elements) ? elements : [])
    .filter((el) => el && el.id !== 'pillars_section' && el.id !== 'gateway_financials')
    .map((el) =>
      el.id === 'current_financial_balance'
        ? { ...el, enabled: true, visibleToNonMembers: false }
        : el
    );
  writeJsonFileAtomicSync(filePath, cleaned, 'ui_elements');
}

export function readVisibilitySettingsFromDisk(tenantId?: string | null): Record<string, any> {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const filePath = getVisibilitySettingsFile(cleanTenant);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const parsed = readJsonFileSync<Record<string, any>>(filePath, () => ({}));
  return parsed && typeof parsed === 'object' ? parsed : {};
}

export function writeVisibilitySettingsToDisk(settings: Record<string, any>, tenantId?: string | null): void {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const filePath = getVisibilitySettingsFile(cleanTenant);
  writeJsonFileAtomicSync(filePath, settings, 'visibility');
}

function sendJson(res: ServerResponse, statusCode: number, data: any): boolean {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
  res.end(JSON.stringify(data));
  return true;
}

export async function handleUIElementsApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url || '').split('?')[0];

  if (!url.startsWith('/api/ui-elements') && !url.startsWith('/api/visibility-settings')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
    res.end();
    return true;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  } catch {
    parsedUrl = new URL('http://localhost' + (req.url || ''));
  }

  const headerTenant = (req.headers['x-tenant-id'] as string | undefined)?.trim();
  const queryTenant = parsedUrl.searchParams.get('tenantId')?.trim();
  const tenantId = normalizeTenantId(headerTenant || queryTenant);
  const method = req.method?.toUpperCase();

  try {
    if (url.startsWith('/api/ui-elements')) {
      // 1. GET /api/ui-elements
      if (method === 'GET' && (url === '/api/ui-elements' || url === '/api/ui-elements/')) {
        const elements = readUIElementsFromDisk(tenantId);
        return sendJson(res, 200, {
          success: true,
          tenantId,
          elements,
          updatedAt: new Date().toISOString(),
        });
      }

      // 2. POST /api/ui-elements/reset
      if (method === 'POST' && url === '/api/ui-elements/reset') {
        const body = await readLargeJsonBody(req).catch(() => ({}));
        const targetTenant = normalizeTenantId(body?.tenantId || tenantId);
        const defaults = initialUIElements.map((el) => ({
          ...el,
          updatedAt: new Date().toISOString(),
        }));
        writeUIElementsToDisk(defaults, targetTenant);
        return sendJson(res, 200, {
          success: true,
          tenantId: targetTenant,
          elements: defaults,
          message: 'تمت استعادة الإعدادات الافتراضية لعناصر الواجهة.',
        });
      }

      // 3. PATCH/POST /api/ui-elements/:id/toggle
      const toggleMatch = url.match(/^\/api\/ui-elements\/([^/]+)\/toggle$/);
      if (toggleMatch && (method === 'PATCH' || method === 'POST' || method === 'PUT')) {
        const elementId = decodeURIComponent(toggleMatch[1]).trim();
        const body = await readLargeJsonBody(req).catch(() => ({}));
        const targetTenant = normalizeTenantId(body?.tenantId || tenantId);
        const current = readUIElementsFromDisk(targetTenant);
        const idx = current.findIndex((e) => e.id === elementId);
        if (idx === -1) {
          return sendJson(res, 404, { success: false, error: 'العنصر غير موجود.' });
        }
        const nextEnabled = typeof body?.enabled === 'boolean' ? body.enabled : !current[idx].enabled;
        current[idx] = {
          ...current[idx],
          enabled: nextEnabled,
          updatedAt: new Date().toISOString(),
        };
        writeUIElementsToDisk(current, targetTenant);
        return sendJson(res, 200, {
          success: true,
          tenantId: targetTenant,
          element: current[idx],
          elements: current,
          message: 'تم تحديث حالة تفعيل العنصر وحفظها في قاعدة البيانات.',
        });
      }

      // 4. PATCH/POST /api/ui-elements/:id/visibility
      const visMatch = url.match(/^\/api\/ui-elements\/([^/]+)\/visibility$/);
      if (visMatch && (method === 'PATCH' || method === 'POST' || method === 'PUT')) {
        const elementId = decodeURIComponent(visMatch[1]).trim();
        const body = await readLargeJsonBody(req).catch(() => ({}));
        const targetTenant = normalizeTenantId(body?.tenantId || tenantId);
        const current = readUIElementsFromDisk(targetTenant);
        const idx = current.findIndex((e) => e.id === elementId);
        if (idx === -1) {
          return sendJson(res, 404, { success: false, error: 'العنصر غير موجود.' });
        }
        const nextVisible =
          typeof body?.visibleToNonMembers === 'boolean'
            ? body.visibleToNonMembers
            : !current[idx].visibleToNonMembers;
        current[idx] = {
          ...current[idx],
          visibleToNonMembers: nextVisible,
          updatedAt: new Date().toISOString(),
        };
        writeUIElementsToDisk(current, targetTenant);
        return sendJson(res, 200, {
          success: true,
          tenantId: targetTenant,
          element: current[idx],
          elements: current,
          message: 'تم تحديث صلاحية ظهور العنصر لغير المنخرطين بنجاح.',
        });
      }

      // 5. PUT / PATCH / DELETE /api/ui-elements/:id
      const idMatch = url.match(/^\/api\/ui-elements\/([^/]+)$/);
      if (idMatch && idMatch[1] !== 'reset') {
        const elementId = decodeURIComponent(idMatch[1]).trim();

        if (method === 'DELETE') {
          const current = readUIElementsFromDisk(tenantId);
          const updatedList = current.filter((e) => e.id !== elementId);
          writeUIElementsToDisk(updatedList, tenantId);
          return sendJson(res, 200, {
            success: true,
            tenantId,
            elements: updatedList,
            message: 'تم حذف العنصر وحفظ التعديلات في قاعدة البيانات.',
          });
        }

        if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
          const body = await readLargeJsonBody(req).catch(() => ({}));
          const targetTenant = normalizeTenantId(body?.tenantId || tenantId);
          const incoming = body?.element || body || {};
          const current = readUIElementsFromDisk(targetTenant);
          const idx = current.findIndex((e) => e.id === elementId);
          let updatedElement: UIElementConfig;
          if (idx >= 0) {
            updatedElement = {
              ...current[idx],
              ...incoming,
              id: elementId,
              updatedAt: new Date().toISOString(),
            };
            current[idx] = updatedElement;
          } else {
            updatedElement = {
              ...incoming,
              id: elementId,
              order: incoming.order ?? current.length + 1,
              updatedAt: new Date().toISOString(),
            } as UIElementConfig;
            current.push(updatedElement);
          }
          writeUIElementsToDisk(current, targetTenant);
          return sendJson(res, 200, {
            success: true,
            tenantId: targetTenant,
            element: updatedElement,
            elements: current,
            message: 'تم تحديث العنصر وحفظه في قاعدة البيانات.',
          });
        }
      }

      // 6. POST or PUT /api/ui-elements (bulk save or single element creation)
      if ((method === 'POST' || method === 'PUT') && (url === '/api/ui-elements' || url === '/api/ui-elements/')) {
        const body = await readLargeJsonBody(req);
        const targetTenant = normalizeTenantId(body?.tenantId || tenantId);
        const current = readUIElementsFromDisk(targetTenant);

        if (Array.isArray(body?.elements)) {
          const map = new Map<string, UIElementConfig>();
          for (const el of current) {
            map.set(el.id, { ...el });
          }
          for (const incoming of body.elements) {
            if (incoming && incoming.id) {
              const existing = map.get(incoming.id) || ({} as UIElementConfig);
              map.set(incoming.id, {
                ...existing,
                ...incoming,
                updatedAt: new Date().toISOString(),
              });
            }
          }
          const updatedList = Array.from(map.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
          writeUIElementsToDisk(updatedList, targetTenant);
          return sendJson(res, 200, {
            success: true,
            tenantId: targetTenant,
            elements: updatedList,
            message: 'تم حفظ إعدادات عناصر الواجهة بشكل دائم في قاعدة البيانات.',
          });
        }

        const singleEl = body?.element || (body?.id || body?.label ? body : null);
        if (singleEl) {
          const elId = singleEl.id || `custom-el-${Date.now()}`;
          const idx = current.findIndex((e) => e.id === elId);
          let savedEl: UIElementConfig;
          if (idx >= 0) {
            savedEl = {
              ...current[idx],
              ...singleEl,
              id: elId,
              updatedAt: new Date().toISOString(),
            };
            current[idx] = savedEl;
          } else {
            savedEl = {
              id: elId,
              key: singleEl.key || elId,
              label: singleEl.label || 'عنصر جديد',
              category: singleEl.category || 'button',
              location: singleEl.location || 'home_hero_actions',
              enabled: singleEl.enabled ?? true,
              visibleToNonMembers: singleEl.visibleToNonMembers ?? true,
              order: singleEl.order ?? current.length + 1,
              isCustom: singleEl.isCustom ?? true,
              ...singleEl,
              updatedAt: new Date().toISOString(),
            };
            current.push(savedEl);
          }
          writeUIElementsToDisk(current, targetTenant);
          return sendJson(res, 200, {
            success: true,
            tenantId: targetTenant,
            element: savedEl,
            elements: current,
            message: 'تم حفظ العنصر في قاعدة البيانات.',
          });
        }

        return sendJson(res, 400, { success: false, error: 'بيانات عناصر الواجهة غير صالحة.' });
      }
    }

    if (url.startsWith('/api/visibility-settings')) {
      if (method === 'GET') {
        const settings = readVisibilitySettingsFromDisk(tenantId);
        return sendJson(res, 200, {
          success: true,
          tenantId,
          settings,
        });
      }

      if (method === 'POST' || method === 'PUT') {
        const body = await readLargeJsonBody(req);
        const targetTenant = normalizeTenantId(body?.tenantId || tenantId);
        const current = readVisibilitySettingsFromDisk(targetTenant);
        const next = {
          ...current,
          ...(body?.settings || body),
          updatedAt: new Date().toISOString(),
        };
        writeVisibilitySettingsToDisk(next, targetTenant);
        return sendJson(res, 200, {
          success: true,
          tenantId: targetTenant,
          settings: next,
        });
      }
    }

    return sendJson(res, 404, { success: false, error: 'Endpoint not found' });
  } catch (err: any) {
    console.error('[uiElementsApiHandler] Error:', err);
    return sendJson(res, 500, {
      success: false,
      error: err?.message || 'حدث خطأ في خادم إعدادات عناصر الواجهة.',
    });
  }
}
