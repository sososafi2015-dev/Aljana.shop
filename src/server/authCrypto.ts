import crypto from 'crypto';

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC_INDIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/**
 * Converts Arabic-Indic and Extended Arabic-Indic numerals to standard ASCII digits (0-9).
 */
export function normalizeDigitsToAscii(input: string): string {
  if (!input) return '';
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const idx1 = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (idx1 !== -1) {
      out += String(idx1);
      continue;
    }
    const idx2 = EXTENDED_ARABIC_INDIC_DIGITS.indexOf(ch);
    if (idx2 !== -1) {
      out += String(idx2);
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Canonical normalization for association admin / member usernames:
 * - trims leading/trailing whitespace
 * - removes leading '@'
 * - converts Arabic-Indic digits to ASCII digits
 * - normalizes Arabic letter variants (أ/إ/آ -> ا, ة -> ه, ى -> ي) and strips diacritics/tatweel
 * - lowercases Latin letters
 * - collapses internal whitespace
 */
export function normalizeLoginUsername(username?: string | null): string {
  if (!username) return '';
  return normalizeDigitsToAscii(String(username))
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates an edited association admin username in Settings.
 */
export function validateSettingsAdminUsername(raw?: string | null): {
  valid: boolean;
  clean: string;
  error?: string;
} {
  const clean = normalizeDigitsToAscii(String(raw || ''))
    .trim()
    .replace(/^@+/, '');

  if (!clean) {
    return {
      valid: false,
      clean: '',
      error: 'يرجى إدخال اسم المستخدم الخاص بحساب إدارة الجمعية.',
    };
  }

  if (clean.length < 3 || clean.length > 64) {
    return {
      valid: false,
      clean,
      error: 'يجب أن يتراوح طول اسم المستخدم بين 3 و 64 حرفاً.',
    };
  }

  if (/\s/.test(clean)) {
    return {
      valid: false,
      clean,
      error: 'لا يمكن أن يحتوي اسم المستخدم على مسافات.',
    };
  }

  const allowedRegex = /^[A-Za-z0-9._\-\u0600-\u06FF]+$/;
  if (!allowedRegex.test(clean)) {
    return {
      valid: false,
      clean,
      error: 'اسم المستخدم يجب أن يحتوي على حروف وأرقام (أو _ - .) فقط دون رموز غير مسموح بها.',
    };
  }

  return { valid: true, clean };
}

export function generateAuthSalt(byteLength = 16): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Computes a strong scrypt password hash with a unique per-account salt.
 * Stored as `scrypt$<128-hex-chars>` for self-identifying verification.
 */
export function hashPasswordScrypt(
  password: string,
  existingSalt?: string
): { hash: string; salt: string } {
  const cleanPass = String(password || '').trim();
  const salt = existingSalt && existingSalt.trim() ? existingSalt.trim() : generateAuthSalt(16);
  const derived = crypto.scryptSync(cleanPass, salt, 64).toString('hex');
  return {
    hash: `scrypt$${derived}`,
    salt,
  };
}

export function hashPasswordLegacySha256(password: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${password}:${salt}:chayef_assoc_salt_secret`)
    .digest('hex');
}

export function legacyClientDjb2Hash(password: string, salt: string): string {
  let hash = 0;
  const str = `${password}:${salt}:chayef_assoc_salt_secret`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

function timingSafeEqualHexOrUtf8(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a plaintext password against a stored password hash in constant time.
 * Supports:
 * - Current standard: `scrypt$<hex>`
 * - Legacy server salted SHA-256 (`${pass}:${salt}:chayef_assoc_salt_secret`)
 * - Legacy raw SHA-256 (`sha256(pass)`)
 * - Legacy `aljana_salt_2025` SHA-256
 * - Legacy client DJB2 32-char hash
 *
 * Returns `{ valid, needsUpgrade }` so legacy hashes can be transparently upgraded to scrypt on login.
 */
export function verifyPasswordHashServer(
  password: string,
  storedHash?: string | null,
  storedSalt?: string | null
): { valid: boolean; needsUpgrade: boolean } {
  const cleanPass = String(password || '').trim();
  const hash = String(storedHash || '').trim();
  const salt = String(storedSalt || '').trim();

  if (!cleanPass || !hash) {
    return { valid: false, needsUpgrade: false };
  }

  // 1. Modern scrypt hash (`scrypt$<hex>`)
  if (hash.startsWith('scrypt$')) {
    if (!salt) return { valid: false, needsUpgrade: false };
    const expectedHex = hash.slice('scrypt$'.length);
    try {
      const derivedHex = crypto.scryptSync(cleanPass, salt, 64).toString('hex');
      const valid = timingSafeEqualHexOrUtf8(derivedHex, expectedHex);
      return { valid, needsUpgrade: false };
    } catch {
      return { valid: false, needsUpgrade: false };
    }
  }

  // 2. Legacy salted SHA-256
  if (salt && timingSafeEqualHexOrUtf8(hashPasswordLegacySha256(cleanPass, salt), hash)) {
    return { valid: true, needsUpgrade: true };
  }

  // 3. Legacy client DJB2 hash
  if (salt && timingSafeEqualHexOrUtf8(legacyClientDjb2Hash(cleanPass, salt), hash)) {
    return { valid: true, needsUpgrade: true };
  }

  // 4. Legacy raw SHA-256 (e.g., seeded template accounts)
  const rawSha = crypto.createHash('sha256').update(cleanPass).digest('hex');
  if (timingSafeEqualHexOrUtf8(rawSha, hash)) {
    return { valid: true, needsUpgrade: true };
  }

  // 5. Legacy aljana_salt_2025 SHA-256
  const aljanaSha = crypto
    .createHash('sha256')
    .update(cleanPass + 'aljana_salt_2025')
    .digest('hex');
  if (timingSafeEqualHexOrUtf8(aljanaSha, hash)) {
    return { valid: true, needsUpgrade: true };
  }

  return { valid: false, needsUpgrade: false };
}

/**
 * Strips all credential material before returning a tenant object over HTTP.
 */
export function sanitizePublicTenant<T extends Record<string, any>>(tenant: T): T {
  if (!tenant || typeof tenant !== 'object') return tenant;
  const clone: Record<string, any> = { ...tenant };
  delete clone.passwordHash;
  delete clone.passwordSalt;
  delete clone.ownerPasswordHash;
  delete clone.ownerPasswordSalt;
  delete clone.plainPassword;
  delete clone.password;
  return clone as T;
}

/**
 * Strips all credential material before returning an owner object over HTTP.
 */
export function sanitizePublicOwner<T extends Record<string, any>>(owner: T): T {
  if (!owner || typeof owner !== 'object') return owner;
  const clone: Record<string, any> = { ...owner };
  delete clone.passwordHash;
  delete clone.passwordSalt;
  delete clone.plainPassword;
  delete clone.password;
  return clone as T;
}

export type AuthTokenRole = 'member' | 'admin' | 'sub_admin' | 'master_super_admin';

export interface AuthSessionPayload {
  role: AuthTokenRole;
  tenantId: string;
  subjectId: string;
  iat: number;
  exp: number;
}

function getServerTokenSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }
  const g = globalThis as Record<string, any>;
  if (!g.__chayefSessionSecret || typeof g.__chayefSessionSecret !== 'string') {
    g.__chayefSessionSecret = crypto.randomBytes(32).toString('hex');
  }
  return g.__chayefSessionSecret;
}

function toBase64Url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64u: string): Buffer {
  const padded = b64u.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64u.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export function signAuthSessionToken(
  claims: { role: AuthTokenRole; tenantId: string; subjectId: string },
  ttlMs: number = 7 * 24 * 60 * 60 * 1000
): string {
  const now = Date.now();
  const payload: AuthSessionPayload = {
    role: claims.role,
    tenantId: String(claims.tenantId || '*').trim() || '*',
    subjectId: String(claims.subjectId || '').trim(),
    iat: now,
    exp: now + ttlMs,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', getServerTokenSecret())
    .update(encodedPayload)
    .digest();
  return `${encodedPayload}.${toBase64Url(sig)}`;
}

export function verifyAuthSessionToken(token?: string | null): AuthSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();
  const dotIdx = trimmed.indexOf('.');
  if (dotIdx <= 0) return null;

  const encodedPayload = trimmed.slice(0, dotIdx);
  const providedSig = trimmed.slice(dotIdx + 1);
  if (!encodedPayload || !providedSig) return null;

  try {
    const expectedSig = toBase64Url(
      crypto.createHmac('sha256', getServerTokenSecret()).update(encodedPayload).digest()
    );
    const bufA = Buffer.from(providedSig, 'utf8');
    const bufB = Buffer.from(expectedSig, 'utf8');
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return null;
    }

    const decoded = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as AuthSessionPayload;
    if (!decoded || typeof decoded !== 'object') return null;
    if (typeof decoded.exp !== 'number' || decoded.exp <= Date.now()) return null;
    if (
      decoded.role !== 'member' &&
      decoded.role !== 'admin' &&
      decoded.role !== 'sub_admin' &&
      decoded.role !== 'master_super_admin'
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function extractBearerTokenFromHeaders(headers: Record<string, any>): string | null {
  const authHeader = headers?.authorization || headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const t = authHeader.slice(7).trim();
    if (t) return t;
  }
  const alt = headers?.['x-auth-token'];
  if (typeof alt === 'string' && alt.trim()) {
    return alt.trim();
  }
  return null;
}
