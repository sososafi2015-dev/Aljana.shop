import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import type { Poll, PollVote, PollStatus, VoteChoice } from '../types';
import { initialPolls } from '../initialData';
import {
  DATA_DIR,
  ensureStorageDirectories,
  normalizeTenantId,
  readJsonFileSync,
  writeJsonFileAtomicSync,
  readLargeJsonBody,
} from './storageEngine';

export interface PollsDatabase {
  polls: Poll[];
  lastUpdated: string;
  initializedFromMaster?: boolean;
}

function getTenantPollsFile(tenantId?: string | null): string {
  const clean = normalizeTenantId(tenantId);
  if (clean === 'tenant_nour') {
    return path.join(DATA_DIR, 'polls_database.json');
  }
  return path.join(DATA_DIR, `polls_database_${clean}.json`);
}

function normalizePoll(raw: any): Poll {
  const votes: PollVote[] = Array.isArray(raw?.votes)
    ? raw.votes
        .filter((v: any) => v && v.memberId && (v.choice === 'for' || v.choice === 'against'))
        .map((v: any) => ({ ...v }))
    : [];

  return {
    id: String(raw?.id || `poll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    title: String(raw?.title || '').trim(),
    description: String(raw?.description || '').trim(),
    createdAt: raw?.createdAt || new Date().toISOString().slice(0, 10),
    startDate: raw?.startDate || undefined,
    endDate: raw?.endDate || undefined,
    status: (raw?.status === 'paused' || raw?.status === 'closed' ? raw.status : 'active') as PollStatus,
    isVisibleInApp: raw?.isVisibleInApp !== undefined ? Boolean(raw.isVisibleInApp) : true,
    allowVoteChange: raw?.allowVoteChange !== undefined ? Boolean(raw.allowVoteChange) : true,
    votes,
    createdBy: raw?.createdBy || 'إدارة الجمعية',
  };
}

export function getMasterPollsOnServer(): Poll[] {
  ensureStorageDirectories();
  const masterFile = path.join(DATA_DIR, 'polls_database.json');
  if (fs.existsSync(masterFile)) {
    const parsed = readJsonFileSync<any>(masterFile, null);
    if (parsed && Array.isArray(parsed.polls) && parsed.polls.length > 0) {
      return parsed.polls.map(normalizePoll);
    }
  }
  return initialPolls.map(normalizePoll);
}

export function cloneReferencePollsForServerTenant(tenantId: string, associationName?: string): Poll[] {
  const cleanTenant = normalizeTenantId(tenantId);
  const masterPolls = getMasterPollsOnServer();

  return masterPolls.map((poll, idx) => {
    const cloned = normalizePoll(poll);
    return {
      ...cloned,
      id: cleanTenant === 'tenant_nour' ? cloned.id : `poll_${cleanTenant}_${idx + 1}`,
      createdBy: associationName
        ? `المكتب التنفيذي لـ ${associationName}`
        : cloned.createdBy || 'إدارة الجمعية',
      status: cloned.status || 'active',
      isVisibleInApp: cloned.isVisibleInApp !== false,
      allowVoteChange: cloned.allowVoteChange !== false,
      votes: Array.isArray(cloned.votes) ? cloned.votes.map((v) => ({ ...v })) : [],
    };
  });
}

export function loadPollsDatabase(tenantId?: string | null): PollsDatabase {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const dbFile = getTenantPollsFile(cleanTenant);

  if (fs.existsSync(dbFile)) {
    const parsed = readJsonFileSync<any>(dbFile, null);
    if (parsed && Array.isArray(parsed.polls)) {
      // If a non-master tenant's database exists on disk with 0 polls and was never initialized from master
      // (e.g., created when loadPollsDatabase previously returned []), seed it from tenant_nour and save permanently
      if (cleanTenant !== 'tenant_nour' && parsed.polls.length === 0 && !parsed.initializedFromMaster) {
        const clonedPolls = cloneReferencePollsForServerTenant(cleanTenant);
        const seededDb: PollsDatabase = {
          polls: clonedPolls,
          lastUpdated: new Date().toISOString(),
          initializedFromMaster: true,
        };
        savePollsDatabase(seededDb, cleanTenant);
        return seededDb;
      }

      return {
        polls: parsed.polls.map(normalizePoll),
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        initializedFromMaster: parsed.initializedFromMaster ?? true,
      };
    }
  }

  const defaultPolls =
    cleanTenant === 'tenant_nour'
      ? getMasterPollsOnServer()
      : cloneReferencePollsForServerTenant(cleanTenant);

  const defaultDb: PollsDatabase = {
    polls: defaultPolls,
    lastUpdated: new Date().toISOString(),
    initializedFromMaster: true,
  };

  savePollsDatabase(defaultDb, cleanTenant);
  return defaultDb;
}

export function initializeTenantPolls(tenantId: string, associationName?: string): PollsDatabase {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const clonedPolls =
    cleanTenant === 'tenant_nour'
      ? getMasterPollsOnServer()
      : cloneReferencePollsForServerTenant(cleanTenant, associationName);

  const db: PollsDatabase = {
    polls: clonedPolls,
    lastUpdated: new Date().toISOString(),
    initializedFromMaster: true,
  };
  savePollsDatabase(db, cleanTenant);
  return db;
}

export function savePollsDatabase(db: PollsDatabase, tenantId?: string | null): void {
  ensureStorageDirectories();
  const cleanTenant = normalizeTenantId(tenantId);
  const dbFile = getTenantPollsFile(cleanTenant);
  const cleanDb: PollsDatabase = {
    ...db,
    polls: Array.isArray(db.polls) ? db.polls.map(normalizePoll) : [],
    lastUpdated: db.lastUpdated || new Date().toISOString(),
    initializedFromMaster: db.initializedFromMaster ?? true,
  };
  writeJsonFileAtomicSync(dbFile, cleanDb, `polls_${cleanTenant}`);
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session, x-tenant-id, x-voter-session');
  res.end(JSON.stringify(data));
}

export async function handlePollsApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> {
  if (!url.startsWith('/api/polls')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return true;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    parsedUrl = new URL('http://localhost' + url);
  }
  const headerTenant = (req.headers['x-tenant-id'] as string | undefined)?.trim();
  const queryTenant = parsedUrl.searchParams.get('tenantId')?.trim();
  const tenantId = normalizeTenantId(headerTenant || queryTenant);

  const db = loadPollsDatabase(tenantId);
  const cleanPath = parsedUrl.pathname;
  const method = req.method?.toUpperCase() || 'GET';

  // 1. GET /api/polls
  if (method === 'GET' && (cleanPath === '/api/polls' || cleanPath === '/api/polls/')) {
    sendJson(res, 200, {
      success: true,
      tenantId,
      polls: db.polls,
      lastUpdated: db.lastUpdated,
    });
    return true;
  }

  // 2. POST /api/polls -> Create new poll
  if (method === 'POST' && (cleanPath === '/api/polls' || cleanPath === '/api/polls/')) {
    try {
      const body = await readLargeJsonBody(req);
      const rawPoll = body?.poll || body || {};
      if (!rawPoll.title || !String(rawPoll.title).trim()) {
        sendJson(res, 400, { success: false, error: 'عنوان القرار أو الاستطلاع إلزامي.' });
        return true;
      }

      const newPoll = normalizePoll({
        ...rawPoll,
        id: rawPoll.id || `poll-${Date.now()}`,
        createdAt: rawPoll.createdAt || new Date().toISOString().slice(0, 10),
        votes: Array.isArray(rawPoll.votes) ? rawPoll.votes : [],
      });

      db.polls = [newPoll, ...db.polls.filter((p) => p.id !== newPoll.id)];
      db.lastUpdated = new Date().toISOString();
      savePollsDatabase(db, tenantId);

      sendJson(res, 201, {
        success: true,
        message: 'تم إنشاء القرار والتصويت وحفظه في قاعدة البيانات بنجاح.',
        poll: newPoll,
        polls: db.polls,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'فشل إنشاء القرار والتصويت.' });
      return true;
    }
  }

  // 3. POST /api/polls/sync -> Bulk sync polls
  if (method === 'POST' && cleanPath === '/api/polls/sync') {
    try {
      const body = await readLargeJsonBody(req);
      const targetTenant = normalizeTenantId(body?.tenantId || tenantId);
      const targetDb = loadPollsDatabase(targetTenant);
      if (Array.isArray(body?.polls)) {
        targetDb.polls = body.polls.map(normalizePoll);
        targetDb.lastUpdated = new Date().toISOString();
        savePollsDatabase(targetDb, targetTenant);
      }
      sendJson(res, 200, {
        success: true,
        tenantId: targetTenant,
        polls: targetDb.polls,
        lastUpdated: targetDb.lastUpdated,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'فشل مزامنة الاستطلاعات.' });
      return true;
    }
  }

  // 4. POST /api/polls/:pollId/vote OR POST /api/polls/vote
  const voteMatch = cleanPath.match(/^\/api\/polls\/([^/]+)\/vote$/);
  if (method === 'POST' && (voteMatch || cleanPath === '/api/polls/vote')) {
    try {
      const body = await readLargeJsonBody(req);
      const pollId = voteMatch ? decodeURIComponent(voteMatch[1]).trim() : String(body?.pollId || '').trim();
      const memberId = String(body?.memberId || body?.voterSession?.memberId || '').trim();
      const memberCode = String(body?.memberCode || body?.voterSession?.memberCode || '').trim();
      const memberName = String(body?.memberName || body?.voterSession?.memberName || 'منخرط').trim();
      const rawChoice = body?.choice || body?.optionId;
      const choice: VoteChoice = rawChoice === 'against' ? 'against' : 'for';

      if (!pollId || !memberId) {
        sendJson(res, 400, { success: false, error: 'بيانات التصويت غير مكتملة.' });
        return true;
      }

      const pollIndex = db.polls.findIndex((p) => p.id === pollId);
      if (pollIndex === -1) {
        sendJson(res, 404, { success: false, error: 'الاستطلاع غير موجود.' });
        return true;
      }

      const poll = db.polls[pollIndex];
      if (poll.status !== 'active') {
        sendJson(res, 403, { success: false, error: 'هذا التصويت غير مفتوح حالياً.' });
        return true;
      }

      const votes: PollVote[] = Array.isArray(poll.votes) ? [...poll.votes] : [];
      const existingIdx = votes.findIndex((v) => v.memberId === memberId);
      const now = new Date().toISOString();

      if (existingIdx !== -1) {
        if (!poll.allowVoteChange) {
          sendJson(res, 409, {
            success: false,
            error: 'لقد قمت بالتصويت مسبقاً ولا يسمح بتغيير الصوت في هذا القرار.',
          });
          return true;
        }
        votes[existingIdx] = {
          ...votes[existingIdx],
          memberCode: memberCode || votes[existingIdx].memberCode,
          memberName: memberName || votes[existingIdx].memberName,
          choice,
          votedAt: now,
        };
      } else {
        votes.push({
          memberId,
          memberCode,
          memberName,
          choice,
          votedAt: now,
        });
      }

      const updatedPoll: Poll = {
        ...poll,
        votes,
      };

      db.polls[pollIndex] = updatedPoll;
      db.lastUpdated = now;
      savePollsDatabase(db, tenantId);

      sendJson(res, 200, {
        success: true,
        message: existingIdx !== -1 ? 'تم تحديث صوتك بنجاح.' : 'تم تسجيل صوتك بنجاح.',
        poll: updatedPoll,
        polls: db.polls,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'حدث خطأ أثناء حفظ التصويت.' });
      return true;
    }
  }

  // 5. PATCH /api/polls/:pollId/status
  const statusMatch = cleanPath.match(/^\/api\/polls\/([^/]+)\/status$/);
  if (statusMatch && (method === 'PATCH' || method === 'PUT' || method === 'POST')) {
    try {
      const pollId = decodeURIComponent(statusMatch[1]).trim();
      const body = await readLargeJsonBody(req).catch(() => ({}));
      const pollIndex = db.polls.findIndex((p) => p.id === pollId);
      if (pollIndex === -1) {
        sendJson(res, 404, { success: false, error: 'القرار غير موجود.' });
        return true;
      }

      const current = db.polls[pollIndex];
      const nextStatus: PollStatus =
        body?.status === 'active' || body?.status === 'paused' || body?.status === 'closed'
          ? body.status
          : current.status === 'active'
          ? 'closed'
          : 'active';

      const updatedPoll: Poll = {
        ...current,
        status: nextStatus,
      };
      db.polls[pollIndex] = updatedPoll;
      db.lastUpdated = new Date().toISOString();
      savePollsDatabase(db, tenantId);

      sendJson(res, 200, {
        success: true,
        poll: updatedPoll,
        polls: db.polls,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'فشل تغيير حالة التصويت.' });
      return true;
    }
  }

  // 6. PATCH /api/polls/:pollId/visibility
  const visMatch = cleanPath.match(/^\/api\/polls\/([^/]+)\/visibility$/);
  if (visMatch && (method === 'PATCH' || method === 'PUT' || method === 'POST')) {
    try {
      const pollId = decodeURIComponent(visMatch[1]).trim();
      const body = await readLargeJsonBody(req).catch(() => ({}));
      const pollIndex = db.polls.findIndex((p) => p.id === pollId);
      if (pollIndex === -1) {
        sendJson(res, 404, { success: false, error: 'القرار غير موجود.' });
        return true;
      }

      const current = db.polls[pollIndex];
      const nextVisible =
        typeof body?.isVisibleInApp === 'boolean' ? body.isVisibleInApp : !current.isVisibleInApp;

      const updatedPoll: Poll = {
        ...current,
        isVisibleInApp: nextVisible,
      };
      db.polls[pollIndex] = updatedPoll;
      db.lastUpdated = new Date().toISOString();
      savePollsDatabase(db, tenantId);

      sendJson(res, 200, {
        success: true,
        poll: updatedPoll,
        polls: db.polls,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err?.message || 'فشل تعديل ظهور التصويت.' });
      return true;
    }
  }

  // 7. PUT / DELETE /api/polls/:pollId
  const itemMatch = cleanPath.match(/^\/api\/polls\/([^/]+)$/);
  if (itemMatch && itemMatch[1] !== 'sync' && itemMatch[1] !== 'vote') {
    const pollId = decodeURIComponent(itemMatch[1]).trim();

    if (method === 'PUT' || method === 'PATCH') {
      try {
        const body = await readLargeJsonBody(req);
        const incoming = body?.poll || body || {};
        const pollIndex = db.polls.findIndex((p) => p.id === pollId);
        if (pollIndex === -1) {
          sendJson(res, 404, { success: false, error: 'القرار غير موجود.' });
          return true;
        }

        const current = db.polls[pollIndex];
        const updatedPoll = normalizePoll({
          ...current,
          ...incoming,
          id: current.id,
          votes: Array.isArray(incoming.votes) ? incoming.votes : current.votes,
        });

        db.polls[pollIndex] = updatedPoll;
        db.lastUpdated = new Date().toISOString();
        savePollsDatabase(db, tenantId);

        sendJson(res, 200, {
          success: true,
          message: 'تم تحديث القرار والتصويت بنجاح.',
          poll: updatedPoll,
          polls: db.polls,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err?.message || 'فشل تحديث القرار والتصويت.' });
        return true;
      }
    }

    if (method === 'DELETE') {
      try {
        db.polls = db.polls.filter((p) => p.id !== pollId);
        db.lastUpdated = new Date().toISOString();
        savePollsDatabase(db, tenantId);

        sendJson(res, 200, {
          success: true,
          message: 'تم حذف القرار والتصويت نهائياً من قاعدة البيانات.',
          polls: db.polls,
        });
        return true;
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err?.message || 'فشل حذف القرار والتصويت.' });
        return true;
      }
    }
  }

  sendJson(res, 404, { success: false, error: 'مسار الاستطلاعات غير موجود.' });
  return true;
}
