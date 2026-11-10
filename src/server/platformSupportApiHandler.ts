import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import type { PlatformSupportSettings, SupportDonationRecord } from '../types';
import { readPayPalConfig, writePayPalConfig, isOrderConfirmedByPayPal } from './paypalApiHandler';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'platform_support_settings.json');
const DONATIONS_FILE = path.join(DATA_DIR, 'platform_support_donations.json');

export function readSupportDonationsFromDisk(): SupportDonationRecord[] {
  ensureDataDir();
  if (!fs.existsSync(DONATIONS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(DONATIONS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[platformSupportApiHandler] Error reading donations file:', err);
    return [];
  }
}

export function writeSupportDonationsToDisk(donations: SupportDonationRecord[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(DONATIONS_FILE, JSON.stringify(donations, null, 2), 'utf-8');
  } catch (err) {
    console.error('[platformSupportApiHandler] Error writing donations file:', err);
  }
}

export const DEFAULT_PLATFORM_SUPPORT_SETTINGS: PlatformSupportSettings = {
  presetAmountsMad: [100, 200, 300, 400, 500, 600, 1000, 1500, 2000, 3000, 4000, 5000],
  presetAmountsUsd: [10, 20, 30, 40, 50, 60, 100, 150, 200, 300, 400, 500],
  allowCustomAmount: true,
  minCustomAmountMad: 50,
  minCustomAmountUsd: 5,
  bankAccount: {
    enabled: true,
    accountHolder: 'syoumax منصة العمل الجمعوي - حساب دعم المنصة (SMART ASSOC SARL)',
    bankName: 'التجاري وفا بنك (Attijariwafa Bank)',
    rib: '007 780 0001234567890123 45',
    iban: 'MA64007780000123456789012345',
    additionalInstructions: 'يرجى كتابة «دعم المنصة» أو «رسوم الإعلان» في خانة موضوع التحويل البنكي، ثم إرفاق صورة الوصل من المعرض.',
    countriesMode: 'all',
    allowedCountries: ['المغرب'],
  },
  cashPlus: {
    enabled: true,
    beneficiaryName: 'syoumax منصة العمل الجمعوي (صندوق دعم وتطوير المنصة)',
    phone: '+212 661-234567',
    accountOrRef: 'CP-8849201',
    instructions: 'يمكنكم التوجه لأقرب وكالة كاش بليس بالمغرب وتقديم رقم الهاتف أو رقم المرجع، أو مسح رمز QR Code للدفع الفوري.',
    countriesMode: 'all',
    allowedCountries: ['المغرب'],
    qrCodeEnabled: false,
    qrCodeUrl: '',
    qrCodeFileName: '',
    qrCodeInstructions: 'امسح رمز الاستجابة السريعة (QR Code) عبر تطبيق كاش بليس لإتمام التحويل والدعم فوراً وبكل سهولة.',
  },
  creditCard: {
    enabled: true,
    gatewayName: 'بوابة البطاقات البنكية المباشرة (Visa / Mastercard / CMI)',
    instructions: 'معاملة إلكترونية فورية وآمنة 100% لدعم استمرارية وتطوير syoumax منصة العمل الجمعوي والإعلانات.',
    countriesMode: 'all',
    allowedCountries: [],
  },
  paypal: {
    enabled: true,
    email: 'sb-onuud40741552@business.example.com',
    paymentUrl: '',
    instructions: 'الدفع المباشر والآمن عبر حساب PayPal أو البطاقات البنكية الدولية لدعم برامج وتطوير syoumax منصة العمل الجمعوي.',
    clientId: 'AaJbsftKG9QmDMZmcWCiJEGXISIeDhuWL7z7qSYDHT48-QcsJ6QhY_gMEWuvOuvFnhFRHZ4HwiOpjtZT',
    mode: 'sandbox',
    isConnected: true,
    countriesMode: 'all',
    allowedCountries: [],
  },
  customMethods: [],
  lastUpdated: new Date().toISOString(),
  updatedBy: 'الإدارة العامة للمنصة',
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readSupportSettingsFromDisk(): PlatformSupportSettings {
  ensureDataDir();

  // If file exists, read it
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const ppConfig = readPayPalConfig();

      return {
        ...DEFAULT_PLATFORM_SUPPORT_SETTINGS,
        ...parsed,
        bankAccount: {
          ...DEFAULT_PLATFORM_SUPPORT_SETTINGS.bankAccount,
          ...(parsed.bankAccount || {}),
        },
        cashPlus: {
          ...DEFAULT_PLATFORM_SUPPORT_SETTINGS.cashPlus,
          ...(parsed.cashPlus || {}),
        },
        creditCard: {
          ...DEFAULT_PLATFORM_SUPPORT_SETTINGS.creditCard,
          ...(parsed.creditCard || {}),
        },
        paypal: {
          ...DEFAULT_PLATFORM_SUPPORT_SETTINGS.paypal,
          ...(parsed.paypal || {}),
          clientId: ppConfig.clientId || parsed.paypal?.clientId || DEFAULT_PLATFORM_SUPPORT_SETTINGS.paypal.clientId,
          mode: ppConfig.mode || parsed.paypal?.mode || DEFAULT_PLATFORM_SUPPORT_SETTINGS.paypal.mode,
          isConnected: ppConfig.isConnected ?? parsed.paypal?.isConnected ?? DEFAULT_PLATFORM_SUPPORT_SETTINGS.paypal.isConnected,
        },
        customMethods: Array.isArray(parsed.customMethods) ? parsed.customMethods : [],
      };
    } catch (err) {
      console.error('[platformSupportApiHandler] Error reading settings file:', err);
    }
  }

  // If file doesn't exist, initialize it with defaults synced with paypal config
  const ppConfig = readPayPalConfig();
  const initial: PlatformSupportSettings = {
    ...DEFAULT_PLATFORM_SUPPORT_SETTINGS,
    paypal: {
      ...DEFAULT_PLATFORM_SUPPORT_SETTINGS.paypal,
      clientId: ppConfig.clientId || DEFAULT_PLATFORM_SUPPORT_SETTINGS.paypal.clientId,
      mode: ppConfig.mode || DEFAULT_PLATFORM_SUPPORT_SETTINGS.paypal.mode,
      isConnected: ppConfig.isConnected ?? DEFAULT_PLATFORM_SUPPORT_SETTINGS.paypal.isConnected,
    },
  };

  writeSupportSettingsToDisk(initial);
  return initial;
}

export function writeSupportSettingsToDisk(settings: PlatformSupportSettings): void {
  ensureDataDir();
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[platformSupportApiHandler] Error writing settings file:', err);
  }
}

function sendJson(res: ServerResponse, statusCode: number, data: any): boolean {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session');
  res.end(JSON.stringify(data));
  return true;
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

export async function handlePlatformSupportApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/platform-support')) {
    return false;
  }

  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session');
    res.end();
    return true;
  }

  try {
    // GET /api/platform-support/settings
    if (method === 'GET' && (url === '/api/platform-support/settings' || url.startsWith('/api/platform-support/settings?'))) {
      const settings = readSupportSettingsFromDisk();
      return sendJson(res, 200, { success: true, settings });
    }

    // POST /api/platform-support/settings
    if (method === 'POST' && url === '/api/platform-support/settings') {
      const body = await readBody(req);
      const current = readSupportSettingsFromDisk();
      const updated: PlatformSupportSettings = {
        ...current,
        ...body,
        bankAccount: {
          ...current.bankAccount,
          ...(body.bankAccount || {}),
        },
        cashPlus: {
          ...current.cashPlus,
          ...(body.cashPlus || {}),
        },
        creditCard: {
          ...current.creditCard,
          ...(body.creditCard || {}),
        },
        paypal: {
          ...current.paypal,
          ...(body.paypal || {}),
        },
        customMethods: Array.isArray(body.customMethods) ? body.customMethods : current.customMethods,
        lastUpdated: new Date().toISOString(),
        updatedBy: body.updatedBy || 'الإدارة العامة',
      };

      writeSupportSettingsToDisk(updated);

      // If paypal credentials were provided in body, keep paypal_config in sync
      if (body.paypal) {
        const ppConfig = readPayPalConfig();
        if (body.paypal.clientId) ppConfig.clientId = body.paypal.clientId;
        if (body.paypal.mode) ppConfig.mode = body.paypal.mode;
        if (typeof body.paypal.isConnected === 'boolean') ppConfig.isConnected = body.paypal.isConnected;
        writePayPalConfig(ppConfig);
      }

      return sendJson(res, 200, { success: true, settings: updated });
    }

    // ==================== PLATFORM SUPPORT DONATIONS ENDPOINTS ====================
    // 1. GET /api/platform-support/donations
    if (method === 'GET' && (url === '/api/platform-support/donations' || url.startsWith('/api/platform-support/donations?'))) {
      const donations = readSupportDonationsFromDisk();
      return sendJson(res, 200, {
        success: true,
        donations,
        total: donations.length,
      });
    }

    // 2. POST /api/platform-support/donations (Submit new platform support donation)
    if (method === 'POST' && (url === '/api/platform-support/donations' || url === '/api/platform-support/donations/submit')) {
      const body = await readBody(req);
      const donations = readSupportDonationsFromDisk();
      const now = new Date().toISOString();
      const isVerifiedByPayPal = Boolean(body.paypalOrderId && isOrderConfirmedByPayPal(body.paypalOrderId));

      const newDonation: SupportDonationRecord = {
        id: body.id || `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'platform_support',
        donorName: (body.donorName && body.donorName.trim()) || (body.supporterName && body.supporterName.trim()) || 'فاعل خير / داعم للمنصة',
        donorPhone: (body.donorPhone && body.donorPhone.trim()) || (body.supporterPhone && body.supporterPhone.trim()) || undefined,
        donorNote: body.donorNote || body.notes || undefined,
        amount: Number(body.amount) || 0,
        currency: body.currency || 'MAD',
        paidAmount: body.paidAmount ? Number(body.paidAmount) : Number(body.amount) || 0,
        paidCurrency: body.paidCurrency || body.currency || 'MAD',
        paymentMethod: body.paymentMethod || 'other',
        paypalOrderId: body.paypalOrderId,
        transactionId: body.transactionId,
        status: isVerifiedByPayPal ? 'confirmed' : 'pending',
        mode: body.mode || 'sandbox',
        createdAt: body.createdAt || now,
        submittedAt: body.submittedAt || now,
        reviewedAt: isVerifiedByPayPal ? now : undefined,
        reviewedBy: isVerifiedByPayPal ? 'PayPal Verified Gateway' : undefined,
        proofDocumentUrl: body.proofDocumentUrl,
        proofFileName: body.proofFileName,
        cardLast4: body.cardLast4,
        transactionReference: body.transactionReference || `SUP-${Date.now().toString().slice(-6)}`,
        country: body.country || (body.currency === 'MAD' ? 'المغرب' : 'دولي'),
      };

      donations.unshift(newDonation);
      writeSupportDonationsToDisk(donations);

      return sendJson(res, 201, {
        success: true,
        message: 'تم تسجيل مساهمة دعم المنصة بنجاح في حساب دعم المنصة.',
        donation: newDonation,
      });
    }

    // 3. POST /api/platform-support/donations/:id/confirm (Confirm platform support donation)
    if (method === 'POST' && url.includes('/confirm') && url.startsWith('/api/platform-support/donations/')) {
      const donationId = url.replace('/api/platform-support/donations/', '').replace('/confirm', '').split('?')[0];
      const body = await readBody(req).catch(() => ({}));
      const adminName = body?.adminName || 'الإدارة العامة للمنصة';
      const now = new Date().toISOString();

      const donations = readSupportDonationsFromDisk();
      const idx = donations.findIndex((d) => d.id === donationId);

      if (idx === -1) {
        return sendJson(res, 404, { success: false, error: 'سجل عملية الدعم غير موجود.' });
      }

      donations[idx] = {
        ...donations[idx],
        status: 'confirmed',
        reviewedAt: now,
        reviewedBy: adminName,
      };

      writeSupportDonationsToDisk(donations);

      return sendJson(res, 200, {
        success: true,
        message: 'تم تأكيد استلام دعم المنصة بنجاح وتوثيقه في حساب دعم المنصة.',
        donation: donations[idx],
      });
    }

    // 4. POST /api/platform-support/donations/:id/reject (Reject platform support donation)
    if (method === 'POST' && url.includes('/reject') && url.startsWith('/api/platform-support/donations/')) {
      const donationId = url.replace('/api/platform-support/donations/', '').replace('/reject', '').split('?')[0];
      const body = await readBody(req).catch(() => ({}));
      const adminName = body?.adminName || 'الإدارة العامة للمنصة';
      const reason = body?.reason || 'تعذر التحقق من صحة معلومات الدفع أو الإشعار المرفق.';
      const now = new Date().toISOString();

      const donations = readSupportDonationsFromDisk();
      const idx = donations.findIndex((d) => d.id === donationId);

      if (idx === -1) {
        return sendJson(res, 404, { success: false, error: 'سجل عملية الدعم غير موجود.' });
      }

      donations[idx] = {
        ...donations[idx],
        status: 'cancelled',
        rejectionReason: reason,
        reviewedAt: now,
        reviewedBy: adminName,
      };

      writeSupportDonationsToDisk(donations);

      return sendJson(res, 200, {
        success: true,
        message: 'تم رفض عملية الدعم وتوثيق السبب.',
        donation: donations[idx],
      });
    }

    // 5. POST /api/platform-support/donations/sync (Sync client donations to server)
    if (method === 'POST' && url === '/api/platform-support/donations/sync') {
      const body = await readBody(req);
      if (Array.isArray(body.donations)) {
        writeSupportDonationsToDisk(body.donations);
        return sendJson(res, 200, { success: true, count: body.donations.length });
      }
    }

    return sendJson(res, 404, { success: false, error: 'Endpoint not found' });
  } catch (err: any) {
    console.error('[platformSupportApiHandler error]', err);
    return sendJson(res, 500, { success: false, error: err?.message || 'Internal Server Error' });
  }
}
