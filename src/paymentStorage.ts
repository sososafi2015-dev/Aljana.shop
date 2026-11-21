import { PlatformPaymentSettings, TenantPaymentRecord, PaymentMethod, PaymentStatus, PaymentType, AssociationTenant, PlatformAdCampaign, SupportedCurrency } from './types';
export type { PlatformPaymentSettings, TenantPaymentRecord, PaymentMethod, PaymentStatus, PaymentType };
import { loadData, saveData } from './storage';
import { getAllTenants, saveAllTenants, getTenantById } from './tenantStorage';
import { saveAdCampaign, createOrUpdateAdCampaignRequest } from './adCampaignStorage';
import { getPlatformSupportSettings, savePlatformSupportSettings, submitPlatformSupportDonation, confirmPlatformSupportDonation } from './platformSupportStorage';
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

export const PAYMENT_STORAGE_KEYS = {
  SETTINGS: 'chayef_platform_payment_settings_v1',
  PAYMENTS: 'chayef_platform_payments_v1',
};

export const DEFAULT_ACTIVATION_NOTICE_TEXT =
  'لا يُسمح بالدخول إلى لوحة التحكم أو استخدام واجهة المنصة أو عرضها للعموم قبل تسديد مبلغ الاشتراك المطلوب والحصول على موافقة الإدارة العامة.';

export const defaultPlatformPaymentSettings: PlatformPaymentSettings = {
  activationFeeMad: 180,
  activationFeeUsd: 18,
  activationNoticeText: DEFAULT_ACTIVATION_NOTICE_TEXT,
  adCreationFeeMad: 199,
  adCreationFeeUsd: 20,
  exchangeRate: 10,
  bankAccount: {
    enabled: true,
    accountHolder: 'SYOMAX منصة العمل الجمعوي - الإدارة المركزية (SMART ASSOC SARL)',
    bankName: 'التجاري وفا بنك (Attijariwafa Bank)',
    rib: '007 780 0001234567890123 45',
    iban: 'MA64007780000123456789012345',
    additionalInstructions: 'يرجى كتابة اسم الجمعية في خانة موضوع التحويل البنكي، ثم إرفاق صورة أو ملف PDF لإشعار التحويل.',
  },
  cashPlus: {
    enabled: true,
    beneficiaryName: 'SYOMAX منصة العمل الجمعوي (Service Activation & Renewal)',
    phone: '+212 661-234567',
    accountOrRef: 'CP-8849201',
    instructions: 'يمكنكم التوجه لأقرب وكالة كاش بليس بالمغرب وتقديم رقم الهاتف أو رقم المرجع أعلاه، ثم رفع صورة واضحة لوصل الإيداع من معرض الهاتف أو مدير الملفات وإرفاقه هنا.',
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
  updatedBy: 'الإدارة العامة',
};

export function getPlatformPaymentSettings(): PlatformPaymentSettings {
  const loaded = loadData<PlatformPaymentSettings & { _feeMigratedV2?: boolean }>(
    PAYMENT_STORAGE_KEYS.SETTINGS,
    defaultPlatformPaymentSettings
  );
  // Migrate legacy uncustomized default fees (199 MAD / 20 or 19 USD) to the new official defaults (180 MAD / 18 USD)
  if (
    !loaded._feeMigratedV2 &&
    (loaded.activationFeeMad === 199 || !loaded.activationFeeMad) &&
    (loaded.activationFeeUsd === 20 || loaded.activationFeeUsd === 19 || !loaded.activationFeeUsd)
  ) {
    loaded.activationFeeMad = 180;
    loaded.activationFeeUsd = 18;
    loaded.exchangeRate = 10;
    loaded._feeMigratedV2 = true;
    try {
      saveData(PAYMENT_STORAGE_KEYS.SETTINGS, loaded);
    } catch {}
  }

  const supportSettings = getPlatformSupportSettings();
  const defBank = defaultPlatformPaymentSettings.bankAccount;
  const srcBank = supportSettings.bankAccount || loaded.bankAccount || ({} as any);

  return {
    ...defaultPlatformPaymentSettings,
    ...loaded,
    activationFeeMad: Number(loaded.activationFeeMad) > 0 ? Number(loaded.activationFeeMad) : 180,
    activationFeeUsd: Number(loaded.activationFeeUsd) > 0 ? Number(loaded.activationFeeUsd) : 18,
    activationNoticeText: (loaded.activationNoticeText || '').trim() || defaultPlatformPaymentSettings.activationNoticeText,
    bankAccount: {
      ...defBank,
      ...srcBank,
      enabled: srcBank.enabled ?? defBank.enabled,
      accountHolder: ((srcBank.accountHolder && srcBank.accountHolder.trim()) || (loaded.bankAccount?.accountHolder && loaded.bankAccount.accountHolder.trim()) || defBank.accountHolder)
        .replace(/\byoux\b/gi, 'SYOMAX')
        .replace(/\bsyoumax\b/gi, 'SYOMAX')
        .replace(/\bAljana\b/gi, 'SYOMAX'),
      bankName: (srcBank.bankName && srcBank.bankName.trim()) || (loaded.bankAccount?.bankName && loaded.bankAccount.bankName.trim()) || defBank.bankName,
      rib: (srcBank.rib && srcBank.rib.trim()) || (loaded.bankAccount?.rib && loaded.bankAccount.rib.trim()) || defBank.rib,
      iban: (srcBank.iban && srcBank.iban.trim()) || (loaded.bankAccount?.iban && loaded.bankAccount.iban.trim()) || defBank.iban,
      additionalInstructions:
        (srcBank.additionalInstructions && srcBank.additionalInstructions.trim()) ||
        (loaded.bankAccount?.additionalInstructions && loaded.bankAccount.additionalInstructions.trim()) ||
        defBank.additionalInstructions,
    },
    cashPlus: {
      ...defaultPlatformPaymentSettings.cashPlus,
      ...(loaded.cashPlus || {}),
      ...(supportSettings.cashPlus || {}),
    },
    creditCard: {
      ...defaultPlatformPaymentSettings.creditCard,
      ...(loaded.creditCard || {}),
      ...(supportSettings.creditCard || {}),
    },
    paypal: {
      ...defaultPlatformPaymentSettings.paypal,
      ...(loaded.paypal || {}),
      ...(supportSettings.paypal || {}),
    },
  };
}

export function savePlatformPaymentSettings(settings: PlatformPaymentSettings): void {
  const updated: PlatformPaymentSettings & { _feeMigratedV2?: boolean } = {
    ...settings,
    activationFeeMad: Number(settings.activationFeeMad) > 0 ? Number(settings.activationFeeMad) : 180,
    activationFeeUsd: Number(settings.activationFeeUsd) > 0 ? Number(settings.activationFeeUsd) : 18,
    activationNoticeText: (settings.activationNoticeText || '').trim() || DEFAULT_ACTIVATION_NOTICE_TEXT,
    lastUpdated: new Date().toISOString(),
    _feeMigratedV2: true,
  };
  saveData(PAYMENT_STORAGE_KEYS.SETTINGS, updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('platform-payment-settings-updated', { detail: updated }));
    window.dispatchEvent(new CustomEvent('ad-creation-fee-updated', { detail: updated }));
  }

  // Sync to Firestore for cloud persistence across devices and sessions
  try {
    const docRef = doc(db, 'platform_payment_settings', 'main');
    setDoc(docRef, { ...updated, _updatedAt: new Date().toISOString() }, { merge: true }).catch((fsErr) => {
      console.warn('[paymentStorage] Firestore payment settings sync warning:', fsErr);
    });
  } catch (e) {
    console.warn('[paymentStorage] Firestore setup warning:', e);
  }

  // Sync to platform support settings so they remain completely unified
  try {
    const currentSupport = getPlatformSupportSettings();
    const updatedSupport = {
      ...currentSupport,
      bankAccount: {
        ...currentSupport.bankAccount,
        ...settings.bankAccount,
        countriesMode: currentSupport.bankAccount?.countriesMode,
        allowedCountries: currentSupport.bankAccount?.allowedCountries,
      },
      cashPlus: {
        ...currentSupport.cashPlus,
        ...settings.cashPlus,
        countriesMode: currentSupport.cashPlus?.countriesMode,
        allowedCountries: currentSupport.cashPlus?.allowedCountries,
        qrCodeEnabled: currentSupport.cashPlus?.qrCodeEnabled,
        qrCodeUrl: currentSupport.cashPlus?.qrCodeUrl,
        qrCodeFileName: currentSupport.cashPlus?.qrCodeFileName,
        qrCodeInstructions: currentSupport.cashPlus?.qrCodeInstructions,
      },
      creditCard: {
        ...currentSupport.creditCard,
        ...settings.creditCard,
        countriesMode: currentSupport.creditCard?.countriesMode,
        allowedCountries: currentSupport.creditCard?.allowedCountries,
      },
      paypal: {
        ...currentSupport.paypal,
        ...settings.paypal,
        countriesMode: currentSupport.paypal?.countriesMode,
        allowedCountries: currentSupport.paypal?.allowedCountries,
      },
    };
    savePlatformSupportSettings(updatedSupport, 'الإدارة العامة (تحديث متزامن)');
  } catch (err) {
    console.error('Error syncing support settings from platform payment settings:', err);
  }

  // Sync with backend API asynchronously
  fetch('/api/platform-payments/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  }).catch(() => {});
}

/**
 * Fetches platform payment settings from server and Firestore, and synchronizes with localStorage
 */
export async function syncPlatformPaymentSettingsFromBackend(): Promise<PlatformPaymentSettings> {
  let backendSettings: any = null;
  let firestoreSettings: any = null;

  // 1. Fetch from persistent backend disk
  try {
    const res = await fetch(`/api/platform-payments/settings?_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.settings) {
        backendSettings = data.settings;
      }
    }
  } catch (err) {
    console.warn('[paymentStorage] syncPlatformPaymentSettingsFromBackend backend fetch failed:', err);
  }

  // 2. Fetch from Firestore for cloud persistence
  try {
    const docRef = doc(db, 'platform_payment_settings', 'main');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      firestoreSettings = snap.data();
    }
  } catch (fsErr) {
    console.warn('[paymentStorage] Firestore fetch warning:', fsErr);
  }

  const current = getPlatformPaymentSettings();
  const defBank = defaultPlatformPaymentSettings.bankAccount;

  // Determine the most recent authoritative source between backend and Firestore
  const backendTime = backendSettings?.lastUpdated ? new Date(backendSettings.lastUpdated).getTime() : 0;
  const firestoreTime = firestoreSettings?.lastUpdated ? new Date(firestoreSettings.lastUpdated).getTime() : 0;
  const primaryRemote = firestoreTime >= backendTime ? (firestoreSettings || backendSettings) : (backendSettings || firestoreSettings);
  const secondaryRemote = firestoreTime >= backendTime ? backendSettings : firestoreSettings;

  const mergedBank = {
    ...defBank,
    ...(current.bankAccount || {}),
    ...(secondaryRemote?.bankAccount || {}),
    ...(primaryRemote?.bankAccount || {}),
  };

  const merged: PlatformPaymentSettings & { _feeMigratedV2?: boolean } = {
    ...current,
    ...(secondaryRemote || {}),
    ...(primaryRemote || {}),
    _feeMigratedV2: true,
    bankAccount: {
      ...mergedBank,
      enabled: mergedBank.enabled ?? defBank.enabled,
      accountHolder: (mergedBank.accountHolder && String(mergedBank.accountHolder).trim()) || current.bankAccount.accountHolder || defBank.accountHolder,
      bankName: (mergedBank.bankName && String(mergedBank.bankName).trim()) || current.bankAccount.bankName || defBank.bankName,
      rib: (mergedBank.rib && String(mergedBank.rib).trim()) || current.bankAccount.rib || defBank.rib,
      iban: (mergedBank.iban && String(mergedBank.iban).trim()) || current.bankAccount.iban || defBank.iban,
      additionalInstructions:
        (mergedBank.additionalInstructions && String(mergedBank.additionalInstructions).trim()) ||
        current.bankAccount.additionalInstructions ||
        defBank.additionalInstructions,
    },
    cashPlus: {
      ...current.cashPlus,
      ...(secondaryRemote?.cashPlus || {}),
      ...(primaryRemote?.cashPlus || {}),
    },
    creditCard: {
      ...current.creditCard,
      ...(secondaryRemote?.creditCard || {}),
      ...(primaryRemote?.creditCard || {}),
    },
    paypal: {
      ...current.paypal,
      ...(secondaryRemote?.paypal || {}),
      ...(primaryRemote?.paypal || {}),
    },
  };

  // Ensure valid positive numbers with fallback to 180 MAD and 18 USD
  merged.activationFeeMad = Number(merged.activationFeeMad) > 0 ? Number(merged.activationFeeMad) : 180;
  merged.activationFeeUsd = Number(merged.activationFeeUsd) > 0 ? Number(merged.activationFeeUsd) : 18;

  // Reconcile activation notice text with fallback to default
  if (!merged.activationNoticeText || !merged.activationNoticeText.trim()) {
    merged.activationNoticeText = DEFAULT_ACTIVATION_NOTICE_TEXT;
  }

  saveData(PAYMENT_STORAGE_KEYS.SETTINGS, merged);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('platform-payment-settings-updated', { detail: merged }));
  }
  return merged;
}

/**
 * Updates specifically the activation notice text displayed at the top of the payment/activation screen
 * and persists it permanently in localStorage, backend disk database, and Firestore.
 */
export async function updatePlatformActivationNoticeText(
  noticeText: string,
  updatedBy: string = 'المدير العام للمنصة'
): Promise<PlatformPaymentSettings> {
  const current = getPlatformPaymentSettings();
  const cleanedText = (noticeText || '').trim() || DEFAULT_ACTIVATION_NOTICE_TEXT;

  const updated: PlatformPaymentSettings = {
    ...current,
    activationNoticeText: cleanedText,
    lastUpdated: new Date().toISOString(),
    updatedBy,
  };

  savePlatformPaymentSettings(updated);

  try {
    await fetch('/api/platform-payments/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch (err) {
    console.warn('[paymentStorage] updatePlatformActivationNoticeText backend sync warning:', err);
  }

  return updated;
}

/**
 * Updates specifically the platform activation fee (MAD and optional USD) by the Super Admin
 * and persists it permanently in localStorage and the backend database.
 */
export async function updatePlatformActivationFee(
  amountMad: number,
  amountUsd?: number,
  updatedBy: string = 'المدير العام للمنصة'
): Promise<PlatformPaymentSettings> {
  const current = getPlatformPaymentSettings();
  const validMad = Math.max(1, Math.round(amountMad));
  const rate = current.exchangeRate || 10;
  const validUsd = amountUsd !== undefined && amountUsd > 0 ? Math.round(amountUsd) : Math.max(1, Math.round(validMad / rate));

  const updated: PlatformPaymentSettings = {
    ...current,
    activationFeeMad: validMad,
    activationFeeUsd: validUsd,
    lastUpdated: new Date().toISOString(),
    updatedBy,
  };

  savePlatformPaymentSettings(updated);

  // Await the backend post to guarantee persistence on disk
  try {
    await fetch('/api/platform-payments/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch (err) {
    console.warn('[paymentStorage] updatePlatformActivationFee backend sync warning:', err);
  }

  return updated;
}

/**
 * Updates specifically the ad creation and promotion fee (MAD and optional USD) by the General Administration
 * and persists it permanently in localStorage and the backend database.
 */
export async function updateAdCreationFee(
  amountMad: number,
  amountUsd?: number,
  updatedBy: string = 'المدير العام للمنصة'
): Promise<PlatformPaymentSettings> {
  const current = getPlatformPaymentSettings();
  const validMad = Math.max(1, Math.round(amountMad));
  const rate = current.exchangeRate || 9.95;
  const validUsd = amountUsd !== undefined && amountUsd > 0 ? Math.round(amountUsd) : Math.max(1, Math.round(validMad / rate));

  const updated: PlatformPaymentSettings = {
    ...current,
    adCreationFeeMad: validMad,
    adCreationFeeUsd: validUsd,
    lastUpdated: new Date().toISOString(),
    updatedBy,
  };

  savePlatformPaymentSettings(updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ad-creation-fee-updated', { detail: updated }));
  }

  // Await the backend post to guarantee persistence on disk
  try {
    await fetch('/api/platform-payments/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch (err) {
    console.warn('[paymentStorage] updateAdCreationFee backend sync warning:', err);
  }

  // Also sync with ad-campaigns/settings endpoint for multi-path redundancy
  try {
    await fetch('/api/ad-campaigns/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch {}

  return updated;
}

function isValidClientTenantPayment(p: any): p is TenantPaymentRecord {
  if (!p || typeof p !== 'object') return false;
  if (!p.id || typeof p.id !== 'string') return false;
  if (!p.tenantId || typeof p.tenantId !== 'string' || !p.tenantId.trim()) return false;
  if ((p.type as string) === 'platform_support' || (p.type as string) === 'support' || p.tenantId === 'platform' || p.tenantId === 'platform_support') {
    return false;
  }
  return true;
}

export function getAllTenantPayments(): TenantPaymentRecord[] {
  const all = loadData<TenantPaymentRecord[]>(PAYMENT_STORAGE_KEYS.PAYMENTS, []);
  // Strictly isolate valid association payments only
  return (all || []).filter(isValidClientTenantPayment);
}

/**
 * Zero-loop real-time updater invoked by Cloud Firestore `onSnapshot` listener on `tenant_payments`
 */
export function applyRealtimeTenantPayments(incomingPayments: TenantPaymentRecord[]): void {
  if (!Array.isArray(incomingPayments)) return;
  const validIncoming = incomingPayments.filter(isValidClientTenantPayment);
  const current = getAllTenantPayments();
  const map = new Map<string, TenantPaymentRecord>();

  for (const p of validIncoming) {
    map.set(p.id, p);
  }
  // Preserve any very recently created local payment (last 15s) that might still be in-flight
  const nowMs = Date.now();
  for (const localP of current) {
    if (!map.has(localP.id)) {
      const createdMs = new Date(localP.submittedAt || localP.createdAt || 0).getTime();
      if (nowMs - createdMs < 15000) {
        map.set(localP.id, localP);
      }
    } else {
      const remoteP = map.get(localP.id)!;
      if (!remoteP.proofDocumentUrl && localP.proofDocumentUrl) {
        map.set(localP.id, { ...remoteP, proofDocumentUrl: localP.proofDocumentUrl });
      }
    }
  }

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime()
  );

  saveData(PAYMENT_STORAGE_KEYS.PAYMENTS, merged);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chayef-payments-changed', { detail: merged }));
  }
}

export function saveAllTenantPayments(payments: TenantPaymentRecord[]): void {
  // Ensure payments don't hoard unlimited megabytes of data URLs in local storage
  const optimized = payments
    .filter(isValidClientTenantPayment)
    .map((p, index) => {
      // Keep full proofDocumentUrl for recent 5 payments, but prune large dataUrls (> 50KB) for older history
      if (index > 4 && p.proofDocumentUrl && p.proofDocumentUrl.startsWith('data:') && p.proofDocumentUrl.length > 50000) {
        return {
          ...p,
          proofDocumentUrl: '',
        };
      }
      return p;
    });

  saveData(PAYMENT_STORAGE_KEYS.PAYMENTS, optimized);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chayef-payments-changed', { detail: optimized }));
  }

  // Sync with backend API asynchronously
  fetch('/api/platform-payments/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payments: optimized }),
  }).catch(() => {});
}

/**
 * Fetches all platform payments directly from backend database & Cloud Firestore (`tenant_payments`)
 */
export async function syncPaymentsFromBackend(force = false): Promise<TenantPaymentRecord[]> {
  const map = new Map<string, TenantPaymentRecord>();
  const statusPriority: Record<string, number> = { confirmed: 4, rejected: 3, verified: 2, pending: 1 };

  const upsertRecord = (p: any, authoritative: boolean) => {
    if (!isValidClientTenantPayment(p)) return;
    const existing = map.get(p.id);
    if (!existing) {
      map.set(p.id, p);
      return;
    }
    const incTs = new Date((p as any)._updatedAt || p.reviewedAt || p.paymentVerifiedAt || p.submittedAt || p.createdAt || 0).getTime();
    const prevTs = new Date((existing as any)._updatedAt || existing.reviewedAt || existing.paymentVerifiedAt || existing.submittedAt || existing.createdAt || 0).getTime();
    const incPri = statusPriority[p.status] || 0;
    const prevPri = statusPriority[existing.status] || 0;
    if (authoritative ? (incTs >= prevTs || incPri > prevPri) : incTs > prevTs) {
      map.set(p.id, {
        ...existing,
        ...p,
        status: p.status || existing.status,
        proofDocumentUrl: p.proofDocumentUrl || existing.proofDocumentUrl,
      });
    }
  };

  // Seed with local valid cache first
  for (const p of getAllTenantPayments()) {
    upsertRecord(p, false);
  }

  // 1. Fetch from server backend (which reconciles disk + Cloud Firestore)
  try {
    const queryStr = force ? `?force=true&_t=${Date.now()}` : `?_t=${Date.now()}`;
    const res = await fetch(`/api/platform-payments${queryStr}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.payments)) {
        for (const p of data.payments) {
          upsertRecord(p, true);
        }
      }
    }
  } catch (e) {
    console.warn('[paymentStorage] syncPaymentsFromBackend API failed:', e);
  }

  // 2. Also read directly from Cloud Firestore `tenant_payments` collection for guaranteed freshness
  try {
    const snap = await getDocs(collection(db, 'tenant_payments'));
    snap.forEach((docSnap) => {
      const data = docSnap.data() as TenantPaymentRecord;
      upsertRecord({ ...data, id: data.id || docSnap.id }, true);
    });
  } catch (fsErr) {
    console.warn('[paymentStorage] Firestore tenant_payments direct sync warning:', fsErr);
  }

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime()
  );

  const currentAll = getAllTenantPayments();
  if (JSON.stringify(currentAll) !== JSON.stringify(merged)) {
    saveData(PAYMENT_STORAGE_KEYS.PAYMENTS, merged);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chayef-payments-changed', { detail: merged }));
    }
  }
  return merged;
}

export function getPaymentsByTenantId(tenantId: string): TenantPaymentRecord[] {
  if (!tenantId || tenantId === 'platform' || tenantId === 'platform_support') return [];
  const all = getAllTenantPayments();
  return all
    .filter((p) => p.tenantId === tenantId && (p.type as string) !== 'platform_support' && (p.type as string) !== 'support')
    .sort((a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime());
}

export function getLatestPaymentForTenant(tenantId: string): TenantPaymentRecord | null {
  const list = getPaymentsByTenantId(tenantId);
  return list.length > 0 ? list[0] : null;
}

/**
 * Adds 1 year (12 months) to any valid ISO date string
 */
export function addOneYear(isoDateStr: string): string {
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) {
      const fallback = new Date();
      fallback.setFullYear(fallback.getFullYear() + 1);
      return fallback.toISOString();
    }
    const next = new Date(d.getTime());
    next.setFullYear(next.getFullYear() + 1);
    return next.toISOString();
  } catch {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + 1);
    return fallback.toISOString();
  }
}

/**
 * Computes renewal start and end dates according to business logic:
 * - If renewed before expiration: starts from current expiration date.
 * - If renewed after expiration: starts from confirmation date.
 */
export function computeRenewalDates(
  currentExpiresAtIso: string | undefined,
  confirmationDateIso: string = new Date().toISOString()
): { periodStart: string; periodEnd: string; isEarlyRenewal: boolean } {
  const confTime = new Date(confirmationDateIso).getTime();
  const currExpTime = currentExpiresAtIso ? new Date(currentExpiresAtIso).getTime() : 0;

  if (currExpTime > confTime) {
    // Renewing BEFORE expiration -> Start from current expiration date without losing days
    const periodStart = new Date(currExpTime).toISOString();
    const periodEnd = addOneYear(periodStart);
    return { periodStart, periodEnd, isEarlyRenewal: true };
  } else {
    // Renewing AFTER expiration -> Start from confirmation date
    const periodStart = confirmationDateIso;
    const periodEnd = addOneYear(periodStart);
    return { periodStart, periodEnd, isEarlyRenewal: false };
  }
}

export interface TenantSubscriptionInfo {
  tenantId: string;
  tenantName: string;
  activationFeePaid: number;
  activationFeeDate: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  status: 'active' | 'expiring_soon' | 'expired';
  statusLabel: string;
  statusColor: 'emerald' | 'amber' | 'red';
  remainingDays: number;
  totalDaysInPeriod: number;
  consumedPercent: number;
  currency: SupportedCurrency;
  annualFee: number;
  pendingPayment?: TenantPaymentRecord;
  lastConfirmedPayment?: TenantPaymentRecord;
  paymentsHistory: TenantPaymentRecord[];
}

/**
 * Calculates complete subscription status, start/end dates, remaining days, and history for any tenant
 */
export function getTenantSubscriptionDetails(tenant: AssociationTenant): TenantSubscriptionInfo {
  const settings = getPlatformPaymentSettings();
  const feeInfo = getActivationFeeForCountry(tenant.country, settings);
  const tenantPayments = getPaymentsByTenantId(tenant.id);

  // Find confirmed activation payment or fallback to tenant createdAt
  const confirmedPayments = tenantPayments.filter((p) => p.status === 'confirmed');
  const activationPayment = confirmedPayments.find((p) => p.type === 'activation') || confirmedPayments[confirmedPayments.length - 1];
  const lastConfirmedPayment = confirmedPayments[0];
  const pendingPayment = tenantPayments.find((p) => p.status === 'pending');

  const activationFeePaid = tenant.activationFeePaid || activationPayment?.amount || feeInfo.amount;
  const activationFeeDate = tenant.activationFeeDate || activationPayment?.submittedAt || tenant.createdAt || '2026-01-01T00:00:00.000Z';

  // Determine current subscription start date and expiration date
  let subStart = tenant.subscriptionStartedAt;
  let subEnd = tenant.subscriptionExpiresAt;

  if (!subStart || !subEnd) {
    // If not explicitly set on tenant record, derive from last confirmed payment or creation date
    if (lastConfirmedPayment && lastConfirmedPayment.periodStart && lastConfirmedPayment.periodEnd) {
      subStart = lastConfirmedPayment.periodStart;
      subEnd = lastConfirmedPayment.periodEnd;
    } else {
      // Default to 1 year from activation date / creation date
      subStart = activationFeeDate;
      subEnd = addOneYear(subStart);
    }
  }

  const nowTime = Date.now();
  const startTime = new Date(subStart).getTime();
  const endTime = new Date(subEnd).getTime();

  const totalPeriodMs = Math.max(endTime - startTime, 1000 * 60 * 60 * 24 * 365);
  const remainingMs = endTime - nowTime;
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  const totalDaysInPeriod = Math.ceil(totalPeriodMs / (1000 * 60 * 60 * 24));

  const elapsedMs = Math.max(0, nowTime - startTime);
  const consumedPercent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalPeriodMs) * 100)));

  let status: 'active' | 'expiring_soon' | 'expired' = 'active';
  let statusLabel = 'نشط';
  let statusColor: 'emerald' | 'amber' | 'red' = 'emerald';

  if (remainingDays <= 0) {
    status = 'expired';
    statusLabel = 'منتهي';
    statusColor = 'red';
  } else if (remainingDays <= 30) {
    status = 'expiring_soon';
    statusLabel = 'قريب من الانتهاء';
    statusColor = 'amber';
  } else {
    status = 'active';
    statusLabel = 'نشط';
    statusColor = 'emerald';
  }

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    activationFeePaid,
    activationFeeDate,
    subscriptionStartDate: subStart,
    subscriptionEndDate: subEnd,
    status,
    statusLabel,
    statusColor,
    remainingDays,
    totalDaysInPeriod,
    consumedPercent,
    currency: feeInfo.currency,
    annualFee: feeInfo.amount,
    pendingPayment,
    lastConfirmedPayment,
    paymentsHistory: tenantPayments,
  };
}

/**
 * Checks if a country corresponds to Morocco
 */
export function isCountryMorocco(country: string): boolean {
  if (!country) return true;
  const c = country.trim().toLowerCase();
  return (
    c.includes('مغرب') ||
    c.includes('morocco') ||
    c.includes('maroc') ||
    c === 'ma' ||
    c.includes('🇲🇦')
  );
}

export interface CountryActivationFeeInfo {
  amount: number;
  currency: SupportedCurrency;
  formatted: string;
  currencyNameAr: string;
  currencySymbol: string;
}

/**
 * Calculates dynamic activation/renewal fee and currency based on user country and admin settings.
 * Ensures:
 * - Inside Morocco: activationFeeMad (default 180 MAD)
 * - Outside Morocco: activationFeeUsd (default 18 USD)
 */
export function getActivationFeeForCountry(country: string, settings?: PlatformPaymentSettings): CountryActivationFeeInfo {
  const s = settings || getPlatformPaymentSettings();
  const currentMad = Number(s.activationFeeMad) > 0 ? Number(s.activationFeeMad) : 180;
  const currentUsd =
    Number(s.activationFeeUsd) > 0
      ? Number(s.activationFeeUsd)
      : Math.max(1, Math.round(currentMad / (Number(s.exchangeRate) > 0 ? Number(s.exchangeRate) : 10)));

  if (!country || isCountryMorocco(country)) {
    const amount = currentMad;
    return {
      amount,
      currency: 'MAD',
      formatted: `${amount.toLocaleString()} درهم مغربي (MAD)`,
      currencyNameAr: 'درهم مغربي',
      currencySymbol: 'MAD',
    };
  }

  // Users outside Morocco: use the configured USD activation fee (default 18 USD)
  const amount = currentUsd;
  return {
    amount,
    currency: 'USD',
    formatted: `${amount.toLocaleString()} دولار أمريكي (USD)`,
    currencyNameAr: 'دولار أمريكي',
    currencySymbol: '$',
  };
}

/**
 * Calculates the monthly fee for creating and promoting an association ad based on country
 * using the central platform settings (adCreationFeeMad / adCreationFeeUsd).
 */
export function getAdCreationFeeForCountry(country: string, settings?: PlatformPaymentSettings): CountryActivationFeeInfo {
  const s = settings || getPlatformPaymentSettings();
  const currentMad = s.adCreationFeeMad !== undefined ? s.adCreationFeeMad : 199;
  const ratio = currentMad / 199;

  if (!country || isCountryMorocco(country)) {
    const amount = currentMad;
    return {
      amount,
      currency: 'MAD',
      formatted: `${amount.toLocaleString()} درهم مغربي (MAD)`,
      currencyNameAr: 'درهم مغربي',
      currencySymbol: 'MAD',
    };
  }

  const c = country.trim().toLowerCase();

  // 1. European Union countries
  if (
    c.includes('فرنسا') || c.includes('france') ||
    c.includes('إسبانيا') || c.includes('اسبانيا') || c.includes('spain') || c.includes('espagne') ||
    c.includes('ألمانيا') || c.includes('المانيا') || c.includes('germany') || c.includes('allemagne') ||
    c.includes('إيطاليا') || c.includes('ايطاليا') || c.includes('italy') || c.includes('italie') ||
    c.includes('بلجيكا') || c.includes('belgium') || c.includes('belgique') ||
    c.includes('هولندا') || c.includes('netherlands') || c.includes('pays-bas') ||
    c.includes('البرتغال') || c.includes('portugal') ||
    c.includes('سويسرا') || c.includes('switzerland') || c.includes('suisse') ||
    c.includes('سويد') || c.includes('sweden') || c.includes('suède') ||
    c.includes('نرويج') || c.includes('norway') ||
    c.includes('دانمارك') || c.includes('denmark') ||
    c.includes('فنلندا') || c.includes('finland') ||
    c.includes('أوروبا') || c.includes('اوروبا') || c.includes('europe')
  ) {
    const amount = Math.max(1, Math.round(20 * ratio));
    return {
      amount,
      currency: 'EUR',
      formatted: `${amount} يورو (EUR)`,
      currencyNameAr: 'يورو',
      currencySymbol: '€',
    };
  }

  // 2. United Kingdom (UK)
  if (c.includes('بريطانيا') || c.includes('المملكة المتحدة') || c.includes('uk') || c.includes('united kingdom') || c.includes('england') || c.includes('انجلترا') || c.includes('لندن')) {
    const amount = Math.max(1, Math.round(16 * ratio));
    return {
      amount,
      currency: 'GBP',
      formatted: `${amount} جنيه إسترليني (GBP)`,
      currencyNameAr: 'جنيه إسترليني',
      currencySymbol: '£',
    };
  }

  // 3. Saudi Arabia
  if (c.includes('سعودي') || c.includes('saudi') || c.includes('ksa') || c.includes('🇸🇦')) {
    const amount = Math.max(1, Math.round(75 * ratio));
    return {
      amount,
      currency: 'SAR',
      formatted: `${amount} ريال سعودي (SAR)`,
      currencyNameAr: 'ريال سعودي',
      currencySymbol: 'SAR',
    };
  }

  // 4. United Arab Emirates
  if (c.includes('إمارات') || c.includes('امارات') || c.includes('uae') || c.includes('emirates') || c.includes('دبي') || c.includes('أبوظبي') || c.includes('🇦🇪')) {
    const amount = Math.max(1, Math.round(75 * ratio));
    return {
      amount,
      currency: 'AED',
      formatted: `${amount} درهم إماراتي (AED)`,
      currencyNameAr: 'درهم إماراتي',
      currencySymbol: 'AED',
    };
  }

  // 5. Qatar
  if (c.includes('قطر') || c.includes('qatar') || c.includes('🇶🇦')) {
    const amount = Math.max(1, Math.round(75 * ratio));
    return {
      amount,
      currency: 'QAR',
      formatted: `${amount} ريال قطري (QAR)`,
      currencyNameAr: 'ريال قطري',
      currencySymbol: 'QAR',
    };
  }

  // 6. Kuwait
  if (c.includes('كويت') || c.includes('kuwait') || c.includes('🇰🇼')) {
    const amount = Math.max(1, Math.round(6 * ratio));
    return {
      amount,
      currency: 'KWD',
      formatted: `${amount} دينار كويتي (KWD)`,
      currencyNameAr: 'دينار كويتي',
      currencySymbol: 'KWD',
    };
  }

  // 7. Bahrain
  if (c.includes('بحرين') || c.includes('bahrain') || c.includes('🇧🇭')) {
    const amount = Math.max(1, Math.round(8 * ratio));
    return {
      amount,
      currency: 'BHD',
      formatted: `${amount} دينار بحريني (BHD)`,
      currencyNameAr: 'دينار بحريني',
      currencySymbol: 'BHD',
    };
  }

  // 8. Oman
  if (c.includes('عمان') || c.includes('عُمان') || c.includes('oman') || c.includes('🇴🇲')) {
    const amount = Math.max(1, Math.round(8 * ratio));
    return {
      amount,
      currency: 'OMR',
      formatted: `${amount} ريال عماني (OMR)`,
      currencyNameAr: 'ريال عماني',
      currencySymbol: 'OMR',
    };
  }

  // 9. Algeria
  if (c.includes('جزائر') || c.includes('algeria') || c.includes('algérie') || c.includes('🇩🇿')) {
    const amount = Math.max(100, Math.round(2700 * ratio));
    return {
      amount,
      currency: 'DZD',
      formatted: `${amount.toLocaleString()} دينار جزائري (DZD)`,
      currencyNameAr: 'دينار جزائري',
      currencySymbol: 'DZD',
    };
  }

  // 10. Tunisia
  if (c.includes('تونس') || c.includes('tunisia') || c.includes('tunisie') || c.includes('🇹🇳')) {
    const amount = Math.max(5, Math.round(60 * ratio));
    return {
      amount,
      currency: 'TND',
      formatted: `${amount} دينار تونسي (TND)`,
      currencyNameAr: 'دينار تونسي',
      currencySymbol: 'TND',
    };
  }

  // 11. Mauritania
  if (c.includes('موريتانيا') || c.includes('mauritania') || c.includes('mauritanie') || c.includes('🇲🇷')) {
    const amount = Math.max(50, Math.round(800 * ratio));
    return {
      amount,
      currency: 'MRU',
      formatted: `${amount.toLocaleString()} أوقية موريتانية (MRU)`,
      currencyNameAr: 'أوقية موريتانية',
      currencySymbol: 'MRU',
    };
  }

  // 12. Egypt
  if (c.includes('مصر') || c.includes('egypt') || c.includes('égypte') || c.includes('🇪🇬')) {
    const amount = Math.max(50, Math.round(950 * ratio));
    return {
      amount,
      currency: 'EGP',
      formatted: `${amount.toLocaleString()} جنيه مصري (EGP)`,
      currencyNameAr: 'جنيه مصري',
      currencySymbol: 'EGP',
    };
  }

  // 13. Jordan
  if (c.includes('أردن') || c.includes('اردن') || c.includes('jordan') || c.includes('🇯🇴')) {
    const amount = Math.max(1, Math.round(15 * ratio));
    return {
      amount,
      currency: 'JOD',
      formatted: `${amount} دينار أردني (JOD)`,
      currencyNameAr: 'دينار أردني',
      currencySymbol: 'JOD',
    };
  }

  // 14. Canada
  if (c.includes('كندا') || c.includes('canada') || c.includes('🇨🇦')) {
    const amount = Math.max(1, Math.round(28 * ratio));
    return {
      amount,
      currency: 'CAD',
      formatted: `${amount} دولار كندي (CAD)`,
      currencyNameAr: 'دولار كندي',
      currencySymbol: 'CAD',
    };
  }

  // 15. Turkey
  if (c.includes('تركيا') || c.includes('turkey') || c.includes('turquie') || c.includes('🇹🇷')) {
    const amount = Math.max(50, Math.round(700 * ratio));
    return {
      amount,
      currency: 'TRY',
      formatted: `${amount.toLocaleString()} ليرة تركية (TRY)`,
      currencyNameAr: 'ليرة تركية',
      currencySymbol: '₺',
    };
  }

  // Default: US Dollar
  const amount = s.adCreationFeeUsd || Math.max(1, Math.round(20 * ratio));
  return {
    amount,
    currency: 'USD',
    formatted: `$${amount} دولار أمريكي (USD)`,
    currencyNameAr: 'دولار أمريكي',
    currencySymbol: '$',
  };
}

export const calculateTenantFee = getActivationFeeForCountry;

export interface CreatePaymentInput {
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  amount: number;
  currency: SupportedCurrency;
  country: string;
  paymentMethod: PaymentMethod;
  proofDocumentUrl?: string;
  proofFileName?: string;
  cardLast4?: string;
  transactionReference?: string;
  adminNotes?: string;
  type?: PaymentType;
  periodStart?: string;
  periodEnd?: string;
  monthsCount?: number;
  adCampaignTitle?: string;
}

/**
 * Creates a new payment, renewal, or ad campaign request and prevents duplicate pending requests of the same type for the same tenant.
 */
export function submitTenantPayment(input: CreatePaymentInput): { success: boolean; payment?: TenantPaymentRecord; error?: string } {
  const allPayments = getAllTenantPayments();
  const requestedType = input.type || 'activation';

  // Check if there is already a pending or verified payment of the same category for this tenant
  const existingPending = allPayments.find(
    (p) => p.tenantId === input.tenantId && (p.status === 'pending' || p.status === 'verified') && (
      p.type === requestedType || (requestedType !== 'ad_campaign' && p.type !== 'ad_campaign')
    )
  );

  if (existingPending) {
    return {
      success: false,
      error: requestedType === 'ad_campaign'
        ? 'توجد بالفعل حملة إعلانية قيد المراجعة والتحقق من الدفع لهذه الجمعية. يرجى انتظار رد الإدارة العامة أو إلغاء الطلب السابق.'
        : 'توجد بالفعل عملية دفع أو طلب اشتراك قيد المراجعة والتفعيل لهذه الجمعية. يرجى انتظار رد الإدارة أو إلغاء الطلب السابق.',
    };
  }

  const now = new Date().toISOString();
  const prefix = requestedType === 'ad_campaign' ? 'AD' : requestedType === 'renewal' ? 'RNW' : 'SUB';
  const refCode = input.transactionReference || `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const methodAr =
    input.paymentMethod === 'bank_transfer'
      ? 'تحويل بنكي'
      : input.paymentMethod === 'cash_plus'
      ? 'Cash Plus'
      : input.paymentMethod === 'credit_card'
      ? 'بطاقة بنكية'
      : 'PayPal';

  const newPayment: TenantPaymentRecord = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    tenantSlug: input.tenantSlug,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    ownerPhone: input.ownerPhone,
    amount: input.amount,
    currency: input.currency,
    country: input.country,
    paymentMethod: input.paymentMethod,
    status: 'pending', // Under review
    paymentVerified: false,
    type: requestedType,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    monthsCount: input.monthsCount,
    adCampaignTitle: input.adCampaignTitle,
    createdAt: now,
    submittedAt: now,
    transactionReference: refCode,
    proofDocumentUrl: input.proofDocumentUrl,
    proofFileName: input.proofFileName,
    cardLast4: input.cardLast4,
    adminNotes: input.adminNotes,
    statusHistory: [
      {
        status: 'pending',
        label: requestedType === 'activation' ? 'قيد مراجعة الدفع (في انتظار التفعيل)' : 'إرسال طلب الدفع للمراجعة',
        timestamp: now,
        actor: input.ownerName,
        note: `تم إرسال وصل وتسديد مبلغ الاشتراك (${input.amount} ${input.currency}) عبر ${methodAr} - رقم المرجع: ${refCode}. انتقلت حالة الطلب إلى «قيد مراجعة الدفع» بانتظار التحقق من صحة الوصل وموافقة الإدارة العامة.`,
      },
    ],
  };

  const updatedPayments = [newPayment, ...allPayments];
  saveAllTenantPayments(updatedPayments);

  // Transition tenant platform status from 'pending_subscription' («في انتظار الاشتراك») to 'pending_activation' («في انتظار التفعيل / قيد مراجعة الدفع») after confirming payment submission
  if (requestedType === 'activation') {
    const allTenants = getAllTenants();
    const tenantIdx = allTenants.findIndex((t) => t.id === input.tenantId);
    if (tenantIdx !== -1 && allTenants[tenantIdx].status !== 'active') {
      const currentTenant = allTenants[tenantIdx];
      const existingHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
        ? currentTenant.subscriptionStatusHistory
        : [
            {
              status: 'pending_subscription',
              label: 'في انتظار الدفع',
              timestamp: currentTenant.createdAt || now,
              actor: currentTenant.ownerName,
              note: 'تم إنشاء المنصة بحالة «في انتظار الدفع».',
            },
          ];
      allTenants[tenantIdx] = {
        ...currentTenant,
        status: 'pending_activation',
        paymentVerified: false,
        updatedAt: now,
        subscriptionStatusHistory: [
          ...existingHistory,
          {
            status: 'pending_activation',
            label: 'قيد مراجعة الدفع',
            timestamp: now,
            actor: input.ownerName,
            note: `تم تسديد الاشتراك وإرسال وصل الدفع (${input.amount} ${input.currency} - ${methodAr} - مرجع: ${refCode}). حالة الطلب الآن «قيد مراجعة الدفع» بانتظار تدقيق الوصل وموافقة الإدارة العامة.`,
          },
        ],
      };
      saveAllTenants(allTenants);
    }
  }

  // If this is an ad campaign payment, automatically create / link the AdCampaignRequest
  if (requestedType === 'ad_campaign') {
    try {
      const calculatedEnd = input.periodEnd || (() => {
        const d = new Date(input.periodStart || now);
        d.setMonth(d.getMonth() + (input.monthsCount || 1));
        return d.toISOString().split('T')[0];
      })();

      createOrUpdateAdCampaignRequest({
        tenantId: input.tenantId,
        tenantName: input.tenantName,
        tenantSlug: input.tenantSlug,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        ownerPhone: input.ownerPhone,
        campaignTitle: input.adCampaignTitle || `إعلان مشاريع ${input.tenantName}`,
        monthsCount: input.monthsCount || 1,
        startDate: input.periodStart || now.split('T')[0],
        endDate: calculatedEnd,
        amount: input.amount,
        currency: input.currency,
        status: 'paid_pending_review',
        paymentStatus: 'pending_verification',
        paymentId: newPayment.id,
        paymentMethod: input.paymentMethod,
        paymentReference: refCode,
        paymentSubmittedAt: now,
        paymentAmount: input.amount,
        paymentCurrency: input.currency,
        proofDocumentUrl: input.proofDocumentUrl,
        proofFileName: input.proofFileName,
        cardLast4: input.cardLast4,
        adminNotes: input.adminNotes,
      });
    } catch (e) {
      console.warn('[PaymentStorage] Failed to automatically create AdCampaignRequest:', e);
    }
  }

  try {
    fetch('/api/platform-payments/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPayment),
    }).catch(() => {});
  } catch {}

  return { success: true, payment: newPayment };
}

export interface SubmitPlatformSupportInput {
  supporterName?: string;
  supporterPhone?: string;
  amount: number;
  currency: 'MAD' | 'USD';
  country?: string;
  paymentMethod: PaymentMethod;
  proofDocumentUrl?: string;
  proofFileName?: string;
  cardLast4?: string;
  transactionReference?: string;
  notes?: string;
}

/**
 * Creates and records a donation/support payment for the platform.
 * Strictly redirects to the dedicated Platform Support Account to guarantee total segregation.
 */
export function submitPlatformSupportPayment(input: SubmitPlatformSupportInput): { success: boolean; payment?: TenantPaymentRecord; error?: string } {
  if (!input.amount || input.amount <= 0) {
    return { success: false, error: 'يرجى تحديد مبلغ دعم صحيح أكبر من الصفر.' };
  }

  // Delegate strictly to the dedicated Platform Support Donations storage
  submitPlatformSupportDonation({
    supporterName: input.supporterName,
    supporterPhone: input.supporterPhone,
    amount: input.amount,
    currency: input.currency,
    country: input.country,
    paymentMethod: input.paymentMethod,
    proofDocumentUrl: input.proofDocumentUrl,
    proofFileName: input.proofFileName,
    cardLast4: input.cardLast4,
    notes: input.notes,
    transactionReference: input.transactionReference,
  }).catch((err) => console.error('[paymentStorage] submitPlatformSupportDonation delegate error:', err));

  const refCode = input.transactionReference || `SUP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();
  const isInstant = input.paymentMethod === 'credit_card' || input.paymentMethod === 'paypal';

  const virtualTicket: TenantPaymentRecord = {
    id: `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tenantId: 'platform_support',
    tenantName: 'SYOMAX منصة العمل الجمعوي (حساب دعم وتطوير المنصة)',
    tenantSlug: 'platform-support',
    ownerId: `supporter_${Date.now()}`,
    ownerName: (input.supporterName && input.supporterName.trim()) || 'فاعل خير / داعم للمنصة',
    ownerPhone: (input.supporterPhone && input.supporterPhone.trim()) || 'غير محدد',
    amount: Number(input.amount),
    currency: input.currency,
    country: input.country || (input.currency === 'MAD' ? 'المغرب' : 'دولي'),
    paymentMethod: input.paymentMethod,
    status: isInstant ? 'confirmed' : 'pending',
    type: 'platform_support',
    createdAt: now,
    submittedAt: now,
    reviewedAt: isInstant ? now : undefined,
    reviewedBy: isInstant ? 'النظام الإلكتروني الآمن' : undefined,
    transactionReference: refCode,
    proofDocumentUrl: input.proofDocumentUrl,
    proofFileName: input.proofFileName,
    cardLast4: input.cardLast4,
    adminNotes: input.notes?.trim() || undefined,
  };

  return { success: true, payment: virtualTicket };
}

/**
 * Super Admin: Confirm payment and activate or renew tenant platform subscription or ad campaign
 */
export function confirmPaymentAndActivateTenant(paymentId: string, adminName: string = 'الإدارة العامة'): { success: boolean; error?: string } {
  // Check if this payment is a platform support donation
  confirmPlatformSupportDonation(paymentId, adminName).catch(() => {});

  const allPayments = getAllTenantPayments();
  const paymentIndex = allPayments.findIndex((p) => p.id === paymentId);

  if (paymentIndex === -1) {
    return { success: true };
  }

  const payment = allPayments[paymentIndex];

  // If this is a platform support payment, remove it from tenant payments
  if (payment.type === 'platform_support' || payment.tenantId === 'platform' || payment.tenantId === 'platform_support') {
    allPayments.splice(paymentIndex, 1);
    saveAllTenantPayments(allPayments);
    return { success: true };
  }

  // If this is an ad campaign payment, delegate to confirmAdCampaignPayment
  if (payment.type === 'ad_campaign') {
    return confirmAdCampaignPayment(paymentId, adminName);
  }

  const now = new Date().toISOString();
  const allTenants = getAllTenants();
  const tenantIndex = allTenants.findIndex((t) => t.id === payment.tenantId);

  let currentExpiresAt: string | undefined;
  if (tenantIndex !== -1) {
    currentExpiresAt = allTenants[tenantIndex].subscriptionExpiresAt;
  }

  // Calculate new subscription term:
  // - If renewing before expiry -> starts from currentExpiresAt
  // - If renewing after expiry / new activation -> starts from now
  const { periodStart, periodEnd } = computeRenewalDates(currentExpiresAt, now);

  // Update payment status to confirmed with period info and operation log
  const existingPayHistory = Array.isArray(payment.statusHistory) ? payment.statusHistory : [];
  allPayments[paymentIndex] = {
    ...payment,
    status: 'confirmed',
    paymentVerified: true,
    paymentVerifiedAt: payment.paymentVerifiedAt || now,
    paymentVerifiedBy: payment.paymentVerifiedBy || adminName,
    reviewedAt: now,
    reviewedBy: adminName,
    periodStart,
    periodEnd,
    statusHistory: [
      ...existingPayHistory,
      ...(!payment.paymentVerified
        ? [
            {
              status: 'verified' as const,
              label: 'تم التحقق من صحة الدفع',
              timestamp: now,
              actor: adminName,
              note: 'تم التحقق من استلام مبلغ الاشتراك ومطابقة بيانات الدفع.',
            },
          ]
        : []),
      {
        status: 'confirmed' as const,
        label: 'تم تفعيل المنصة والموافقة الإدارية',
        timestamp: now,
        actor: adminName,
        note: `تمت الموافقة الإدارية وتفعيل المنصة رسمياً لفترة الاشتراك (${periodStart.split('T')[0]} إلى ${periodEnd.split('T')[0]}).`,
      },
    ],
  };
  saveAllTenantPayments(allPayments);

  // Update tenant in allTenants
  if (tenantIndex !== -1) {
    const currentTenant = allTenants[tenantIndex];
    const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
      ? currentTenant.subscriptionStatusHistory
      : [];
    allTenants[tenantIndex] = {
      ...currentTenant,
      status: 'active',
      paymentVerified: true,
      paymentVerifiedAt: currentTenant.paymentVerifiedAt || now,
      paymentVerifiedBy: currentTenant.paymentVerifiedBy || adminName,
      subscriptionStartedAt: currentTenant.subscriptionStartedAt || periodStart,
      subscriptionExpiresAt: periodEnd,
      lastRenewalPaymentId: payment.id,
      lastRenewalDate: now,
      activationFeePaid: currentTenant.activationFeePaid || payment.amount,
      activationFeeDate: currentTenant.activationFeeDate || payment.submittedAt || now,
      updatedAt: now,
      subscriptionStatusHistory: [
        ...existingTenantHistory,
        ...(!currentTenant.paymentVerified
          ? [
              {
                status: 'payment_verified' as const,
                label: 'تم التحقق من الدفع إدارياً',
                timestamp: now,
                actor: adminName,
                note: `تم التحقق من صحة دفع الاشتراك (مرجع: ${payment.transactionReference || payment.id}).`,
              },
            ]
          : []),
        {
          status: 'active' as const,
          label: 'مفعّلة',
          timestamp: now,
          actor: adminName,
          note: `تم تفعيل منصة الجمعية رسمياً من طرف الإدارة العامة بعد استيفاء شرطي التحقق من صحة الدفع والموافقة الإدارية.`,
        },
      ],
    };
    saveAllTenants(allTenants);
  }

  // Also call server backend API endpoint and persist directly to Cloud Firestore
  try {
    fetch(`/api/platform-payments/${paymentId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName, periodStart, periodEnd, tenantId: payment.tenantId }),
    }).catch(() => {});
  } catch {}

  try {
    const confirmedPayPayload = JSON.parse(JSON.stringify({ ...allPayments[paymentIndex], _updatedAt: now }));
    setDoc(doc(db, 'tenant_payments', paymentId), confirmedPayPayload, { merge: true }).catch(() => {});
    if (tenantIndex !== -1) {
      const activeTenantPayload = JSON.parse(JSON.stringify({ ...allTenants[tenantIndex], _updatedAt: now }));
      setDoc(doc(db, 'tenants', allTenants[tenantIndex].id), activeTenantPayload, { merge: true }).catch(() => {});
    }
  } catch {}

  return { success: true };
}

/**
 * Super Admin: Async permanent activation for ANY pending/unactivated association
 * (whether it has already uploaded a payment receipt OR just registered and is awaiting activation).
 * Awaits server API + Cloud Firestore persistence so state survives reload/logout and propagates live.
 */
export async function activatePendingTenantPlatform(input: {
  tenantId: string;
  tenantSnapshot?: Partial<AssociationTenant>;
  paymentId?: string;
  adminName?: string;
  note?: string;
  amount?: number;
  currency?: 'MAD' | 'USD';
}): Promise<{ success: boolean; error?: string; tenant?: AssociationTenant; payment?: TenantPaymentRecord }> {
  const adminName = input.adminName || 'الإدارة العامة';
  const now = new Date().toISOString();

  // 1. Optimistically update local cache immediately for instant UI response
  if (input.paymentId) {
    confirmPaymentAndActivateTenant(input.paymentId, adminName);
  } else {
    const allTenants = getAllTenants();
    const tIdx = allTenants.findIndex((t) => t.id === input.tenantId);
    const { periodStart, periodEnd } = computeRenewalDates(tIdx !== -1 ? allTenants[tIdx].subscriptionExpiresAt : undefined, now);
    if (tIdx !== -1) {
      const currentTenant = allTenants[tIdx];
      const existingHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
        ? currentTenant.subscriptionStatusHistory
        : [];
      allTenants[tIdx] = {
        ...currentTenant,
        status: 'active',
        paymentVerified: true,
        paymentVerifiedAt: currentTenant.paymentVerifiedAt || now,
        paymentVerifiedBy: currentTenant.paymentVerifiedBy || adminName,
        subscriptionStartedAt: currentTenant.subscriptionStartedAt || periodStart,
        subscriptionExpiresAt: periodEnd,
        activationFeePaid: currentTenant.activationFeePaid || input.amount || 180,
        activationFeeCurrency: currentTenant.activationFeeCurrency || input.currency || 'MAD',
        activationFeeDate: currentTenant.activationFeeDate || now,
        updatedAt: now,
        subscriptionStatusHistory: [
          ...existingHistory,
          {
            status: 'active',
            label: 'مفعّلة',
            timestamp: now,
            actor: adminName,
            note: input.note || 'تم قبول طلب التفعيل وتفعيل منصة الجمعية رسمياً من طرف الإدارة العامة.',
          },
        ],
      };
      saveAllTenants(allTenants);
    }
  }

  // 2. Await authoritative server persistence (writes disk + Cloud Firestore `tenants` & `tenant_payments`)
  let serverTenant: AssociationTenant | undefined;
  let serverPayment: TenantPaymentRecord | undefined;
  try {
    const res = await fetch('/api/platform-payments/activate-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: input.tenantId,
        paymentId: input.paymentId,
        tenantSnapshot: input.tenantSnapshot,
        adminName,
        note: input.note,
        amount: input.amount,
        currency: input.currency,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return { success: false, error: data?.error || 'تعذر حفظ تفعيل المنصة في الخادم.' };
    }
    serverTenant = data.tenant;
    serverPayment = data.payment;
  } catch (err: any) {
    console.warn('[paymentStorage] activatePendingTenantPlatform server call warning:', err);
  }

  // 3. Ensure direct client Cloud Firestore write & local cache reconciliation
  try {
    if (serverTenant) {
      const sanitizedTenant = JSON.parse(JSON.stringify({ ...serverTenant, _updatedAt: now }));
      await setDoc(doc(db, 'tenants', serverTenant.id), sanitizedTenant, { merge: true }).catch(() => {});
      const allTenants = getAllTenants();
      const idx = allTenants.findIndex((t) => t.id === serverTenant!.id);
      if (idx !== -1) {
        allTenants[idx] = { ...allTenants[idx], ...serverTenant };
      } else {
        allTenants.unshift(serverTenant);
      }
      saveData('chayef_all_tenants_v2', allTenants);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chayef-tenants-changed', { detail: allTenants }));
      }
    }
    if (serverPayment) {
      const sanitizedPay = JSON.parse(JSON.stringify({ ...serverPayment, _updatedAt: now }));
      await setDoc(doc(db, 'tenant_payments', serverPayment.id), sanitizedPay, { merge: true }).catch(() => {});
      const allPayments = getAllTenantPayments();
      const pIdx = allPayments.findIndex((p) => p.id === serverPayment!.id);
      if (pIdx !== -1) {
        allPayments[pIdx] = { ...allPayments[pIdx], ...serverPayment };
      } else {
        allPayments.unshift(serverPayment);
      }
      saveData(PAYMENT_STORAGE_KEYS.PAYMENTS, allPayments);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chayef-payments-changed', { detail: allPayments }));
      }
    }
  } catch {}

  return { success: true, tenant: serverTenant, payment: serverPayment };
}

/**
 * Super Admin: Step 1 of Administrative Review -> Verify payment before or prior to activating the platform
 * Records the verification state in both payment record and tenant record.
 */
export function verifyTenantPayment(
  paymentId: string,
  adminName: string = 'الإدارة العامة',
  verificationNote?: string
): { success: boolean; error?: string } {
  const allPayments = getAllTenantPayments();
  const paymentIndex = allPayments.findIndex((p) => p.id === paymentId);

  if (paymentIndex === -1) {
    return { success: false, error: 'طلب الاشتراك / الدفع غير موجود.' };
  }

  const payment = allPayments[paymentIndex];
  const now = new Date().toISOString();
  const noteText = verificationNote?.trim() || 'تمت مراجعة طلب الاشتراك والتحقق من صحة الدفع ومطابقة المبلغ بنجاح. المنصة في انتظار قرار التفعيل النهائي.';

  const existingPayHistory = Array.isArray(payment.statusHistory) ? payment.statusHistory : [];
  allPayments[paymentIndex] = {
    ...payment,
    status: 'verified',
    paymentVerified: true,
    paymentVerifiedAt: now,
    paymentVerifiedBy: adminName,
    adminNotes: verificationNote?.trim() || payment.adminNotes,
    statusHistory: [
      ...existingPayHistory,
      {
        status: 'verified',
        label: 'تم التحقق من الدفع (في انتظار التفعيل الإداري)',
        timestamp: now,
        actor: adminName,
        note: noteText,
      },
    ],
  };
  saveAllTenantPayments(allPayments);

  // Also update tenant record to reflect verified payment while keeping status in 'pending_activation' until explicit activation
  const allTenants = getAllTenants();
  const tenantIndex = allTenants.findIndex((t) => t.id === payment.tenantId);
  if (tenantIndex !== -1) {
    const currentTenant = allTenants[tenantIndex];
    const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
      ? currentTenant.subscriptionStatusHistory
      : [];
    allTenants[tenantIndex] = {
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
    saveAllTenants(allTenants);
  }

  try {
    fetch(`/api/platform-payments/${paymentId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName, note: noteText }),
    }).catch(() => {});
  } catch {}

  try {
    const sanitizedPay = JSON.parse(JSON.stringify({ ...allPayments[paymentIndex], _updatedAt: now }));
    setDoc(doc(db, 'tenant_payments', paymentId), sanitizedPay, { merge: true }).catch(() => {});
    if (tenantIndex !== -1) {
      const sanitizedTenant = JSON.parse(JSON.stringify({ ...allTenants[tenantIndex], _updatedAt: now }));
      setDoc(doc(db, 'tenants', allTenants[tenantIndex].id), sanitizedTenant, { merge: true }).catch(() => {});
    }
  } catch {}

  return { success: true };
}

/**
 * Super Admin: Confirm an Ad Campaign Payment and automatically register/activate the ad campaign
 */
export function confirmAdCampaignPayment(
  paymentId: string,
  adminName: string = 'الإدارة العامة',
  priorityOrder: number = 1
): { success: boolean; error?: string; campaign?: PlatformAdCampaign } {
  const allPayments = getAllTenantPayments();
  const paymentIndex = allPayments.findIndex((p) => p.id === paymentId);

  if (paymentIndex === -1) {
    return { success: false, error: 'طلب دفع الحملة الإعلانية غير موجود.' };
  }

  const payment = allPayments[paymentIndex];
  const now = new Date().toISOString();
  const tenant = getTenantById(payment.tenantId);

  // Compute ad dates
  let startDate = payment.periodStart || now;
  let endDate = payment.periodEnd;
  if (!endDate) {
    const months = payment.monthsCount || 1;
    const s = new Date(startDate);
    s.setMonth(s.getMonth() + months);
    endDate = s.toISOString();
  }

  // Create or activate Ad Campaign in adCampaignStorage
  const campaign = saveAdCampaign({
    tenantId: payment.tenantId,
    tenantName: payment.tenantName,
    tenantSlug: payment.tenantSlug || tenant?.slug,
    tenantLogoUrl: tenant?.logoUrl,
    tenantCity: tenant?.city || 'المغرب',
    tenantCountry: tenant?.country || 'المغرب',
    priorityOrder: priorityOrder || 1,
    startDate,
    endDate,
    title: payment.adCampaignTitle || 'إعلان ترويجي للمشاريع بالصفحة الأولى',
    notes: `تم تأكيد دفع الإعلان (${payment.amount} ${payment.currency}) بواسطة ${adminName} - مرجع: ${payment.transactionReference}`,
    enabled: true,
    createdBy: adminName,
  });

  // Update payment record
  allPayments[paymentIndex] = {
    ...payment,
    status: 'confirmed',
    reviewedAt: now,
    reviewedBy: adminName,
    periodStart: startDate,
    periodEnd: endDate,
    adCampaignId: campaign.id,
  };
  saveAllTenantPayments(allPayments);

  // Also call server backend API endpoint
  try {
    fetch(`/api/platform-payments/${paymentId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminName,
        periodStart: startDate,
        periodEnd: endDate,
        adCampaignId: campaign.id,
        type: 'ad_campaign',
      }),
    }).catch(() => {});
  } catch {}

  return { success: true, campaign };
}

/**
 * Returns all ad campaign payment records for a specific tenant
 */
export function getAdCampaignPaymentsByTenant(tenantId: string): TenantPaymentRecord[] {
  const all = getAllTenantPayments();
  return all
    .filter((p) => p.tenantId === tenantId && p.type === 'ad_campaign')
    .sort((a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime());
}

/**
 * Returns all ad campaign payment records across the platform
 */
export function getAllAdCampaignPayments(): TenantPaymentRecord[] {
  const all = getAllTenantPayments();
  return all
    .filter((p) => p.type === 'ad_campaign')
    .sort((a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime());
}

/**
 * Super Admin: Reject payment with reason
 */
export function rejectTenantPayment(paymentId: string, adminName: string = 'الإدارة العامة', reason?: string): { success: boolean; error?: string } {
  const allPayments = getAllTenantPayments();
  const paymentIndex = allPayments.findIndex((p) => p.id === paymentId);

  if (paymentIndex === -1) {
    return { success: false, error: 'عملية الدفع غير موجودة.' };
  }

  const payment = allPayments[paymentIndex];
  const now = new Date().toISOString();

  const existingPayHistory = Array.isArray(payment.statusHistory) ? payment.statusHistory : [];
  const finalReason = reason || 'تعذر التحقق من صحة معلومات الدفع أو الإشعار المرفق.';

  allPayments[paymentIndex] = {
    ...payment,
    status: 'rejected',
    paymentVerified: false,
    reviewedAt: now,
    reviewedBy: adminName,
    rejectionReason: finalReason,
    statusHistory: [
      ...existingPayHistory,
      {
        status: 'rejected',
        label: 'تم رفض طلب الاشتراك / الدفع',
        timestamp: now,
        actor: adminName,
        note: `سبب الرفض: ${finalReason}`,
      },
    ],
  };
  saveAllTenantPayments(allPayments);

  // If this was an initial activation payment, return tenant status to 'pending_subscription' («في انتظار الاشتراك»)
  // because payment was rejected and the owner must submit a valid subscription payment.
  const allTenants = getAllTenants();
  const tenantIndex = allTenants.findIndex((t) => t.id === payment.tenantId);
  if (tenantIndex !== -1 && payment.type === 'activation') {
    const currentTenant = allTenants[tenantIndex];
    const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
      ? currentTenant.subscriptionStatusHistory
      : [];
    allTenants[tenantIndex] = {
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
          note: `تم رفض عملية الدفع من طرف الإدارة. السبب: ${finalReason}. يرجى إعادة تسديد الاشتراك لتفعيل المنصة.`,
        },
      ],
    };
    saveAllTenants(allTenants);
  }

  // Also call server backend API endpoint & persist directly to Cloud Firestore
  try {
    fetch(`/api/platform-payments/${paymentId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName, reason: finalReason }),
    }).catch(() => {});
  } catch {}

  try {
    const sanitizedPay = JSON.parse(JSON.stringify({ ...allPayments[paymentIndex], _updatedAt: now }));
    setDoc(doc(db, 'tenant_payments', paymentId), sanitizedPay, { merge: true }).catch(() => {});
    if (tenantIndex !== -1 && payment.type === 'activation') {
      const sanitizedTenant = JSON.parse(JSON.stringify({ ...allTenants[tenantIndex], _updatedAt: now }));
      setDoc(doc(db, 'tenants', allTenants[tenantIndex].id), sanitizedTenant, { merge: true }).catch(() => {});
    }
  } catch {}

  return { success: true };
}

/**
 * Tenant Owner: Cancel pending payment request
 */
export function cancelTenantPayment(paymentId: string): { success: boolean; error?: string } {
  const allPayments = getAllTenantPayments();
  const paymentIndex = allPayments.findIndex((p) => p.id === paymentId);

  if (paymentIndex === -1) {
    return { success: false, error: 'طلب الدفع غير موجود.' };
  }

  const payment = allPayments[paymentIndex];
  if (payment.status !== 'pending') {
    return { success: false, error: 'لا يمكن إلغاء طلب تمت معالجته مسبقاً.' };
  }

  // Remove the pending payment
  allPayments.splice(paymentIndex, 1);
  saveAllTenantPayments(allPayments);

  // If this was an activation payment and the tenant is not active, return status to 'pending_subscription'
  if (payment.type === 'activation') {
    const allTenants = getAllTenants();
    const tenantIndex = allTenants.findIndex((t) => t.id === payment.tenantId);
    if (tenantIndex !== -1 && allTenants[tenantIndex].status !== 'active') {
      const now = new Date().toISOString();
      const currentTenant = allTenants[tenantIndex];
      const existingTenantHistory = Array.isArray(currentTenant.subscriptionStatusHistory)
        ? currentTenant.subscriptionStatusHistory
        : [];
      allTenants[tenantIndex] = {
        ...currentTenant,
        status: 'pending_subscription',
        paymentVerified: false,
        updatedAt: now,
        subscriptionStatusHistory: [
          ...existingTenantHistory,
          {
            status: 'pending_subscription',
            label: 'في انتظار الدفع (تم إلغاء طلب الدفع)',
            timestamp: now,
            actor: currentTenant.ownerName,
            note: 'قام صاحب الجمعية بإلغاء طلب الدفع السابق لإعادة إرساله.',
          },
        ],
      };
      saveAllTenants(allTenants);
    }
  }

  try {
    fetch(`/api/platform-payments/${paymentId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  } catch {}

  try {
    deleteDoc(doc(db, 'tenant_payments', paymentId)).catch(() => {});
  } catch {}

  return { success: true };
}

/**
 * Super Admin: Directly record a subscription renewal for an association.
 * Automatically computes renewal term, updates start/expiration dates, marks status active,
 * creates a confirmed payment record, and syncs across local and server storage.
 */
export function recordDirectSubscriptionRenewal(
  tenantId: string,
  options: {
    years?: number;
    customEndDate?: string;
    customStartDate?: string;
    paymentMethod?: string;
    transactionReference?: string;
    amount?: number;
    currency?: 'MAD' | 'USD';
    notes?: string;
    adminName?: string;
  } = {}
): { success: boolean; error?: string; periodStart?: string; periodEnd?: string; tenant?: AssociationTenant } {
  const allTenants = getAllTenants();
  const tenantIndex = allTenants.findIndex((t) => t.id === tenantId);

  if (tenantIndex === -1) {
    return { success: false, error: 'الجمعية المحددة غير موجودة في النظام.' };
  }

  const currentTenant = allTenants[tenantIndex];
  const now = new Date().toISOString();
  const years = options.years || 1;
  const adminName = options.adminName || 'الإدارة العامة للمنصة';

  let periodStart = options.customStartDate;
  let periodEnd = options.customEndDate;

  if (!periodStart || !periodEnd) {
    const currentExpiresAt = currentTenant.subscriptionExpiresAt;
    const nowTime = Date.now();
    const currExpTime = currentExpiresAt ? new Date(currentExpiresAt).getTime() : 0;

    if (currExpTime > nowTime) {
      // Renewing before expiration -> extend from existing expiration date
      const d = new Date(currExpTime);
      periodStart = currentTenant.subscriptionStartedAt || d.toISOString();
      const next = new Date(d);
      next.setFullYear(next.getFullYear() + years);
      periodEnd = next.toISOString();
    } else {
      // Renewing after expiration -> new cycle begins now
      const d = new Date(nowTime);
      periodStart = d.toISOString();
      const next = new Date(d);
      next.setFullYear(next.getFullYear() + years);
      periodEnd = next.toISOString();
    }
  }

  const settings = getPlatformPaymentSettings();
  const feeInfo = getActivationFeeForCountry(currentTenant.country, settings);
  const finalAmount = options.amount !== undefined ? options.amount : feeInfo.amount * years;
  const finalCurrency = options.currency || feeInfo.currency;

  // Create confirmed payment record for history & audit
  const newPaymentId = `pay_renew_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const confirmedPaymentRecord: TenantPaymentRecord = {
    id: newPaymentId,
    tenantId: currentTenant.id,
    tenantName: currentTenant.name,
    tenantSlug: currentTenant.slug,
    ownerId: currentTenant.ownerId || '',
    ownerName: currentTenant.ownerName || 'مدير الجمعية',
    ownerPhone: currentTenant.ownerPhone || '',
    country: currentTenant.country || 'المغرب',
    amount: finalAmount,
    currency: finalCurrency,
    paymentMethod: (options.paymentMethod as any) || 'bank_transfer',
    type: 'renewal',
    status: 'confirmed',
    transactionReference: options.transactionReference || `RENEW-${Date.now().toString().slice(-6)}`,
    adminNotes: options.notes || `تجديد اشتراك سنوي مباشر بواسطة ${adminName}`,
    submittedAt: now,
    reviewedAt: now,
    reviewedBy: adminName,
    periodStart,
    periodEnd,
    createdAt: now,
  };

  const allPayments = getAllTenantPayments();
  const updatedPayments = [confirmedPaymentRecord, ...allPayments];
  saveAllTenantPayments(updatedPayments);

  // Update tenant
  const updatedTenant: AssociationTenant = {
    ...currentTenant,
    status: 'active',
    subscriptionStartedAt: periodStart,
    subscriptionExpiresAt: periodEnd,
    lastRenewalPaymentId: newPaymentId,
    lastRenewalDate: now,
    updatedAt: now,
  };

  allTenants[tenantIndex] = updatedTenant;
  saveAllTenants(allTenants);

  // Sync to server
  try {
    fetch(`/api/tenants/${tenantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'active',
        subscriptionStartedAt: periodStart,
        subscriptionExpiresAt: periodEnd,
        lastRenewalPaymentId: newPaymentId,
        lastRenewalDate: now,
      }),
    }).catch(() => {});
  } catch {}

  return {
    success: true,
    periodStart,
    periodEnd,
    tenant: updatedTenant,
  };
}

/**
 * Super Admin: Directly adjust / correct subscription start and end dates for a tenant.
 */
export function updateTenantSubscriptionDates(
  tenantId: string,
  startDate: string,
  endDate: string,
  options: { status?: 'active' | 'inactive'; adminName?: string } = {}
): { success: boolean; error?: string; tenant?: AssociationTenant } {
  const allTenants = getAllTenants();
  const tenantIndex = allTenants.findIndex((t) => t.id === tenantId);

  if (tenantIndex === -1) {
    return { success: false, error: 'الجمعية المحددة غير موجودة في النظام.' };
  }

  const currentTenant = allTenants[tenantIndex];
  const now = new Date().toISOString();

  const updatedTenant: AssociationTenant = {
    ...currentTenant,
    status: options.status || currentTenant.status || 'active',
    subscriptionStartedAt: startDate,
    subscriptionExpiresAt: endDate,
    updatedAt: now,
  };

  allTenants[tenantIndex] = updatedTenant;
  saveAllTenants(allTenants);

  // Sync to server
  try {
    fetch(`/api/tenants/${tenantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionStartedAt: startDate,
        subscriptionExpiresAt: endDate,
        status: updatedTenant.status,
      }),
    }).catch(() => {});
  } catch {}

  return {
    success: true,
    tenant: updatedTenant,
  };
}

/**
 * Helper to fetch all associations that have remaining days <= threshold (default 20 days),
 * including expired ones (remainingDays <= 0).
 */
export function getTenantsRequiringRenewal(thresholdDays: number = 20): Array<{
  tenant: AssociationTenant;
  subInfo: TenantSubscriptionInfo;
}> {
  const allTenants = getAllTenants();
  const result: Array<{ tenant: AssociationTenant; subInfo: TenantSubscriptionInfo }> = [];

  for (const tenant of allTenants) {
    const subInfo = getTenantSubscriptionDetails(tenant);
    // Include if remaining days <= 20 (this includes expired where remainingDays <= 0)
    if (subInfo.remainingDays <= thresholdDays) {
      result.push({ tenant, subInfo });
    }
  }

  // Sort by remaining days ascending (most urgent / expired first)
  result.sort((a, b) => a.subInfo.remainingDays - b.subInfo.remainingDays);
  return result;
}

