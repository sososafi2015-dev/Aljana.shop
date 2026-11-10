import { PlatformSupportSettings, CustomSupportPaymentMethod, SupportDonationRecord } from './types';
import { loadData, saveData } from './storage';

export const PLATFORM_SUPPORT_STORAGE_KEY = 'chayef_platform_support_settings_v1';
export const PLATFORM_SUPPORT_DONATIONS_STORAGE_KEY = 'chayef_platform_support_donations_v1';

export interface SubmitPlatformSupportInput {
  supporterName?: string;
  supporterPhone?: string;
  amount: number;
  currency: string;
  country?: string;
  paymentMethod: string;
  proofDocumentUrl?: string;
  proofFileName?: string;
  cardLast4?: string;
  notes?: string;
  transactionReference?: string;
}

export const defaultPlatformSupportSettings: PlatformSupportSettings = {
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
    additionalInstructions: 'يرجى كتابة «دعم المنصة» في خانة موضوع التحويل البنكي، ثم إرفاق صورة الوصل من المعرض.',
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
    instructions: 'معاملة إلكترونية فورية وآمنة 100% لدعم استمرارية وتطوير syoumax منصة العمل الجمعوي.',
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
  updatedBy: 'الإدارة العامة',
};

/**
 * Returns the current platform support settings from persistent storage.
 */
export function getPlatformSupportSettings(): PlatformSupportSettings {
  const loaded = loadData<PlatformSupportSettings>(PLATFORM_SUPPORT_STORAGE_KEY, defaultPlatformSupportSettings);
  
  // Guarantee all nested keys exist in case of partial cached data
  return {
    ...defaultPlatformSupportSettings,
    ...loaded,
    presetAmountsMad: Array.isArray(loaded.presetAmountsMad) && loaded.presetAmountsMad.length > 0
      ? loaded.presetAmountsMad
      : defaultPlatformSupportSettings.presetAmountsMad,
    presetAmountsUsd: Array.isArray(loaded.presetAmountsUsd) && loaded.presetAmountsUsd.length > 0
      ? loaded.presetAmountsUsd
      : defaultPlatformSupportSettings.presetAmountsUsd,
    allowCustomAmount: typeof loaded.allowCustomAmount === 'boolean' ? loaded.allowCustomAmount : true,
    bankAccount: {
      ...defaultPlatformSupportSettings.bankAccount,
      ...(loaded.bankAccount || {}),
      accountHolder: (loaded.bankAccount?.accountHolder || defaultPlatformSupportSettings.bankAccount.accountHolder)
        .replace(/\byoux\b/gi, 'syoumax')
        .replace(/\bAljana\b/gi, 'syoumax'),
      countriesMode: loaded.bankAccount?.countriesMode || 'all',
      allowedCountries: Array.isArray(loaded.bankAccount?.allowedCountries)
        ? loaded.bankAccount.allowedCountries
        : defaultPlatformSupportSettings.bankAccount.allowedCountries,
    },
    cashPlus: {
      ...defaultPlatformSupportSettings.cashPlus,
      ...(loaded.cashPlus || {}),
      beneficiaryName: (loaded.cashPlus?.beneficiaryName || defaultPlatformSupportSettings.cashPlus.beneficiaryName)
        .replace(/\byoux\b/gi, 'syoumax')
        .replace(/\bAljana\b/gi, 'syoumax'),
      qrCodeEnabled: typeof loaded.cashPlus?.qrCodeEnabled === 'boolean' ? loaded.cashPlus.qrCodeEnabled : false,
      qrCodeUrl: loaded.cashPlus?.qrCodeUrl || '',
      qrCodeFileName: loaded.cashPlus?.qrCodeFileName || '',
      qrCodeInstructions: loaded.cashPlus?.qrCodeInstructions || defaultPlatformSupportSettings.cashPlus.qrCodeInstructions,
      countriesMode: loaded.cashPlus?.countriesMode || 'all',
      allowedCountries: Array.isArray(loaded.cashPlus?.allowedCountries)
        ? loaded.cashPlus.allowedCountries
        : defaultPlatformSupportSettings.cashPlus.allowedCountries,
    },
    creditCard: {
      ...defaultPlatformSupportSettings.creditCard,
      ...(loaded.creditCard || {}),
      instructions: (loaded.creditCard?.instructions || defaultPlatformSupportSettings.creditCard.instructions)
        .replace(/\byoux\b/gi, 'syoumax')
        .replace(/\bAljana\b/gi, 'syoumax'),
      countriesMode: loaded.creditCard?.countriesMode || 'all',
      allowedCountries: Array.isArray(loaded.creditCard?.allowedCountries)
        ? loaded.creditCard.allowedCountries
        : defaultPlatformSupportSettings.creditCard.allowedCountries,
    },
    paypal: {
      ...defaultPlatformSupportSettings.paypal,
      ...(loaded.paypal || {}),
      instructions: (loaded.paypal?.instructions || defaultPlatformSupportSettings.paypal.instructions)
        .replace(/\byoux\b/gi, 'syoumax')
        .replace(/\bAljana\b/gi, 'syoumax'),
      countriesMode: loaded.paypal?.countriesMode || 'all',
      allowedCountries: Array.isArray(loaded.paypal?.allowedCountries)
        ? loaded.paypal.allowedCountries
        : defaultPlatformSupportSettings.paypal.allowedCountries,
    },
    customMethods: Array.isArray(loaded.customMethods)
      ? loaded.customMethods.map((m) => ({
          ...m,
          countriesMode: m.countriesMode || 'all',
          allowedCountries: Array.isArray(m.allowedCountries) ? m.allowedCountries : [],
        }))
      : [],
  };
}

/**
 * Saves and persists platform support settings, broadcasting changes across the app.
 */
export function savePlatformSupportSettings(settings: PlatformSupportSettings, updatedBy = 'الإدارة العامة للمنصة'): void {
  const updated: PlatformSupportSettings = {
    ...settings,
    lastUpdated: new Date().toISOString(),
    updatedBy,
  };

  saveData(PLATFORM_SUPPORT_STORAGE_KEY, updated);

  // Broadcast custom event so the modal and main portal update immediately without manual reload
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('platform-support-settings-updated', { detail: updated }));
  }

  // Sync to backend API if available
  fetch('/api/platform-support/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  }).catch(() => {});
}

// Initial client-side sync from backend permanent database
if (typeof window !== 'undefined') {
  fetch('/api/platform-support/settings')
    .then((res) => {
      if (res.ok) return res.json();
      return null;
    })
    .then((data) => {
      if (data && data.success && data.settings) {
        saveData(PLATFORM_SUPPORT_STORAGE_KEY, data.settings);
        window.dispatchEvent(new CustomEvent('platform-support-settings-updated', { detail: data.settings }));
      }
    })
    .catch(() => {});
}

// ==================== PLATFORM SUPPORT DONATIONS STORAGE & ACCOUNT ====================

/**
 * Returns all platform support donations from persistent local storage.
 * Completely isolated from any association's ledger or balance.
 */
export function getAllPlatformSupportDonations(): SupportDonationRecord[] {
  return loadData<SupportDonationRecord[]>(PLATFORM_SUPPORT_DONATIONS_STORAGE_KEY, []);
}

/**
 * Persists all platform support donations and broadcasts the change.
 */
export function saveAllPlatformSupportDonations(donations: SupportDonationRecord[]): void {
  // Prune oversized data URLs for old history (> 5 items) to prevent local storage quota bloat
  const sanitized = donations.map((d, idx) => {
    if (idx > 4 && d.proofDocumentUrl && d.proofDocumentUrl.startsWith('data:') && d.proofDocumentUrl.length > 50000) {
      return { ...d, proofDocumentUrl: '' };
    }
    return d;
  });

  saveData(PLATFORM_SUPPORT_DONATIONS_STORAGE_KEY, sanitized);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('platform-support-donations-changed', { detail: sanitized }));
  }

  // Sync to backend asynchronously
  fetch('/api/platform-support/donations/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ donations: sanitized }),
  }).catch(() => {});
}

/**
 * Submits a new payment for platform support.
 * Recorded exclusively in the Platform Support Account (حساب دعم وتطوير المنصة).
 */
export async function submitPlatformSupportDonation(
  input: SubmitPlatformSupportInput & { paypalOrderId?: string; verifiedByPayPal?: boolean }
): Promise<{ success: boolean; donation?: SupportDonationRecord; error?: string }> {
  try {
    const isVerifiedPayPal = Boolean(input.verifiedByPayPal && input.paypalOrderId);
    const now = new Date().toISOString();
    const refCode = input.transactionReference || `SUP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const newDonation: SupportDonationRecord = {
      id: `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'platform_support',
      donorName: (input.supporterName && input.supporterName.trim()) || 'فاعل خير / داعم للمنصة',
      donorPhone: (input.supporterPhone && input.supporterPhone.trim()) || undefined,
      donorNote: input.notes?.trim() || undefined,
      amount: Number(input.amount),
      currency: input.currency,
      paidAmount: Number(input.amount),
      paidCurrency: input.currency,
      paymentMethod: input.paymentMethod,
      paypalOrderId: input.paypalOrderId,
      status: isVerifiedPayPal ? 'confirmed' : 'pending',
      mode: 'sandbox',
      createdAt: now,
      submittedAt: now,
      reviewedAt: isVerifiedPayPal ? now : undefined,
      reviewedBy: isVerifiedPayPal ? 'PayPal Verified Gateway' : undefined,
      transactionReference: refCode,
      proofDocumentUrl: input.proofDocumentUrl,
      proofFileName: input.proofFileName,
      cardLast4: input.cardLast4,
      country: input.country || (input.currency === 'MAD' ? 'المغرب' : 'دولي'),
    };

    const existing = getAllPlatformSupportDonations();
    const updated = [newDonation, ...existing];
    saveAllPlatformSupportDonations(updated);

    // Sync to backend endpoint
    fetch('/api/platform-support/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDonation),
    }).catch(() => {});

    return { success: true, donation: newDonation };
  } catch (err: any) {
    return { success: false, error: err?.message || 'تعذر تسجيل مساهمة دعم المنصة.' };
  }
}

/**
 * Super Admin confirms a pending platform support donation (e.g. after verifying receipt).
 */
export async function confirmPlatformSupportDonation(
  id: string,
  adminName: string = 'الإدارة العامة للمنصة'
): Promise<{ success: boolean; error?: string }> {
  const donations = getAllPlatformSupportDonations();
  const idx = donations.findIndex((d) => d.id === id);

  if (idx === -1) {
    return { success: false, error: 'عملية الدعم غير موجودة.' };
  }

  const now = new Date().toISOString();
  donations[idx] = {
    ...donations[idx],
    status: 'confirmed',
    reviewedAt: now,
    reviewedBy: adminName,
  };

  saveAllPlatformSupportDonations(donations);

  fetch(`/api/platform-support/donations/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminName }),
  }).catch(() => {});

  return { success: true };
}

/**
 * Super Admin rejects a pending platform support donation.
 */
export async function rejectPlatformSupportDonation(
  id: string,
  adminName: string = 'الإدارة العامة للمنصة',
  reason: string = 'تعذر التحقق من صحة معلومات الدفع أو الإشعار المرفق.'
): Promise<{ success: boolean; error?: string }> {
  const donations = getAllPlatformSupportDonations();
  const idx = donations.findIndex((d) => d.id === id);

  if (idx === -1) {
    return { success: false, error: 'عملية الدعم غير موجودة.' };
  }

  const now = new Date().toISOString();
  donations[idx] = {
    ...donations[idx],
    status: 'cancelled',
    rejectionReason: reason,
    reviewedAt: now,
    reviewedBy: adminName,
  };

  saveAllPlatformSupportDonations(donations);

  fetch(`/api/platform-support/donations/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminName, reason }),
  }).catch(() => {});

  return { success: true };
}

/**
 * Fetches all platform support donations from server and merges with local storage.
 */
export async function syncPlatformSupportDonationsFromBackend(): Promise<SupportDonationRecord[]> {
  try {
    const res = await fetch('/api/platform-support/donations');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.donations)) {
        const local = getAllPlatformSupportDonations();
        const map = new Map<string, SupportDonationRecord>();

        for (const d of local) {
          if (d && d.id) map.set(d.id, d);
        }

        for (const d of data.donations) {
          if (d && d.id) {
            const existing = map.get(d.id);
            if (!existing) {
              map.set(d.id, d);
            } else {
              map.set(d.id, {
                ...existing,
                ...d,
                status: d.status || existing.status,
                proofDocumentUrl: existing.proofDocumentUrl || d.proofDocumentUrl,
              });
            }
          }
        }

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime()
        );

        saveData(PLATFORM_SUPPORT_DONATIONS_STORAGE_KEY, merged);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('platform-support-donations-changed', { detail: merged }));
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('[platformSupportStorage] syncPlatformSupportDonationsFromBackend failed:', err);
  }
  return getAllPlatformSupportDonations();
}

// Initial client-side sync of platform support donations
if (typeof window !== 'undefined') {
  syncPlatformSupportDonationsFromBackend().catch(() => {});
}

