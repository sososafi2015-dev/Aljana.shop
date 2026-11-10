import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import type {
  PlatformSetupServiceConfig,
  PlatformSetupServiceItem,
  PlatformSetupServiceRequest,
  SetupServicePaymentStatus,
  SetupServiceExecutionStatus,
} from '../types';
import { offloadBase64ToDisk } from './storageEngine';
import {
  saveDocToFirebaseServer,
  getDocFromFirebaseServer,
  listCollectionFromFirebaseServer,
} from './firebaseServerStorage';

export const DEFAULT_SETUP_SERVICE_ITEMS: PlatformSetupServiceItem[] = [
  {
    id: 'item_interface',
    title: 'إعداد الواجهة الإلكترونية',
    description: 'تصميم وتجهيز واجهة خاصة بجمعيتك تعكس هويتها وأهدافها.',
  },
  {
    id: 'item_info',
    title: 'إضافة معلومات الجمعية',
    description: 'إدخال الاسم الرسمي للجمعية، والشعار، والعنوان، ومعلومات التواصل، والحساب البنكي.',
  },
  {
    id: 'item_card',
    title: 'تجهيز بطاقة الانخراط',
    description: 'تنسيق وإعداد بطاقة انخراط احترافية خاصة بأعضاء الجمعية.',
  },
  {
    id: 'item_stamps',
    title: 'إعداد الأختام والتوقيعات',
    description: 'إضافة ختم الجمعية وختم رئيس الجمعية، وتجهيزهما للاستخدام ضمن الوثائق والنماذج المتاحة على المنصة.',
  },
  {
    id: 'item_sections',
    title: 'تنظيم أقسام المنصة',
    description: 'إعداد الأقسام المختلفة وترتيبها بما يتناسب مع احتياجات الجمعية ويسهّل إدارة شؤونها.',
  },
  {
    id: 'item_activities',
    title: 'إضافة الأنشطة والمشاريع',
    description: 'إدخال أنشطة الجمعية ومشاريعها التنموية والاجتماعية، إذا كانت متوفرة لدى الجمعية.',
  },
  {
    id: 'item_board',
    title: 'إضافة أعضاء مكتب الجمعية',
    description: 'تسجيل بيانات أعضاء المكتب المسير وتنظيم معلوماتهم وفقًا للبيانات المقدمة.',
  },
  {
    id: 'item_members',
    title: 'إضافة المنخرطين',
    description: 'إدخال بيانات المنخرطين الحاليين في الجمعية، إذا توفرت قوائمهم ومعلوماتهم.',
  },
];

export const DEFAULT_SETUP_SERVICE_CONFIG: PlatformSetupServiceConfig = {
  serviceFeeMad: 150,
  currency: 'MAD',
  title: 'سنقوم بإعداد منصة جمعيتك نيابة عنك',
  introText:
    'سنتولى إعداد وتجهيز واجهة منصة جمعيتك بعناية واحترافية، مع إدخال جميع معلوماتها وبياناتها الأساسية، لتكون جاهزة للاستخدام وتسهيل عملية إدارة أنشطتها وتنظيم شؤونها.',
  servicesHeading: 'تشمل خدمتنا:',
  serviceItems: DEFAULT_SETUP_SERVICE_ITEMS,
  goalText: '🤝 هدفنا هو أن نوفّر عليك الوقت والجهد، ونجعل منصة جمعيتك جاهزة للانطلاق.',
  updatedAt: '2025-01-01T00:00:00.000Z',
  updatedBy: 'النظام الرئيسي',
  version: 1,
};

function getDataDir(): string {
  const dir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getConfigFilePath(): string {
  return path.join(getDataDir(), 'platform_setup_service_config.json');
}

function getRequestsFilePath(): string {
  return path.join(getDataDir(), 'platform_setup_service_requests.json');
}

export function sanitizeSetupServiceConfig(raw: any, fallbackVersion = 1): PlatformSetupServiceConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETUP_SERVICE_CONFIG };
  }

  const parsedFee = Number(raw.serviceFeeMad);
  const serviceFeeMad = Number.isFinite(parsedFee) && parsedFee > 0 ? Math.round(parsedFee * 100) / 100 : DEFAULT_SETUP_SERVICE_CONFIG.serviceFeeMad;

  const rawItems = Array.isArray(raw.serviceItems) && raw.serviceItems.length > 0
    ? raw.serviceItems
    : DEFAULT_SETUP_SERVICE_ITEMS;

  const serviceItems: PlatformSetupServiceItem[] = rawItems
    .map((item: any, idx: number) => ({
      id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : `item_${idx + 1}`,
      title: typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : DEFAULT_SETUP_SERVICE_ITEMS[idx]?.title || `خدمة ${idx + 1}`,
      description: typeof item?.description === 'string' && item.description.trim() ? item.description.trim() : DEFAULT_SETUP_SERVICE_ITEMS[idx]?.description || '',
    }))
    .filter((item: PlatformSetupServiceItem) => item.title.length > 0);

  return {
    serviceFeeMad,
    currency: typeof raw.currency === 'string' && raw.currency.trim() ? raw.currency.trim() : 'MAD',
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : DEFAULT_SETUP_SERVICE_CONFIG.title,
    introText: typeof raw.introText === 'string' && raw.introText.trim() ? raw.introText.trim() : DEFAULT_SETUP_SERVICE_CONFIG.introText,
    servicesHeading: typeof raw.servicesHeading === 'string' && raw.servicesHeading.trim() ? raw.servicesHeading.trim() : DEFAULT_SETUP_SERVICE_CONFIG.servicesHeading,
    serviceItems: serviceItems.length > 0 ? serviceItems : DEFAULT_SETUP_SERVICE_ITEMS,
    goalText: typeof raw.goalText === 'string' && raw.goalText.trim() ? raw.goalText.trim() : DEFAULT_SETUP_SERVICE_CONFIG.goalText,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : DEFAULT_SETUP_SERVICE_CONFIG.updatedAt,
    updatedBy: typeof raw.updatedBy === 'string' && raw.updatedBy ? raw.updatedBy : DEFAULT_SETUP_SERVICE_CONFIG.updatedBy,
    version: typeof raw.version === 'number' && raw.version > 0 ? raw.version : fallbackVersion,
  };
}

export function readServerSetupServiceConfig(): PlatformSetupServiceConfig {
  const filePath = getConfigFilePath();
  if (!fs.existsSync(filePath)) {
    const initial = { ...DEFAULT_SETUP_SERVICE_CONFIG };
    try {
      fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write initial setup service config:', err);
    }
    return initial;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return sanitizeSetupServiceConfig(parsed);
  } catch (err) {
    console.error('Failed to read setup service config:', err);
    return { ...DEFAULT_SETUP_SERVICE_CONFIG };
  }
}

export function writeServerSetupServiceConfig(
  incoming: Partial<PlatformSetupServiceConfig>,
  updatedBy = 'الإدارة العامة للمنصة'
): PlatformSetupServiceConfig {
  const current = readServerSetupServiceConfig();
  const nextVersion = (current.version || 1) + 1;
  const merged = sanitizeSetupServiceConfig(
    {
      ...current,
      ...incoming,
      updatedAt: new Date().toISOString(),
      updatedBy: incoming.updatedBy || updatedBy,
      version: nextVersion,
    },
    nextVersion
  );

  const filePath = getConfigFilePath();
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(merged, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);

  return readServerSetupServiceConfig();
}

export function readServerSetupServiceRequests(): PlatformSetupServiceRequest[] {
  const filePath = getRequestsFilePath();
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
    } catch {}
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read setup service requests:', err);
    return [];
  }
}

export function writeServerSetupServiceRequests(requests: PlatformSetupServiceRequest[]): PlatformSetupServiceRequest[] {
  const filePath = getRequestsFilePath();
  const tempPath = `${filePath}.tmp`;
  const clean = Array.isArray(requests) ? requests : [];
  fs.writeFileSync(tempPath, JSON.stringify(clean, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
  return clean;
}

function sendJson(res: ServerResponse, statusCode: number, payload: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export async function handleSetupServiceApi(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const rawUrl = req.url || '';
  const urlObj = new URL(rawUrl, 'http://localhost');
  const pathname = urlObj.pathname;

  if (!pathname.startsWith('/api/setup-service')) {
    return false;
  }

  try {
    // 1. GET /api/setup-service/config
    if (pathname === '/api/setup-service/config' && req.method === 'GET') {
      let config = readServerSetupServiceConfig();
      try {
        const cloudConfig = await getDocFromFirebaseServer<PlatformSetupServiceConfig>('platform_setup_service', 'config');
        if (cloudConfig && typeof cloudConfig.serviceFeeMad === 'number' && cloudConfig.serviceFeeMad > 0) {
          const cloudVer = Number(cloudConfig.version || 0);
          const localVer = Number(config.version || 0);
          if (cloudVer > localVer || (config.updatedAt === '2025-01-01T00:00:00.000Z' && cloudConfig.updatedAt !== '2025-01-01T00:00:00.000Z')) {
            config = sanitizeSetupServiceConfig(cloudConfig, cloudVer || 1);
            const filePath = getConfigFilePath();
            fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
          }
        }
      } catch (err) {
        console.warn('[SetupServiceAPI] Cloud config check warning:', err);
      }
      sendJson(res, 200, { ok: true, config });
      return true;
    }

    // 2. PUT or POST /api/setup-service/config
    if (pathname === '/api/setup-service/config' && (req.method === 'PUT' || req.method === 'POST')) {
      const body = await parseJsonBody(req);
      const rawConfig = body.config || body;

      const feeNum = Number(rawConfig?.serviceFeeMad);
      if (!Number.isFinite(feeNum) || feeNum <= 0) {
        sendJson(res, 400, {
          ok: false,
          error: 'يرجى إدخال مبلغ صحيح وأكبر من صفر لرسوم الخدمة (لا يُسمح بالقيم السالبة أو الصفرية).',
        });
        return true;
      }

      const saved = writeServerSetupServiceConfig(rawConfig, body.updatedBy || rawConfig?.updatedBy || 'الإدارة العامة للمنصة');

      // Sync to Cloud Firestore permanently
      try {
        await saveDocToFirebaseServer('platform_setup_service', 'config', saved);
      } catch (cloudErr) {
        console.warn('[SetupServiceAPI] Cloud Firestore save warning:', cloudErr);
      }

      // Read-after-write verification
      const verified = readServerSetupServiceConfig();
      sendJson(res, 200, {
        ok: true,
        config: verified,
        message: 'تم حفظ التعديلات بنجاح',
      });
      return true;
    }

    // 3. GET /api/setup-service/requests
    if (pathname === '/api/setup-service/requests' && req.method === 'GET') {
      const tenantIdFilter = urlObj.searchParams.get('tenantId')?.trim() || '';
      let requests = readServerSetupServiceRequests();

      // Merge any requests from Cloud Firestore if local list is empty or missing items
      try {
        const cloudDocs = await listCollectionFromFirebaseServer<PlatformSetupServiceRequest>('setup_service_requests');
        if (Array.isArray(cloudDocs) && cloudDocs.length > 0) {
          const mapById = new Map<string, PlatformSetupServiceRequest>();
          for (const r of requests) {
            if (r && r.id) mapById.set(r.id, r);
          }
          let changed = false;
          for (const c of cloudDocs) {
            if (c && c.id) {
              const existing = mapById.get(c.id);
              if (!existing || (c.updatedAt && (!existing.updatedAt || c.updatedAt > existing.updatedAt))) {
                mapById.set(c.id, c);
                changed = true;
              }
            }
          }
          if (changed) {
            requests = Array.from(mapById.values()).sort(
              (a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime()
            );
            writeServerSetupServiceRequests(requests);
          }
        }
      } catch (err) {
        console.warn('[SetupServiceAPI] Cloud requests merge warning:', err);
      }

      const sorted = [...requests].sort(
        (a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime()
      );
      const filtered = tenantIdFilter
        ? sorted.filter((r) => r.tenantId === tenantIdFilter)
        : sorted;

      sendJson(res, 200, { ok: true, requests: filtered });
      return true;
    }

    // 4. POST /api/setup-service/requests (Submit a new setup service payment request)
    if (pathname === '/api/setup-service/requests' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const reqData = body.request || body;

      const tenantId = typeof reqData.tenantId === 'string' ? reqData.tenantId.trim() : '';
      const tenantName = typeof reqData.tenantName === 'string' ? reqData.tenantName.trim() : '';
      if (!tenantId || !tenantName) {
        sendJson(res, 400, {
          ok: false,
          error: 'بيانات الجمعية غير مكتملة (معرف الجمعية واسمها مطلوبان لربط الطلب).',
        });
        return true;
      }

      const currentConfig = readServerSetupServiceConfig();
      const amount = Number.isFinite(Number(reqData.amount)) && Number(reqData.amount) > 0
        ? Number(reqData.amount)
        : currentConfig.serviceFeeMad;

      let proofDocumentUrl = typeof reqData.proofDocumentUrl === 'string' ? reqData.proofDocumentUrl : '';
      if (proofDocumentUrl && proofDocumentUrl.startsWith('data:image/')) {
        try {
          proofDocumentUrl = offloadBase64ToDisk(proofDocumentUrl) || proofDocumentUrl;
        } catch (err) {
          console.warn('[SetupServiceAPI] Failed to offload receipt data URL:', err);
        }
      }

      const nowIso = new Date().toISOString();
      const newRequest: PlatformSetupServiceRequest = {
        id: typeof reqData.id === 'string' && reqData.id.trim()
          ? reqData.id.trim()
          : `setup_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tenantId,
        tenantName,
        tenantSlug: reqData.tenantSlug || '',
        tenantCity: reqData.tenantCity || '',
        tenantCountry: reqData.tenantCountry || 'المغرب',
        ownerId: reqData.ownerId || '',
        ownerName: reqData.ownerName || 'مسؤول الجمعية',
        ownerPhone: reqData.ownerPhone || '',
        amount,
        currency: reqData.currency || currentConfig.currency || 'MAD',
        paymentMethod: reqData.paymentMethod || 'bank_transfer',
        paymentMethodLabel: reqData.paymentMethodLabel || 'تحويل بنكي',
        proofDocumentUrl,
        proofFileName: reqData.proofFileName || '',
        transactionReference: reqData.transactionReference || '',
        notes: reqData.notes || '',
        // Critical rule: always start as 'pending_review' until verified by General Administration
        paymentStatus: 'pending_review',
        serviceStatus: 'pending_review',
        submittedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const existing = readServerSetupServiceRequests();
      const updated = [newRequest, ...existing.filter((r) => r.id !== newRequest.id)];
      writeServerSetupServiceRequests(updated);

      try {
        await saveDocToFirebaseServer('setup_service_requests', newRequest.id, newRequest);
      } catch (err) {
        console.warn('[SetupServiceAPI] Cloud Firestore request save warning:', err);
      }

      sendJson(res, 200, {
        ok: true,
        request: newRequest,
        message: 'تم إرسال طلب إعداد المنصة وإثبات الدفع بنجاح وهو الآن قيد المراجعة.',
      });
      return true;
    }

    // 5. PUT or POST /api/setup-service/requests/status (General Administration review & status update)
    if (pathname === '/api/setup-service/requests/status' && (req.method === 'PUT' || req.method === 'POST')) {
      const body = await parseJsonBody(req);
      const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
      if (!requestId) {
        sendJson(res, 400, { ok: false, error: 'معرف الطلب مطلوب.' });
        return true;
      }

      const requests = readServerSetupServiceRequests();
      const idx = requests.findIndex((r) => r.id === requestId);
      if (idx === -1) {
        sendJson(res, 404, { ok: false, error: 'لم يتم العثور على الطلب المحدد.' });
        return true;
      }

      const target = requests[idx];
      const nextPaymentStatus: SetupServicePaymentStatus = body.paymentStatus || target.paymentStatus;
      let nextServiceStatus: SetupServiceExecutionStatus = body.serviceStatus || target.serviceStatus;

      // Enforce requirement: Service cannot be considered paid or completed before payment verification
      if (nextPaymentStatus !== 'verified' && (nextServiceStatus === 'in_progress' || nextServiceStatus === 'completed')) {
        sendJson(res, 400, {
          ok: false,
          error: 'لا يمكن اعتبار الخدمة مدفوعة أو مكتملة قبل التحقق من الدفع وتأكيده أولاً.',
        });
        return true;
      }

      if (nextPaymentStatus === 'rejected') {
        nextServiceStatus = 'rejected';
      } else if (nextPaymentStatus === 'verified' && nextServiceStatus === 'pending_review') {
        nextServiceStatus = 'in_progress';
      }

      const nowIso = new Date().toISOString();
      const updatedRequest: PlatformSetupServiceRequest = {
        ...target,
        paymentStatus: nextPaymentStatus,
        serviceStatus: nextServiceStatus,
        rejectionReason: body.rejectionReason !== undefined ? body.rejectionReason : target.rejectionReason,
        adminNotes: body.adminNotes !== undefined ? body.adminNotes : target.adminNotes,
        reviewedAt: nowIso,
        reviewedBy: body.reviewedBy || 'الإدارة العامة للمنصة',
        updatedAt: nowIso,
      };

      requests[idx] = updatedRequest;
      writeServerSetupServiceRequests(requests);

      try {
        await saveDocToFirebaseServer('setup_service_requests', updatedRequest.id, updatedRequest);
      } catch (err) {
        console.warn('[SetupServiceAPI] Cloud Firestore status update warning:', err);
      }

      sendJson(res, 200, {
        ok: true,
        request: updatedRequest,
        message: 'تم تحديث حالة الطلب بنجاح.',
      });
      return true;
    }

    sendJson(res, 404, { ok: false, error: 'Setup service endpoint not found' });
    return true;
  } catch (err: any) {
    console.error('SetupService API Error:', err);
    sendJson(res, 500, { ok: false, error: err?.message || 'Internal Server Error' });
    return true;
  }
}
