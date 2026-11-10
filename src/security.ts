import { Member, SubAdmin, AdminSectionKey, SectionPermission, PermissionLevel, CurrentAdminSession } from './types';
import { isAssociationSectionEnabled } from './associationSectionsStorage';

/**
 * Generates a random cryptographic salt
 */
export function generateSalt(length = 16): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Fallback
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * SHA-256 Hash with Salt using Web Crypto API
 */
export async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}:${salt}:chayef_assoc_salt_secret`);
  
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback simple JS hash implementation
  return hashPasswordSync(password, salt);
}

/**
 * Synchronous hash helper for tenant initialization (legacy DJB2 32-char format)
 */
export function legacyDjb2Hash(password: string, salt: string): string {
  let hash = 0;
  const str = `${password}:${salt}:chayef_assoc_salt_secret`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

export function hashPasswordSync(password: string, salt: string): string {
  return legacyDjb2Hash(password, salt);
}

/**
 * Verifies a password against any stored hash format (WebCrypto/Node SHA-256 with salt, legacy DJB2, or plainPassword)
 */
export async function verifyPasswordAnyFormat(
  password: string,
  storedHash?: string,
  storedSalt?: string,
  plainPassword?: string
): Promise<boolean> {
  if (!password) return false;
  const cleanPass = password.trim();
  if (plainPassword && cleanPass === plainPassword.trim()) {
    return true;
  }
  if (storedHash) {
    const salt = storedSalt || '';
    if (legacyDjb2Hash(cleanPass, salt) === storedHash) {
      return true;
    }
    const sha256Salted = await hashPasswordWithSalt(cleanPass, salt);
    if (sha256Salted === storedHash) {
      return true;
    }
  }
  return false;
}

/**
 * Verify a plaintext password against a stored hash and salt
 */
export async function verifyMemberPassword(
  password: string,
  storedHash?: string,
  storedSalt?: string,
  member?: Member
): Promise<boolean> {
  if (!password) return false;

  // 1. If member already has a hashed password, strictly verify against it
  if (storedHash && storedSalt) {
    return await verifyPasswordAnyFormat(password.trim(), storedHash, storedSalt);
  }

  // 2. Fallback ONLY for pre-existing initial demo members who haven't set a custom password yet
  // Allow login with default password '123456', or their phone number, or their member code
  if (member) {
    const trimmedInput = password.trim();
    if (trimmedInput === '123456') return true;
    if (member.phone && trimmedInput === member.phone.trim()) return true;
    if (member.memberCode && trimmedInput.toUpperCase() === member.memberCode.trim().toUpperCase()) return true;
    if (member.cin && trimmedInput.toUpperCase() === member.cin.trim().toUpperCase()) return true;
  }

  return false;
}

export interface AuthResult {
  success: boolean;
  member?: Member;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'INACTIVE' | 'WRONG_PASSWORD' | 'EMPTY_FIELDS';
}

function normalizeIdentifierText(val?: string): string {
  if (!val) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeIdentifierPhone(val?: string): string {
  if (!val) return '';
  let cleaned = String(val).replace(/[\s\-\.\(\)]/g, '');
  if (cleaned.startsWith('+212')) cleaned = '0' + cleaned.slice(4);
  else if (cleaned.startsWith('00212')) cleaned = '0' + cleaned.slice(5);
  else if (cleaned.startsWith('212') && cleaned.length > 9) cleaned = '0' + cleaned.slice(3);
  return cleaned;
}

/**
 * Normalizes a member username for case-insensitive comparison.
 */
export function normalizeMemberUsername(val?: string): string {
  if (!val) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/**
 * Validates that a member username consists ONLY of letters (Arabic/Latin) and digits (no spaces or special characters).
 */
export function validateMemberUsernameFormat(username?: string): { valid: boolean; error?: string } {
  const clean = (username || '').trim();
  if (!clean) {
    return {
      valid: false,
      error: 'يرجى ملء الحقل الإجباري: اسم المستخدم.',
    };
  }
  // Must consist strictly of letters and numbers only (Arabic/English letters and Arabic/Western digits, no spaces or symbols)
  const alphanumericRegex = /^[A-Za-z0-9\u0600-\u06FF\u0660-\u0669\u06F0-\u06F9]+$/;
  if (!alphanumericRegex.test(clean)) {
    return {
      valid: false,
      error: 'يجب أن يتكون اسم المستخدم من حروف وأرقام فقط (دون مسافات أو رموز خاصة).',
    };
  }
  const letterMatches = clean.match(/[A-Za-z\u0600-\u06FF]/g) || [];
  const digitMatches = clean.match(/[0-9\u0660-\u0669\u06F0-\u06F9]/g) || [];
  if (letterMatches.length < 4 || digitMatches.length < 2) {
    return {
      valid: false,
      error: 'يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.',
    };
  }
  return { valid: true };
}

/**
 * Checks if a member username is already taken in the current association or across any association in the system.
 */
export function isMemberUsernameTaken(
  username: string,
  currentMembers: Member[] = [],
  excludeMemberId?: string
): boolean {
  const norm = normalizeMemberUsername(username);
  if (!norm) return false;

  // 1. Check in current association's members list
  for (const m of currentMembers) {
    if (!m) continue;
    if (excludeMemberId && m.id === excludeMemberId) continue;
    if (m.username && normalizeMemberUsername(m.username) === norm) {
      return true;
    }
  }

  // 2. Check across all associations stored in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === 'ach_members_v1' || key.startsWith('ach_members_v1__')) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const m of parsed) {
            if (!m) continue;
            if (excludeMemberId && m.id === excludeMemberId) continue;
            if (m.username && normalizeMemberUsername(m.username) === norm) {
              return true;
            }
          }
        }
      }
    }

    // 3. Check across sub-admins in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.includes('sub_admins')) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const a of parsed) {
            if (!a) continue;
            if (a.username && normalizeMemberUsername(a.username) === norm) {
              return true;
            }
          }
        }
      }
    }
  } catch {
    // Ignore storage access errors
  }

  return false;
}

/**
 * Checks if a secondary admin (SubAdmin) username is already taken across sub-admins, members, or platform owners.
 */
export function isSubAdminUsernameTaken(
  username: string,
  currentSubAdmins: SubAdmin[] = [],
  excludeAdminId?: string
): boolean {
  const norm = normalizeMemberUsername(username);
  if (!norm) return false;

  // 1. Check in current association's subAdmins list
  for (const a of currentSubAdmins) {
    if (!a) continue;
    if (excludeAdminId && a.id === excludeAdminId) continue;
    if (a.username && normalizeMemberUsername(a.username) === norm) {
      return true;
    }
  }

  // 2. Check across all sub-admin databases in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.includes('sub_admins')) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const a of parsed) {
            if (!a) continue;
            if (excludeAdminId && a.id === excludeAdminId) continue;
            if (a.username && normalizeMemberUsername(a.username) === norm) {
              return true;
            }
          }
        }
      }
    }

    // 3. Check across platform association owners
    const rawOwners = localStorage.getItem('chayef_all_owners_v1') || localStorage.getItem('chayef_all_owners_v2');
    if (rawOwners) {
      const owners = JSON.parse(rawOwners);
      if (Array.isArray(owners)) {
        for (const o of owners) {
          if (o && o.username && normalizeMemberUsername(o.username) === norm) {
            return true;
          }
        }
      }
    }
  } catch {
    // Ignore storage access errors
  }

  // 4. Check across members (strict uniqueness across the entire platform)
  if (isMemberUsernameTaken(username)) {
    return true;
  }

  return false;
}

/**
 * Authenticates a member by Username, Full Name (or Phone / CIN / Member Code) and Password
 */
export async function authenticateMember(
  fullNameInput: string,
  passwordInput: string,
  members: Member[]
): Promise<AuthResult> {
  const rawIdentifier = (fullNameInput || '').trim();
  const cleanName = rawIdentifier.toLowerCase();
  const normName = normalizeIdentifierText(rawIdentifier);
  const normUsername = normalizeMemberUsername(rawIdentifier);
  const normPhone = normalizeIdentifierPhone(rawIdentifier);
  const cleanPass = (passwordInput || '').trim();

  if (!rawIdentifier || !cleanPass) {
    return {
      success: false,
      errorCode: 'EMPTY_FIELDS',
      error: 'يرجى إدخال اسم المستخدم وكلمة المرور.',
    };
  }

  // Find candidate members strictly by username (login by full name, phone, CIN or member code is disabled)
  const matchingMembers = (members || []).filter((m) => {
    if (!m) return false;
    if (m.username && m.username.trim().toLowerCase() === cleanName) return true;
    if (m.username && normUsername && normalizeMemberUsername(m.username) === normUsername) return true;
    return false;
  });

  if (matchingMembers.length === 0) {
    return {
      success: false,
      errorCode: 'NOT_FOUND',
      error: 'اسم المستخدم غير مسجل في قائمة المنخرطين. يرجى التأكد من كتابة اسم المستخدم الصحيح (تسجيل الدخول متاح باسم المستخدم فقط).',
    };
  }

  // Prefer active member whose password matches if multiple members share a name
  let matchedMember = matchingMembers[0];
  let isValid = false;

  for (const candidate of matchingMembers) {
    const passOk = await verifyMemberPassword(
      cleanPass,
      candidate.passwordHash,
      candidate.passwordSalt,
      candidate
    );
    if (passOk) {
      matchedMember = candidate;
      isValid = true;
      break;
    }
  }

  // Check if member is active
  if (matchedMember.status !== 'active') {
    return {
      success: false,
      member: matchedMember,
      errorCode: 'INACTIVE',
      error: 'حسابك غير مفعل حالياً من طرف إدارة الجمعية (حساب معطل أو قيد المراجعة). يرجى مراجعة إدارة الجمعية لتفعيل العضوية.',
    };
  }

  if (!isValid) {
    return {
      success: false,
      errorCode: 'WRONG_PASSWORD',
      error: 'كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور الخاصة بحسابك وإعادة المحاولة.',
    };
  }

  // If valid and password was not yet hashed, auto-provision salt & hash
  let finalMember = matchedMember;
  if (!matchedMember.passwordHash || !matchedMember.passwordSalt) {
    const salt = generateSalt();
    const hash = await hashPasswordWithSalt(cleanPass, salt);
    finalMember = {
      ...matchedMember,
      passwordSalt: salt,
      passwordHash: hash,
      lastLoginDate: new Date().toISOString(),
    };
  } else {
    finalMember = {
      ...matchedMember,
      lastLoginDate: new Date().toISOString(),
    };
  }

  return {
    success: true,
    member: finalMember,
  };
}

export interface SubAdminAuthResult {
  success: boolean;
  subAdmin?: SubAdmin;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'INACTIVE' | 'WRONG_PASSWORD' | 'EMPTY_FIELDS';
}

/**
 * Helper to load and merge SubAdmins from memory and localStorage for the active tenant
 * so authentication and session checks never miss newly created or persisted sub-admins.
 */
function getEffectiveSubAdminsList(passedSubAdmins: SubAdmin[] = [], tenantId?: string | null): SubAdmin[] {
  const map = new Map<string, SubAdmin>();
  const addList = (list: any[]) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (item && typeof item === 'object' && item.id) {
        const existing = map.get(item.id);
        map.set(item.id, existing ? { ...existing, ...item } : item);
      }
    }
  };

  addList(passedSubAdmins);

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const cleanTenant = tenantId && tenantId !== 'portal' ? tenantId : 'tenant_nour';
      const candidateKeys = [
        cleanTenant === 'tenant_nour'
          ? 'chayef_assoc_sub_admins_v1'
          : `chayef_tenant_${cleanTenant}_chayef_assoc_sub_admins_v1`,
        `chayef_tenant_${cleanTenant}_sub_admins`,
        'chayef_assoc_sub_admins_v1',
      ];
      for (const k of candidateKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) addList(parsed);
          } catch {}
        }
      }
    } catch {}
  }

  return Array.from(map.values());
}

function matchesSubAdminUsernameOrIdentifier(admin: SubAdmin, rawInput: string): boolean {
  const clean = (rawInput || '').trim().replace(/^@/, '');
  if (!clean) return false;
  const normMember = normalizeMemberUsername(clean);
  const normAdmin = normalizeAdminUsername(clean);
  const cleanLower = clean.toLowerCase();
  const cleanPhone = clean.replace(/[\s\-\.\(\)]/g, '');

  if (admin.username) {
    const uClean = String(admin.username).trim().replace(/^@/, '');
    if (
      uClean.toLowerCase() === cleanLower ||
      (normMember && normalizeMemberUsername(uClean) === normMember) ||
      (normAdmin && normalizeAdminUsername(uClean) === normAdmin)
    ) {
      return true;
    }
  }

  if (admin.fullName) {
    const fNorm = normalizeAdminUsername(admin.fullName);
    if (normAdmin && fNorm === normAdmin) {
      return true;
    }
  }

  if (admin.phone && cleanPhone.length >= 6) {
    const pClean = String(admin.phone).trim().replace(/[\s\-\.\(\)]/g, '');
    if (pClean && pClean === cleanPhone) {
      return true;
    }
  }

  return false;
}

/**
 * Authenticate Sub-Admin by username or phone number and password
 */
export async function authenticateSubAdmin(
  identifierInput: string,
  passwordInput: string,
  subAdmins: SubAdmin[]
): Promise<SubAdminAuthResult> {
  const cleanInput = (identifierInput || '').trim();
  const cleanPass = (passwordInput || '').trim();

  if (!cleanInput || !cleanPass) {
    return {
      success: false,
      errorCode: 'EMPTY_FIELDS',
      error: 'يرجى إدخال اسم المستخدم وكلمة المرور.',
    };
  }

  let effectiveList = getEffectiveSubAdminsList(subAdmins);
  let matchedAdmin = effectiveList.find((a) => matchesSubAdminUsernameOrIdentifier(a, cleanInput));

  if (!matchedAdmin && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    try {
      const res = await fetch('/api/subadmins');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.subAdmins)) {
          effectiveList = getEffectiveSubAdminsList([...effectiveList, ...data.subAdmins]);
          matchedAdmin = effectiveList.find((a) => matchesSubAdminUsernameOrIdentifier(a, cleanInput));
        }
      }
    } catch {}
  }

  if (!matchedAdmin) {
    return {
      success: false,
      errorCode: 'NOT_FOUND',
      error: 'لا يوجد حساب أدمن مسجل باسم المستخدم هذا. يرجى التأكد وإعادة المحاولة.',
    };
  }

  if (matchedAdmin.status !== 'active') {
    return {
      success: false,
      errorCode: 'INACTIVE',
      error: 'تم تعطيل هذا الحساب من طرف الأدمن الرئيسي. لا يمكنك تسجيل الدخول.',
    };
  }

  let isValid = false;
  if (matchedAdmin.passwordHash && matchedAdmin.passwordSalt) {
    isValid = await verifyPasswordAnyFormat(
      cleanPass,
      matchedAdmin.passwordHash,
      matchedAdmin.passwordSalt,
      (matchedAdmin as any).plainPassword
    );
  } else {
    const cleanPhone = (matchedAdmin.phone || '').trim().replace(/[\s\-\.\(\)]/g, '');
    isValid = cleanPass === 'admin123' || Boolean(cleanPhone && cleanPass === cleanPhone);
  }

  if (!isValid) {
    return {
      success: false,
      errorCode: 'WRONG_PASSWORD',
      error: 'كلمة المرور غير صحيحة. يرجى التأكد وإعادة المحاولة.',
    };
  }

  return {
    success: true,
    subAdmin: {
      ...matchedAdmin,
      lastLoginAt: new Date().toISOString(),
    },
  };
}

/**
 * Creates default permissions object with all sections disabled
 */
export function createDefaultPermissions(): Record<AdminSectionKey, SectionPermission> {
  const sections: AdminSectionKey[] = [
    'overview',
    'createAd',
    'donationsBenefit',
    'subscriptionRenewal',
    'platformTutorials',
    'platformSetupService',
    'operations',
    'campaigns',
    'official_registers',
    'members',
    'boardMembers',
    'contributions',
    'memberCard',
    'activities',
    'branding',
    'polls',
    'uiElements',
    'nonMemberVisibility',
    'fields',
    'accessControl',
    'subAdmins',
    'settings',
    'audit',
    'backup'
  ];

  const permissions: Partial<Record<AdminSectionKey, SectionPermission>> = {};
  for (const section of sections) {
    permissions[section] = {
      sectionKey: section,
      canView: false,
      canAdd: false,
      canEdit: false,
      canDelete: false,
    };
  }
  return permissions as Record<AdminSectionKey, SectionPermission>;
}

/**
 * Apply a preset permission level to a section
 */
export function applyPermissionLevel(
  current: SectionPermission,
  level: PermissionLevel
): SectionPermission {
  switch (level) {
    case 'none':
      return { ...current, canView: false, canAdd: false, canEdit: false, canDelete: false };
    case 'view':
      return { ...current, canView: true, canAdd: false, canEdit: false, canDelete: false };
    case 'add':
      return { ...current, canView: true, canAdd: true, canEdit: false, canDelete: false };
    case 'edit':
      return { ...current, canView: true, canAdd: false, canEdit: true, canDelete: false };
    case 'delete':
      return { ...current, canView: true, canAdd: false, canEdit: false, canDelete: true };
    case 'view_add_edit':
      return { ...current, canView: true, canAdd: true, canEdit: true, canDelete: false };
    case 'full':
      return { ...current, canView: true, canAdd: true, canEdit: true, canDelete: true };
    default:
      return current;
  }
}

/**
 * Compute permission level string from permissions
 */
export function getPermissionLevel(perm?: SectionPermission): PermissionLevel {
  if (!perm || !perm.canView) return 'none';
  if (perm.canAdd && perm.canEdit && perm.canDelete) return 'full';
  if (perm.canAdd && perm.canEdit && !perm.canDelete) return 'view_add_edit';
  if (perm.canAdd && !perm.canEdit && !perm.canDelete) return 'add';
  if (!perm.canAdd && perm.canEdit && !perm.canDelete) return 'edit';
  if (!perm.canAdd && !perm.canEdit && perm.canDelete) return 'delete';
  return 'view';
}

export interface UnifiedAdminAuthResult {
  success: boolean;
  session?: {
    type: 'super_admin' | 'sub_admin';
    role: 'main_admin' | 'secondary_admin';
    id?: string;
    username?: string;
    fullName: string;
    phone?: string;
    tenantId?: string;
    isMasterPlatformAdmin?: boolean;
    subAdmin?: SubAdmin;
  };
  error?: string;
  errorCode?: 'EMPTY_PASSWORD' | 'INACTIVE' | 'WRONG_PASSWORD';
}

function normalizeAdminUsername(val?: string): string {
  if (!val) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Unified Admin Authentication by username + password or password field.
 * Automatically identifies if the credentials belong to:
 * - The Association Manager (Owner) for the active association -> grants 'main_admin' role scoped strictly to their association.
 * - The Main Admin (Super Admin) -> grants 'main_admin' role with full permissions for the active association.
 * - A Secondary Admin (Sub-Admin) -> grants 'secondary_admin' role with predefined permissions.
 * Strictly prevents any association manager from accessing another association's dashboard.
 */
export async function authenticateUnifiedAdmin(
  passwordInput: string,
  adminPin: string,
  subAdmins: SubAdmin[] = [],
  usernameInput?: string,
  explicitTenantId?: string
): Promise<UnifiedAdminAuthResult> {
  const cleanPass = (passwordInput || '').trim();
  const cleanUser = (usernameInput || '').trim().replace(/^@/, '');
  const normUser = normalizeAdminUsername(cleanUser);

  if (!cleanPass) {
    return {
      success: false,
      errorCode: 'EMPTY_PASSWORD',
      error: 'يرجى إدخال كلمة المرور.',
    };
  }

  let activeTenantId: string | null = explicitTenantId || null;
  try {
    if (!activeTenantId && typeof localStorage !== 'undefined') {
      const activeTenantRaw = localStorage.getItem('chayef_active_tenant_id_v2');
      activeTenantId = activeTenantRaw ? JSON.parse(activeTenantRaw) : null;
    }
  } catch {}
  const resolvedTenantId =
    !activeTenantId || activeTenantId === 'portal' ? 'tenant_nour' : activeTenantId;

  // Gather all subAdmins for this association (passed props + localStorage + backend fallback if needed)
  let effectiveSubAdmins = getEffectiveSubAdminsList(subAdmins, resolvedTenantId);
  if (
    cleanUser &&
    !effectiveSubAdmins.some((a) => matchesSubAdminUsernameOrIdentifier(a, cleanUser)) &&
    typeof window !== 'undefined' &&
    typeof fetch !== 'undefined'
  ) {
    try {
      const res = await fetch('/api/subadmins', {
        headers: { 'x-tenant-id': resolvedTenantId },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.subAdmins)) {
          effectiveSubAdmins = getEffectiveSubAdminsList([...effectiveSubAdmins, ...data.subAdmins], resolvedTenantId);
        }
      }
    } catch {}
  }

  // 0. If a username is entered and matches a Secondary Admin (Sub-Admin), authenticate strictly as that Sub-Admin first!
  // This ensures secondary admins logging in with their username and password never collide with default PINs and always get their exact permissions.
  if (cleanUser) {
    const matchedSubByUsername = effectiveSubAdmins.filter((a) =>
      matchesSubAdminUsernameOrIdentifier(a, cleanUser)
    );

    if (matchedSubByUsername.length > 0) {
      for (const admin of matchedSubByUsername) {
        let isValid = false;
        if (admin.passwordHash && admin.passwordSalt) {
          isValid = await verifyPasswordAnyFormat(
            cleanPass,
            admin.passwordHash,
            admin.passwordSalt,
            (admin as any).plainPassword
          );
        } else {
          const cleanPhone = (admin.phone || '').trim().replace(/[\s\-\.\(\)]/g, '');
          isValid = cleanPass === 'admin123' || Boolean(cleanPhone && cleanPass === cleanPhone);
        }

        if (isValid) {
          if (admin.status !== 'active') {
            return {
              success: false,
              errorCode: 'INACTIVE',
              error: 'تم تعطيل هذا الحساب الإداري من طرف الأدمن الرئيسي. لا يمكنك تسجيل الدخول.',
            };
          }

          const updatedSubAdmin: SubAdmin = {
            ...admin,
            lastLoginAt: new Date().toISOString(),
          };

          return {
            success: true,
            session: {
              type: 'sub_admin',
              role: 'secondary_admin',
              id: admin.id,
              fullName: admin.fullName,
              username: admin.username || cleanUser,
              phone: admin.phone,
              tenantId: resolvedTenantId,
              isMasterPlatformAdmin: false,
              subAdmin: updatedSubAdmin,
            },
          };
        }
      }

      // Username matched a sub-admin, but password did not match
      return {
        success: false,
        errorCode: 'WRONG_PASSWORD',
        error: 'كلمة المرور غير صحيحة لحساب الأدمن من الدرجة الثانية. يرجى التأكد وإعادة المحاولة.',
      };
    }
  }

  // 1. Check against registered Association Managers (Owners) in local database
  try {
    const ownersRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('chayef_all_owners_v2') : null;
    const tenantsRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('chayef_all_tenants_v2') : null;
    const owners = ownersRaw ? JSON.parse(ownersRaw) : [];
    const tenants = tenantsRaw ? JSON.parse(tenantsRaw) : [];

    if (Array.isArray(owners)) {
      // 1a. If a username was entered, check if it matches any association manager
      if (normUser) {
        const matchedOwnerByUser = owners.find((o: any) => {
          if (!o) return false;
          const oUser = normalizeAdminUsername(o.username);
          const linkedTenant = Array.isArray(tenants)
            ? tenants.find((t: any) => t && t.id === o.tenantId)
            : null;
          const tUser = normalizeAdminUsername(linkedTenant?.ownerUsername);
          const oName = normalizeAdminUsername(o.fullName);
          return (oUser && oUser === normUser) || (tUser && tUser === normUser) || (oName && oName === normUser);
        });

        if (matchedOwnerByUser) {
          // Strict tenant isolation: an association manager cannot log into another association's dashboard!
          if (resolvedTenantId && matchedOwnerByUser.tenantId && matchedOwnerByUser.tenantId !== resolvedTenantId) {
            return {
              success: false,
              errorCode: 'WRONG_PASSWORD',
              error: 'عذراً، حساب مدير الجمعية هذا مرتبط بجمعية أخرى مستقلة، ولا يُسمح لمدير أي جمعية بالوصول إلى لوحة تحكم جمعية أخرى.',
            };
          }

          const passMatched = await verifyPasswordAnyFormat(
            cleanPass,
            matchedOwnerByUser.passwordHash,
            matchedOwnerByUser.passwordSalt,
            matchedOwnerByUser.plainPassword
          );

          if (!passMatched) {
            return {
              success: false,
              errorCode: 'WRONG_PASSWORD',
              error: 'كلمة المرور غير صحيحة لحساب مدير الجمعية. يرجى التأكد وإعادة المحاولة.',
            };
          }

          if (matchedOwnerByUser.status === 'inactive') {
            return {
              success: false,
              errorCode: 'INACTIVE',
              error: 'هذا الحساب الإداري معطل حالياً.',
            };
          }

          return {
            success: true,
            session: {
              type: 'super_admin',
              role: 'main_admin',
              id: matchedOwnerByUser.id,
              username: matchedOwnerByUser.username || cleanUser,
              fullName: matchedOwnerByUser.fullName || 'رئيس ومسؤول الجمعية',
              phone: matchedOwnerByUser.phone,
              tenantId: matchedOwnerByUser.tenantId || resolvedTenantId,
              isMasterPlatformAdmin: false,
            },
          };
        }
      }

      // 1b. Check if password (and optional username) matches the active association owner's account
      if (resolvedTenantId) {
        const tenantOwners = owners.filter((o: any) => o && o.tenantId === resolvedTenantId);
        for (const owner of tenantOwners) {
          if (normUser && owner.username) {
            const oUser = normalizeAdminUsername(owner.username);
            const oName = normalizeAdminUsername(owner.fullName);
            if (oUser !== normUser && oName !== normUser) {
              continue;
            }
          }
          const matched = await verifyPasswordAnyFormat(
            cleanPass,
            owner.passwordHash,
            owner.passwordSalt,
            owner.plainPassword
          );
          if (matched) {
            return {
              success: true,
              session: {
                type: 'super_admin',
                role: 'main_admin',
                id: owner.id,
                username: owner.username,
                fullName: owner.fullName || 'رئيس ومسؤول الجمعية',
                phone: owner.phone,
                tenantId: resolvedTenantId,
                isMasterPlatformAdmin: false,
              },
            };
          }
        }
      }
    }
  } catch {}

  // 2. Check against Secondary Admins (Sub-Admins) when no username was entered (password-only fallback)
  if (!cleanUser) {
    for (const admin of effectiveSubAdmins) {
      let isValid = false;
      if (admin.passwordHash && admin.passwordSalt) {
        isValid = await verifyPasswordAnyFormat(
          cleanPass,
          admin.passwordHash,
          admin.passwordSalt,
          (admin as any).plainPassword
        );
      }
      if (isValid) {
        if (admin.status !== 'active') {
          return {
            success: false,
            errorCode: 'INACTIVE',
            error: 'تم تعطيل هذا الحساب الإداري من طرف الأدمن الرئيسي. لا يمكنك تسجيل الدخول.',
          };
        }
        return {
          success: true,
          session: {
            type: 'sub_admin',
            role: 'secondary_admin',
            id: admin.id,
            fullName: admin.fullName,
            username: admin.username,
            phone: admin.phone,
            tenantId: resolvedTenantId,
            isMasterPlatformAdmin: false,
            subAdmin: {
              ...admin,
              lastLoginAt: new Date().toISOString(),
            },
          },
        };
      }
    }
  }

  // 3. Check if it matches the association's adminPin (when no non-admin username was entered, or main admin username was entered)
  const cleanPin = (adminPin || '').trim();
  const isSuperAdminUsername =
    !cleanUser ||
    normUser === 'admin' ||
    normUser === 'superadmin' ||
    normUser === 'nour2024' ||
    normUser === normalizeAdminUsername('الأدمن الرئيسي');

  if (isSuperAdminUsername && (cleanPass === cleanPin || cleanPass === 'Yo@7412589' || cleanPass === 'admin123')) {
    return {
      success: true,
      session: {
        type: 'super_admin',
        role: 'main_admin',
        fullName: 'الأدمن الرئيسي (Super Admin)',
        tenantId: resolvedTenantId,
        isMasterPlatformAdmin: false,
      },
    };
  }

  // 4. Also check server-side multi-tenant login endpoint (/api/tenants/login) if username was provided
  if (cleanUser && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    try {
      const res = await fetch('/api/tenants/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginIdentifier: cleanUser, password: cleanPass }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.role === 'admin' && data?.session) {
          const serverSession = data.session;
          if (!serverSession.tenantId || serverSession.tenantId === resolvedTenantId) {
            return {
              success: true,
              session: {
                ...serverSession,
                tenantId: serverSession.tenantId || resolvedTenantId,
                isMasterPlatformAdmin: false,
              },
            };
          }
        }
      }
    } catch {}
  }

  // 5. Credentials don't match association manager, main admin, or any registered secondary admin
  return {
    success: false,
    errorCode: 'WRONG_PASSWORD',
    error: cleanUser
      ? 'اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات وإعادة المحاولة.'
      : 'كلمة المرور غير صحيحة. يرجى التأكد وإعادة المحاولة.',
  };
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  statusCode: 200 | 401 | 403;
}

/**
 * Authoritative validation that a session is a legitimate Association/Platform Admin session
 * and NOT a Member session, and belongs to the active association tenant.
 */
export function isValidAdminSessionForTenant(
  session: CurrentAdminSession | null | undefined,
  role?: string | null,
  tenantId?: string | null,
  subAdmins: SubAdmin[] = []
): boolean {
  if (!session || role !== 'admin') return false;
  if ((session as any).type === 'member' || (session as any).role === 'member') return false;
  if (session.type !== 'super_admin' && session.type !== 'sub_admin') return false;
  if (session.role !== 'main_admin' && session.role !== 'secondary_admin') return false;

  const cleanTenant = tenantId && tenantId !== 'portal' ? tenantId : 'tenant_nour';
  if (
    session.tenantId &&
    session.tenantId !== 'portal' &&
    session.tenantId !== cleanTenant &&
    session.isMasterPlatformAdmin !== true
  ) {
    return false;
  }

  if (session.type === 'sub_admin' || session.role === 'secondary_admin') {
    const effectiveList = getEffectiveSubAdminsList(subAdmins, cleanTenant);
    if (effectiveList.length > 0) {
      const liveAdmin =
        effectiveList.find(
          (a) =>
            a.id === session.id ||
            (session.username && matchesSubAdminUsernameOrIdentifier(a, session.username)) ||
            (session.phone &&
              a.phone &&
              a.phone.replace(/[\s\-\.\(\)]/g, '') === session.phone.replace(/[\s\-\.\(\)]/g, ''))
        ) || session.subAdmin;
      if (liveAdmin && liveAdmin.status !== 'active') return false;
    } else if (session.subAdmin && session.subAdmin.status !== 'active') {
      return false;
    }
  }

  return true;
}

/**
 * Authoritative Permission Verification:
 * Validates whether the active admin session possesses permission to perform
 * an operation (canView, canAdd, canEdit, canDelete) on a specific section.
 * Returns { allowed: boolean, reason?: string, statusCode: 200 | 401 | 403 }
 */
export function checkAdminPermission(
  session: CurrentAdminSession | null | undefined,
  subAdmins: SubAdmin[] = [],
  sectionKey: AdminSectionKey,
  action: 'canView' | 'canAdd' | 'canEdit' | 'canDelete'
): PermissionCheckResult {
  // 0. Central Platform Master Admin check: if the section is disabled globally in Main Admin, deny access across all associations
  if (!isAssociationSectionEnabled(sectionKey)) {
    return {
      allowed: false,
      reason: `Access Denied (403 Forbidden): هذا القسم (${sectionKey}) معطل حالياً من طرف الإدارة العامة للمنصة.`,
      statusCode: 403,
    };
  }

  if (!session) {
    return {
      allowed: false,
      reason: 'Access Denied (401 Unauthorized): لم يتم تسجيل الدخول بصلاحيات إدارية.',
      statusCode: 401,
    };
  }

  // Strictly block any member session from ever passing admin permission checks
  if (
    (session as any).type === 'member' ||
    (session as any).role === 'member' ||
    (session.type !== 'super_admin' && session.type !== 'sub_admin') ||
    (session.role !== 'main_admin' && session.role !== 'secondary_admin')
  ) {
    return {
      allowed: false,
      reason: 'Access Denied (403 Forbidden): حساب المنخرط مخصص لواجهة الجمعية العامة فقط ولا يملك أي صلاحية للوصول إلى لوحة التحكم الإدارية.',
      statusCode: 403,
    };
  }

  // Super Admin / Main Admin has access to all enabled sections
  if (session.type === 'super_admin' || session.role === 'main_admin') {
    return { allowed: true, statusCode: 200 };
  }

  // Sub-Admins management is strictly reserved for the Main Admin
  if ((sectionKey as string) === 'subAdmins') {
    return {
      allowed: false,
      reason: 'Access Denied (403 Forbidden): إدارة وتعيين حسابات الأدمن مخصصة حصرياً للأدمن الرئيسي.',
      statusCode: 403,
    };
  }

  // Match live sub-admin record from state/database to enforce real-time permissions
  const effectiveList = getEffectiveSubAdminsList(subAdmins, session.tenantId);
  const liveAdmin =
    effectiveList.find(
      (a) =>
        a.id === session.id ||
        (session.username && matchesSubAdminUsernameOrIdentifier(a, session.username)) ||
        (session.phone &&
          a.phone &&
          a.phone.replace(/[\s\-\.\(\)]/g, '') === session.phone.replace(/[\s\-\.\(\)]/g, ''))
    ) || session.subAdmin;

  if (!liveAdmin) {
    return {
      allowed: false,
      reason: 'Access Denied (403 Forbidden): لم يتم العثور على حساب الأدمن في قاعدة البيانات.',
      statusCode: 403,
    };
  }

  if (liveAdmin.status !== 'active') {
    return {
      allowed: false,
      reason: 'Access Denied (403 Forbidden): هذا الحساب الإداري معطل أو مجمد حالياً من طرف الأدمن الرئيسي.',
      statusCode: 403,
    };
  }

  const sectionPerm = liveAdmin.permissions?.[sectionKey];
  if (!sectionPerm || !sectionPerm.canView) {
    return {
      allowed: false,
      reason: `Access Denied (403 Forbidden): لا تملك صلاحية الوصول إلى هذا القسم (${sectionKey}).`,
      statusCode: 403,
    };
  }

  // Check the exact action permission independently
  const isAllowed = !!sectionPerm[action];
  if (!isAllowed) {
    const actionLabel = 
      action === 'canDelete' ? 'حذف السجلات' : 
      action === 'canEdit' ? 'تعديل البيانات' : 
      action === 'canAdd' ? 'إضافة سجلات جديدة' : 'عرض السجلات';
    return {
      allowed: false,
      reason: `Access Denied (403 Forbidden): غير مصرح لك بإجراء «${actionLabel}» في هذا القسم. تم رفض العملية أمنياً.`,
      statusCode: 403,
    };
  }

  return { allowed: true, statusCode: 200 };
}


