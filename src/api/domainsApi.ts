import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, FirestoreOperationType, handleFirestoreError } from '../firebase';
import type {
  DnsRecordItem,
  DomainAuditLogEntry,
  DomainVerificationResult,
  MasterAdminSession,
  PlatformDomainConfig,
} from '../types';

export const HOSTINGER_DEFAULT_NAMESERVERS = [
  'ns1.dns-parking.com',
  'ns2.dns-parking.com',
];

const FIRESTORE_DOMAINS_COLLECTION = 'platform_domains';
const FIRESTORE_AUDIT_COLLECTION = 'domain_audit_logs';

function isSuperAdminSession(session?: MasterAdminSession | null): boolean {
  if (!session || typeof session !== 'object') return false;
  if (session.role === 'secondary_admin') return false;
  return session.isMaster === true || session.role === 'super_admin';
}

function getAuthHeaders(session?: MasterAdminSession | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };
  if (session) {
    headers['x-admin-session'] = encodeURIComponent(JSON.stringify(session));
  }
  return headers;
}

export const OFFICIAL_PLATFORM_DOMAIN = 'youx.ai.studio';
export const OFFICIAL_PLATFORM_URL = 'https://youx.ai.studio';

export function normalizeDomainNameClient(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let clean = raw.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, '');
  clean = clean.split('/')[0].split('?')[0].split('#')[0];
  clean = clean.split(':')[0];
  clean = clean.replace(/\.+$/, '');
  if (clean === 'al-shaif-association.ai.studio' || clean === 'syoumax.org') {
    return OFFICIAL_PLATFORM_DOMAIN;
  }
  return clean;
}

export function isValidDomainNameClient(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(domain);
}

export function normalizeTargetUrlClient(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (
      parsed.hostname.toLowerCase() === 'al-shaif-association.ai.studio' ||
      parsed.hostname.toLowerCase() === 'syoumax.org'
    ) {
      return OFFICIAL_PLATFORM_URL;
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

async function readDomainsFromFirestoreDirect(): Promise<{
  domains: PlatformDomainConfig[];
  auditLogs: DomainAuditLogEntry[];
}> {
  try {
    const [domSnap, logSnap] = await Promise.all([
      getDocs(collection(db, FIRESTORE_DOMAINS_COLLECTION)),
      getDocs(collection(db, FIRESTORE_AUDIT_COLLECTION)),
    ]);

    const domains: PlatformDomainConfig[] = [];
    domSnap.forEach((d) => {
      const data = d.data() as PlatformDomainConfig;
      if (data && data.domainName) {
        domains.push({ ...data, id: data.id || d.id });
      }
    });

    const auditLogs: DomainAuditLogEntry[] = [];
    logSnap.forEach((d) => {
      const data = d.data() as DomainAuditLogEntry;
      if (data && data.timestamp) {
        auditLogs.push({ ...data, id: data.id || d.id });
      }
    });

    domains.sort(
      (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );
    auditLogs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return { domains, auditLogs };
  } catch (err) {
    throw handleFirestoreError(err, FirestoreOperationType.LIST, FIRESTORE_DOMAINS_COLLECTION);
  }
}

async function mirrorDomainToFirestoreClient(
  domain: PlatformDomainConfig,
  auditLogs?: DomainAuditLogEntry[]
): Promise<void> {
  try {
    await setDoc(doc(db, FIRESTORE_DOMAINS_COLLECTION, domain.id), domain, { merge: true });
    if (auditLogs && auditLogs.length > 0) {
      const latest = auditLogs[0];
      if (latest && latest.id) {
        await setDoc(doc(db, FIRESTORE_AUDIT_COLLECTION, latest.id), latest, { merge: true });
      }
    }
  } catch (err) {
    // Throw formatted FirestoreErrorInfo via handleFirestoreError for diagnostics
    const formatted = handleFirestoreError(err, FirestoreOperationType.WRITE, `${FIRESTORE_DOMAINS_COLLECTION}/${domain.id}`);
    console.warn('[DomainsAPI] Client Firestore mirror warning:', formatted.message);
  }
}

export async function fetchPlatformDomains(
  session?: MasterAdminSession | null
): Promise<{
  success: boolean;
  domains: PlatformDomainConfig[];
  auditLogs: DomainAuditLogEntry[];
  error?: string;
}> {
  if (!isSuperAdminSession(session)) {
    return {
      success: false,
      domains: [],
      auditLogs: [],
      error: 'غير مصرح بالوصول: قسم إدارة الدومينات متاح للمدير العام (Super Admin) فقط.',
    };
  }

  try {
    const res = await fetch(`/api/platform-domains?_t=${Date.now()}`, {
      method: 'GET',
      headers: getAuthHeaders(session),
      cache: 'no-store',
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        domains: Array.isArray(data.domains) ? data.domains : [],
        auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs : [],
      };
    }
    return {
      success: false,
      domains: [],
      auditLogs: [],
      error: data.error || 'تعذر جلب إعدادات الدومينات من الخادم.',
    };
  } catch {
    // Fallback direct read from Cloud Firestore if API middleware is momentarily unavailable
    try {
      const fsData = await readDomainsFromFirestoreDirect();
      return {
        success: true,
        domains: fsData.domains,
        auditLogs: fsData.auditLogs,
      };
    } catch (fsErr: any) {
      return {
        success: false,
        domains: [],
        auditLogs: [],
        error: fsErr?.message || 'تعذر الاتصال بقاعدة بيانات Firebase Firestore.',
      };
    }
  }
}

export interface SavePlatformDomainPayload {
  id?: string;
  domainName: string;
  targetUrl: string;
  providerPreset: 'hostinger' | 'custom';
  nameservers: string[];
  dnsRecords: DnsRecordItem[];
  auditAction?: DomainAuditLogEntry['action'];
  auditDetails?: string;
}

export async function savePlatformDomain(
  payload: SavePlatformDomainPayload,
  session?: MasterAdminSession | null
): Promise<{
  success: boolean;
  domain?: PlatformDomainConfig;
  domains?: PlatformDomainConfig[];
  auditLogs?: DomainAuditLogEntry[];
  message?: string;
  error?: string;
}> {
  if (!isSuperAdminSession(session)) {
    return {
      success: false,
      error: 'غير مصرح بالتعديل: يتطلب صلاحية المدير العام (Super Admin).',
    };
  }

  try {
    const res = await fetch('/api/platform-domains', {
      method: 'POST',
      headers: getAuthHeaders(session),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.success && data.domain) {
      // Ensure client Firestore cache stays synchronized immediately
      mirrorDomainToFirestoreClient(data.domain, data.auditLogs).catch(() => {});
      return {
        success: true,
        domain: data.domain,
        domains: data.domains,
        auditLogs: data.auditLogs,
        message: data.message,
      };
    }
    return {
      success: false,
      error: data.error || 'تعذر حفظ إعدادات الدومين.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'حدث خطأ أثناء الاتصال بالخادم لحفظ الدومين.',
    };
  }
}

export async function verifyPlatformDomain(
  domainId: string,
  session?: MasterAdminSession | null
): Promise<{
  success: boolean;
  domain?: PlatformDomainConfig;
  verification?: DomainVerificationResult;
  domains?: PlatformDomainConfig[];
  auditLogs?: DomainAuditLogEntry[];
  error?: string;
}> {
  if (!isSuperAdminSession(session)) {
    return {
      success: false,
      error: 'غير مصرح بالتحقق: يتطلب صلاحية المدير العام (Super Admin).',
    };
  }

  try {
    const res = await fetch(`/api/platform-domains/${encodeURIComponent(domainId)}/verify`, {
      method: 'POST',
      headers: getAuthHeaders(session),
    });
    const data = await res.json();
    if (res.ok && data.success && data.domain) {
      mirrorDomainToFirestoreClient(data.domain, data.auditLogs).catch(() => {});
      return {
        success: true,
        domain: data.domain,
        verification: data.verification,
        domains: data.domains,
        auditLogs: data.auditLogs,
      };
    }
    return {
      success: false,
      error: data.error || 'فشل التحقق الفعلي من إعدادات الدومين.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'تعذر إجراء فحص DNS من الخادم.',
    };
  }
}

export async function deletePlatformDomain(
  domainId: string,
  session?: MasterAdminSession | null
): Promise<{
  success: boolean;
  domains?: PlatformDomainConfig[];
  auditLogs?: DomainAuditLogEntry[];
  message?: string;
  error?: string;
}> {
  if (!isSuperAdminSession(session)) {
    return {
      success: false,
      error: 'غير مصرح بالحذف: يتطلب صلاحية المدير العام (Super Admin).',
    };
  }

  try {
    const res = await fetch(`/api/platform-domains/${encodeURIComponent(domainId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(session),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      deleteDoc(doc(db, FIRESTORE_DOMAINS_COLLECTION, domainId)).catch((err) => {
        handleFirestoreError(err, FirestoreOperationType.DELETE, `${FIRESTORE_DOMAINS_COLLECTION}/${domainId}`);
      });
      return {
        success: true,
        domains: data.domains,
        auditLogs: data.auditLogs,
        message: data.message,
      };
    }
    return {
      success: false,
      error: data.error || 'تعذر حذف الدومين.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'حدث خطأ أثناء حذف الدومين.',
    };
  }
}
