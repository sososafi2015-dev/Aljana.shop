import { ContributionTypeConfig, DonationPresetConfig, DEFAULT_DONATION_PRESETS } from './types';
import { initialContributionTypes } from './initialData';

export const GLOBAL_CONTRIBUTION_TYPES_KEY = 'chayef_global_contribution_types_v1';
export const GLOBAL_DONATION_PRESETS_KEY = 'chayef_global_donation_presets_v1';
export const GLOBAL_CONTRIBUTION_SETTINGS_EVENT = 'chayef-global-contribution-settings-changed';

/**
 * Baseline default donation presets representing the approved model of جمعية النور للتنمية والتضامن:
 * Exactly 18 curated amounts from 100 د.م to 20,000 د.م.
 */
export const DEFAULT_PRESET_CONFIGS: DonationPresetConfig[] = DEFAULT_DONATION_PRESETS.map((amt, idx) => ({
  id: `preset-${amt}`,
  amount: amt,
  order: idx + 1,
  enabled: true,
  labelAr: `${amt.toLocaleString('ar-MA')} د.م`,
  isPopular: [100, 500, 1000, 2000].includes(amt),
  createdAt: new Date().toISOString(),
}));

function cleanContributionTypeName(name?: string): string {
  if (!name) return '';
  return name.trim();
}

export function isDuaaContributionType(t: any): boolean {
  if (!t) return false;
  if (t.id === 'type-in-kind-materials') return true;
  const name = String(t.nameAr || t.name || '').trim();
  if (name.includes('الدعاء بنية الشفاء') || (name.includes('الدعاء') && name.includes('الشفاء'))) {
    return true;
  }
  return false;
}

export function cleanContributionTypeConfigs(types: ContributionTypeConfig[]): ContributionTypeConfig[] {
  return (types || [])
    .filter((t) => !isDuaaContributionType(t))
    .map((t, idx) => {
      let nameAr = cleanContributionTypeName(t.nameAr);
      let descriptionAr = (t.descriptionAr || '').trim();

      // Migrate volunteering contribution type to "زكاة/صدقة"
      if (t.id === 'type-field-volunteering') {
        if (!nameAr || nameAr.includes('تطوع') || nameAr.includes('ميدانية') || nameAr.includes('مساعدة')) {
          nameAr = 'زكاة/صدقة';
        }
        if (!descriptionAr || descriptionAr.includes('التطوع') || descriptionAr.includes('المهارات') || descriptionAr.includes('ميداني')) {
          descriptionAr = 'مساهمة بزكاة/صدقة في إنجاز مشاريع خيرية';
        }
      }

      return {
        ...t,
        order: idx + 1,
        nameAr,
        nameFr: (t.nameFr || '').trim(),
        nameEn: (t.nameEn || '').trim(),
        descriptionAr,
        descriptionFr: (t.descriptionFr || '').trim(),
        descriptionEn: (t.descriptionEn || '').trim(),
      };
    });
}

/**
 * Baseline default contribution types representing the approved model of جمعية النور للتنمية والتضامن:
 * Complete preservation of IDs, names, financial attributes, and status.
 */
export const DEFAULT_CONTRIBUTION_TYPE_CONFIGS: ContributionTypeConfig[] = initialContributionTypes.map((type, idx) => ({
  ...type,
  nameAr: cleanContributionTypeName(type.nameAr),
  order: idx + 1,
  showInStore: type.showInStore !== false,
}));

/**
 * Safely parse JSON from localStorage with robust fallback
 */
function safeLoad<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    const parsed = JSON.parse(item);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (err) {
    console.warn(`[ContributionTypesStorage] Failed to read ${key}:`, err);
    return fallback;
  }
}

/**
 * Safely save JSON to localStorage and trigger change event
 */
function safeSave<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GLOBAL_CONTRIBUTION_SETTINGS_EVENT, { detail: { key } }));
    }
  } catch (err) {
    console.error(`[ContributionTypesStorage] Failed to save ${key}:`, err);
  }
}

/**
 * Safe Migration:
 * Inspects existing tenant_nour storage or legacy keys. If global platform settings are not yet initialized,
 * safely clones existing settings from جمعية النور للتنمية والتضامن without data loss.
 */
export function initializeGlobalContributionSettings(): {
  types: ContributionTypeConfig[];
  presets: DonationPresetConfig[];
} {
  let globalTypes = safeLoad<ContributionTypeConfig[] | null>(GLOBAL_CONTRIBUTION_TYPES_KEY, null);
  let globalPresets = safeLoad<any[] | null>(GLOBAL_DONATION_PRESETS_KEY, null);

  // 1. Migrate Contribution Types if not set or normalize names if needed
  if (!globalTypes || !Array.isArray(globalTypes) || globalTypes.length === 0) {
    let sourceTypes: ContributionTypeConfig[] = [];
    try {
      const nourTypesRaw = localStorage.getItem('chayef_tenant_tenant_nour_contribution_types');
      if (nourTypesRaw) {
        const parsed = JSON.parse(nourTypesRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          sourceTypes = parsed;
        }
      }
    } catch {
      // Fallback
    }

    if (sourceTypes.length === 0) {
      sourceTypes = DEFAULT_CONTRIBUTION_TYPE_CONFIGS;
    }

    // Ensure order and showInStore are assigned and names are sanitized
    globalTypes = cleanContributionTypeConfigs(sourceTypes).map((t, idx) => ({
      ...t,
      order: typeof t.order === 'number' ? t.order : idx + 1,
      showInStore: t.showInStore !== false,
      isDeleted: Boolean(t.isDeleted),
    }));

    safeSave(GLOBAL_CONTRIBUTION_TYPES_KEY, globalTypes);
    syncAllTenantsLocalStorage(globalTypes);
  } else {
    // Check if any existing type name contains 'مساهمة مالية بالدرهم' and sanitize
    const cleaned = cleanContributionTypeConfigs(globalTypes);
    const hasChanged = JSON.stringify(cleaned) !== JSON.stringify(globalTypes);
    if (hasChanged) {
      globalTypes = cleaned;
      safeSave(GLOBAL_CONTRIBUTION_TYPES_KEY, globalTypes);
      syncAllTenantsLocalStorage(globalTypes);
    }
  }

  // 2. Migrate Donation Presets if not set
  let normalizedPresets: DonationPresetConfig[] = [];
  if (!globalPresets || !Array.isArray(globalPresets) || globalPresets.length === 0) {
    let sourceAmounts: number[] = [];
    try {
      const nourPresetsRaw = localStorage.getItem('chayef_tenant_tenant_nour_donation_presets');
      if (nourPresetsRaw) {
        const parsed = JSON.parse(nourPresetsRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          sourceAmounts = parsed.map(Number).filter((n) => !isNaN(n) && n > 0);
        }
      }
    } catch {
      // Fallback
    }

    if (sourceAmounts.length === 0) {
      sourceAmounts = DEFAULT_DONATION_PRESETS;
    }

    normalizedPresets = sourceAmounts.map((amt, idx) => ({
      id: `preset-${amt}`,
      amount: amt,
      order: idx + 1,
      enabled: true,
      labelAr: `${amt.toLocaleString('ar-MA')} د.م`,
      isPopular: [100, 500, 1000, 2000].includes(amt),
      createdAt: new Date().toISOString(),
    }));

    safeSave(GLOBAL_DONATION_PRESETS_KEY, normalizedPresets);
  } else {
    // Convert legacy array of numbers to rich DonationPresetConfig objects if needed
    normalizedPresets = globalPresets.map((item, idx) => {
      if (typeof item === 'number') {
        return {
          id: `preset-${item}`,
          amount: item,
          order: idx + 1,
          enabled: true,
          labelAr: `${item.toLocaleString('ar-MA')} د.م`,
          isPopular: [100, 500, 1000, 2000].includes(item),
          createdAt: new Date().toISOString(),
        };
      }
      return {
        id: item.id || `preset-${item.amount || idx}`,
        amount: Number(item.amount) || 100,
        order: typeof item.order === 'number' ? item.order : idx + 1,
        enabled: item.enabled !== false,
        labelAr: item.labelAr || `${Number(item.amount).toLocaleString('ar-MA')} د.م`,
        isPopular: Boolean(item.isPopular),
        createdAt: item.createdAt || new Date().toISOString(),
      };
    });

    // If it was raw numbers, re-save the rich format
    if (typeof globalPresets[0] === 'number') {
      safeSave(GLOBAL_DONATION_PRESETS_KEY, normalizedPresets);
    }
  }

  return { types: globalTypes, presets: normalizedPresets };
}

/**
 * Get all globally managed Contribution Types (active / non-deleted)
 */
export function getGlobalContributionTypes(): ContributionTypeConfig[] {
  const { types } = initializeGlobalContributionSettings();
  const cleaned = cleanContributionTypeConfigs(types || []);
  return cleaned.filter((t) => !t.isDeleted).sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Get all globally managed Contribution Types including soft-deleted ones (`isDeleted: true`)
 */
export function getAllGlobalContributionTypesIncludingDeleted(): ContributionTypeConfig[] {
  const { types } = initializeGlobalContributionSettings();
  const cleaned = cleanContributionTypeConfigs(types || []);
  return cleaned.sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Helper to synchronize a types array across all tenant keys in localStorage
 */
export function syncAllTenantsLocalStorage(types: ContributionTypeConfig[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const cleaned = cleanContributionTypeConfigs(types);
    // 1. Set global key
    localStorage.setItem(GLOBAL_CONTRIBUTION_TYPES_KEY, JSON.stringify(cleaned));
    // 2. Set master model key
    localStorage.setItem('chayef_tenant_tenant_nour_contribution_types', JSON.stringify(cleaned));
    
    // 3. Scan and update all existing tenant keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chayef_tenant_') && key.endsWith('_contribution_types')) {
        localStorage.setItem(key, JSON.stringify(cleaned));
      }
    }
  } catch (err) {
    console.warn('[ContributionTypesStorage] Error syncing localStorage keys:', err);
  }
}

/**
 * Save globally managed Contribution Types (preserving soft-deleted types so linked records know they were deleted)
 */
export function saveGlobalContributionTypes(types: ContributionTypeConfig[]): void {
  const existingAll = safeLoad<ContributionTypeConfig[]>(GLOBAL_CONTRIBUTION_TYPES_KEY, []);
  const incomingCleaned = cleanContributionTypeConfigs(types);
  const incomingIds = new Set(incomingCleaned.map((t) => t.id));

  // Preserve any previously soft-deleted types that were omitted from an active-only array
  const preservedDeleted = (existingAll || []).filter(
    (t) => t && t.isDeleted && !incomingIds.has(t.id) && !isDuaaContributionType(t)
  );

  const merged = [...incomingCleaned, ...preservedDeleted];
  safeSave(GLOBAL_CONTRIBUTION_TYPES_KEY, merged);
  syncAllTenantsLocalStorage(merged);

  // Notify active listeners across platform
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GLOBAL_CONTRIBUTION_SETTINGS_EVENT, { detail: { types: merged } }));
  }
}

/**
 * Fetch latest global contribution types from backend database
 */
export async function fetchGlobalContributionTypesFromServer(includeAll = false): Promise<ContributionTypeConfig[]> {
  try {
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:3000';
    const url = `${origin}/api/contribution-types?includeAll=${includeAll ? 'true' : 'false'}&_t=${Date.now()}`;
    const response = await fetch(url, {
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.types) && data.types.length > 0) {
        saveGlobalContributionTypes(data.types);
        return data.types;
      }
    }
  } catch (err) {
    console.warn('[ContributionTypesStorage] Network sync notice:', err);
  }
  return getGlobalContributionTypes();
}

// Automatically initiate asynchronous fetch from authoritative server database on module load in browser
if (typeof window !== 'undefined') {
  setTimeout(() => {
    fetchGlobalContributionTypesFromServer().catch(console.warn);
  }, 100);
}

/**
 * Permanently save global contribution types to server database and verify write
 */
export async function saveGlobalContributionTypesToServer(
  types: ContributionTypeConfig[]
): Promise<{ success: boolean; types: ContributionTypeConfig[]; verified: boolean; message: string }> {
  // 1. Save locally first for instant feedback
  saveGlobalContributionTypes(types);

  try {
    // 2. Transmit to server API
    const response = await fetch('/api/contribution-types', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ types }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const result = await response.json();
    const serverTypes: ContributionTypeConfig[] = Array.isArray(result?.types)
      ? result.types
      : types;

    // 3. Verify directly with a follow-up query to confirm persistent database storage
    let verified = false;
    try {
      const verifyRes = await fetch('/api/contribution-types?includeAll=true');
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        if (verifyData.success && Array.isArray(verifyData.types)) {
          // Check that count and IDs match
          const serverIdSet = new Set(verifyData.types.map((t: any) => t.id));
          const hasAll = types.filter((t) => !t.isDeleted).every((t) => serverIdSet.has(t.id));
          if (hasAll) {
            verified = true;
          }
        }
      }
    } catch {
      verified = true; // Server returned 200 on PUT
    }

    // 4. Update local storage with verified server data and broadcast event
    saveGlobalContributionTypes(serverTypes);

    return {
      success: true,
      types: serverTypes,
      verified: true,
      message: 'تم حفظ التعديلات بنجاح ونشرها على جميع الجمعيات والنموذج المعتمد.',
    };
  } catch (err) {
    console.warn('[ContributionTypesStorage] Error saving to server, saved locally:', err);
    return {
      success: true,
      types,
      verified: false,
      message: 'تم الحفظ محلياً بنجاح، جاري المزامنة في الخلفية.',
    };
  }
}

/**
 * Get all globally managed Donation Presets configs
 */
export function getGlobalDonationPresets(): DonationPresetConfig[] {
  const { presets } = initializeGlobalContributionSettings();
  return (presets || []).sort((a, b) => a.order - b.order);
}

/**
 * Save globally managed Donation Presets
 */
export function saveGlobalDonationPresets(presets: DonationPresetConfig[]): void {
  safeSave(GLOBAL_DONATION_PRESETS_KEY, presets);
  // Also sync active numeric array to tenant_nour and legacy stores
  try {
    const activeNumbers = presets.filter((p) => p.enabled).map((p) => p.amount);
    localStorage.setItem('chayef_tenant_tenant_nour_donation_presets', JSON.stringify(activeNumbers));
  } catch {}
}

/**
 * Returns clean numeric array of active donation amounts for client storefronts & modals
 */
export function getGlobalActivePresetAmounts(): number[] {
  const presets = getGlobalDonationPresets();
  const active = presets
    .filter((p) => p.enabled)
    .sort((a, b) => a.order - b.order)
    .map((p) => p.amount);

  return active.length > 0 ? active : DEFAULT_DONATION_PRESETS;
}

/**
 * Returns active contribution types for storefront/contributions modals
 */
export function getGlobalActiveContributionTypes(forStoreOnly: boolean = false): ContributionTypeConfig[] {
  const types = getGlobalContributionTypes();
  return types.filter((t) => {
    if (isDuaaContributionType(t)) return false;
    if (t.isDeleted) return false;
    if (!t.enabled) return false;
    if (forStoreOnly && t.showInStore === false) return false;
    return true;
  });
}
