const TENANT_TOKEN_PREFIX = 'chayef_auth_token_v1_';
const MASTER_TOKEN_KEY = 'chayef_master_auth_token_v1';

const memoryTenantTokens = new Map<string, string>();
let memoryMasterToken: string | null = null;

function normalizeClientTenant(tenantId?: string | null): string {
  if (!tenantId || tenantId === 'portal') return 'tenant_nour';
  return tenantId.trim();
}

export function setTenantAuthToken(tenantId: string | undefined | null, token?: string | null): void {
  if (!token || typeof token !== 'string' || !token.trim()) return;
  const clean = normalizeClientTenant(tenantId);
  const trimmed = token.trim();
  memoryTenantTokens.set(clean, trimmed);
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    try {
      window.sessionStorage.setItem(`${TENANT_TOKEN_PREFIX}${clean}`, trimmed);
    } catch {}
  }
}

export function getTenantAuthToken(tenantId?: string | null): string | null {
  const clean = normalizeClientTenant(tenantId);
  const mem = memoryTenantTokens.get(clean);
  if (mem) return mem;
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(`${TENANT_TOKEN_PREFIX}${clean}`);
      if (stored && stored.trim()) {
        memoryTenantTokens.set(clean, stored.trim());
        return stored.trim();
      }
    } catch {}
  }
  return null;
}

export function clearTenantAuthToken(tenantId?: string | null): void {
  const clean = normalizeClientTenant(tenantId);
  memoryTenantTokens.delete(clean);
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    try {
      window.sessionStorage.removeItem(`${TENANT_TOKEN_PREFIX}${clean}`);
    } catch {}
  }
}

export function setMasterAuthToken(token?: string | null): void {
  if (!token || typeof token !== 'string' || !token.trim()) return;
  const trimmed = token.trim();
  memoryMasterToken = trimmed;
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    try {
      window.sessionStorage.setItem(MASTER_TOKEN_KEY, trimmed);
    } catch {}
  }
}

export function getMasterAuthToken(): string | null {
  if (memoryMasterToken) return memoryMasterToken;
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(MASTER_TOKEN_KEY);
      if (stored && stored.trim()) {
        memoryMasterToken = stored.trim();
        return memoryMasterToken;
      }
    } catch {}
  }
  return null;
}

export function clearMasterAuthToken(): void {
  memoryMasterToken = null;
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    try {
      window.sessionStorage.removeItem(MASTER_TOKEN_KEY);
    } catch {}
  }
}

export function getEffectiveAuthTokenForTenant(tenantId?: string | null): string | null {
  return getTenantAuthToken(tenantId) || getMasterAuthToken();
}
