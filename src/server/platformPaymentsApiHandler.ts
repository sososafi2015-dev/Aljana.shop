import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { readTenantsFromDisk, writeTenantsToDisk } from './tenantsApiHandler';
import { readSupportDonationsFromDisk, writeSupportDonationsToDisk } from './platformSupportApiHandler';

const DATA_DIR = path.join(process.cwd(), 'data');
const PAYMENTS_FILE = path.join(DATA_DIR, 'platform_payments.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'platform_payment_settings.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readPaymentsFromDisk(): any[] {
  ensureDataDir();
  if (!fs.existsSync(PAYMENTS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(PAYMENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Isolate and migrate any platform support payments to the dedicated support donations file
    const supportRecords = parsed.filter(
      (p) => p && (p.type === 'platform_support' || p.type === 'support' || p.tenantId === 'platform' || p.tenantId === 'platform_support')
    );
    if (supportRecords.length > 0) {
      try {
        const donations = readSupportDonationsFromDisk();
        const existingIds = new Set(donations.map((d) => d.id));
        let changed = false;
        for (const sp of supportRecords) {
          if (!existingIds.has(sp.id)) {
            donations.unshift({
              ...sp,
              type: 'platform_support',
              donorName: sp.donorName || sp.ownerName || 'فاعل خير / داعم للمنصة',
              donorPhone: sp.donorPhone || sp.ownerPhone || '',
            });
            existingIds.add(sp.id);
            changed = true;
          }
        }
        if (changed) {
          writeSupportDonationsToDisk(donations);
        }
      } catch (err) {
        console.error('[platformPaymentsApiHandler] Error isolating support payments:', err);
      }

      // Keep only association subscription/activation/renewal/ad payments
      const associationPaymentsOnly = parsed.filter(
        (p) => p && p.type !== 'platform_support' && p.type !== 'support' && p.tenantId !== 'platform' && p.tenantId !== 'platform_support'
      );
      try {
        fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(associationPaymentsOnly, null, 2), 'utf-8');
      } catch {}
      return associationPaymentsOnly;
    }

    return parsed;
  } catch (err) {
    console.error('[platformPaymentsApiHandler] Error reading platform_payments.json:', err);
    return [];
  }
}

export function writePaymentsToDisk(payments: any[]): void {
  ensureDataDir();
  try {
    // Strictly filter out any platform support payments before writing
    const associationPaymentsOnly = payments.filter(
      (p) => p && p.type !== 'platform_support' && p.type !== 'support' && p.tenantId !== 'platform' && p.tenantId !== 'platform_support'
    );
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(associationPaymentsOnly, null, 2), 'utf-8');
  } catch (err) {
    console.error('[platformPaymentsApiHandler] Error writing platform_payments.json:', err);
  }
}

const defaultServerPaymentSettings = {
  activationFeeMad: 199,
  activationFeeUsd: 20,
  activationNoticeText:
    'لا يُسمح بالدخول إلى لوحة التحكم أو استخدام واجهة المنصة أو عرضها للعموم قبل تسديد مبلغ الاشتراك المطلوب والحصول على موافقة الإدارة العامة.',
  adCreationFeeMad: 199,
  adCreationFeeUsd: 20,
  exchangeRate: 9.95,
  lastUpdated: new Date().toISOString(),
  updatedBy: 'الإدارة العامة للمنصة',
};

function readSettingsFromDisk(): any {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) {
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultServerPaymentSettings, null, 2), 'utf-8');
      return defaultServerPaymentSettings;
    } catch {
      return defaultServerPaymentSettings;
    }
  }
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...defaultServerPaymentSettings,
      ...parsed,
    };
  } catch (err) {
    console.error('[platformPaymentsApiHandler] Error reading platform_payment_settings.json:', err);
    return defaultServerPaymentSettings;
  }
}

function writeSettingsToDisk(settings: any): any {
  ensureDataDir();
  try {
    const existing = readSettingsFromDisk() || {};
    const merged = { 
      ...existing, 
      ...settings,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    console.error('[platformPaymentsApiHandler] Error writing platform_payment_settings.json:', err);
    return settings;
  }
}

function sendJson(res: ServerResponse, statusCode: number, data: any): boolean {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
  res.end(JSON.stringify(data));
  return true;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) { // 10MB limit (for base64 receipts)
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

export async function handlePlatformPaymentsApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/platform-payments')) {
    return false;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id');
    res.end();
    return true;
  }

  const method = req.method?.toUpperCase();

  try {
    // 1. GET /api/platform-payments/settings
    if (method === 'GET' && url === '/api/platform-payments/settings') {
      const settings = readSettingsFromDisk();
      return sendJson(res, 200, { success: true, settings });
    }

    // 2. POST /api/platform-payments/settings
    if (method === 'POST' && url === '/api/platform-payments/settings') {
      const body = await readBody(req);
      writeSettingsToDisk(body);
      return sendJson(res, 200, { success: true, message: 'تم حفظ إعدادات الدفع بنجاح.' });
    }

    // 3. GET /api/platform-payments
    if (method === 'GET' && (url === '/api/platform-payments' || url.startsWith('/api/platform-payments?'))) {
      const allOnDisk = readPaymentsFromDisk();
      // Strictly isolate: association subscription/activation/renewal/ad payments ONLY
      const payments = allOnDisk.filter(
        (p) => p && p.type !== 'platform_support' && p.type !== 'support' && p.tenantId !== 'platform' && p.tenantId !== 'platform_support'
      );
      return sendJson(res, 200, { success: true, payments, total: payments.length });
    }

    // 4. POST /api/platform-payments/sync
    if (method === 'POST' && url === '/api/platform-payments/sync') {
      const body = await readBody(req);
      if (Array.isArray(body.payments)) {
        // Only keep association payments
        const filtered = body.payments.filter(
          (p: any) => p && p.type !== 'platform_support' && p.type !== 'support' && p.tenantId !== 'platform' && p.tenantId !== 'platform_support'
        );
        writePaymentsToDisk(filtered);
        return sendJson(res, 200, { success: true, count: filtered.length });
      }
    }

    // 5. POST /api/platform-payments/submit
    if (method === 'POST' && url === '/api/platform-payments/submit') {
      const body = await readBody(req);
      
      // If a platform support payment is submitted here, divert it strictly to the platform support account!
      if (body.type === 'platform_support' || body.type === 'support' || body.tenantId === 'platform' || body.tenantId === 'platform_support') {
        const donations = readSupportDonationsFromDisk();
        const supportRecord = {
          ...body,
          type: 'platform_support',
          donorName: body.donorName || body.supporterName || body.ownerName || 'فاعل خير / داعم للمنصة',
          donorPhone: body.donorPhone || body.supporterPhone || body.ownerPhone || '',
          amount: Number(body.amount) || 0,
          currency: body.currency || 'MAD',
          status: body.status || 'pending',
          createdAt: body.createdAt || new Date().toISOString(),
          submittedAt: body.submittedAt || new Date().toISOString(),
        };
        donations.unshift(supportRecord);
        writeSupportDonationsToDisk(donations);
        return sendJson(res, 201, { success: true, message: 'تم حفظ الدعم في حساب دعم المنصة حصراً.', donation: supportRecord });
      }

      const existing = readPaymentsFromDisk();
      const existingIdx = body.id ? existing.findIndex((p) => p && p.id === body.id) : -1;
      if (existingIdx !== -1) {
        existing[existingIdx] = { ...existing[existingIdx], ...body };
      } else {
        existing.unshift(body);
      }
      writePaymentsToDisk(existing);

      // If this is an activation payment, transition tenant status from 'pending_subscription' to 'pending_activation'
      if ((!body.type || body.type === 'activation') && body.tenantId) {
        const tenants = readTenantsFromDisk();
        const tIdx = tenants.findIndex((t) => t.id === body.tenantId);
        if (tIdx !== -1 && tenants[tIdx].status !== 'active') {
          const now = new Date().toISOString();
          const currentTenant = tenants[tIdx];
          const existingHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
            ? currentTenant.subscriptionStatusHistory
            : [];
          tenants[tIdx] = {
            ...currentTenant,
            status: 'pending_activation',
            paymentVerified: false,
            updatedAt: now,
            subscriptionStatusHistory: [
              ...existingHistory,
              {
                status: 'pending_activation',
                label: 'في انتظار التفعيل',
                timestamp: now,
                actor: body.ownerName || currentTenant.ownerName,
                note: `تم إرسال تأكيد تسديد الاشتراك (${body.amount} ${body.currency}) وبانتظار التحقق من الدفع والتفعيل الإداري من الإدارة العامة.`,
              },
            ],
          };
          writeTenantsToDisk(tenants);
        }
      }

      return sendJson(res, 201, { success: true, payment: body });
    }

    // 5b. POST /api/platform-payments/:id/verify -> Verify payment prior to final activation
    if (method === 'POST' && url.includes('/verify') && url.startsWith('/api/platform-payments/')) {
      const paymentId = url.replace('/api/platform-payments/', '').replace('/verify', '').split('?')[0];
      const body = await readBody(req).catch(() => ({}));
      const adminName = body?.adminName || 'الإدارة العامة';
      const noteText = body?.note || 'تم التحقق من صحة عملية الدفع ومطابقة المبلغ بنجاح.';
      const now = new Date().toISOString();

      const payments = readPaymentsFromDisk();
      const pIdx = payments.findIndex((p) => p.id === paymentId);
      let tenantId = '';

      if (pIdx !== -1) {
        const existingPayHistory = Array.isArray(payments[pIdx].statusHistory) ? payments[pIdx].statusHistory : [];
        payments[pIdx].status = 'verified';
        payments[pIdx].paymentVerified = true;
        payments[pIdx].paymentVerifiedAt = now;
        payments[pIdx].paymentVerifiedBy = adminName;
        payments[pIdx].statusHistory = [
          ...existingPayHistory,
          {
            status: 'verified',
            label: 'تم التحقق من الدفع (في انتظار التفعيل الإداري)',
            timestamp: now,
            actor: adminName,
            note: noteText,
          },
        ];
        tenantId = payments[pIdx].tenantId;
        writePaymentsToDisk(payments);
      }

      if (tenantId) {
        const tenants = readTenantsFromDisk();
        const tIdx = tenants.findIndex((t) => t.id === tenantId);
        if (tIdx !== -1) {
          const currentTenant = tenants[tIdx];
          const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
            ? currentTenant.subscriptionStatusHistory
            : [];
          tenants[tIdx] = {
            ...currentTenant,
            status: currentTenant.status === 'active' ? 'active' : 'pending_activation',
            paymentVerified: true,
            paymentVerifiedAt: now,
            paymentVerifiedBy: adminName,
            updatedAt: now,
            subscriptionStatusHistory: [
              ...existingTenantHistory,
              {
                status: 'payment_verified',
                label: 'تم التحقق من الدفع (بانتظار التفعيل الإداري)',
                timestamp: now,
                actor: adminName,
                note: noteText,
              },
            ],
          };
          writeTenantsToDisk(tenants);
        }
      }

      return sendJson(res, 200, {
        success: true,
        message: 'تم التحقق من صحة عملية الدفع وتوثيق الحالة بنجاح.',
      });
    }

    // 6. POST /api/platform-payments/:id/confirm -> Confirm payment and activate or renew tenant platform
    if (method === 'POST' && url.includes('/confirm') && url.startsWith('/api/platform-payments/')) {
      const paymentId = url.replace('/api/platform-payments/', '').replace('/confirm', '').split('?')[0];
      const body = await readBody(req).catch(() => ({}));
      const adminName = body?.adminName || 'الإدارة العامة';
      const now = new Date().toISOString();

      // Check if it exists in support donations first
      const donations = readSupportDonationsFromDisk();
      const dIdx = donations.findIndex((d) => d.id === paymentId);
      if (dIdx !== -1) {
        donations[dIdx].status = 'confirmed';
        donations[dIdx].reviewedAt = now;
        donations[dIdx].reviewedBy = adminName;
        writeSupportDonationsToDisk(donations);
        return sendJson(res, 200, {
          success: true,
          message: 'تم تأكيد استلام دعم المنصة بنجاح وتوثيقه في حساب دعم المنصة المستقل.',
        });
      }

      const payments = readPaymentsFromDisk();
      const pIdx = payments.findIndex((p) => p.id === paymentId);

      let tenantId = '';
      let isRenewal = false;
      let paymentAmount = 199;
      let submittedDate = now;

      if (pIdx !== -1) {
        tenantId = payments[pIdx].tenantId;
        isRenewal = payments[pIdx].type === 'renewal';
        paymentAmount = payments[pIdx].amount || 199;
        submittedDate = payments[pIdx].submittedAt || payments[pIdx].createdAt || now;
      }

      // Calculate periodStart & periodEnd
      let currentExpiresAt: string | undefined;
      const tenants = readTenantsFromDisk();
      const tIdx = tenants.findIndex((t) => t.id === tenantId);
      if (tIdx !== -1) {
        currentExpiresAt = tenants[tIdx].subscriptionExpiresAt;
      }

      let periodStart = body?.periodStart;
      let periodEnd = body?.periodEnd;

      const isAdCampaign = pIdx !== -1 && payments[pIdx].type === 'ad_campaign';
      const isPlatformSupport = pIdx !== -1 && (payments[pIdx].type === 'platform_support' || payments[pIdx].type === 'support' || payments[pIdx].tenantId === 'platform' || payments[pIdx].tenantId === 'platform_support');

      if (isPlatformSupport) {
        // Move to support donations and remove from tenant payments
        const spRecord = payments[pIdx];
        payments.splice(pIdx, 1);
        writePaymentsToDisk(payments);

        const curDonations = readSupportDonationsFromDisk();
        const existingIdx = curDonations.findIndex((d) => d.id === spRecord.id);
        if (existingIdx !== -1) {
          curDonations[existingIdx].status = 'confirmed';
          curDonations[existingIdx].reviewedAt = now;
          curDonations[existingIdx].reviewedBy = adminName;
        } else {
          curDonations.unshift({
            ...spRecord,
            type: 'platform_support',
            status: 'confirmed',
            reviewedAt: now,
            reviewedBy: adminName,
          });
        }
        writeSupportDonationsToDisk(curDonations);

        return sendJson(res, 200, {
          success: true,
          message: 'تم تأكيد استلام دعم المنصة بنجاح وتوثيقه في حساب دعم المنصة.',
        });
      }

      if (isAdCampaign) {
        const adStart = body?.periodStart || payments[pIdx].periodStart || now;
        const adEnd = body?.periodEnd || payments[pIdx].periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
        payments[pIdx].status = 'confirmed';
        payments[pIdx].reviewedAt = now;
        payments[pIdx].reviewedBy = adminName;
        payments[pIdx].periodStart = adStart;
        payments[pIdx].periodEnd = adEnd;
        writePaymentsToDisk(payments);

        return sendJson(res, 200, {
          success: true,
          message: 'تم تأكيد دفع الحملة الإعلانية وتفعيلها بنجاح.',
          periodStart: adStart,
          periodEnd: adEnd,
        });
      }

      if (!periodStart || !periodEnd) {
        const confTime = new Date(now).getTime();
        const currExpTime = currentExpiresAt ? new Date(currentExpiresAt).getTime() : 0;
        if (currExpTime > confTime) {
          // Renewing before expiration -> Start from current expiration date
          const d = new Date(currExpTime);
          periodStart = d.toISOString();
          const next = new Date(d);
          next.setFullYear(next.getFullYear() + 1);
          periodEnd = next.toISOString();
        } else {
          // Renewing after expiration or activation -> Start from confirmation date
          const d = new Date(now);
          periodStart = d.toISOString();
          const next = new Date(d);
          next.setFullYear(next.getFullYear() + 1);
          periodEnd = next.toISOString();
        }
      }

      if (pIdx !== -1) {
        const existingPayHistory = Array.isArray(payments[pIdx].statusHistory) ? payments[pIdx].statusHistory : [];
        payments[pIdx].status = 'confirmed';
        payments[pIdx].paymentVerified = true;
        payments[pIdx].paymentVerifiedAt = payments[pIdx].paymentVerifiedAt || now;
        payments[pIdx].paymentVerifiedBy = payments[pIdx].paymentVerifiedBy || adminName;
        payments[pIdx].reviewedAt = now;
        payments[pIdx].reviewedBy = adminName;
        payments[pIdx].periodStart = periodStart;
        payments[pIdx].periodEnd = periodEnd;
        payments[pIdx].statusHistory = [
          ...existingPayHistory,
          {
            status: 'confirmed',
            label: 'تم تفعيل المنصة والموافقة الإدارية',
            timestamp: now,
            actor: adminName,
            note: `تمت الموافقة الإدارية وتفعيل المنصة رسمياً.`,
          },
        ];
        writePaymentsToDisk(payments);
      }

      // Also activate/renew tenant in database
      if (tIdx !== -1) {
        const currentTenant = tenants[tIdx];
        const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
          ? currentTenant.subscriptionStatusHistory
          : [];
        tenants[tIdx] = {
          ...currentTenant,
          status: 'active',
          paymentVerified: true,
          paymentVerifiedAt: currentTenant.paymentVerifiedAt || now,
          paymentVerifiedBy: currentTenant.paymentVerifiedBy || adminName,
          subscriptionStartedAt: currentTenant.subscriptionStartedAt || periodStart,
          subscriptionExpiresAt: periodEnd,
          lastRenewalPaymentId: paymentId,
          lastRenewalDate: now,
          activationFeePaid: currentTenant.activationFeePaid || paymentAmount,
          activationFeeDate: currentTenant.activationFeeDate || submittedDate,
          updatedAt: now,
          subscriptionStatusHistory: [
            ...existingTenantHistory,
            {
              status: 'active',
              label: 'مفعّلة',
              timestamp: now,
              actor: adminName,
              note: 'تم التحقق من صحة الدفع والموافقة الإدارية وتفعيل المنصة رسمياً.',
            },
          ],
        };
        writeTenantsToDisk(tenants);
      }

      return sendJson(res, 200, {
        success: true,
        message: 'تم تأكيد عملية الدفع وتحديث فترة الاشتراك بنجاح في قاعدة البيانات.',
        periodStart,
        periodEnd,
      });
    }

    // 7. POST /api/platform-payments/:id/reject -> Reject payment
    if (method === 'POST' && url.includes('/reject') && url.startsWith('/api/platform-payments/')) {
      const paymentId = url.replace('/api/platform-payments/', '').replace('/reject', '').split('?')[0];
      const body = await readBody(req).catch(() => ({}));
      const adminName = body?.adminName || 'الإدارة العامة';
      const reason = body?.reason || 'تعذر التحقق من صحة معلومات الدفع أو الإشعار المرفق.';
      const now = new Date().toISOString();

      const payments = readPaymentsFromDisk();
      const pIdx = payments.findIndex((p) => p.id === paymentId);

      let tenantId = '';
      let isActivation = true;
      if (pIdx !== -1) {
        const existingPayHistory = Array.isArray(payments[pIdx].statusHistory) ? payments[pIdx].statusHistory : [];
        payments[pIdx].status = 'rejected';
        payments[pIdx].paymentVerified = false;
        payments[pIdx].reviewedAt = now;
        payments[pIdx].reviewedBy = adminName;
        payments[pIdx].rejectionReason = reason;
        payments[pIdx].statusHistory = [
          ...existingPayHistory,
          {
            status: 'rejected',
            label: 'تم رفض طلب الاشتراك / الدفع',
            timestamp: now,
            actor: adminName,
            note: `سبب الرفض: ${reason}`,
          },
        ];
        tenantId = payments[pIdx].tenantId;
        isActivation = payments[pIdx].type !== 'renewal' && payments[pIdx].type !== 'ad_campaign';
        writePaymentsToDisk(payments);
      }

      if (tenantId && isActivation) {
        const tenants = readTenantsFromDisk();
        const tIdx = tenants.findIndex((t) => t.id === tenantId);
        if (tIdx !== -1 && tenants[tIdx].status !== 'active') {
          const currentTenant = tenants[tIdx];
          const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
            ? currentTenant.subscriptionStatusHistory
            : [];
          tenants[tIdx] = {
            ...currentTenant,
            status: 'pending_subscription',
            paymentVerified: false,
            updatedAt: now,
            subscriptionStatusHistory: [
              ...existingTenantHistory,
              {
                status: 'rejected',
                label: 'تم رفض طلب الاشتراك (العودة إلى: في انتظار الدفع)',
                timestamp: now,
                actor: adminName,
                note: `تم رفض عملية الدفع من طرف الإدارة. السبب: ${reason}`,
              },
            ],
          };
          writeTenantsToDisk(tenants);
        }
      }

      return sendJson(res, 200, {
        success: true,
        message: 'تم رفض عملية الدفع بنجاح.',
      });
    }

    // 8. POST /api/platform-payments/:id/cancel -> Cancel pending payment
    if (method === 'POST' && url.includes('/cancel') && url.startsWith('/api/platform-payments/')) {
      const paymentId = url.replace('/api/platform-payments/', '').replace('/cancel', '').split('?')[0];
      const payments = readPaymentsFromDisk();
      const pIdx = payments.findIndex((p) => p.id === paymentId);

      if (pIdx !== -1) {
        const cancelledPayment = payments[pIdx];
        payments.splice(pIdx, 1);
        writePaymentsToDisk(payments);

        if ((!cancelledPayment.type || cancelledPayment.type === 'activation') && cancelledPayment.tenantId) {
          const tenants = readTenantsFromDisk();
          const tIdx = tenants.findIndex((t) => t.id === cancelledPayment.tenantId);
          if (tIdx !== -1 && tenants[tIdx].status !== 'active') {
            tenants[tIdx].status = 'pending_subscription';
            tenants[tIdx].paymentVerified = false;
            tenants[tIdx].updatedAt = new Date().toISOString();
            writeTenantsToDisk(tenants);
          }
        }
      }

      return sendJson(res, 200, {
        success: true,
        message: 'تم إلغاء طلب الدفع بنجاح.',
      });
    }

    return sendJson(res, 404, { success: false, error: 'Endpoint not found' });
  } catch (err: any) {
    console.error('[platformPaymentsApiHandler error]', err);
    return sendJson(res, 500, { success: false, error: err?.message || 'Server error' });
  }
}
