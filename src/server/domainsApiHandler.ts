import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import tls from 'tls';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import type {
  DnsRecordItem,
  DnsRecordType,
  DomainAuditLogEntry,
  DomainConnectionStatus,
  DomainVerificationResult,
  PlatformDomainConfig,
} from '../types';
import { readLargeJsonBody, sendNoCacheJson, writeJsonFileAtomicSync } from './storageEngine';
import {
  deleteDocFromFirebaseServer,
  listCollectionFromFirebaseServer,
  saveDocToFirebaseServer,
} from './firebaseServerStorage';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'platform_domains_database.json');
const FIRESTORE_DOMAINS_COLLECTION = 'platform_domains';
const FIRESTORE_AUDIT_COLLECTION = 'domain_audit_logs';

export const HOSTINGER_DEFAULT_NAMESERVERS = [
  'ns1.dns-parking.com',
  'ns2.dns-parking.com',
];

interface DomainsDatabaseFile {
  domains: PlatformDomainConfig[];
  auditLogs: DomainAuditLogEntry[];
  updatedAt: string;
}

const VALID_RECORD_TYPES: DnsRecordType[] = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS'];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  sendNoCacheJson(res, statusCode, data);
}

/**
 * Strictly authorizes ONLY Platform Super Admin (`super_admin` / `isMaster: true`).
 * Rejects secondary admins, association admins, members, and unauthenticated requests.
 */
function verifySuperAdminAuth(req: IncomingMessage): { isAuthorized: boolean; adminName: string; reason?: string } {
  try {
    const rawHeader = req.headers['x-admin-session'] || req.headers['authorization'];
    if (!rawHeader) {
      return {
        isAuthorized: false,
        adminName: '',
        reason: 'غير مصرح بالوصول: هذا القسم مخصص للمدير العام (Super Admin) فقط.',
      };
    }

    let session: any = null;
    const rawStr = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    try {
      session = JSON.parse(decodeURIComponent(rawStr));
    } catch {
      try {
        session = JSON.parse(rawStr);
      } catch {
        session = null;
      }
    }

    if (!session || typeof session !== 'object') {
      return {
        isAuthorized: false,
        adminName: '',
        reason: 'جلسة المسؤول غير صالحة.',
      };
    }

    if (session.role === 'secondary_admin') {
      return {
        isAuthorized: false,
        adminName: '',
        reason: 'غير مصرح للأدمن المساعد بالوصول إلى قسم إدارة الدومينات (مخصص لـ Super Admin فقط).',
      };
    }

    const isMasterSuperAdmin =
      session.isMaster === true ||
      session.role === 'super_admin' ||
      session.isMasterPlatformAdmin === true ||
      session.type === 'master_super_admin';

    if (!isMasterSuperAdmin) {
      return {
        isAuthorized: false,
        adminName: '',
        reason: 'غير مصرح بالوصول: يتطلب صلاحية المدير العام (Super Admin).',
      };
    }

    return {
      isAuthorized: true,
      adminName: String(session.fullName || session.username || 'الأدمين الرئيسي (Super Admin)').slice(0, 120),
    };
  } catch {
    return {
      isAuthorized: false,
      adminName: '',
      reason: 'تعذر التحقق من صلاحيات المدير العام.',
    };
  }
}

export const OFFICIAL_PLATFORM_DOMAIN = 'syomax.com';
export const OFFICIAL_PLATFORM_URL = 'https://syomax.com';

export function normalizeDomainName(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let clean = raw.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, '');
  clean = clean.split('/')[0].split('?')[0].split('#')[0];
  clean = clean.split(':')[0];
  clean = clean.replace(/\.+$/, '');
  if (clean.endsWith('.ai.studio') || clean === 'www.syomax.com') {
    return OFFICIAL_PLATFORM_DOMAIN;
  }
  return clean;
}

export function isValidDomainName(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(domain);
}

export function normalizeTargetUrl(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith('.ai.studio') || host === 'www.syomax.com') {
      const pathAndQuery = `${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}${parsed.hash}`;
      return `${OFFICIAL_PLATFORM_URL}${pathAndQuery}`.replace(/\/+$/, '');
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function sanitizeDnsRecords(records: any[]): DnsRecordItem[] {
  if (!Array.isArray(records)) return [];
  const now = new Date().toISOString();
  const result: DnsRecordItem[] = [];
  for (const item of records.slice(0, 100)) {
    if (!item || typeof item !== 'object') continue;
    const type = String(item.type || '').toUpperCase() as DnsRecordType;
    if (!VALID_RECORD_TYPES.includes(type)) continue;
    const host = String(item.host || '@').trim().slice(0, 253) || '@';
    const value = String(item.value || '').trim().slice(0, 1000);
    if (!value) continue;
    const rawTtl = Number(item.ttl);
    const ttl = Number.isFinite(rawTtl) && rawTtl >= 60 && rawTtl <= 604800 ? Math.round(rawTtl) : 3600;
    const rawPriority = item.priority !== undefined && item.priority !== '' && item.priority !== null
      ? Number(item.priority)
      : undefined;
    const priority =
      rawPriority !== undefined && Number.isFinite(rawPriority) && rawPriority >= 0 && rawPriority <= 65535
        ? Math.round(rawPriority)
        : type === 'MX'
        ? 10
        : undefined;

    result.push({
      id: String(item.id || `dns_${crypto.randomBytes(4).toString('hex')}`),
      type,
      host,
      value,
      ttl,
      ...(priority !== undefined ? { priority } : {}),
      createdAt: String(item.createdAt || now),
      updatedAt: String(item.updatedAt || now),
    });
  }
  return result;
}

function sanitizeNameservers(nameservers: any[]): string[] {
  if (!Array.isArray(nameservers)) return [...HOSTINGER_DEFAULT_NAMESERVERS];
  const cleaned = nameservers
    .map((ns) => normalizeDomainName(String(ns || '')))
    .filter((ns) => ns.length > 0 && ns.length <= 253)
    .slice(0, 10);
  return cleaned;
}

function readLocalDomainsDb(): DomainsDatabaseFile {
  ensureDataDir();
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          domains: Array.isArray(parsed.domains) ? parsed.domains : [],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
          updatedAt: String(parsed.updatedAt || new Date().toISOString()),
        };
      }
    }
  } catch (err) {
    console.warn('[DomainsDB] Read disk notice:', err);
  }
  return {
    domains: [],
    auditLogs: [],
    updatedAt: new Date().toISOString(),
  };
}

function writeLocalDomainsDb(db: DomainsDatabaseFile): void {
  ensureDataDir();
  writeJsonFileAtomicSync(DB_FILE, db, 'platform_domains');
}

async function syncDomainsFromFirestoreAndDisk(): Promise<DomainsDatabaseFile> {
  const local = readLocalDomainsDb();
  try {
    const [remoteDomains, remoteLogs] = await Promise.all([
      listCollectionFromFirebaseServer<PlatformDomainConfig>(FIRESTORE_DOMAINS_COLLECTION),
      listCollectionFromFirebaseServer<DomainAuditLogEntry>(FIRESTORE_AUDIT_COLLECTION),
    ]);

    const domainMap = new Map<string, PlatformDomainConfig>();
    for (const d of local.domains) {
      if (d && d.id) domainMap.set(d.id, d);
    }
    for (const d of remoteDomains) {
      if (!d || !d.id || !d.domainName) continue;
      const existing = domainMap.get(d.id);
      if (!existing || new Date(d.updatedAt || 0).getTime() >= new Date(existing.updatedAt || 0).getTime()) {
        domainMap.set(d.id, d);
      }
    }

    const logMap = new Map<string, DomainAuditLogEntry>();
    for (const l of local.auditLogs) {
      if (l && l.id) logMap.set(l.id, l);
    }
    for (const l of remoteLogs) {
      if (l && l.id) logMap.set(l.id, l);
    }

    const mergedDomains = Array.from(domainMap.values()).sort(
      (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );
    const mergedLogs = Array.from(logMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 300);

    const merged: DomainsDatabaseFile = {
      domains: mergedDomains,
      auditLogs: mergedLogs,
      updatedAt: new Date().toISOString(),
    };
    writeLocalDomainsDb(merged);
    return merged;
  } catch (err) {
    console.warn('[DomainsDB] Firestore sync fallback to disk:', err);
    return local;
  }
}

async function persistDomainToFirestoreAndDisk(
  domain: PlatformDomainConfig,
  auditEntry?: DomainAuditLogEntry
): Promise<DomainsDatabaseFile> {
  const db = readLocalDomainsDb();
  const idx = db.domains.findIndex((d) => d.id === domain.id);
  const existingAudit = idx >= 0 && Array.isArray(db.domains[idx].auditLogs) ? db.domains[idx].auditLogs! : [];
  const nextDomainAudit = auditEntry
    ? [auditEntry, ...existingAudit].slice(0, 100)
    : Array.isArray(domain.auditLogs)
    ? domain.auditLogs.slice(0, 100)
    : existingAudit;

  const fullDomain: PlatformDomainConfig = {
    ...domain,
    auditLogs: nextDomainAudit,
  };

  if (idx >= 0) {
    db.domains[idx] = fullDomain;
  } else {
    db.domains.unshift(fullDomain);
  }

  if (auditEntry) {
    db.auditLogs = [auditEntry, ...db.auditLogs].slice(0, 300);
  }
  db.updatedAt = new Date().toISOString();
  writeLocalDomainsDb(db);

  // Persist to Firebase Firestore in parallel
  const saves: Promise<any>[] = [
    saveDocToFirebaseServer(FIRESTORE_DOMAINS_COLLECTION, fullDomain.id, fullDomain),
  ];
  if (auditEntry) {
    saves.push(saveDocToFirebaseServer(FIRESTORE_AUDIT_COLLECTION, auditEntry.id, auditEntry));
  }
  await Promise.all(saves);

  return db;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallbackValue), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

async function probeTlsCertificate(hostname: string, timeoutMs = 5500): Promise<{
  sslEnabled: boolean;
  sslAuthorized: boolean;
  issuer?: string;
  subject?: string;
  validTo?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: {
      sslEnabled: boolean;
      sslAuthorized: boolean;
      issuer?: string;
      subject?: string;
      validTo?: string;
      error?: string;
    }) => {
      if (!settled) {
        settled = true;
        resolve(res);
      }
    };

    try {
      const socket = tls.connect(
        {
          host: hostname,
          port: 443,
          servername: hostname,
          rejectUnauthorized: false,
          timeout: timeoutMs,
        },
        () => {
          try {
            const cert = socket.getPeerCertificate(false);
            const authorized = socket.authorized;
            const authError = socket.authorizationError ? String(socket.authorizationError) : undefined;
            const hasCert = cert && Object.keys(cert).length > 0;
            const validToStr = cert?.valid_to;
            const notExpired = validToStr ? new Date(validToStr).getTime() > Date.now() : false;
            const normalizeCertStr = (v: unknown): string | undefined =>
              Array.isArray(v) ? (v[0] ? String(v[0]) : undefined) : v ? String(v) : undefined;
            const issuer = normalizeCertStr(cert?.issuer?.O) || normalizeCertStr(cert?.issuer?.CN);
            const subject = normalizeCertStr(cert?.subject?.CN);

            socket.end();

            if (hasCert && authorized && notExpired) {
              finish({
                sslEnabled: true,
                sslAuthorized: true,
                issuer,
                subject,
                validTo: validToStr,
              });
            } else {
              finish({
                sslEnabled: false,
                sslAuthorized: Boolean(authorized),
                issuer,
                subject,
                validTo: validToStr,
                error: !hasCert
                  ? 'لم يتم العثور على شهادة SSL صالحة'
                  : !notExpired
                  ? 'شهادة SSL منتهية الصلاحية'
                  : authError || 'شهادة SSL غير موثوقة أو لا تطابق الدومين',
              });
            }
          } catch (e: any) {
            socket.destroy();
            finish({
              sslEnabled: false,
              sslAuthorized: false,
              error: e?.message || 'فشل فحص شهادة SSL',
            });
          }
        }
      );

      socket.setTimeout(timeoutMs, () => {
        socket.destroy();
        finish({
          sslEnabled: false,
          sslAuthorized: false,
          error: 'انتهت مهلة الاتصال بالمنفذ الآمن HTTPS (443)',
        });
      });

      socket.on('error', (err: any) => {
        socket.destroy();
        finish({
          sslEnabled: false,
          sslAuthorized: false,
          error: err?.code || err?.message || 'تعذر الاتصال بالمنفذ 443',
        });
      });
    } catch (err: any) {
      finish({
        sslEnabled: false,
        sslAuthorized: false,
        error: err?.message || 'فشل تهيئة فحص SSL',
      });
    }
  });
}

async function probeHttpReachability(hostname: string, useHttps: boolean, timeoutMs = 5500): Promise<{
  reachable: boolean;
  statusCode: number | null;
  error?: string;
}> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { reachable: boolean; statusCode: number | null; error?: string }) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    try {
      const mod = useHttps ? https : http;
      const req = mod.request(
        {
          hostname,
          port: useHttps ? 443 : 80,
          path: '/',
          method: 'HEAD',
          timeout: timeoutMs,
          headers: {
            Host: hostname,
            'User-Agent': 'PlatformDomainVerifier/1.0',
          },
        },
        (response) => {
          response.resume();
          finish({
            reachable: true,
            statusCode: response.statusCode || 200,
          });
        }
      );

      req.setTimeout(timeoutMs, () => {
        req.destroy();
        finish({ reachable: false, statusCode: null, error: 'انتهت مهلة الاستجابة' });
      });

      req.on('error', (err: any) => {
        req.destroy();
        finish({
          reachable: false,
          statusCode: null,
          error: err?.code || err?.message || 'تعذر الوصول إلى الدومين',
        });
      });

      req.end();
    } catch (err: any) {
      finish({
        reachable: false,
        statusCode: null,
        error: err?.message || 'فشل اختبار الاتصال',
      });
    }
  });
}

async function performRealDomainVerification(domainConfig: PlatformDomainConfig): Promise<DomainVerificationResult> {
  const checkedAt = new Date().toISOString();
  const domain = normalizeDomainName(domainConfig.domainName);
  const issuesAr: string[] = [];

  if (!isValidDomainName(domain)) {
    return {
      checkedAt,
      status: 'dns_error',
      sslEnabled: false,
      targetReachable: false,
      nameserversMatch: false,
      resolvedNameservers: [],
      resolvedARecords: [],
      resolvedAaaaRecords: [],
      resolvedCnameRecords: [],
      resolvedTxtRecords: [],
      resolvedMxRecords: [],
      targetResolvedARecords: [],
      httpStatus: null,
      summaryAr: 'صيغة اسم الدومين غير صالحة. يرجى إدخال اسم دومين صحيح مثل syomax.com.',
      issuesAr: ['اسم الدومين المدخل لا يتوافق مع معايير أسماء النطاقات الصحيحة.'],
    };
  }

  let dnsFatalError = '';
  const safeResolveNs = async () => {
    try {
      return await dns.promises.resolveNs(domain);
    } catch (err: any) {
      if (err?.code === 'ESERVFAIL' || err?.code === 'EREFUSED' || err?.code === 'EFORMERR') {
        dnsFatalError = err.code;
      }
      return [] as string[];
    }
  };
  const safeResolve4 = async (host: string) => {
    try {
      return await dns.promises.resolve4(host);
    } catch (err: any) {
      if (err?.code === 'ESERVFAIL' || err?.code === 'EREFUSED') {
        dnsFatalError = dnsFatalError || err.code;
      }
      return [] as string[];
    }
  };
  const safeResolve6 = async () => {
    try {
      return await dns.promises.resolve6(domain);
    } catch {
      return [] as string[];
    }
  };
  const safeResolveCname = async () => {
    const rootCname = await dns.promises.resolveCname(domain).catch(() => [] as string[]);
    const wwwCname = await dns.promises.resolveCname(`www.${domain}`).catch(() => [] as string[]);
    return Array.from(new Set([...rootCname, ...wwwCname]));
  };
  const safeResolveTxt = async () => {
    try {
      const txt = await dns.promises.resolveTxt(domain);
      return txt.map((chunks) => chunks.join('')).slice(0, 20);
    } catch {
      return [] as string[];
    }
  };
  const safeResolveMx = async () => {
    try {
      const mx = await dns.promises.resolveMx(domain);
      return mx.map((m) => ({ exchange: m.exchange, priority: m.priority })).slice(0, 10);
    } catch {
      return [] as Array<{ exchange: string; priority: number }>;
    }
  };

  let targetHost = '';
  let isLocalTarget = false;
  try {
    const normalizedUrl = normalizeTargetUrl(domainConfig.targetUrl);
    if (normalizedUrl) {
      const u = new URL(normalizedUrl);
      targetHost = u.hostname.toLowerCase();
      isLocalTarget =
        targetHost === 'localhost' ||
        targetHost === '127.0.0.1' ||
        targetHost.endsWith('.local') ||
        targetHost.startsWith('192.168.') ||
        targetHost.startsWith('10.');
    }
  } catch {}

  const [
    resolvedNameserversRaw,
    resolvedARecords,
    resolvedAaaaRecords,
    resolvedCnameRecordsRaw,
    resolvedTxtRecords,
    resolvedMxRecords,
    targetResolvedARecords,
  ] = await Promise.all([
    withTimeout(safeResolveNs(), 5000, [] as string[]),
    withTimeout(safeResolve4(domain), 5000, [] as string[]),
    withTimeout(safeResolve6(), 5000, [] as string[]),
    withTimeout(safeResolveCname(), 5000, [] as string[]),
    withTimeout(safeResolveTxt(), 5000, [] as string[]),
    withTimeout(safeResolveMx(), 5000, [] as Array<{ exchange: string; priority: number }>),
    targetHost && !isLocalTarget
      ? withTimeout(safeResolve4(targetHost), 5000, [] as string[])
      : Promise.resolve([] as string[]),
  ]);

  const resolvedNameservers = resolvedNameserversRaw.map((ns) => normalizeDomainName(ns)).filter(Boolean);
  const resolvedCnameRecords = resolvedCnameRecordsRaw.map((c) => normalizeDomainName(c)).filter(Boolean);

  const configuredNs = (domainConfig.nameservers || [])
    .map((ns) => normalizeDomainName(ns))
    .filter(Boolean);

  const nameserversMatch =
    configuredNs.length > 0 &&
    resolvedNameservers.length > 0 &&
    configuredNs.every((ns) => resolvedNameservers.includes(ns));

  const hasAnyDnsResolution =
    resolvedARecords.length > 0 ||
    resolvedAaaaRecords.length > 0 ||
    resolvedCnameRecords.length > 0;

  // Check alignment with configured A / CNAME records or target URL
  const configuredARecords = (domainConfig.dnsRecords || [])
    .filter((r) => r.type === 'A' && (r.host === '@' || r.host === domain))
    .map((r) => r.value.trim());

  const configuredCnameTargets = (domainConfig.dnsRecords || [])
    .filter((r) => r.type === 'CNAME')
    .map((r) => normalizeDomainName(r.value));

  const ipMatchesTarget =
    targetResolvedARecords.length > 0 &&
    resolvedARecords.some((ip) => targetResolvedARecords.includes(ip));

  const ipMatchesConfiguredA =
    configuredARecords.length > 0 &&
    resolvedARecords.some((ip) => configuredARecords.includes(ip));

  const cnameMatchesTargetOrConfig =
    resolvedCnameRecords.length > 0 &&
    ((targetHost && resolvedCnameRecords.some((c) => c === targetHost || c.endsWith(`.${targetHost}`))) ||
      configuredCnameTargets.some((c) => resolvedCnameRecords.includes(c)));

  // Only probe TLS/HTTP if DNS actually resolves to avoid spurious timeouts
  let tlsCheck: Awaited<ReturnType<typeof probeTlsCertificate>> = {
    sslEnabled: false,
    sslAuthorized: false,
    error: 'لم يبدأ فحص SSL لأن الدومين لم يوجّه بعد إلى عنوان IP صالح.',
  };
  let httpProbe: Awaited<ReturnType<typeof probeHttpReachability>> = {
    reachable: false,
    statusCode: null,
  };

  if (hasAnyDnsResolution) {
    tlsCheck = await probeTlsCertificate(domain, 5500);
    httpProbe = await probeHttpReachability(domain, tlsCheck.sslEnabled, 5500);
    if (!httpProbe.reachable && tlsCheck.sslEnabled) {
      // Fallback HTTP check on port 80 if HTTPS HEAD failed
      httpProbe = await probeHttpReachability(domain, false, 4500);
    }
  }

  // Build transparent diagnostics and authentic status
  if (isLocalTarget) {
    issuesAr.push(
      `عنوان الموقع المستهدف (${domainConfig.targetUrl}) هو رابط تطوير محلي؛ لكي يكتمل الربط الحي على الإنترنت يجب استبداله برابط المنصة الفعلي المنشور.`
    );
  }

  if (configuredNs.length > 0 && resolvedNameservers.length === 0) {
    issuesAr.push('لم تُنشر خوادم الأسماء (Nameservers) بعد في شبكة DNS العالمية.');
  } else if (configuredNs.length > 0 && !nameserversMatch) {
    issuesAr.push(
      `خوادم الأسماء الفعلية الحالية (${resolvedNameservers.join(', ')}) تختلف عن القيم المضبوطة (${configuredNs.join(', ')}).`
    );
  }

  if (!hasAnyDnsResolution) {
    issuesAr.push('لا توجد سجلات A أو AAAA أو CNAME نشطة لهذا الدومين حتى الآن.');
  } else {
    if (targetHost && !isLocalTarget && targetResolvedARecords.length > 0 && !ipMatchesTarget && !cnameMatchesTargetOrConfig) {
      issuesAr.push(
        `عناوين IP الحالية للدومين (${resolvedARecords.join(', ') || 'غير محددة'}) لا تطابق عنوان الموقع المستهدف (${targetResolvedARecords.join(', ')}).`
      );
    }
    if (configuredARecords.length > 0 && !ipMatchesConfiguredA) {
      issuesAr.push(
        `سجل A الفعلي (${resolvedARecords.join(', ') || 'غير موجود'}) لا يطابق سجل A المسجل في الإعدادات (${configuredARecords.join(', ')}).`
      );
    }
  }

  if (!tlsCheck.sslEnabled && tlsCheck.error) {
    issuesAr.push(`حالة SSL: ${tlsCheck.error}`);
  }

  if (hasAnyDnsResolution && !httpProbe.reachable) {
    issuesAr.push(
      `الدومين يحل عنوان DNS لكن الموقع المستهدف لم يستجب عبر HTTP/HTTPS${httpProbe.error ? ` (${httpProbe.error})` : ''}.`
    );
  }

  // Final status classification — strictly honest!
  let status: DomainConnectionStatus = 'pending_dns';
  let summaryAr = '';

  const pointsToConfiguredOrTarget =
    !isLocalTarget &&
    (ipMatchesTarget ||
      cnameMatchesTargetOrConfig ||
      (configuredARecords.length > 0 && ipMatchesConfiguredA && nameserversMatch));

  if (dnsFatalError) {
    status = 'dns_error';
    summaryAr = `تعذر الاستعلام عن DNS للدومين (${dnsFatalError}). يوجد خطأ في إعدادات DNS لدى مزود النطاق.`;
  } else if (!hasAnyDnsResolution && resolvedNameservers.length === 0) {
    status = 'pending_dns';
    summaryAr =
      'الدومين محفوظ داخل المنصة، لكن سجلات DNS لم تنشر بعد أو أن التغييرات في Hostinger ما زالت في مرحلة الانتشار (DNS Propagation).';
  } else if (hasAnyDnsResolution && !isLocalTarget && !pointsToConfiguredOrTarget && (targetResolvedARecords.length > 0 || configuredARecords.length > 0)) {
    status = 'dns_error';
    summaryAr =
      'الدومين يشير حالياً إلى خادم مختلف أو توجد سجلات DNS متعارضة مع الموقع المستهدف وإعدادات المنصة.';
  } else if (hasAnyDnsResolution && httpProbe.reachable && pointsToConfiguredOrTarget && (configuredNs.length === 0 || nameserversMatch || ipMatchesTarget)) {
    status = 'connected';
    summaryAr = tlsCheck.sslEnabled
      ? 'تم التحقق الفعلي من سجلات DNS واستجابة الموقع وشهادة SSL بنجاح — الدومين متصل ويعمل بشكل سليم.'
      : 'تم التحقق الفعلي من توجيه DNS واستجابة الموقع، لكن شهادة SSL غير مفعلة أو غير مكتملة بعد.';
  } else if (resolvedNameservers.length > 0 && !nameserversMatch && !hasAnyDnsResolution) {
    status = 'pending_dns';
    summaryAr =
      'في انتظار تحديث خوادم الأسماء (Nameservers) لدى Hostinger أو اكتمال انتشار DNS خلال 24-48 ساعة.';
  } else if (hasAnyDnsResolution && !httpProbe.reachable) {
    status = 'dns_error';
    summaryAr =
      'تم العثور على سجلات DNS لكن الخادم المستهدف لا يستجيب على الدومين حتى الآن.';
  } else {
    status = 'pending_dns';
    summaryAr = isLocalTarget
      ? 'لا يمكن إتمام التحقق الخارجي الكامل لأن عنوان الموقع المستهدف محلي (localhost). يرجى ضبط رابط المنصة العام ثم إعادة التحقق.'
      : 'في انتظار اكتمال انتشار سجلات DNS وتوجيهها إلى الموقع المستهدف.';
  }

  return {
    checkedAt,
    status,
    sslEnabled: Boolean(tlsCheck.sslEnabled),
    sslIssuer: tlsCheck.issuer,
    sslSubject: tlsCheck.subject,
    sslValidTo: tlsCheck.validTo,
    sslAuthorized: tlsCheck.sslAuthorized,
    sslError: tlsCheck.error,
    httpStatus: httpProbe.statusCode,
    targetReachable: Boolean(httpProbe.reachable),
    nameserversMatch,
    resolvedNameservers,
    resolvedARecords,
    resolvedAaaaRecords,
    resolvedCnameRecords,
    resolvedTxtRecords,
    resolvedMxRecords,
    targetResolvedARecords,
    summaryAr,
    issuesAr,
  };
}

export async function handleDomainsApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  if (!url.startsWith('/api/platform-domains')) {
    return false;
  }

  // Strictly enforce Super Admin authentication on ALL /api/platform-domains routes
  const auth = verifySuperAdminAuth(req);
  if (!auth.isAuthorized) {
    sendJson(res, 403, {
      success: false,
      statusCode: 403,
      error: auth.reason || 'غير مصرح بالوصول إلى إدارة الدومينات (مخصص للمدير العام Super Admin فقط).',
    });
    return true;
  }

  const cleanPath = url.split('?')[0];

  // GET /api/platform-domains
  if (cleanPath === '/api/platform-domains' && req.method === 'GET') {
    const db = await syncDomainsFromFirestoreAndDisk();
    sendJson(res, 200, {
      success: true,
      domains: db.domains,
      auditLogs: db.auditLogs,
      updatedAt: db.updatedAt,
    });
    return true;
  }

  // POST /api/platform-domains (Create or Update domain & DNS records)
  if (cleanPath === '/api/platform-domains' && req.method === 'POST') {
    const body = await readLargeJsonBody(req);
    const domainName = normalizeDomainName(body?.domainName);
    const targetUrl = normalizeTargetUrl(body?.targetUrl);

    if (!isValidDomainName(domainName)) {
      sendJson(res, 400, {
        success: false,
        error: 'يرجى إدخال اسم دومين صحيح مثل syomax.com بدون مسافات أو بروتوكول.',
      });
      return true;
    }

    if (!targetUrl) {
      sendJson(res, 400, {
        success: false,
        error: 'يرجى إدخال عنوان الموقع المستهدف بشكل صحيح (مثال: https://syomax.com).',
      });
      return true;
    }

    const db = await syncDomainsFromFirestoreAndDisk();
    const now = new Date().toISOString();
    const existingById = body?.id ? db.domains.find((d) => d.id === body.id) : undefined;
    const duplicateName = db.domains.find(
      (d) => normalizeDomainName(d.domainName) === domainName && d.id !== body?.id
    );

    if (duplicateName) {
      sendJson(res, 409, {
        success: false,
        error: `الدومين «${domainName}» مسجل بالفعل في النظام.`,
      });
      return true;
    }

    const nameservers = sanitizeNameservers(body?.nameservers);
    if (nameservers.length < 2) {
      sendJson(res, 400, {
        success: false,
        error: 'يجب إدخال خادمي DNS على الأقل (Nameserver 1 و Nameserver 2).',
      });
      return true;
    }

    const dnsRecords = sanitizeDnsRecords(body?.dnsRecords || existingById?.dnsRecords || []);
    const providerPreset = body?.providerPreset === 'custom' ? 'custom' : 'hostinger';

    const actionType: DomainAuditLogEntry['action'] =
      body?.auditAction || (existingById ? 'update' : 'create');
    const actionLabelMap: Record<DomainAuditLogEntry['action'], string> = {
      create: 'إضافة دومين جديد',
      update: 'تحديث إعدادات الدومين و DNS',
      dns_add: 'إضافة سجل DNS جديد',
      dns_update: 'تعديل سجل DNS',
      dns_delete: 'حذف سجل DNS',
      verify: 'التحقق من إعدادات الدومين',
      delete: 'حذف الدومين',
    };

    // Never fabricate "connected" on save — if critical routing settings changed, require fresh real verification
    const routingChanged =
      !existingById ||
      existingById.domainName !== domainName ||
      existingById.targetUrl !== targetUrl ||
      JSON.stringify(existingById.nameservers) !== JSON.stringify(nameservers) ||
      JSON.stringify(existingById.dnsRecords) !== JSON.stringify(dnsRecords);

    const nextStatus: DomainConnectionStatus = routingChanged
      ? 'not_linked'
      : existingById?.status || 'not_linked';

    const nextSsl = routingChanged ? false : Boolean(existingById?.sslEnabled);

    const savedDomain: PlatformDomainConfig = {
      id: existingById?.id || String(body?.id || `dom_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`),
      domainName,
      targetUrl,
      providerPreset,
      nameservers,
      dnsRecords,
      status: nextStatus,
      sslEnabled: nextSsl,
      lastVerification: routingChanged ? null : existingById?.lastVerification || null,
      createdAt: existingById?.createdAt || now,
      updatedAt: now,
      createdBy: existingById?.createdBy || auth.adminName,
      updatedBy: auth.adminName,
    };

    const auditEntry: DomainAuditLogEntry = {
      id: `domlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      domainId: savedDomain.id,
      domainName: savedDomain.domainName,
      action: actionType,
      actionLabelAr: actionLabelMap[actionType] || 'تحديث الدومين',
      details:
        String(body?.auditDetails || '').trim().slice(0, 500) ||
        (existingById
          ? `تم حفظ تعديلات الدومين (${domainName}) وعدد ${dnsRecords.length} سجل DNS و ${nameservers.length} خادم أسماء.`
          : `تم تسجيل الدومين (${domainName}) وربطه مبدئياً بعنوان (${targetUrl}) في قاعدة البيانات.`),
      performedBy: auth.adminName,
      timestamp: now,
    };

    const updatedDb = await persistDomainToFirestoreAndDisk(savedDomain, auditEntry);
    const returnedDomain = updatedDb.domains.find((d) => d.id === savedDomain.id) || savedDomain;

    sendJson(res, existingById ? 200 : 201, {
      success: true,
      domain: returnedDomain,
      domains: updatedDb.domains,
      auditLogs: updatedDb.auditLogs,
      message: existingById
        ? 'تم حفظ إعدادات الدومين وسجلات DNS في Firebase Firestore بنجاح.'
        : 'تم إضافة وحفظ الدومين في Firebase Firestore بنجاح.',
    });
    return true;
  }

  // POST /api/platform-domains/:id/verify -> Real live DNS & TLS verification
  if (cleanPath.startsWith('/api/platform-domains/') && cleanPath.endsWith('/verify') && req.method === 'POST') {
    const id = decodeURIComponent(
      cleanPath.replace('/api/platform-domains/', '').replace('/verify', '')
    ).trim();
    const db = await syncDomainsFromFirestoreAndDisk();
    const targetDomain = db.domains.find((d) => d.id === id);

    if (!targetDomain) {
      sendJson(res, 404, {
        success: false,
        error: 'تعذر العثور على الدومين المطلوب للتحقق.',
      });
      return true;
    }

    const verification = await performRealDomainVerification(targetDomain);
    const now = new Date().toISOString();

    const updatedDomain: PlatformDomainConfig = {
      ...targetDomain,
      status: verification.status,
      sslEnabled: verification.sslEnabled,
      lastVerification: verification,
      updatedAt: now,
      updatedBy: auth.adminName,
    };

    const auditEntry: DomainAuditLogEntry = {
      id: `domlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      domainId: targetDomain.id,
      domainName: targetDomain.domainName,
      action: 'verify',
      actionLabelAr: 'التحقق الفعلي من الدومين و DNS',
      details: `نتيجة الفحص: ${verification.status} | SSL: ${verification.sslEnabled ? 'مفعلة' : 'غير مفعلة'} — ${verification.summaryAr}`,
      performedBy: auth.adminName,
      timestamp: now,
    };

    const updatedDb = await persistDomainToFirestoreAndDisk(updatedDomain, auditEntry);
    const returnedDomain = updatedDb.domains.find((d) => d.id === targetDomain.id) || updatedDomain;

    sendJson(res, 200, {
      success: true,
      domain: returnedDomain,
      verification,
      domains: updatedDb.domains,
      auditLogs: updatedDb.auditLogs,
    });
    return true;
  }

  // DELETE /api/platform-domains/:id
  if (cleanPath.startsWith('/api/platform-domains/') && req.method === 'DELETE') {
    const id = decodeURIComponent(cleanPath.replace('/api/platform-domains/', '')).trim();
    if (!id) {
      sendJson(res, 400, { success: false, error: 'معرف الدومين مطلوب للحذف.' });
      return true;
    }

    const db = await syncDomainsFromFirestoreAndDisk();
    const target = db.domains.find((d) => d.id === id);
    if (!target) {
      sendJson(res, 404, { success: false, error: 'الدومين غير موجود أو تم حذفه مسبقاً.' });
      return true;
    }

    const now = new Date().toISOString();
    const auditEntry: DomainAuditLogEntry = {
      id: `domlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      domainId: target.id,
      domainName: target.domainName,
      action: 'delete',
      actionLabelAr: 'حذف الدومين',
      details: `تم حذف الدومين (${target.domainName}) وإزالة سجلاته من المنصة.`,
      performedBy: auth.adminName,
      timestamp: now,
    };

    db.domains = db.domains.filter((d) => d.id !== id);
    db.auditLogs = [auditEntry, ...db.auditLogs].slice(0, 300);
    db.updatedAt = now;
    writeLocalDomainsDb(db);

    await Promise.all([
      deleteDocFromFirebaseServer(FIRESTORE_DOMAINS_COLLECTION, id),
      saveDocToFirebaseServer(FIRESTORE_AUDIT_COLLECTION, auditEntry.id, auditEntry),
    ]);

    sendJson(res, 200, {
      success: true,
      domains: db.domains,
      auditLogs: db.auditLogs,
      message: `تم حذف الدومين «${target.domainName}» بنجاح.`,
    });
    return true;
  }

  return false;
}
