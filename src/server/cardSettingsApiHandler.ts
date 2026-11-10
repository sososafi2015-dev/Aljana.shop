import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { initialMemberCardSettings } from '../initialData';
import type { MemberCardSettings } from '../types';
import {
  DATA_DIR,
  ensureStorageDirectories,
  normalizeTenantId,
  offloadBase64ToDisk,
  readJsonFileSync,
  writeJsonFileAtomicSync,
  readLargeJsonBody,
} from './storageEngine';

export interface CardSettingsDatabase extends MemberCardSettings {
  tenantId?: string;
  updatedAt: string;
}

function getCardSettingsFile(tenantId?: string | null): string {
  const clean = normalizeTenantId(tenantId);
  if (clean === 'tenant_nour') {
    return path.join(DATA_DIR, 'card_settings_database.json');
  }
  return path.join(DATA_DIR, `card_settings_database_${clean}.json`);
}

export function readCardSettingsFromDisk(tenantId?: string | null): CardSettingsDatabase {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const filePath = getCardSettingsFile(cleanTenant);

  if (fs.existsSync(filePath)) {
    const parsed = readJsonFileSync<any>(filePath, () => null);
    if (parsed && typeof parsed === 'object') {
      return {
        ...initialMemberCardSettings,
        ...parsed,
        tenantId: cleanTenant,
        stampImageUrl: parsed.stampImageUrl ?? '',
        signatureImageUrl: parsed.signatureImageUrl ?? '',
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  }

  return {
    ...initialMemberCardSettings,
    tenantId: cleanTenant,
    stampImageUrl: initialMemberCardSettings.stampImageUrl || '',
    signatureImageUrl: initialMemberCardSettings.signatureImageUrl || '',
    updatedAt: new Date().toISOString(),
  };
}

export function writeCardSettingsToDisk(settings: CardSettingsDatabase, tenantId?: string | null): CardSettingsDatabase {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId || settings.tenantId);
  const filePath = getCardSettingsFile(cleanTenant);
  const updated: CardSettingsDatabase = {
    ...initialMemberCardSettings,
    ...settings,
    tenantId: cleanTenant,
    stampImageUrl:
      settings.stampImageUrl && settings.stampImageUrl.startsWith('data:')
        ? offloadBase64ToDisk(settings.stampImageUrl, 'official_stamp')
        : settings.stampImageUrl ?? '',
    signatureImageUrl:
      settings.signatureImageUrl && settings.signatureImageUrl.startsWith('data:')
        ? offloadBase64ToDisk(settings.signatureImageUrl, 'president_signature')
        : settings.signatureImageUrl ?? '',
    updatedAt: new Date().toISOString(),
  };
  writeJsonFileAtomicSync(filePath, updated, `card_${cleanTenant}`);
  return updated;
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

export async function handleCardSettingsApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith('/api/card-settings')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
    if (method === 'GET' && url === '/api/card-settings') {
      const settings = readCardSettingsFromDisk(tenantId);
      return sendJson(res, 200, {
        success: true,
        tenantId,
        settings,
      });
    }

    if ((method === 'POST' || method === 'PUT') && url === '/api/card-settings') {
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body.tenantId || tenantId);
      const current = readCardSettingsFromDisk(targetTenant);
      const incoming = body.settings || body;

      let stampImageUrl = incoming.stampImageUrl !== undefined ? incoming.stampImageUrl : current.stampImageUrl;
      let signatureImageUrl = incoming.signatureImageUrl !== undefined ? incoming.signatureImageUrl : current.signatureImageUrl;

      if (stampImageUrl && stampImageUrl.startsWith('data:')) {
        stampImageUrl = offloadBase64ToDisk(stampImageUrl, 'official_stamp');
      }
      if (signatureImageUrl && signatureImageUrl.startsWith('data:')) {
        signatureImageUrl = offloadBase64ToDisk(signatureImageUrl, 'president_signature');
      }

      const next: CardSettingsDatabase = {
        ...current,
        ...incoming,
        tenantId: targetTenant,
        stampImageUrl,
        signatureImageUrl,
        updatedAt: new Date().toISOString(),
      };
      const saved = writeCardSettingsToDisk(next, targetTenant);

      return sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        settings: saved,
        message: 'تم حفظ إعدادات وتصميم بطاقة الانخراط بشكل دائم في قاعدة البيانات الرئيسية.',
      });
    }

    if (method === 'POST' && url === '/api/card-settings/stamp') {
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body.tenantId || tenantId);
      const current = readCardSettingsFromDisk(targetTenant);
      let finalUrl = body.stampImageUrl || '';
      if (finalUrl.startsWith('data:')) {
        finalUrl = offloadBase64ToDisk(finalUrl, 'official_stamp');
      }
      const next: CardSettingsDatabase = {
        ...current,
        stampImageUrl: finalUrl,
        updatedAt: new Date().toISOString(),
      };
      const saved = writeCardSettingsToDisk(next, targetTenant);
      return sendJson(res, 200, {
        success: true,
        stampImageUrl: finalUrl,
        settings: saved,
        message: 'تم حفظ الختم الرسمي في قاعدة البيانات بنجاح.',
      });
    }

    if (method === 'DELETE' && url === '/api/card-settings/stamp') {
      const current = readCardSettingsFromDisk(tenantId);
      const next: CardSettingsDatabase = {
        ...current,
        stampImageUrl: '',
        updatedAt: new Date().toISOString(),
      };
      const saved = writeCardSettingsToDisk(next, tenantId);
      return sendJson(res, 200, {
        success: true,
        stampImageUrl: '',
        settings: saved,
        message: 'تم حذف الختم الرسمي نهائيًا من قاعدة البيانات.',
      });
    }

    if (method === 'POST' && url === '/api/card-settings/signature') {
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body.tenantId || tenantId);
      const current = readCardSettingsFromDisk(targetTenant);
      let finalUrl = body.signatureImageUrl || '';
      if (finalUrl.startsWith('data:')) {
        finalUrl = offloadBase64ToDisk(finalUrl, 'president_signature');
      }
      const next: CardSettingsDatabase = {
        ...current,
        signatureImageUrl: finalUrl,
        updatedAt: new Date().toISOString(),
      };
      const saved = writeCardSettingsToDisk(next, targetTenant);
      return sendJson(res, 200, {
        success: true,
        signatureImageUrl: finalUrl,
        settings: saved,
        message: 'تم حفظ توقيع الرئيس في قاعدة البيانات بنجاح.',
      });
    }

    if (method === 'DELETE' && url === '/api/card-settings/signature') {
      const current = readCardSettingsFromDisk(tenantId);
      const next: CardSettingsDatabase = {
        ...current,
        signatureImageUrl: '',
        updatedAt: new Date().toISOString(),
      };
      const saved = writeCardSettingsToDisk(next, tenantId);
      return sendJson(res, 200, {
        success: true,
        signatureImageUrl: '',
        settings: saved,
        message: 'تم حذف توقيع الرئيس نهائيًا من قاعدة البيانات.',
      });
    }

    return sendJson(res, 404, { success: false, error: 'Card settings endpoint not found' });
  } catch (err: any) {
    console.error('[cardSettingsApiHandler] Error:', err);
    return sendJson(res, 500, {
      success: false,
      error: err?.message || 'حدث خطأ في خادم إعدادات البطاقة.',
    });
  }
}
