import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import type { PlatformAdCampaign, AdCampaignRequest } from '../types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'ad_campaigns_database.json');
const REQUESTS_DB_FILE = path.join(DATA_DIR, 'ad_campaign_requests_database.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'platform_payment_settings.json');

const defaultCampaigns: PlatformAdCampaign[] = [
  {
    id: 'ad_camp_default_1',
    tenantId: 'tenant_nour',
    tenantName: 'جمعية النور للتنمية والتضامن',
    tenantSlug: 'nour',
    tenantLogoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=200&q=80',
    tenantCity: 'الدار البيضاء',
    tenantCountry: 'المغرب',
    priorityOrder: 1,
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'حملة ترويجية للمشاريع التنموية الكبرى',
    notes: 'حملة إعلانية مميزة لتصدر مشاريع التنمية في الصفحة الأولى',
    enabled: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Super Admin',
  },
  {
    id: 'ad_camp_default_2',
    tenantId: 'tenant_amal_atlas',
    tenantName: 'جمعية أمل الأطلس لرعاية الأيتام',
    tenantSlug: 'amal-atlas',
    tenantLogoUrl: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=200&q=80',
    tenantCity: 'مراكش',
    tenantCountry: 'المغرب',
    priorityOrder: 2,
    startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'رعاية ودعم المبادرات التعليمية واليتامى',
    notes: 'ترتيب متقدم ضمن قائمة الجمعيات الأكثر نشاطاً',
    enabled: true,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Super Admin',
  },
];

const defaultRequests: AdCampaignRequest[] = [
  {
    id: 'ad_req_demo_1',
    tenantId: 'tenant_amal_atlas',
    tenantName: 'جمعية أمل الأطلس لرعاية الأيتام',
    tenantSlug: 'amal-atlas',
    tenantLogoUrl: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=200&q=80',
    tenantCity: 'مراكش',
    tenantCountry: 'المغرب',
    ownerId: 'owner_amal',
    ownerName: 'عبد اللطيف التازي',
    ownerPhone: '+212 661-889900',
    campaignTitle: 'حملة إعلان مبادرات التعليم والرعاية المدرسية',
    campaignDescription: 'طلب ترويج مشاريع الجمعية وتصدر قائمة التبرعات في الصفحة الأولى لمدة 3 أشهر خلال الموسم الدراسي الجديد.',
    monthsCount: 3,
    startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 91 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    requestedPriorityOrder: 2,
    amount: 597,
    currency: 'MAD',
    monthlyRate: 199,
    status: 'paid_pending_review',
    paymentStatus: 'pending_verification',
    paymentId: 'pay_ad_demo_1',
    paymentMethod: 'bank_transfer',
    paymentReference: 'TR-BMCE-992014',
    paymentSubmittedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    paymentAmount: 597,
    paymentCurrency: 'MAD',
    proofFileName: 'recu_virement_bmce.jpg',
    proofDocumentUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ad_req_demo_2',
    tenantId: 'tenant_nour',
    tenantName: 'جمعية النور للتنمية والتضامن',
    tenantSlug: 'nour',
    tenantLogoUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=200&q=80',
    tenantCity: 'الدار البيضاء',
    tenantCountry: 'المغرب',
    ownerId: 'owner_nour',
    ownerName: 'الحاج بوشعيب الزهراني',
    ownerPhone: '+212 661-123456',
    campaignTitle: 'حملة ترويجية للمشاريع التنموية الكبرى',
    campaignDescription: 'إعلان سنوي لتسليط الضوء على مبادرات التنمية المستدامة والتضامن الاجتماعي.',
    monthsCount: 1,
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    requestedPriorityOrder: 1,
    amount: 199,
    currency: 'MAD',
    monthlyRate: 199,
    status: 'approved',
    paymentStatus: 'confirmed',
    paymentId: 'pay_ad_demo_2',
    paymentMethod: 'credit_card',
    paymentReference: 'CMI-8823190',
    paymentSubmittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    paymentAmount: 199,
    paymentCurrency: 'MAD',
    cardLast4: '4242',
    reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reviewedBy: 'الإدارة العامة للمنصة',
    approvedCampaignId: 'ad_camp_default_1',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ad_req_demo_3',
    tenantId: 'tenant_basma_takaful',
    tenantName: 'جمعية بسمة للتكافل والعمل الخيري',
    tenantSlug: 'basma-takaful',
    tenantCity: 'طنجة',
    tenantCountry: 'المغرب',
    ownerId: 'owner_basma',
    ownerName: 'فاطمة الزهراء بنجلون',
    ownerPhone: '+212 662-445566',
    campaignTitle: 'تدشين إعلان مشاريع الإطعام وقفة الشتاء',
    campaignDescription: 'الرغبة في ظهور مشاريع الإطعام الدافئ وقوافل المساعدات الشتوية في الواجهة الأمامية للمنصة.',
    monthsCount: 2,
    startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 62 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    requestedPriorityOrder: 3,
    amount: 398,
    currency: 'MAD',
    monthlyRate: 199,
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ad_req_demo_4',
    tenantId: 'tenant_yad_fi_yad',
    tenantName: 'جمعية اليد في اليد لدعم التعليم',
    tenantSlug: 'yad-fi-yad',
    tenantCity: 'فاس',
    tenantCountry: 'المغرب',
    ownerId: 'owner_yad',
    ownerName: 'ياسين الفاسي',
    ownerPhone: '+212 663-778899',
    campaignTitle: 'حملة ترميم المدارس القروية',
    campaignDescription: 'إعلان للتعريف ببرنامج تجهيز وترميم أقسام المدارس بالمناطق النائية.',
    monthsCount: 2,
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    requestedPriorityOrder: 2,
    amount: 398,
    currency: 'MAD',
    monthlyRate: 199,
    status: 'rejected',
    paymentStatus: 'failed',
    rejectionReason: 'وصل التحويل البنكي المرفق غير واضح والمبلغ المحول لا يطابق مدة الشهرين. يرجى إعادة إرسال الطلب مع وصل بنكي مقروء بالمبلغ الصحيح.',
    reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reviewedBy: 'الإدارة المركزية',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

let inMemoryCampaigns: PlatformAdCampaign[] | null = null;
let inMemoryRequests: AdCampaignRequest[] | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readCampaignsFromDisk(): PlatformAdCampaign[] {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    writeCampaignsToDisk(defaultCampaigns);
    return defaultCampaigns;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('[adCampaignsApiHandler] Error reading ad_campaigns_database.json:', err);
  }
  return defaultCampaigns;
}

function writeCampaignsToDisk(campaigns: PlatformAdCampaign[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(campaigns, null, 2), 'utf-8');
    inMemoryCampaigns = campaigns;
  } catch (err) {
    console.error('[adCampaignsApiHandler] Error writing ad_campaigns_database.json:', err);
  }
}

function readRequestsFromDisk(): AdCampaignRequest[] {
  ensureDataDir();
  if (!fs.existsSync(REQUESTS_DB_FILE)) {
    writeRequestsToDisk(defaultRequests);
    return defaultRequests;
  }

  try {
    const raw = fs.readFileSync(REQUESTS_DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('[adCampaignsApiHandler] Error reading ad_campaign_requests_database.json:', err);
  }
  return defaultRequests;
}

function writeRequestsToDisk(requests: AdCampaignRequest[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(REQUESTS_DB_FILE, JSON.stringify(requests, null, 2), 'utf-8');
    inMemoryRequests = requests;
  } catch (err) {
    console.error('[adCampaignsApiHandler] Error writing ad_campaign_requests_database.json:', err);
  }
}

function sendJson(res: ServerResponse, statusCode: number, data: any): boolean {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session');
  res.end(JSON.stringify(data));
  return true;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export async function handleAdCampaignsApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const method = req.method?.toUpperCase() || 'GET';

  if (!url.startsWith('/api/ad-campaigns') && !url.startsWith('/api/ad-campaign-requests')) {
    return false;
  }

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-session');
    res.end();
    return true;
  }

  if (!inMemoryCampaigns) {
    inMemoryCampaigns = readCampaignsFromDisk();
  }
  if (!inMemoryRequests) {
    inMemoryRequests = readRequestsFromDisk();
  }

  const cleanUrl = url.split('?')[0];

  // ==================== 0. AD CREATION & CAMPAIGN SETTINGS API ====================
  if (cleanUrl === '/api/ad-campaigns/settings') {
    if (method === 'GET') {
      try {
        if (fs.existsSync(SETTINGS_FILE)) {
          const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
          const parsed = JSON.parse(raw);
          return sendJson(res, 200, { success: true, settings: parsed });
        }
      } catch (err) {
        console.error('[adCampaignsApiHandler] Error reading settings:', err);
      }
      return sendJson(res, 200, { 
        success: true, 
        settings: { adCreationFeeMad: 199, adCreationFeeUsd: 20, exchangeRate: 9.95 } 
      });
    }

    if (method === 'POST') {
      try {
        const body = await readBody(req);
        let existing: any = {};
        if (fs.existsSync(SETTINGS_FILE)) {
          try {
            existing = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
          } catch {}
        }
        const updated = {
          ...existing,
          ...body,
          lastUpdated: new Date().toISOString(),
          updatedBy: body.updatedBy || 'الإدارة العامة للمنصة',
        };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
        return sendJson(res, 200, { success: true, settings: updated, message: 'تم حفظ مبلغ وإعدادات إنشاء الإعلان بنجاح.' });
      } catch (err) {
        console.error('[adCampaignsApiHandler] Error saving settings:', err);
        return sendJson(res, 500, { success: false, error: 'فشل في حفظ إعدادات الإعلان' });
      }
    }
  }

  // ==================== 1. AD CAMPAIGN REQUESTS API ====================
  
  // GET /api/ad-campaign-requests or /api/ad-campaigns/requests
  if ((cleanUrl === '/api/ad-campaign-requests' || cleanUrl === '/api/ad-campaigns/requests') && method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      requests: inMemoryRequests,
      total: inMemoryRequests.length,
      lastUpdated: new Date().toISOString(),
    });
  }

  // POST /api/ad-campaign-requests (Create or Update Request)
  if (cleanUrl === '/api/ad-campaign-requests' && method === 'POST') {
    try {
      const body = await readBody(req);
      const incoming: Partial<AdCampaignRequest> = body.request || body;

      if (!incoming.tenantId || !incoming.campaignTitle) {
        return sendJson(res, 400, {
          success: false,
          error: 'بيانات طلب الحملة غير مكتملة (معرف الجمعية وعنوان الحملة مطلوبان)',
        });
      }

      const nowIso = new Date().toISOString();
      let targetReq: AdCampaignRequest;

      if (incoming.id) {
        const idx = inMemoryRequests.findIndex((r) => r.id === incoming.id);
        if (idx >= 0) {
          targetReq = {
            ...inMemoryRequests[idx],
            ...incoming,
            updatedAt: nowIso,
          } as AdCampaignRequest;
          inMemoryRequests[idx] = targetReq;
        } else {
          targetReq = {
            ...incoming,
            id: incoming.id,
            createdAt: incoming.createdAt || nowIso,
            updatedAt: nowIso,
          } as AdCampaignRequest;
          inMemoryRequests.unshift(targetReq);
        }
      } else {
        targetReq = {
          ...incoming,
          id: `ad_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: nowIso,
          updatedAt: nowIso,
        } as AdCampaignRequest;
        inMemoryRequests.unshift(targetReq);
      }

      writeRequestsToDisk(inMemoryRequests);
      return sendJson(res, 200, {
        success: true,
        request: targetReq,
        requests: inMemoryRequests,
      });
    } catch (err: any) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // POST /api/ad-campaign-requests/pay (Link Payment)
  if (cleanUrl === '/api/ad-campaign-requests/pay' && method === 'POST') {
    try {
      const body = await readBody(req);
      const { requestId, paymentId, paymentMethod, paymentReference, paymentAmount, paymentCurrency, proofDocumentUrl, proofFileName, cardLast4, notes } = body;

      const idx = inMemoryRequests.findIndex((r) => r.id === requestId);
      if (idx < 0) {
        return sendJson(res, 404, { success: false, error: 'الطلب غير موجود' });
      }

      const nowIso = new Date().toISOString();
      inMemoryRequests[idx] = {
        ...inMemoryRequests[idx],
        status: 'paid_pending_review',
        paymentStatus: 'pending_verification',
        paymentId: paymentId || inMemoryRequests[idx].paymentId,
        paymentMethod: paymentMethod || inMemoryRequests[idx].paymentMethod,
        paymentReference: paymentReference || inMemoryRequests[idx].paymentReference,
        paymentAmount: paymentAmount || inMemoryRequests[idx].paymentAmount,
        paymentCurrency: paymentCurrency || inMemoryRequests[idx].paymentCurrency,
        paymentSubmittedAt: nowIso,
        proofDocumentUrl: proofDocumentUrl || inMemoryRequests[idx].proofDocumentUrl,
        proofFileName: proofFileName || inMemoryRequests[idx].proofFileName,
        cardLast4: cardLast4 || inMemoryRequests[idx].cardLast4,
        adminNotes: notes || inMemoryRequests[idx].adminNotes,
        updatedAt: nowIso,
      };

      writeRequestsToDisk(inMemoryRequests);
      return sendJson(res, 200, {
        success: true,
        request: inMemoryRequests[idx],
      });
    } catch (err: any) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // POST /api/ad-campaign-requests/review (Approve / Reject / Correction)
  if (cleanUrl === '/api/ad-campaign-requests/review' && method === 'POST') {
    try {
      const body = await readBody(req);
      const { requestId, decision, rejectionReason, correctionNotes, adminNotes, adminName, priorityOrder, startDate, endDate } = body;

      const idx = inMemoryRequests.findIndex((r) => r.id === requestId);
      if (idx < 0) {
        return sendJson(res, 404, { success: false, error: 'الطلب غير موجود' });
      }

      const nowIso = new Date().toISOString();
      const currentReq = inMemoryRequests[idx];
      let activatedCampaign: PlatformAdCampaign | undefined;

      if (decision === 'approve') {
        const finalPriority = priorityOrder !== undefined ? Number(priorityOrder) : (currentReq.requestedPriorityOrder || 1);
        const finalStart = startDate || currentReq.startDate || nowIso;
        let finalEnd = endDate || currentReq.endDate;
        if (!finalEnd) {
          const d = new Date(finalStart);
          d.setMonth(d.getMonth() + (currentReq.monthsCount || 1));
          finalEnd = d.toISOString();
        }

        // Create or update Live PlatformAdCampaign
        const campId = currentReq.approvedCampaignId || `ad_camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const campIdx = inMemoryCampaigns.findIndex((c) => c.id === campId || c.tenantId === currentReq.tenantId);

        if (campIdx >= 0) {
          activatedCampaign = {
            ...inMemoryCampaigns[campIdx],
            priorityOrder: finalPriority,
            startDate: finalStart,
            endDate: finalEnd,
            title: currentReq.campaignTitle,
            notes: adminNotes || currentReq.campaignDescription || 'حملة مفعلة بعد مراجعة الطلب',
            enabled: true,
            updatedAt: nowIso,
          };
          inMemoryCampaigns[campIdx] = activatedCampaign;
        } else {
          activatedCampaign = {
            id: campId,
            tenantId: currentReq.tenantId,
            tenantName: currentReq.tenantName || 'جمعية',
            tenantSlug: currentReq.tenantSlug,
            tenantLogoUrl: currentReq.tenantLogoUrl,
            tenantCity: currentReq.tenantCity,
            tenantCountry: currentReq.tenantCountry,
            priorityOrder: finalPriority,
            startDate: finalStart,
            endDate: finalEnd,
            title: currentReq.campaignTitle,
            notes: adminNotes || currentReq.campaignDescription || 'حملة مفعلة بعد مراجعة الطلب',
            enabled: true,
            createdAt: nowIso,
            updatedAt: nowIso,
            createdBy: adminName || 'الإدارة العامة للمنصة',
          };
          inMemoryCampaigns.push(activatedCampaign);
        }

        writeCampaignsToDisk(inMemoryCampaigns);

        inMemoryRequests[idx] = {
          ...currentReq,
          status: 'approved',
          paymentStatus: 'confirmed',
          approvedCampaignId: activatedCampaign.id,
          startDate: finalStart,
          endDate: finalEnd,
          requestedPriorityOrder: finalPriority,
          reviewedAt: nowIso,
          reviewedBy: adminName || 'الإدارة العامة للمنصة',
          adminNotes: adminNotes || currentReq.adminNotes,
          updatedAt: nowIso,
        };
      } else if (decision === 'reject') {
        inMemoryRequests[idx] = {
          ...currentReq,
          status: 'rejected',
          paymentStatus: currentReq.paymentStatus === 'pending_verification' ? 'failed' : currentReq.paymentStatus,
          rejectionReason: rejectionReason || 'تم رفض الطلب لعدم استيفاء الشروط المطلوبة.',
          reviewedAt: nowIso,
          reviewedBy: adminName || 'الإدارة العامة للمنصة',
          adminNotes: adminNotes || currentReq.adminNotes,
          updatedAt: nowIso,
        };
      } else if (decision === 'correction_requested') {
        inMemoryRequests[idx] = {
          ...currentReq,
          status: 'correction_requested',
          correctionNotes: correctionNotes || 'يرجى مراجعة تفاصيل الحملة وتحديثها.',
          reviewedAt: nowIso,
          reviewedBy: adminName || 'الإدارة العامة للمنصة',
          adminNotes: adminNotes || currentReq.adminNotes,
          updatedAt: nowIso,
        };
      }

      writeRequestsToDisk(inMemoryRequests);
      return sendJson(res, 200, {
        success: true,
        request: inMemoryRequests[idx],
        campaign: activatedCampaign,
      });
    } catch (err: any) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // DELETE /api/ad-campaign-requests/:id
  const deleteReqMatch = cleanUrl.match(/^\/api\/ad-campaign-requests\/([^/]+)$/);
  if (deleteReqMatch && method === 'DELETE') {
    const id = decodeURIComponent(deleteReqMatch[1]);
    const filtered = inMemoryRequests.filter((r) => r.id !== id);
    if (filtered.length === inMemoryRequests.length) {
      return sendJson(res, 404, { success: false, error: 'الطلب غير موجود' });
    }
    inMemoryRequests = filtered;
    writeRequestsToDisk(inMemoryRequests);
    return sendJson(res, 200, { success: true, deletedId: id });
  }

  // ==================== 2. PLATFORM AD CAMPAIGNS API (LIVE RANKING) ====================

  // GET /api/ad-campaigns
  if (cleanUrl === '/api/ad-campaigns' && method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      campaigns: inMemoryCampaigns,
      total: inMemoryCampaigns.length,
      lastUpdated: new Date().toISOString(),
    });
  }

  // POST /api/ad-campaigns (Create or Upsert)
  if (cleanUrl === '/api/ad-campaigns' && method === 'POST') {
    try {
      const body = await readBody(req);
      const incoming: Partial<PlatformAdCampaign> = body.campaign || body;

      if (!incoming.tenantId || !incoming.startDate || !incoming.endDate) {
        return sendJson(res, 400, {
          success: false,
          error: 'بيانات الحملة الإعلانية غير مكتملة (معرف الجمعية، تاريخ البداية والنهاية مطلوبان)',
        });
      }

      const nowIso = new Date().toISOString();
      let targetCampaign: PlatformAdCampaign;

      if (incoming.id) {
        const index = inMemoryCampaigns.findIndex((c) => c.id === incoming.id);
        if (index >= 0) {
          targetCampaign = {
            ...inMemoryCampaigns[index],
            ...incoming,
            priorityOrder: Number(incoming.priorityOrder) || 1,
            updatedAt: nowIso,
          } as PlatformAdCampaign;
          inMemoryCampaigns[index] = targetCampaign;
        } else {
          targetCampaign = {
            id: incoming.id,
            tenantId: incoming.tenantId,
            tenantName: incoming.tenantName || 'جمعية',
            tenantSlug: incoming.tenantSlug,
            tenantLogoUrl: incoming.tenantLogoUrl,
            tenantCity: incoming.tenantCity,
            tenantCountry: incoming.tenantCountry,
            priorityOrder: Number(incoming.priorityOrder) || 1,
            startDate: incoming.startDate,
            endDate: incoming.endDate,
            title: incoming.title || '',
            notes: incoming.notes || '',
            enabled: incoming.enabled !== false,
            createdAt: nowIso,
            updatedAt: nowIso,
            createdBy: incoming.createdBy || 'Super Admin',
          };
          inMemoryCampaigns.push(targetCampaign);
        }
      } else {
        targetCampaign = {
          id: `ad_camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          tenantId: incoming.tenantId,
          tenantName: incoming.tenantName || 'جمعية',
          tenantSlug: incoming.tenantSlug,
          tenantLogoUrl: incoming.tenantLogoUrl,
          tenantCity: incoming.tenantCity,
          tenantCountry: incoming.tenantCountry,
          priorityOrder: Number(incoming.priorityOrder) || 1,
          startDate: incoming.startDate,
          endDate: incoming.endDate,
          title: incoming.title || '',
          notes: incoming.notes || '',
          enabled: incoming.enabled !== false,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: incoming.createdBy || 'Super Admin',
        };
        inMemoryCampaigns.push(targetCampaign);
      }

      writeCampaignsToDisk(inMemoryCampaigns);
      return sendJson(res, 200, {
        success: true,
        campaign: targetCampaign,
        campaigns: inMemoryCampaigns,
      });
    } catch (err: any) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // PATCH /api/ad-campaigns/:id/toggle
  const toggleMatch = cleanUrl.match(/^\/api\/ad-campaigns\/([^/]+)\/toggle$/);
  if (toggleMatch && (method === 'PATCH' || method === 'POST')) {
    try {
      const id = decodeURIComponent(toggleMatch[1]);
      const body = await readBody(req);
      const index = inMemoryCampaigns.findIndex((c) => c.id === id);

      if (index === -1) {
        return sendJson(res, 404, { success: false, error: 'الحملة الإعلانية غير موجودة' });
      }

      const newEnabled = body.enabled !== undefined ? Boolean(body.enabled) : !inMemoryCampaigns[index].enabled;
      inMemoryCampaigns[index] = {
        ...inMemoryCampaigns[index],
        enabled: newEnabled,
        updatedAt: new Date().toISOString(),
      };

      writeCampaignsToDisk(inMemoryCampaigns);
      return sendJson(res, 200, {
        success: true,
        campaign: inMemoryCampaigns[index],
        campaigns: inMemoryCampaigns,
      });
    } catch (err: any) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // DELETE /api/ad-campaigns/:id
  const deleteMatch = cleanUrl.match(/^\/api\/ad-campaigns\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const id = decodeURIComponent(deleteMatch[1]);
    const filtered = inMemoryCampaigns.filter((c) => c.id !== id);

    if (filtered.length === inMemoryCampaigns.length) {
      return sendJson(res, 404, { success: false, error: 'الحملة الإعلانية غير موجودة' });
    }

    inMemoryCampaigns = filtered;
    writeCampaignsToDisk(inMemoryCampaigns);
    return sendJson(res, 200, {
      success: true,
      deletedId: id,
      campaigns: inMemoryCampaigns,
    });
  }

  return false;
}
