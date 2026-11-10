import type {
  PlatformSetupServiceConfig,
  PlatformSetupServiceItem,
  PlatformSetupServiceRequest,
  SetupServicePaymentStatus,
  SetupServiceExecutionStatus,
} from './types';
import { ensurePermanentImageUrl } from './api/imageApi';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

async function saveDocToFirestore(collectionName: string, docId: string, data: any): Promise<void> {
  await setDoc(doc(db, collectionName, docId), data, { merge: true });
}

async function getDocFromFirestore<T = any>(collectionName: string, docId: string): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, docId));
  return snap.exists() ? (snap.data() as T) : null;
}

async function listDocsFromFirestore<T = any>(collectionName: string): Promise<T[]> {
  const snap = await getDocs(collection(db, collectionName));
  const items: T[] = [];
  snap.forEach((d) => items.push(d.data() as T));
  return items;
}

const CONFIG_STORAGE_KEY = 'chayef_platform_setup_service_config_v1';
const REQUESTS_STORAGE_KEY = 'chayef_platform_setup_service_requests_v1';

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

let memoryConfigCache: PlatformSetupServiceConfig | null = null;
let memoryRequestsCache: PlatformSetupServiceRequest[] | null = null;

function sanitizeClientSetupConfig(raw: any): PlatformSetupServiceConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETUP_SERVICE_CONFIG };
  }

  const parsedFee = Number(raw.serviceFeeMad);
  const serviceFeeMad =
    Number.isFinite(parsedFee) && parsedFee > 0
      ? Math.round(parsedFee * 100) / 100
      : DEFAULT_SETUP_SERVICE_CONFIG.serviceFeeMad;

  const rawItems =
    Array.isArray(raw.serviceItems) && raw.serviceItems.length > 0
      ? raw.serviceItems
      : DEFAULT_SETUP_SERVICE_ITEMS;

  const serviceItems: PlatformSetupServiceItem[] = rawItems
    .map((item: any, idx: number) => ({
      id:
        typeof item?.id === 'string' && item.id.trim()
          ? item.id.trim()
          : `item_${idx + 1}`,
      title:
        typeof item?.title === 'string' && item.title.trim()
          ? item.title.trim()
          : DEFAULT_SETUP_SERVICE_ITEMS[idx]?.title || `خدمة ${idx + 1}`,
      description:
        typeof item?.description === 'string' && item.description.trim()
          ? item.description.trim()
          : DEFAULT_SETUP_SERVICE_ITEMS[idx]?.description || '',
    }))
    .filter((item: PlatformSetupServiceItem) => item.title.length > 0);

  return {
    serviceFeeMad,
    currency: typeof raw.currency === 'string' && raw.currency.trim() ? raw.currency.trim() : 'MAD',
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : DEFAULT_SETUP_SERVICE_CONFIG.title,
    introText:
      typeof raw.introText === 'string' && raw.introText.trim()
        ? raw.introText.trim()
        : DEFAULT_SETUP_SERVICE_CONFIG.introText,
    servicesHeading:
      typeof raw.servicesHeading === 'string' && raw.servicesHeading.trim()
        ? raw.servicesHeading.trim()
        : DEFAULT_SETUP_SERVICE_CONFIG.servicesHeading,
    serviceItems: serviceItems.length > 0 ? serviceItems : DEFAULT_SETUP_SERVICE_ITEMS,
    goalText:
      typeof raw.goalText === 'string' && raw.goalText.trim()
        ? raw.goalText.trim()
        : DEFAULT_SETUP_SERVICE_CONFIG.goalText,
    updatedAt:
      typeof raw.updatedAt === 'string' && raw.updatedAt
        ? raw.updatedAt
        : DEFAULT_SETUP_SERVICE_CONFIG.updatedAt,
    updatedBy:
      typeof raw.updatedBy === 'string' && raw.updatedBy
        ? raw.updatedBy
        : DEFAULT_SETUP_SERVICE_CONFIG.updatedBy,
    version: typeof raw.version === 'number' && raw.version > 0 ? raw.version : 1,
  };
}

function broadcastConfigUpdated(config: PlatformSetupServiceConfig) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('setup-service-config-updated', { detail: config }));
  }
}

function broadcastRequestsUpdated(requests: PlatformSetupServiceRequest[]) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('setup-service-requests-updated', { detail: requests }));
  }
}

export function getSetupServiceConfigSync(): PlatformSetupServiceConfig {
  if (memoryConfigCache) {
    return memoryConfigCache;
  }
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryConfigCache = sanitizeClientSetupConfig(parsed);
      return memoryConfigCache;
    }
  } catch (e) {
    console.warn('Failed to read setup service config from localStorage:', e);
  }
  return { ...DEFAULT_SETUP_SERVICE_CONFIG };
}

export async function fetchSetupServiceConfigFromServer(): Promise<PlatformSetupServiceConfig> {
  try {
    const res = await fetch('/api/setup-service/config', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.config) {
        const clean = sanitizeClientSetupConfig(data.config);
        memoryConfigCache = clean;
        try {
          localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(clean));
        } catch {}
        broadcastConfigUpdated(clean);
        return clean;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch setup service config from API, trying Firestore:', err);
  }

  try {
    const cloudDoc = await getDocFromFirestore<PlatformSetupServiceConfig>('platform_setup_service', 'config');
    if (cloudDoc && typeof cloudDoc.serviceFeeMad === 'number' && cloudDoc.serviceFeeMad > 0) {
      const clean = sanitizeClientSetupConfig(cloudDoc);
      memoryConfigCache = clean;
      try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(clean));
      } catch {}
      broadcastConfigUpdated(clean);
      return clean;
    }
  } catch (err) {
    console.warn('Failed to fetch setup service config from Firestore:', err);
  }

  return getSetupServiceConfigSync();
}

export async function saveSetupServiceConfigPermanent(
  configInput: Partial<PlatformSetupServiceConfig>,
  updatedBy = 'الإدارة العامة للمنصة'
): Promise<{ ok: boolean; config: PlatformSetupServiceConfig; error?: string }> {
  const feeNum = Number(configInput.serviceFeeMad);
  if (!Number.isFinite(feeNum) || feeNum <= 0) {
    return {
      ok: false,
      config: getSetupServiceConfigSync(),
      error: 'يرجى إدخال مبلغ صحيح وأكبر من صفر لرسوم الخدمة (لا يُسمح بالقيم غير الصالحة أو الصفرية أو السالبة).',
    };
  }

  const current = getSetupServiceConfigSync();
  const payload: PlatformSetupServiceConfig = sanitizeClientSetupConfig({
    ...current,
    ...configInput,
    serviceFeeMad: Math.round(feeNum * 100) / 100,
    updatedAt: new Date().toISOString(),
    updatedBy,
    version: (current.version || 1) + 1,
  });

  try {
    const res = await fetch('/api/setup-service/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: payload, updatedBy }),
    });

    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        config: current,
        error: data?.error || 'تعذر حفظ التعديلات في قاعدة البيانات.',
      };
    }

    // Also persist to Cloud Firestore from client SDK for redundancy
    try {
      await saveDocToFirestore('platform_setup_service', 'config', data.config || payload);
    } catch (cloudErr) {
      console.warn('Client Firestore sync warning for setup service config:', cloudErr);
    }

    // Read-after-write verification: re-fetch from server database to guarantee persistence
    const verified = await fetchSetupServiceConfigFromServer();
    if (Number(verified.serviceFeeMad) !== Number(payload.serviceFeeMad)) {
      return {
        ok: false,
        config: verified,
        error: 'فشل التحقق من مطابقة البيانات المحفوظة في قاعدة البيانات.',
      };
    }

    memoryConfigCache = verified;
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(verified));
    } catch {}
    broadcastConfigUpdated(verified);

    return { ok: true, config: verified };
  } catch (err: any) {
    console.error('Error saving setup service config:', err);
    return {
      ok: false,
      config: current,
      error: err?.message || 'حدث خطأ أثناء الاتصال بقاعدة البيانات لحفظ التعديلات.',
    };
  }
}

export function getSetupServiceRequestsSync(tenantId?: string): PlatformSetupServiceRequest[] {
  let list: PlatformSetupServiceRequest[] = [];
  if (memoryRequestsCache) {
    list = memoryRequestsCache;
  } else {
    try {
      const raw = localStorage.getItem(REQUESTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed;
          memoryRequestsCache = list;
        }
      }
    } catch {}
  }

  const sorted = [...list].sort(
    (a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime()
  );
  return tenantId ? sorted.filter((r) => r.tenantId === tenantId) : sorted;
}

export async function fetchSetupServiceRequestsFromServer(
  tenantId?: string
): Promise<PlatformSetupServiceRequest[]> {
  try {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await fetch(`/api/setup-service/requests${query}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.requests)) {
        if (!tenantId) {
          memoryRequestsCache = data.requests;
          try {
            localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(data.requests));
          } catch {}
        }
        return data.requests;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch setup service requests from server:', err);
  }

  try {
    const cloudDocs = await listDocsFromFirestore<PlatformSetupServiceRequest>('setup_service_requests');
    if (Array.isArray(cloudDocs) && cloudDocs.length > 0) {
      const sorted = cloudDocs.sort(
        (a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime()
      );
      memoryRequestsCache = sorted;
      try {
        localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(sorted));
      } catch {}
      return tenantId ? sorted.filter((r) => r.tenantId === tenantId) : sorted;
    }
  } catch {}

  return getSetupServiceRequestsSync(tenantId);
}

export async function submitSetupServicePaymentRequest(input: {
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  tenantCity?: string;
  tenantCountry?: string;
  ownerId?: string;
  ownerName: string;
  ownerPhone: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  proofDocumentUrl?: string;
  proofFileName?: string;
  transactionReference?: string;
  notes?: string;
}): Promise<{ ok: boolean; request?: PlatformSetupServiceRequest; error?: string }> {
  try {
    let permanentProofUrl = input.proofDocumentUrl || '';
    if (permanentProofUrl && permanentProofUrl.startsWith('data:')) {
      permanentProofUrl = await ensurePermanentImageUrl(permanentProofUrl, input.tenantId);
    }

    const res = await fetch('/api/setup-service/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request: {
          ...input,
          proofDocumentUrl: permanentProofUrl,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok || !data?.ok || !data?.request) {
      return {
        ok: false,
        error: data?.error || 'تعذر تسجيل طلب الخدمة في قاعدة البيانات.',
      };
    }

    const savedReq: PlatformSetupServiceRequest = data.request;

    // Also persist to Cloud Firestore from client
    try {
      await saveDocToFirestore('setup_service_requests', savedReq.id, savedReq);
    } catch (cloudErr) {
      console.warn('Client Firestore sync warning for setup service request:', cloudErr);
    }

    const currentList = getSetupServiceRequestsSync();
    const updatedList = [savedReq, ...currentList.filter((r) => r.id !== savedReq.id)];
    memoryRequestsCache = updatedList;
    try {
      localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(updatedList));
    } catch {}
    broadcastRequestsUpdated(updatedList);

    return { ok: true, request: savedReq };
  } catch (err: any) {
    console.error('Error submitting setup service request:', err);
    return {
      ok: false,
      error: err?.message || 'حدث خطأ أثناء إرسال طلب تسديد مبلغ الخدمة.',
    };
  }
}

export async function updateSetupServiceRequestStatus(input: {
  requestId: string;
  paymentStatus: SetupServicePaymentStatus;
  serviceStatus: SetupServiceExecutionStatus;
  rejectionReason?: string;
  adminNotes?: string;
  reviewedBy?: string;
}): Promise<{ ok: boolean; request?: PlatformSetupServiceRequest; error?: string }> {
  try {
    const res = await fetch('/api/setup-service/requests/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await res.json();
    if (!res.ok || !data?.ok || !data?.request) {
      return {
        ok: false,
        error: data?.error || 'تعذر تحديث حالة الطلب.',
      };
    }

    const updatedReq: PlatformSetupServiceRequest = data.request;
    try {
      await saveDocToFirestore('setup_service_requests', updatedReq.id, updatedReq);
    } catch {}

    const currentList = getSetupServiceRequestsSync();
    const nextList = currentList.map((r) => (r.id === updatedReq.id ? updatedReq : r));
    memoryRequestsCache = nextList;
    try {
      localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(nextList));
    } catch {}
    broadcastRequestsUpdated(nextList);

    return { ok: true, request: updatedReq };
  } catch (err: any) {
    console.error('Error updating setup service request status:', err);
    return {
      ok: false,
      error: err?.message || 'حدث خطأ أثناء تحديث حالة الطلب.',
    };
  }
}
