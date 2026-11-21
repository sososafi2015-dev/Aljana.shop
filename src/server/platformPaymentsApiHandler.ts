import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { readTenantsFromDisk, writeTenantsToDisk } from './tenantsApiHandler';
import { readSupportDonationsFromDisk, writeSupportDonationsToDisk } from './platformSupportApiHandler';
import {
  saveDocToFirebaseServer,
  getDocFromFirebaseServer,
  listCollectionFromFirebaseServer,
  deleteDocFromFirebaseServer,
} from './firebaseServerStorage';
import { offloadBase64ToDisk } from './storageEngine';

const DATA_DIR = path.join(process.cwd(), 'data');
const PAYMENTS_FILE = path.join(DATA_DIR, 'platform_payments.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'platform_payment_settings.json');

let paymentsCloudReconcileLastTs = 0;
const PAYMENTS_RECONCILE_TTL_MS = 5000;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function isValidAssociationPaymentRecord(p: any): boolean {
  if (!p || typeof p !== 'object') return false;
  if (!p.id || typeof p.id !== 'string') return false;
  if (p.type === 'platform_support' || p.type === 'support' || p.tenantId === 'platform' || p.tenantId === 'platform_support') {
    return false;
  }
  if (!p.tenantId || typeof p.tenantId !== 'string' || !p.tenantId.trim()) {
    return false;
  }
  return true;
}

function sanitizePaymentRecordForStorage(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const clone = { ...raw };
  if (typeof clone.proofDocumentUrl === 'string' && clone.proofDocumentUrl.startsWith('data:')) {
    clone.proofDocumentUrl = offloadBase64ToDisk(clone.proofDocumentUrl, 'payment_proof');
  }
  return clone;
}

async function persistPaymentToCloudFirestore(payment: any): Promise<void> {
  if (!isValidAssociationPaymentRecord(payment)) return;
  const sanitized = sanitizePaymentRecordForStorage(payment);
  await saveDocToFirebaseServer('tenant_payments', sanitized.id, {
    ...sanitized,
    _updatedAt: sanitized._updatedAt || sanitized.reviewedAt || sanitized.submittedAt || new Date().toISOString(),
  });
}

export async function reconcilePaymentsFromCloudFirestore(force = false): Promise<any[]> {
  const localPayments = readPaymentsFromDisk();
  if (!force && Date.now() - paymentsCloudReconcileLastTs < PAYMENTS_RECONCILE_TTL_MS) {
    return localPayments;
  }
  paymentsCloudReconcileLastTs = Date.now();

  try {
    const cloudPayments = await listCollectionFromFirebaseServer<any>('tenant_payments');
    const mergedMap = new Map<string, any>();

    for (const lp of localPayments) {
      if (isValidAssociationPaymentRecord(lp)) {
        mergedMap.set(lp.id, lp);
      }
    }

    let changed = false;
    if (Array.isArray(cloudPayments)) {
      for (const rawCp of cloudPayments) {
        if (!isValidAssociationPaymentRecord(rawCp)) continue;
        const cp = sanitizePaymentRecordForStorage(rawCp);
        const existing = mergedMap.get(cp.id);
        if (!existing) {
          mergedMap.set(cp.id, cp);
          changed = true;
        } else {
          const cloudTs = new Date(cp._updatedAt || cp.reviewedAt || cp.paymentVerifiedAt || cp.submittedAt || cp.createdAt || 0).getTime();
          const localTs = new Date(existing._updatedAt || existing.reviewedAt || existing.paymentVerifiedAt || existing.submittedAt || existing.createdAt || 0).getTime();
          const statusPriority: Record<string, number> = { confirmed: 4, rejected: 3, verified: 2, pending: 1 };
          const cloudPri = statusPriority[cp.status] || 0;
          const localPri = statusPriority[existing.status] || 0;
          if (cloudTs > localTs || (cloudTs === localTs && cloudPri > localPri)) {
            mergedMap.set(cp.id, {
              ...existing,
              ...cp,
              proofDocumentUrl: cp.proofDocumentUrl || existing.proofDocumentUrl,
            });
            changed = true;
          }
        }
      }
    }

    // Reconcile with tenants: if a tenant is already active, mark any stale pending activation payment as confirmed
    const tenants = readTenantsFromDisk();
    const tenantMap = new Map<string, any>();
    for (const t of tenants) {
      if (t && t.id) tenantMap.set(t.id, t);
    }

    const paymentsToSyncBack: any[] = [];
    for (const [payId, pay] of mergedMap.entries()) {
      const t = tenantMap.get(pay.tenantId);
      if (t && t.status === 'active' && (!pay.type || pay.type === 'activation') && (pay.status === 'pending' || pay.status === 'verified')) {
        const nowIso = new Date().toISOString();
        const updatedPay = {
          ...pay,
          status: 'confirmed',
          paymentVerified: true,
          reviewedAt: pay.reviewedAt || t.updatedAt || nowIso,
          reviewedBy: pay.reviewedBy || 'الإدارة العامة',
          _updatedAt: nowIso,
        };
        mergedMap.set(payId, updatedPay);
        paymentsToSyncBack.push(updatedPay);
        changed = true;
      }
    }

    const mergedList = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime()
    );

    if (changed) {
      writePaymentsToDisk(mergedList, false);
      if (paymentsToSyncBack.length > 0) {
        Promise.all(paymentsToSyncBack.map((p) => persistPaymentToCloudFirestore(p).catch(() => {}))).catch(() => {});
      }
    }
    return mergedList;
  } catch (err) {
    console.warn('[platformPaymentsApiHandler] Firestore payments reconciliation notice:', err);
    return localPayments;
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

      // Keep only valid association subscription/activation/renewal/ad payments
      const associationPaymentsOnly = parsed.filter(isValidAssociationPaymentRecord).map(sanitizePaymentRecordForStorage);
      try {
        fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(associationPaymentsOnly, null, 2), 'utf-8');
      } catch {}
      return associationPaymentsOnly;
    }

    const validOnly = parsed.filter(isValidAssociationPaymentRecord).map(sanitizePaymentRecordForStorage);
    if (validOnly.length !== parsed.length) {
      try {
        fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(validOnly, null, 2), 'utf-8');
      } catch {}
    }
    return validOnly;
  } catch (err) {
    console.error('[platformPaymentsApiHandler] Error reading platform_payments.json:', err);
    return [];
  }
}

export function writePaymentsToDisk(payments: any[], syncFirestore = true): void {
  ensureDataDir();
  try {
    // Strictly filter out any platform support or invalid payments before writing
    const associationPaymentsOnly = payments
      .filter(isValidAssociationPaymentRecord)
      .map(sanitizePaymentRecordForStorage);
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(associationPaymentsOnly, null, 2), 'utf-8');
    paymentsCloudReconcileLastTs = Date.now();
    if (syncFirestore) {
      Promise.all(
        associationPaymentsOnly.map((p) => persistPaymentToCloudFirestore(p).catch(() => {}))
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[platformPaymentsApiHandler] Error writing platform_payments.json:', err);
  }
}

const defaultServerPaymentSettings = {
  activationFeeMad: 180,
  activationFeeUsd: 18,
  activationNoticeText:
    'لا يُسمح بالدخول إلى لوحة التحكم أو استخدام واجهة المنصة أو عرضها للعموم قبل تسديد مبلغ الاشتراك المطلوب والحصول على موافقة الإدارة العامة.',
  adCreationFeeMad: 199,
  adCreationFeeUsd: 20,
  exchangeRate: 10,
  bankAccount: {
    enabled: true,
    accountHolder: 'SYOMAX منصة العمل الجمعوي - الإدارة المركزية (SMART ASSOC SARL)',
    bankName: 'التجاري وفا بنك (Attijariwafa Bank)',
    rib: '007 780 0001234567890123 45',
    iban: 'MA64007780000123456789012345',
    additionalInstructions:
      'يرجى كتابة اسم الجمعية في خانة موضوع التحويل البنكي، ثم إرفاق صورة أو ملف PDF لإشعار التحويل.',
  },
  cashPlus: {
    enabled: true,
    beneficiaryName: 'SYOMAX منصة العمل الجمعوي (Service Activation & Renewal)',
    phone: '+212 661-234567',
    accountOrRef: 'CP-8849201',
    instructions:
      'يمكنكم التوجه لأقرب وكالة كاش بليس بالمغرب وتقديم رقم الهاتف أو رقم المرجع أعلاه، ثم رفع صورة واضحة لوصل الإيداع من معرض الهاتف أو مدير الملفات وإرفاقه هنا.',
  },
  creditCard: {
    enabled: true,
    gatewayName: 'بوابة البطاقات البنكية الآمنة (CMI / Visa & Mastercard 3D-Secure)',
    instructions: 'معاملة إلكترونية فورية ومؤمنة 100% بتشفير SSL عالي الأمان لبطاقات الائتمان المغربية والدولية.',
  },
  paypal: {
    enabled: true,
    email: 'payments@smart-associations.org',
    instructions: 'إتمام عملية الدفع الآمن عبر حساب PayPal أو البطاقات الدولية المعتمدة من أي دولة حول العالم.',
  },
  lastUpdated: new Date().toISOString(),
  updatedBy: 'الإدارة العامة للمنصة',
};

function mergePaymentSettingsSafe(base: any, incoming: any): any {
  const defBank = defaultServerPaymentSettings.bankAccount;
  const baseBank = base?.bankAccount || {};
  const inBank = incoming?.bankAccount || {};

  return {
    ...defaultServerPaymentSettings,
    ...(base || {}),
    ...(incoming || {}),
    activationNoticeText:
      (incoming?.activationNoticeText && String(incoming.activationNoticeText).trim()) ||
      (base?.activationNoticeText && String(base.activationNoticeText).trim()) ||
      defaultServerPaymentSettings.activationNoticeText,
    bankAccount: {
      ...defBank,
      ...baseBank,
      ...inBank,
      enabled: inBank.enabled ?? baseBank.enabled ?? defBank.enabled,
      accountHolder:
        (inBank.accountHolder && String(inBank.accountHolder).trim()) ||
        (baseBank.accountHolder && String(baseBank.accountHolder).trim()) ||
        defBank.accountHolder,
      bankName:
        (inBank.bankName && String(inBank.bankName).trim()) ||
        (baseBank.bankName && String(baseBank.bankName).trim()) ||
        defBank.bankName,
      rib:
        (inBank.rib && String(inBank.rib).trim()) ||
        (baseBank.rib && String(baseBank.rib).trim()) ||
        defBank.rib,
      iban:
        (inBank.iban && String(inBank.iban).trim()) ||
        (baseBank.iban && String(baseBank.iban).trim()) ||
        defBank.iban,
      additionalInstructions:
        (inBank.additionalInstructions && String(inBank.additionalInstructions).trim()) ||
        (baseBank.additionalInstructions && String(baseBank.additionalInstructions).trim()) ||
        defBank.additionalInstructions,
    },
    cashPlus: {
      ...defaultServerPaymentSettings.cashPlus,
      ...(base?.cashPlus || {}),
      ...(incoming?.cashPlus || {}),
    },
    creditCard: {
      ...defaultServerPaymentSettings.creditCard,
      ...(base?.creditCard || {}),
      ...(incoming?.creditCard || {}),
    },
    paypal: {
      ...defaultServerPaymentSettings.paypal,
      ...(base?.paypal || {}),
      ...(incoming?.paypal || {}),
    },
  };
}

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
    return mergePaymentSettingsSafe(defaultServerPaymentSettings, parsed);
  } catch (err) {
    console.error('[platformPaymentsApiHandler] Error reading platform_payment_settings.json:', err);
    return defaultServerPaymentSettings;
  }
}

function writeSettingsToDisk(settings: any): any {
  ensureDataDir();
  try {
    const existing = readSettingsFromDisk() || defaultServerPaymentSettings;
    const merged = mergePaymentSettingsSafe(existing, {
      ...settings,
      lastUpdated: new Date().toISOString(),
    });
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
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
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
  const cleanPath = url.split('?')[0];

  try {
    // 1. GET /api/platform-payments/settings
    if (method === 'GET' && cleanPath === '/api/platform-payments/settings') {
      let settings = readSettingsFromDisk();
      try {
        const cloudSettings = await getDocFromFirebaseServer<any>('platform_payment_settings', 'main');
        if (cloudSettings && typeof cloudSettings.activationFeeMad === 'number') {
          const diskTime = settings?.lastUpdated ? new Date(settings.lastUpdated).getTime() : 0;
          const cloudTime = cloudSettings?.lastUpdated ? new Date(cloudSettings.lastUpdated).getTime() : 0;
          if (cloudTime > diskTime) {
            settings = writeSettingsToDisk(cloudSettings);
          } else {
            await saveDocToFirebaseServer('platform_payment_settings', 'main', {
              ...settings,
              _updatedAt: new Date().toISOString(),
            });
          }
        } else {
          await saveDocToFirebaseServer('platform_payment_settings', 'main', {
            ...settings,
            _updatedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('[platformPaymentsApiHandler] Firestore settings sync notice:', e);
      }
      return sendJson(res, 200, { success: true, settings });
    }

    // 2. POST /api/platform-payments/settings
    if (method === 'POST' && cleanPath === '/api/platform-payments/settings') {
      const body = await readBody(req);
      const saved = writeSettingsToDisk(body);
      try {
        await saveDocToFirebaseServer('platform_payment_settings', 'main', {
          ...saved,
          _updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[platformPaymentsApiHandler] Firestore settings write notice:', e);
      }
      return sendJson(res, 200, { success: true, settings: saved, message: 'تم حفظ إعدادات الدفع بنجاح.' });
    }

    // 3. GET /api/platform-payments
    if (method === 'GET' && (url === '/api/platform-payments' || url.startsWith('/api/platform-payments?'))) {
      const forceSync = url.includes('force=true') || url.includes('refresh=true');
      const payments = await reconcilePaymentsFromCloudFirestore(forceSync);
      return sendJson(res, 200, { success: true, payments, total: payments.length });
    }

    // 4. POST /api/platform-payments/sync
    if (method === 'POST' && cleanPath === '/api/platform-payments/sync') {
      const body = await readBody(req);
      if (Array.isArray(body.payments)) {
        // Non-destructive merge with existing disk + cloud payments so nothing is lost
        const existing = await reconcilePaymentsFromCloudFirestore(false);
        const map = new Map<string, any>();
        for (const p of existing) {
          if (isValidAssociationPaymentRecord(p)) map.set(p.id, p);
        }
        for (const rawP of body.payments) {
          if (!isValidAssociationPaymentRecord(rawP)) continue;
          const p = sanitizePaymentRecordForStorage(rawP);
          const prev = map.get(p.id);
          if (!prev) {
            map.set(p.id, p);
          } else {
            const incTs = new Date(p._updatedAt || p.reviewedAt || p.paymentVerifiedAt || p.submittedAt || p.createdAt || 0).getTime();
            const prevTs = new Date(prev._updatedAt || prev.reviewedAt || prev.paymentVerifiedAt || prev.submittedAt || prev.createdAt || 0).getTime();
            if (incTs >= prevTs) {
              map.set(p.id, { ...prev, ...p, proofDocumentUrl: p.proofDocumentUrl || prev.proofDocumentUrl });
            }
          }
        }
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime()
        );
        writePaymentsToDisk(merged, true);
        return sendJson(res, 200, { success: true, count: merged.length, payments: merged });
      }
    }

    // 4b. POST /api/platform-payments/activate-tenant -> Activate any pending/unactivated tenant directly (with or without prior payment receipt)
    if (method === 'POST' && cleanPath === '/api/platform-payments/activate-tenant') {
      const body = await readBody(req).catch(() => ({}));
      const tenantId = String(body?.tenantId || '').trim();
      const paymentId = String(body?.paymentId || '').trim();
      const adminName = String(body?.adminName || 'الإدارة العامة').trim();
      const note = String(body?.note || '').trim();

      if (!tenantId) {
        return sendJson(res, 400, { success: false, error: 'معرف الجمعية (tenantId) مطلوب للتفعيل.' });
      }

      const now = new Date().toISOString();
      const tenants = readTenantsFromDisk();
      const payments = await reconcilePaymentsFromCloudFirestore(true);
      const settings = readSettingsFromDisk();

      let tIdx = tenants.findIndex((t) => t && t.id === tenantId);
      const linkedPayment =
        (paymentId ? payments.find((p) => p.id === paymentId) : null) ||
        payments.find((p) => p.tenantId === tenantId && (!p.type || p.type === 'activation') && p.status !== 'rejected');

      // If tenant only existed in Firestore/payment record, reconstruct full tenant entry so activation persists cleanly
      if (tIdx === -1 && (linkedPayment || body?.tenantSnapshot)) {
        const snap = body?.tenantSnapshot || {};
        const reconstructedTenant = {
          id: tenantId,
          name: snap.name || linkedPayment?.tenantName || 'جمعية مسجلة',
          nameFr: snap.nameFr || `Association ${snap.name || linkedPayment?.tenantName || ''}`,
          nameEn: snap.nameEn || `Association ${snap.name || linkedPayment?.tenantName || ''}`,
          country: snap.country || linkedPayment?.country || 'المغرب',
          city: snap.city || 'الدار البيضاء',
          slug: snap.slug || linkedPayment?.tenantSlug || `assoc-${Date.now()}`,
          logoUrl: snap.logoUrl || 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=300&q=80',
          bannerImageUrl: snap.bannerImageUrl || 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80',
          ownerId: snap.ownerId || linkedPayment?.ownerId || `owner_${tenantId}`,
          ownerName: snap.ownerName || linkedPayment?.ownerName || 'مسؤول الجمعية',
          ownerPhone: snap.ownerPhone || linkedPayment?.ownerPhone || '',
          status: 'pending_activation',
          paymentVerified: false,
          createdAt: snap.createdAt || linkedPayment?.createdAt || now,
          updatedAt: now,
          tier: 'pro',
          monthlyFee: 180,
          isTemplate: false,
          isVisibleOnPublicPortal: false,
          enablePublicDonations: true,
        };
        tenants.unshift(reconstructedTenant);
        tIdx = 0;
      }

      if (tIdx === -1) {
        return sendJson(res, 404, { success: false, error: 'لم يتم العثور على الجمعية المطلوبة للتفعيل.' });
      }

      const currentTenant = tenants[tIdx];
      const isMorocco = !currentTenant.country || currentTenant.country.includes('المغرب') || currentTenant.country.toLowerCase().includes('morocco');
      const expectedCurrency = isMorocco ? 'MAD' : 'USD';
      const expectedAmount = isMorocco ? (Number(settings.activationFeeMad) || 180) : (Number(settings.activationFeeUsd) || 18);

      const dStart = new Date(now);
      const periodStart = body?.periodStart || dStart.toISOString();
      const dEnd = new Date(periodStart);
      dEnd.setFullYear(dEnd.getFullYear() + 1);
      const periodEnd = body?.periodEnd || dEnd.toISOString();

      let confirmedPayment: any = null;
      const updatedPayments = [...payments];

      // Confirm all pending/verified activation payments for this tenant
      let matchedAny = false;
      for (let i = 0; i < updatedPayments.length; i++) {
        const p = updatedPayments[i];
        if (
          p &&
          ((paymentId && p.id === paymentId) ||
            (p.tenantId === tenantId && (!p.type || p.type === 'activation') && (p.status === 'pending' || p.status === 'verified')))
        ) {
          matchedAny = true;
          const existingPayHistory = Array.isArray(p.statusHistory) ? p.statusHistory : [];
          updatedPayments[i] = {
            ...p,
            status: 'confirmed',
            paymentVerified: true,
            paymentVerifiedAt: p.paymentVerifiedAt || now,
            paymentVerifiedBy: p.paymentVerifiedBy || adminName,
            reviewedAt: now,
            reviewedBy: adminName,
            periodStart,
            periodEnd,
            adminNotes: note || p.adminNotes,
            _updatedAt: now,
            statusHistory: [
              ...existingPayHistory,
              {
                status: 'confirmed',
                label: 'تم تفعيل المنصة والموافقة الإدارية',
                timestamp: now,
                actor: adminName,
                note: note || 'تمت الموافقة الإدارية وتفعيل المنصة رسمياً.',
              },
            ],
          };
          confirmedPayment = updatedPayments[i];
        }
      }

      // If no payment record existed yet, create a confirmed activation record so financial/audit history is complete
      if (!matchedAny) {
        confirmedPayment = {
          id: `pay_act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tenantId,
          tenantName: currentTenant.name,
          tenantSlug: currentTenant.slug || '',
          ownerId: currentTenant.ownerId || '',
          ownerName: currentTenant.ownerName || 'مسؤول الجمعية',
          ownerPhone: currentTenant.ownerPhone || '',
          amount: Number(body?.amount) || expectedAmount,
          currency: body?.currency || expectedCurrency,
          country: currentTenant.country || 'المغرب',
          paymentMethod: body?.paymentMethod || 'bank_transfer',
          status: 'confirmed',
          paymentVerified: true,
          paymentVerifiedAt: now,
          paymentVerifiedBy: adminName,
          type: 'activation',
          periodStart,
          periodEnd,
          createdAt: currentTenant.createdAt || now,
          submittedAt: now,
          reviewedAt: now,
          reviewedBy: adminName,
          transactionReference: `ACT-${Date.now().toString().slice(-6)}`,
          adminNotes: note || 'تفعيل إداري مباشر من لوحة الإدارة العامة للمنصة',
          _updatedAt: now,
          statusHistory: [
            {
              status: 'confirmed',
              label: 'تم تفعيل المنصة والموافقة الإدارية',
              timestamp: now,
              actor: adminName,
              note: note || 'تم قبول طلب تفعيل المنصة وتفعيلها رسمياً من طرف الإدارة العامة.',
            },
          ],
        };
        updatedPayments.unshift(confirmedPayment);
      }

      writePaymentsToDisk(updatedPayments, false);
      if (confirmedPayment) {
        await persistPaymentToCloudFirestore(confirmedPayment).catch(() => {});
      }

      const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
        ? currentTenant.subscriptionStatusHistory
        : [];
      const activatedTenant = {
        ...currentTenant,
        status: 'active',
        paymentVerified: true,
        paymentVerifiedAt: currentTenant.paymentVerifiedAt || now,
        paymentVerifiedBy: currentTenant.paymentVerifiedBy || adminName,
        subscriptionStartedAt: currentTenant.subscriptionStartedAt || periodStart,
        subscriptionExpiresAt: periodEnd,
        lastRenewalPaymentId: confirmedPayment?.id || currentTenant.lastRenewalPaymentId,
        lastRenewalDate: now,
        activationFeePaid: currentTenant.activationFeePaid || confirmedPayment?.amount || expectedAmount,
        activationFeeCurrency: currentTenant.activationFeeCurrency || confirmedPayment?.currency || expectedCurrency,
        activationFeeDate: currentTenant.activationFeeDate || confirmedPayment?.submittedAt || now,
        updatedAt: now,
        subscriptionStatusHistory: [
          ...existingTenantHistory,
          {
            status: 'active',
            label: 'مفعّلة',
            timestamp: now,
            actor: adminName,
            note: note || 'تم قبول طلب التفعيل وتفعيل منصة الجمعية رسمياً من طرف الإدارة العامة.',
          },
        ],
      };
      tenants[tIdx] = activatedTenant;
      writeTenantsToDisk(tenants, false);
      await saveDocToFirebaseServer('tenants', activatedTenant.id, {
        ...activatedTenant,
        _updatedAt: now,
      }).catch(() => {});

      return sendJson(res, 200, {
        success: true,
        tenant: activatedTenant,
        payment: confirmedPayment,
        periodStart,
        periodEnd,
        message: `تم تفعيل منصة «${activatedTenant.name}» بنجاح وتحديث حالتها في قاعدة البيانات.`,
      });
    }

    // 5. POST /api/platform-payments/submit
    if (method === 'POST' && cleanPath === '/api/platform-payments/submit') {
      const rawBody = await readBody(req);
      const body = rawBody?.payment && typeof rawBody.payment === 'object' ? rawBody.payment : rawBody;
      
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

      const now = new Date().toISOString();
      const paymentRecord = sanitizePaymentRecordForStorage({
        ...body,
        id: body.id || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: body.status || 'pending',
        type: body.type || 'activation',
        createdAt: body.createdAt || now,
        submittedAt: body.submittedAt || now,
        _updatedAt: now,
      });

      const existing = await reconcilePaymentsFromCloudFirestore(false);
      const existingIdx = existing.findIndex((p) => p && p.id === paymentRecord.id);
      if (existingIdx !== -1) {
        existing[existingIdx] = { ...existing[existingIdx], ...paymentRecord };
      } else {
        existing.unshift(paymentRecord);
      }
      writePaymentsToDisk(existing, false);
      await persistPaymentToCloudFirestore(paymentRecord).catch(() => {});

      // If this is an activation payment, transition tenant status from 'pending_subscription' to 'pending_activation'
      if ((!paymentRecord.type || paymentRecord.type === 'activation') && paymentRecord.tenantId) {
        const tenants = readTenantsFromDisk();
        const tIdx = tenants.findIndex((t) => t.id === paymentRecord.tenantId);
        if (tIdx !== -1 && tenants[tIdx].status !== 'active') {
          const currentTenant = tenants[tIdx];
          const existingHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
            ? currentTenant.subscriptionStatusHistory
            : [];
          const updatedTenant = {
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
                actor: paymentRecord.ownerName || currentTenant.ownerName,
                note: `تم إرسال تأكيد تسديد الاشتراك (${paymentRecord.amount} ${paymentRecord.currency}) وبانتظار التحقق من الدفع والتفعيل الإداري من الإدارة العامة.`,
              },
            ],
          };
          tenants[tIdx] = updatedTenant;
          writeTenantsToDisk(tenants, false);
          await saveDocToFirebaseServer('tenants', updatedTenant.id, {
            ...updatedTenant,
            _updatedAt: now,
          }).catch(() => {});
        }
      }

      return sendJson(res, 201, { success: true, payment: paymentRecord });
    }

    // 5b. POST /api/platform-payments/:id/verify -> Verify payment prior to final activation
    if (method === 'POST' && url.includes('/verify') && url.startsWith('/api/platform-payments/')) {
      const paymentId = url.replace('/api/platform-payments/', '').replace('/verify', '').split('?')[0];
      const body = await readBody(req).catch(() => ({}));
      const adminName = body?.adminName || 'الإدارة العامة';
      const noteText = body?.note || 'تم التحقق من صحة عملية الدفع ومطابقة المبلغ بنجاح.';
      const now = new Date().toISOString();

      const payments = await reconcilePaymentsFromCloudFirestore(true);
      const pIdx = payments.findIndex((p) => p.id === paymentId);
      let tenantId = '';

      if (pIdx !== -1) {
        const existingPayHistory = Array.isArray(payments[pIdx].statusHistory) ? payments[pIdx].statusHistory : [];
        payments[pIdx].status = 'verified';
        payments[pIdx].paymentVerified = true;
        payments[pIdx].paymentVerifiedAt = now;
        payments[pIdx].paymentVerifiedBy = adminName;
        payments[pIdx]._updatedAt = now;
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
        writePaymentsToDisk(payments, false);
        await persistPaymentToCloudFirestore(payments[pIdx]).catch(() => {});
      }

      if (tenantId) {
        const tenants = readTenantsFromDisk();
        const tIdx = tenants.findIndex((t) => t.id === tenantId);
        if (tIdx !== -1) {
          const currentTenant = tenants[tIdx];
          const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
            ? currentTenant.subscriptionStatusHistory
            : [];
          const updatedTenant = {
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
          tenants[tIdx] = updatedTenant;
          writeTenantsToDisk(tenants, false);
          await saveDocToFirebaseServer('tenants', updatedTenant.id, {
            ...updatedTenant,
            _updatedAt: now,
          }).catch(() => {});
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

      const payments = await reconcilePaymentsFromCloudFirestore(true);
      const pIdx = payments.findIndex((p) => p.id === paymentId);

      let tenantId = body?.tenantId || '';
      let isRenewal = false;
      let paymentAmount = 180;
      let submittedDate = now;

      if (pIdx !== -1) {
        tenantId = payments[pIdx].tenantId || tenantId;
        isRenewal = payments[pIdx].type === 'renewal';
        paymentAmount = payments[pIdx].amount || 180;
        submittedDate = payments[pIdx].submittedAt || payments[pIdx].createdAt || now;
      }

      // Calculate periodStart & periodEnd
      let currentExpiresAt: string | undefined;
      const tenants = readTenantsFromDisk();
      let tIdx = tenants.findIndex((t) => t.id === tenantId);

      // If tenant only existed via payment record (legacy stub), reconstruct full tenant record so activation persists cleanly
      if (tIdx === -1 && tenantId && pIdx !== -1 && payments[pIdx].type !== 'ad_campaign') {
        const pay = payments[pIdx];
        tenants.unshift({
          id: tenantId,
          name: pay.tenantName || 'جمعية مسجلة',
          nameFr: `Association ${pay.tenantName || ''}`,
          nameEn: `Association ${pay.tenantName || ''}`,
          country: pay.country || 'المغرب',
          city: 'الدار البيضاء',
          slug: pay.tenantSlug || `assoc-${Date.now()}`,
          logoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=300&q=80',
          bannerImageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1600&q=80',
          ownerId: pay.ownerId || `owner_${tenantId}`,
          ownerName: pay.ownerName || 'مسؤول الجمعية',
          ownerPhone: pay.ownerPhone || '',
          status: 'pending_activation',
          paymentVerified: false,
          createdAt: pay.createdAt || pay.submittedAt || now,
          updatedAt: now,
          tier: 'pro',
          monthlyFee: 180,
          isTemplate: false,
          isVisibleOnPublicPortal: false,
          enablePublicDonations: true,
        });
        tIdx = 0;
      }

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
        writePaymentsToDisk(payments, false);
        await deleteDocFromFirebaseServer('tenant_payments', spRecord.id).catch(() => {});

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
        payments[pIdx]._updatedAt = now;
        writePaymentsToDisk(payments, false);
        await persistPaymentToCloudFirestore(payments[pIdx]).catch(() => {});

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
        payments[pIdx]._updatedAt = now;
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
        writePaymentsToDisk(payments, false);
        await persistPaymentToCloudFirestore(payments[pIdx]).catch(() => {});
      }

      // Also activate/renew tenant in database and Cloud Firestore
      let activatedTenant: any = null;
      if (tIdx !== -1) {
        const currentTenant = tenants[tIdx];
        const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
          ? currentTenant.subscriptionStatusHistory
          : [];
        activatedTenant = {
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
        tenants[tIdx] = activatedTenant;
        writeTenantsToDisk(tenants, false);
        await saveDocToFirebaseServer('tenants', activatedTenant.id, {
          ...activatedTenant,
          _updatedAt: now,
        }).catch(() => {});
      }

      return sendJson(res, 200, {
        success: true,
        message: 'تم تأكيد عملية الدفع وتحديث فترة الاشتراك بنجاح في قاعدة البيانات.',
        periodStart,
        periodEnd,
        tenant: activatedTenant,
        payment: pIdx !== -1 ? payments[pIdx] : undefined,
      });
    }

    // 7. POST /api/platform-payments/:id/reject -> Reject payment
    if (method === 'POST' && url.includes('/reject') && url.startsWith('/api/platform-payments/')) {
      const paymentId = url.replace('/api/platform-payments/', '').replace('/reject', '').split('?')[0];
      const body = await readBody(req).catch(() => ({}));
      const adminName = body?.adminName || 'الإدارة العامة';
      const reason = body?.reason || 'تعذر التحقق من صحة معلومات الدفع أو الإشعار المرفق.';
      const now = new Date().toISOString();

      const payments = await reconcilePaymentsFromCloudFirestore(true);
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
        payments[pIdx]._updatedAt = now;
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
        writePaymentsToDisk(payments, false);
        await persistPaymentToCloudFirestore(payments[pIdx]).catch(() => {});
      }

      if (tenantId && isActivation) {
        const tenants = readTenantsFromDisk();
        const tIdx = tenants.findIndex((t) => t.id === tenantId);
        if (tIdx !== -1 && tenants[tIdx].status !== 'active') {
          const currentTenant = tenants[tIdx];
          const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
            ? currentTenant.subscriptionStatusHistory
            : [];
          const updatedTenant = {
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
          tenants[tIdx] = updatedTenant;
          writeTenantsToDisk(tenants, false);
          await saveDocToFirebaseServer('tenants', updatedTenant.id, {
            ...updatedTenant,
            _updatedAt: now,
          }).catch(() => {});
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
      const payments = await reconcilePaymentsFromCloudFirestore(true);
      const pIdx = payments.findIndex((p) => p.id === paymentId);

      if (pIdx !== -1) {
        const cancelledPayment = payments[pIdx];
        payments.splice(pIdx, 1);
        writePaymentsToDisk(payments, false);
        await deleteDocFromFirebaseServer('tenant_payments', paymentId).catch(() => {});

        if ((!cancelledPayment.type || cancelledPayment.type === 'activation') && cancelledPayment.tenantId) {
          const tenants = readTenantsFromDisk();
          const tIdx = tenants.findIndex((t) => t.id === cancelledPayment.tenantId);
          if (tIdx !== -1 && tenants[tIdx].status !== 'active') {
            const now = new Date().toISOString();
            tenants[tIdx].status = 'pending_subscription';
            tenants[tIdx].paymentVerified = false;
            tenants[tIdx].updatedAt = now;
            writeTenantsToDisk(tenants, false);
            await saveDocToFirebaseServer('tenants', tenants[tIdx].id, {
              ...tenants[tIdx],
              _updatedAt: now,
            }).catch(() => {});
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
