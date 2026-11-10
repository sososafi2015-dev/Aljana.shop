import {
  getStoredPolls,
  savePolls,
  getStoredCurrentAdminSession,
  getActiveTenantIdFromStorage,
  getStoredLoggedInMemberId,
  getStoredMembers,
  getStoredBoardMembers,
  VOTING_RESTRICTED_MESSAGE,
} from '../storage';
import type { Poll, PollVote, PollStatus, CurrentAdminSession, VoteChoice } from '../types';

function getAdminHeader(session: CurrentAdminSession | null | undefined): Record<string, string> {
  const resolved = session || getStoredCurrentAdminSession() || {
    type: 'super_admin',
    role: 'main_admin',
    fullName: 'إدارة الجمعية',
  };
  return {
    'x-admin-session': encodeURIComponent(JSON.stringify(resolved)),
    'x-tenant-id': getActiveTenantIdFromStorage(),
  };
}

/**
 * Fetch all polls for tenant
 */
export async function apiFetchPolls(
  tenantId?: string
): Promise<{ success: boolean; polls: Poll[]; error?: string }> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !activeTenant || activeTenant === 'portal' ? 'tenant_nour' : activeTenant;
  try {
    const res = await fetch(`/api/polls?tenantId=${encodeURIComponent(cleanTenant)}`, {
      headers: {
        'x-tenant-id': cleanTenant,
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    if (data.success && Array.isArray(data.polls)) {
      if (data.polls.length > 0) {
        savePolls(data.polls, cleanTenant);
        return { success: true, polls: data.polls };
      }
      const isExplicitEmpty =
        typeof window !== 'undefined' &&
        localStorage.getItem(`chayef_tenant_${cleanTenant}_polls_explicit_empty`) === 'true';
      if (isExplicitEmpty) {
        savePolls([], cleanTenant, true);
        return { success: true, polls: [] };
      }
      const local = getStoredPolls(cleanTenant);
      if (local.length > 0) {
        fetch(`/api/polls/sync?tenantId=${encodeURIComponent(cleanTenant)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': cleanTenant,
          },
          body: JSON.stringify({ tenantId: cleanTenant, polls: local }),
        }).catch(() => {});
        return { success: true, polls: local };
      }
    }
    const local = getStoredPolls(cleanTenant);
    return { success: true, polls: local };
  } catch (err) {
    const local = getStoredPolls(cleanTenant);
    return { success: true, polls: local };
  }
}

/**
 * Create a new poll
 */
export async function apiCreatePoll(
  pollData: Partial<Poll>,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; poll?: Poll; polls?: Poll[]; error?: string }> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage();
  try {
    const res = await fetch(`/api/polls?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
      body: JSON.stringify(pollData),
    });
    const data = await res.json();
    if (data.success) {
      if (Array.isArray(data.polls)) {
        savePolls(data.polls, activeTenant);
      }
      return { success: true, poll: data.poll, polls: data.polls };
    }
    return { success: false, error: data.error || 'فشل إنشاء القرار والتصويت' };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر الاتصال بالخادم' };
  }
}

/**
 * Update an existing poll
 */
export async function apiUpdatePoll(
  pollId: string,
  pollData: Partial<Poll>,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; poll?: Poll; polls?: Poll[]; error?: string }> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage();
  try {
    const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
      body: JSON.stringify(pollData),
    });
    const data = await res.json();
    if (data.success) {
      if (Array.isArray(data.polls)) {
        savePolls(data.polls, activeTenant);
      }
      return { success: true, poll: data.poll, polls: data.polls };
    }
    return { success: false, error: data.error || 'فشل تحديث القرار والتصويت' };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر الاتصال بالخادم' };
  }
}

/**
 * Toggle poll status (active / paused / closed)
 */
export async function apiTogglePollStatus(
  pollId: string,
  status?: PollStatus,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; poll?: Poll; polls?: Poll[]; error?: string }> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage();
  try {
    const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/status?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.success) {
      if (Array.isArray(data.polls)) {
        savePolls(data.polls, activeTenant);
      }
      return { success: true, poll: data.poll, polls: data.polls };
    }
    return { success: false, error: data.error || 'فشل تغيير حالة التصويت' };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر الاتصال بالخادم' };
  }
}

/**
 * Toggle poll visibility in member app
 */
export async function apiTogglePollVisibility(
  pollId: string,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; poll?: Poll; polls?: Poll[]; error?: string }> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage();
  try {
    const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/visibility?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'PATCH',
      headers: {
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
    });
    const data = await res.json();
    if (data.success) {
      if (Array.isArray(data.polls)) {
        savePolls(data.polls, activeTenant);
      }
      return { success: true, poll: data.poll, polls: data.polls };
    }
    return { success: false, error: data.error || 'فشل تعديل ظهور التصويت' };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر الاتصال بالخادم' };
  }
}

/**
 * Authoritative Poll Deletion
 * - Sends DELETE request with authentication and tenant context
 * - Updates local storage and returns remaining polls
 */
export async function apiDeletePoll(
  pollId: string,
  session?: CurrentAdminSession | null,
  tenantId?: string
): Promise<{ success: boolean; message?: string; polls?: Poll[]; error?: string }> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage();
  try {
    const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}?tenantId=${encodeURIComponent(activeTenant)}`, {
      method: 'DELETE',
      headers: {
        ...getAdminHeader(session),
        'x-tenant-id': activeTenant,
      },
    });
    const data = await res.json();
    if (data.success) {
      const remaining = Array.isArray(data.polls)
        ? data.polls
        : getStoredPolls(activeTenant).filter((p) => p.id !== pollId);
      savePolls(remaining, activeTenant, true);
      return {
        success: true,
        message: data.message || 'تم حذف القرار والتصويت نهائياً بنجاح.',
        polls: remaining,
      };
    }
    return { success: false, error: data.error || 'فشل حذف القرار والتصويت.' };
  } catch (err: any) {
    // Graceful offline fallback
    const current = getStoredPolls(activeTenant);
    const remaining = current.filter((p) => p.id !== pollId);
    savePolls(remaining, activeTenant, true);
    return {
      success: true,
      message: 'تم حذف القرار والتصويت محلياً بنجاح.',
      polls: remaining,
    };
  }
}

/**
 * Record a vote for a poll (exclusively for authenticated association members & board members)
 */
export async function apiVotePoll(
  pollId: string,
  vote: { memberId: string; memberCode: string; memberName: string; choice: VoteChoice },
  tenantId?: string
): Promise<{ success: boolean; message?: string; poll?: Poll; polls?: Poll[]; error?: string }> {
  const activeTenant = tenantId || getActiveTenantIdFromStorage();
  const cleanTenant = !activeTenant || activeTenant === 'portal' ? 'tenant_nour' : activeTenant;

  const loggedInMemberId = getStoredLoggedInMemberId(cleanTenant);
  const members = getStoredMembers(cleanTenant);
  const boardMembers = getStoredBoardMembers(cleanTenant);
  const adminSession = getStoredCurrentAdminSession(cleanTenant);

  const matchedMember = loggedInMemberId
    ? members.find((m) => m.id === loggedInMemberId && m.status === 'active')
    : undefined;
  const isBoardVoter =
    !!adminSession &&
    (boardMembers.some((bm) => bm.id === vote.memberId || bm.memberId === vote.memberId) ||
      members.some((m) => m.id === vote.memberId && m.status === 'active') ||
      vote.memberId === (adminSession.id || 'board_admin'));

  if (!matchedMember && !isBoardVoter) {
    return {
      success: false,
      error: VOTING_RESTRICTED_MESSAGE,
    };
  }

  const voterSessionPayload = {
    isAuthenticated: true,
    tenantId: cleanTenant,
    memberId: vote.memberId,
    memberCode: vote.memberCode,
    memberName: vote.memberName,
    voterType: isBoardVoter ? 'board_member' : 'member',
    verifiedMemberSnapshot: matchedMember || undefined,
  };

  try {
    const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/vote?tenantId=${encodeURIComponent(cleanTenant)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': cleanTenant,
        'x-voter-session': encodeURIComponent(JSON.stringify(voterSessionPayload)),
      },
      body: JSON.stringify({
        ...vote,
        voterSession: voterSessionPayload,
      }),
    });
    const data = await res.json();
    if (data.success) {
      if (Array.isArray(data.polls)) {
        savePolls(data.polls, cleanTenant);
      }
      return { success: true, message: data.message, poll: data.poll, polls: data.polls };
    }
    return { success: false, error: data.error || VOTING_RESTRICTED_MESSAGE };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر الاتصال بالخادم.' };
  }
}
