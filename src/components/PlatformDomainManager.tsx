import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Globe,
  History,
  Info,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  Wrench,
  X,
} from 'lucide-react';
import type {
  DnsRecordItem,
  DnsRecordType,
  DomainAuditLogEntry,
  DomainConnectionStatus,
  MasterAdminSession,
  PlatformDomainConfig,
} from '../types';
import {
  deletePlatformDomain,
  fetchPlatformDomains,
  HOSTINGER_DEFAULT_NAMESERVERS,
  isValidDomainNameClient,
  normalizeDomainNameClient,
  normalizeTargetUrlClient,
  savePlatformDomain,
  verifyPlatformDomain,
} from '../api/domainsApi';

interface PlatformDomainManagerProps {
  currentSession: MasterAdminSession | null;
  isSuperAdmin: boolean;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const DNS_RECORD_TYPES: DnsRecordType[] = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS'];

const TTL_PRESETS = [
  { label: '5 دقائق (300)', value: 300 },
  { label: 'ساعة واحدة (3600)', value: 3600 },
  { label: '4 ساعات (14400)', value: 14400 },
  { label: '24 ساعة (86400)', value: 86400 },
];

function getDefaultTargetUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    if (window.location.origin.includes('al-shaif-association.ai.studio')) {
      return 'https://youx.ai.studio';
    }
    return window.location.origin;
  }
  return 'https://youx.ai.studio';
}

function getStatusBadgeMeta(status: DomainConnectionStatus): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: 'connected' | 'pending' | 'error' | 'not_linked';
} {
  switch (status) {
    case 'connected':
      return {
        label: 'متصل بنجاح',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-800',
        borderClass: 'border-emerald-200',
        icon: 'connected',
      };
    case 'pending_dns':
      return {
        label: 'في انتظار تحديث DNS',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-900',
        borderClass: 'border-amber-200',
        icon: 'pending',
      };
    case 'dns_error':
      return {
        label: 'يوجد خطأ في إعدادات DNS',
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-800',
        borderClass: 'border-rose-200',
        icon: 'error',
      };
    case 'not_linked':
    default:
      return {
        label: 'لم يتم الربط بعد',
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-700',
        borderClass: 'border-slate-200',
        icon: 'not_linked',
      };
  }
}

function formatArabicDateTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ar-MA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const PlatformDomainManager: React.FC<PlatformDomainManagerProps> = ({
  currentSession,
  isSuperAdmin,
  onShowToast,
}) => {
  const hasSuperAccess =
    isSuperAdmin &&
    Boolean(currentSession) &&
    currentSession?.role !== 'secondary_admin' &&
    (currentSession?.isMaster === true || currentSession?.role === 'super_admin');

  const [domains, setDomains] = useState<PlatformDomainConfig[]>([]);
  const [globalAuditLogs, setGlobalAuditLogs] = useState<DomainAuditLogEntry[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Domain & Nameservers Form State
  const [domainName, setDomainName] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>(getDefaultTargetUrl);
  const [providerPreset, setProviderPreset] = useState<'hostinger' | 'custom'>('hostinger');
  const [nameservers, setNameservers] = useState<string[]>([...HOSTINGER_DEFAULT_NAMESERVERS]);
  const [dnsRecords, setDnsRecords] = useState<DnsRecordItem[]>([]);
  const [isDnsEditingUnlocked, setIsDnsEditingUnlocked] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // DNS Record Sub-Form State (Add / Edit)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordType, setRecordType] = useState<DnsRecordType>('A');
  const [recordHost, setRecordHost] = useState<string>('@');
  const [recordValue, setRecordValue] = useState<string>('');
  const [recordTtl, setRecordTtl] = useState<number>(3600);
  const [recordPriority, setRecordPriority] = useState<string>('10');
  const [showRecordForm, setShowRecordForm] = useState<boolean>(false);

  // Delete Confirmation Modals (in-UI, never window.confirm)
  const [confirmDeleteDomain, setConfirmDeleteDomain] = useState<PlatformDomainConfig | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<DnsRecordItem | null>(null);

  const dnsConfigSectionRef = useRef<HTMLDivElement | null>(null);

  const selectedDomain = useMemo(
    () => domains.find((d) => d.id === selectedDomainId) || null,
    [domains, selectedDomainId]
  );

  const domainAuditLogs = useMemo(() => {
    if (selectedDomain) {
      const merged = [
        ...(selectedDomain.auditLogs || []),
        ...globalAuditLogs.filter((l) => l.domainId === selectedDomain.id),
      ];
      const map = new Map<string, DomainAuditLogEntry>();
      for (const item of merged) {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      }
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }
    return globalAuditLogs;
  }, [selectedDomain, globalAuditLogs]);

  const populateFormFromDomain = (dom: PlatformDomainConfig | null) => {
    if (!dom) {
      setSelectedDomainId(null);
      setDomainName('');
      setTargetUrl(getDefaultTargetUrl());
      setProviderPreset('hostinger');
      setNameservers([...HOSTINGER_DEFAULT_NAMESERVERS]);
      setDnsRecords([]);
      setIsDnsEditingUnlocked(true);
      setShowRecordForm(false);
      setEditingRecordId(null);
      return;
    }

    setSelectedDomainId(dom.id);
    setDomainName(dom.domainName);
    setTargetUrl(dom.targetUrl);
    setProviderPreset(dom.providerPreset || 'hostinger');
    const nsList = Array.isArray(dom.nameservers) && dom.nameservers.length >= 2
      ? [...dom.nameservers]
      : [
          dom.nameservers?.[0] || HOSTINGER_DEFAULT_NAMESERVERS[0],
          dom.nameservers?.[1] || HOSTINGER_DEFAULT_NAMESERVERS[1],
        ];
    setNameservers(nsList);
    setDnsRecords(Array.isArray(dom.dnsRecords) ? [...dom.dnsRecords] : []);
    setIsDnsEditingUnlocked(false);
    setShowRecordForm(false);
    setEditingRecordId(null);
  };

  const loadDomains = async (preferredId?: string | null) => {
    if (!hasSuperAccess) return;
    setIsLoading(true);
    const res = await fetchPlatformDomains(currentSession);
    setIsLoading(false);
    if (!res.success) {
      onShowToast(res.error || 'تعذر تحميل إعدادات الدومينات.', 'error');
      return;
    }

    setDomains(res.domains);
    setGlobalAuditLogs(res.auditLogs);

    if (res.domains.length > 0) {
      const targetId = preferredId !== undefined ? preferredId : selectedDomainId;
      const matched = targetId ? res.domains.find((d) => d.id === targetId) : res.domains[0];
      populateFormFromDomain(matched || res.domains[0]);
    } else {
      populateFormFromDomain(null);
    }
  };

  useEffect(() => {
    loadDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSuperAccess]);

  if (!hasSuperAccess) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm" dir="rtl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-base font-black text-rose-900">صلاحية مقيدة — المدير العام فقط</h2>
        <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
          قسم «🌐 ضومين (Domain Management)» مخصص للمدير العام للمنصة (Super Admin) فقط ولا يمكن عرضه أو تعديله من طرف المشرفين المساعدين أو مديري الجمعيات.
        </p>
      </div>
    );
  }

  const handleCopyText = async (text: string, key: string, successLabel: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      onShowToast(successLabel, 'success');
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2200);
    } catch {
      onShowToast('تعذر النسخ التلقائي، يرجى النسخ يدوياً.', 'error');
    }
  };

  const handleApplyHostingerPreset = () => {
    setProviderPreset('hostinger');
    const extras = nameservers.slice(2);
    setNameservers([...HOSTINGER_DEFAULT_NAMESERVERS, ...extras]);
    setIsDnsEditingUnlocked(true);
    onShowToast('تم تعبئة خوادم أسماء Hostinger الافتراضية. يمكنك تعديلها أو حفظها الآن.', 'info');
  };

  const handleNameserverChange = (index: number, value: string) => {
    setNameservers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddExtraNameserver = () => {
    if (nameservers.length >= 10) {
      onShowToast('الحد الأقصى لخوادم DNS هو 10 خوادم.', 'info');
      return;
    }
    setIsDnsEditingUnlocked(true);
    setNameservers((prev) => [...prev, '']);
  };

  const handleRemoveNameserver = (index: number) => {
    if (index < 2) return; // Keep primary & secondary required slots
    setNameservers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDomain = async (
    customRecords?: DnsRecordItem[],
    auditMeta?: { action: DomainAuditLogEntry['action']; details: string }
  ): Promise<PlatformDomainConfig | null> => {
    const cleanDomain = normalizeDomainNameClient(domainName);
    const cleanTarget = normalizeTargetUrlClient(targetUrl);

    if (!isValidDomainNameClient(cleanDomain)) {
      onShowToast('يرجى إدخال اسم دومين صحيح (مثال: youx.ai.studio).', 'error');
      return null;
    }
    if (!cleanTarget) {
      onShowToast('يرجى إدخال عنوان الموقع المستهدف بشكل صحيح (مثال: https://youx.ai.studio).', 'error');
      return null;
    }

    const cleanedNs = nameservers
      .map((ns) => normalizeDomainNameClient(ns))
      .filter(Boolean);

    if (cleanedNs.length < 2) {
      onShowToast('يرجى إدخال خادمي DNS على الأقل (Nameserver 1 و Nameserver 2).', 'error');
      return null;
    }

    setIsSaving(true);
    const res = await savePlatformDomain(
      {
        id: selectedDomainId || undefined,
        domainName: cleanDomain,
        targetUrl: cleanTarget,
        providerPreset,
        nameservers: cleanedNs,
        dnsRecords: customRecords || dnsRecords,
        auditAction: auditMeta?.action,
        auditDetails: auditMeta?.details,
      },
      currentSession
    );
    setIsSaving(false);

    if (!res.success || !res.domain) {
      onShowToast(res.error || 'تعذر حفظ إعدادات الدومين.', 'error');
      return null;
    }

    if (res.domains) setDomains(res.domains);
    if (res.auditLogs) setGlobalAuditLogs(res.auditLogs);
    populateFormFromDomain(res.domain);
    onShowToast(
      res.message || 'تم حفظ إعدادات الدومين في Firebase Firestore بنجاح.',
      'success'
    );
    return res.domain;
  };

  const handleUnlockDnsEditing = () => {
    setIsDnsEditingUnlocked(true);
    dnsConfigSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    onShowToast('تم تفعيل وضع تعديل إعدادات DNS وخوادم الأسماء.', 'info');
  };

  const handleVerifyDomain = async () => {
    let domainToVerify = selectedDomain;

    // Check if there are unsaved form changes or new domain not yet persisted
    const cleanDomain = normalizeDomainNameClient(domainName);
    const cleanTarget = normalizeTargetUrlClient(targetUrl);
    const cleanedNs = nameservers.map((ns) => normalizeDomainNameClient(ns)).filter(Boolean);

    const hasUnsavedChanges =
      !domainToVerify ||
      domainToVerify.domainName !== cleanDomain ||
      domainToVerify.targetUrl !== cleanTarget ||
      JSON.stringify(domainToVerify.nameservers) !== JSON.stringify(cleanedNs) ||
      JSON.stringify(domainToVerify.dnsRecords) !== JSON.stringify(dnsRecords);

    if (hasUnsavedChanges) {
      const saved = await handleSaveDomain(dnsRecords, {
        action: domainToVerify ? 'update' : 'create',
        details: `حفظ التعديلات قبل إجراء التحقق الفعلي للدومين (${cleanDomain})`,
      });
      if (!saved) return;
      domainToVerify = saved;
    }

    if (!domainToVerify) return;

    setIsVerifying(true);
    const res = await verifyPlatformDomain(domainToVerify.id, currentSession);
    setIsVerifying(false);

    if (!res.success || !res.domain) {
      onShowToast(res.error || 'تعذر إجراء التحقق الفعلي من الدومين.', 'error');
      return;
    }

    if (res.domains) setDomains(res.domains);
    if (res.auditLogs) setGlobalAuditLogs(res.auditLogs);
    populateFormFromDomain(res.domain);

    if (res.domain.status === 'connected') {
      onShowToast('تم التحقق الفعلي: الدومين متصل بنجاح.', 'success');
    } else if (res.domain.status === 'pending_dns') {
      onShowToast('نتيجة الفحص: الدومين في انتظار تحديث أو انتشار DNS.', 'info');
    } else {
      onShowToast('نتيجة الفحص: يوجد خطأ أو تعارض في إعدادات DNS.', 'error');
    }
  };

  const handleOpenAddDnsRecord = () => {
    setEditingRecordId(null);
    setRecordType('A');
    setRecordHost('@');
    setRecordValue('');
    setRecordTtl(3600);
    setRecordPriority('10');
    setShowRecordForm(true);
  };

  const handleOpenEditDnsRecord = (rec: DnsRecordItem) => {
    setEditingRecordId(rec.id);
    setRecordType(rec.type);
    setRecordHost(rec.host);
    setRecordValue(rec.value);
    setRecordTtl(rec.ttl || 3600);
    setRecordPriority(rec.priority !== undefined ? String(rec.priority) : '10');
    setShowRecordForm(true);
  };

  const handleSubmitDnsRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedHost = recordHost.trim() || '@';
    const trimmedValue = recordValue.trim();

    if (!trimmedValue) {
      onShowToast('يرجى إدخال قيمة السجل (Points to / Value).', 'error');
      return;
    }

    const parsedTtl = Number(recordTtl);
    if (!Number.isFinite(parsedTtl) || parsedTtl < 60) {
      onShowToast('يجب أن تكون قيمة TTL رقمية لا تقل عن 60 ثانية.', 'error');
      return;
    }

    const parsedPriority =
      recordType === 'MX' || (recordPriority.trim() !== '' && recordType !== 'A' && recordType !== 'AAAA' && recordType !== 'TXT')
        ? Number(recordPriority)
        : undefined;

    if (recordType === 'MX' && (!Number.isFinite(parsedPriority) || (parsedPriority ?? -1) < 0)) {
      onShowToast('يجب إدخال أولوية (Priority) صالحة لسجلات MX.', 'error');
      return;
    }

    const now = new Date().toISOString();
    let updatedList: DnsRecordItem[];
    let auditAction: DomainAuditLogEntry['action'];
    let auditDetails: string;

    if (editingRecordId) {
      updatedList = dnsRecords.map((r) =>
        r.id === editingRecordId
          ? {
              ...r,
              type: recordType,
              host: trimmedHost,
              value: trimmedValue,
              ttl: Math.round(parsedTtl),
              priority: parsedPriority !== undefined && Number.isFinite(parsedPriority) ? Math.round(parsedPriority) : undefined,
              updatedAt: now,
            }
          : r
      );
      auditAction = 'dns_update';
      auditDetails = `تعديل سجل ${recordType} (${trimmedHost} -> ${trimmedValue} | TTL: ${parsedTtl})`;
    } else {
      const newRecord: DnsRecordItem = {
        id: `dns_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: recordType,
        host: trimmedHost,
        value: trimmedValue,
        ttl: Math.round(parsedTtl),
        ...(parsedPriority !== undefined && Number.isFinite(parsedPriority)
          ? { priority: Math.round(parsedPriority) }
          : {}),
        createdAt: now,
        updatedAt: now,
      };
      updatedList = [...dnsRecords, newRecord];
      auditAction = 'dns_add';
      auditDetails = `إضافة سجل ${recordType} جديد (${trimmedHost} -> ${trimmedValue} | TTL: ${parsedTtl})`;
    }

    setDnsRecords(updatedList);
    setShowRecordForm(false);
    setEditingRecordId(null);

    if (selectedDomainId && isValidDomainNameClient(normalizeDomainNameClient(domainName))) {
      await handleSaveDomain(updatedList, { action: auditAction, details: auditDetails });
    } else {
      onShowToast('تم تجهيز السجل في القائمة. اضغط «حفظ إعدادات الدومين» لحفظ الدومين والسجلات في Firestore.', 'info');
    }
  };

  const handleConfirmDeleteRecord = async () => {
    if (!confirmDeleteRecord) return;
    const targetRec = confirmDeleteRecord;
    const updatedList = dnsRecords.filter((r) => r.id !== targetRec.id);
    setDnsRecords(updatedList);
    setConfirmDeleteRecord(null);

    if (selectedDomainId && isValidDomainNameClient(normalizeDomainNameClient(domainName))) {
      await handleSaveDomain(updatedList, {
        action: 'dns_delete',
        details: `حذف سجل ${targetRec.type} (${targetRec.host} -> ${targetRec.value})`,
      });
    } else {
      onShowToast('تمت إزالة سجل DNS من المسودة.', 'info');
    }
  };

  const handleConfirmDeleteDomain = async () => {
    if (!confirmDeleteDomain) return;
    setIsDeleting(true);
    const res = await deletePlatformDomain(confirmDeleteDomain.id, currentSession);
    setIsDeleting(false);
    setConfirmDeleteDomain(null);

    if (!res.success) {
      onShowToast(res.error || 'تعذر حذف الدومين.', 'error');
      return;
    }

    const nextDomains = res.domains || [];
    setDomains(nextDomains);
    if (res.auditLogs) setGlobalAuditLogs(res.auditLogs);
    populateFormFromDomain(nextDomains[0] || null);
    onShowToast(res.message || 'تم حذف الدومين بنجاح.', 'success');
  };

  const statusMeta = getStatusBadgeMeta(selectedDomain?.status || 'not_linked');
  const cleanPreviewDomain = normalizeDomainNameClient(domainName) || 'youx.ai.studio';

  return (
    <div className="space-y-5" dir="rtl">
      {/* ================= CARD 1: HEADER & DOMAIN SELECTOR ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white flex items-center justify-center shadow-md shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-900">
                  🌐 ضومين (Domain Management)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Super Admin فقط
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                إدارة وربط الدومينات الخارجية (خصوصاً دومينات Hostinger) بموقع المنصة، وإدارة سجلات DNS، والتحقق الفعلي من حالة الاتصال وشهادة SSL مع الحفظ الدائم في Firebase Firestore.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => loadDomains()}
              disabled={isLoading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>تحديث القائمة</span>
            </button>
            <button
              type="button"
              id="btn-add-new-domain"
              onClick={() => populateFormFromDomain(null)}
              className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة دومين جديد</span>
            </button>
          </div>
        </div>

        {/* Saved Domains Switcher */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-500 mb-2 flex items-center justify-between">
            <span>الدومينات المحفوظة في قاعدة البيانات ({domains.length}):</span>
            {!selectedDomainId && (
              <span className="text-sky-700 font-black">وضع إضافة دومين جديد</span>
            )}
          </div>

          {isLoading ? (
            <div className="text-xs text-slate-400 py-2">جارٍ تحميل الدومينات من Firebase Firestore...</div>
          ) : domains.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-500">
              لا توجد دومينات محفوظة حالياً. استخدم النموذج أدناه لإضافة أول دومين (مثل <strong dir="ltr">youx.ai.studio</strong>) وحفظه.
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {domains.map((dom) => {
                const isSelected = dom.id === selectedDomainId;
                const badge = getStatusBadgeMeta(dom.status);
                return (
                  <button
                    key={dom.id}
                    type="button"
                    onClick={() => populateFormFromDomain(dom)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Globe className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-300' : 'text-sky-600'}`} />
                    <span dir="ltr" className="font-mono">{dom.domainName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isSelected ? 'bg-white/15 text-white border-white/20' : `${badge.bgClass} ${badge.textClass} ${badge.borderClass}`
                      }`}
                    >
                      {badge.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= CARD 2: DOMAIN CONNECTION & SSL STATUS ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>حالة اتصال الدومين وشهادة الأمان SSL</span>
            </h3>
            <p className="text-xs text-slate-500">
              يتم تحديث حالة الاتصال فقط بناءً على نتائج الفحص الفعلي لسجلات DNS واستجابة الخادم عبر الإنترنت.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Domain Status Badge */}
            <div className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-2 ${statusMeta.bgClass} ${statusMeta.textClass} ${statusMeta.borderClass}`}>
              {statusMeta.icon === 'connected' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {statusMeta.icon === 'pending' && <Clock className="w-4 h-4 text-amber-600" />}
              {statusMeta.icon === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
              {statusMeta.icon === 'not_linked' && <Info className="w-4 h-4 text-slate-500" />}
              <span>{statusMeta.label}</span>
            </div>

            {/* SSL Badge */}
            <div
              className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-2 ${
                selectedDomain?.sslEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {selectedDomain?.sslEnabled ? (
                <>
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>شهادة SSL مفعلة</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 text-slate-400" />
                  <span>شهادة SSL غير مفعلة</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Summary Box */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            {selectedDomain?.lastVerification ? (
              <span>
                <strong>آخر نتيجة تحقق:</strong> {selectedDomain.lastVerification.summaryAr}
              </span>
            ) : selectedDomain ? (
              <span>
                الإعدادات محفوظة داخل المنصة. اضغط على زر <strong>«التحقق من إعدادات الدومين»</strong> لإجراء فحص DNS الفعلي عبر الإنترنت.
              </span>
            ) : (
              <span>
                هذا الدومين في وضع المسودة. بعد حفظه وتطبيق إعدادات DNS لدى Hostinger، يمكنك التحقق من حالة الربط الفعلي.
              </span>
            )}
          </div>
          {selectedDomain?.lastVerification?.checkedAt && (
            <span className="text-[11px] text-slate-500 font-mono shrink-0" dir="ltr">
              {formatArabicDateTime(selectedDomain.lastVerification.checkedAt)}
            </span>
          )}
        </div>
      </div>

      {/* ================= CARD 3: DOMAIN & NAMESERVERS CONFIGURATION ================= */}
      <div ref={dnsConfigSectionRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              <span>إعدادات الدومين وخوادم الأسماء (Nameservers)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              إدخال اسم الدومين المستهدف، رابط المنصة، وإعدادات خوادم DNS مع قالب Hostinger الجاهز القابل للتعديل.
            </p>
          </div>

          <button
            type="button"
            onClick={handleApplyHostingerPreset}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>تطبيق نموذج Hostinger الافتراضي</span>
          </button>
        </div>

        {/* Domain Name & Target URL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              اسم الدومين (Domain Name) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              dir="ltr"
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              placeholder="youx.ai.studio"
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-sky-600 outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              مثال: <span className="font-mono" dir="ltr">youx.ai.studio</span> (بدون https:// أو مسارات إضافية)
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              عنوان الموقع المستهدف (Target Site URL) <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              dir="ltr"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://youx.ai.studio"
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-sky-600 outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              الرابط العام للمنصة المراد توجيه الدومين إليها.
            </p>
          </div>
        </div>

        {/* Hostinger Default Preset Banner */}
        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 text-xs text-indigo-950">
            <div className="font-black flex items-center gap-1.5">
              <Server className="w-4 h-4 text-indigo-600" />
              <span>إعدادات Hostinger DNS الافتراضية الجاهزة:</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap font-mono text-[11px]" dir="ltr">
              <span className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-900">
                NS1: ns1.dns-parking.com
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-900">
                NS2: ns2.dns-parking.com
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={providerPreset}
              onChange={(e) => setProviderPreset(e.target.value === 'custom' ? 'custom' : 'hostinger')}
              disabled={!isDnsEditingUnlocked}
              className="px-3 py-1.5 text-xs font-bold bg-white border border-indigo-200 rounded-lg text-indigo-900 outline-none disabled:opacity-60"
            >
              <option value="hostinger">نموذج Hostinger</option>
              <option value="custom">مزود DNS مخصص</option>
            </select>
          </div>
        </div>

        {/* Nameservers List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800">
              خوادم أسماء النطاق (Nameservers)
            </label>
            <button
              type="button"
              onClick={handleAddExtraNameserver}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة خادم DNS إضافي</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nameservers.map((ns, index) => (
              <div key={`ns-${index}`} className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    {index === 0
                      ? 'خادم DNS الأول (Nameserver 1)'
                      : index === 1
                      ? 'خادم DNS الثاني (Nameserver 2)'
                      : `خادم DNS إضافي (Nameserver ${index + 1})`}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    disabled={!isDnsEditingUnlocked}
                    value={ns}
                    onChange={(e) => handleNameserverChange(index, e.target.value)}
                    placeholder={index === 0 ? 'ns1.dns-parking.com' : index === 1 ? 'ns2.dns-parking.com' : `ns${index + 1}.example.com`}
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-sky-600 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                  />
                </div>
                {index >= 2 && (
                  <button
                    type="button"
                    disabled={!isDnsEditingUnlocked}
                    onClick={() => handleRemoveNameserver(index)}
                    className="mt-5 p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer disabled:opacity-40"
                    title="إزالة خادم DNS الإضافي"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 5 Control Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
          {/* 1. Save domain settings */}
          <button
            type="button"
            id="btn-save-domain"
            disabled={isSaving}
            onClick={() => handleSaveDomain()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>حفظ إعدادات الدومين</span>
          </button>

          {/* 2. Edit DNS settings */}
          <button
            type="button"
            id="btn-edit-dns-settings"
            onClick={handleUnlockDnsEditing}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              isDnsEditingUnlocked
                ? 'bg-sky-50 text-sky-800 border-sky-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <Edit3 className="w-4 h-4 text-sky-600" />
            <span>تعديل إعدادات DNS</span>
          </button>

          {/* 3. Copy Nameservers */}
          <button
            type="button"
            id="btn-copy-nameservers"
            onClick={() => {
              const validNs = nameservers.map((n) => n.trim()).filter(Boolean);
              if (validNs.length === 0) {
                onShowToast('لا توجد عناوين Nameservers لنسخها.', 'error');
                return;
              }
              handleCopyText(
                validNs.join('\n'),
                'all_ns',
                'تم نسخ عناوين Nameservers إلى الحافظة بنجاح.'
              );
            }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {copiedKey === 'all_ns' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
            <span>نسخ عناوين Nameservers</span>
          </button>

          {/* 4. Verify domain configuration */}
          <button
            type="button"
            id="btn-verify-domain"
            disabled={isVerifying}
            onClick={handleVerifyDomain}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{isVerifying ? 'جارٍ التحقق الفعلي...' : 'التحقق من إعدادات الدومين'}</span>
          </button>

          {/* 5. Delete domain */}
          {selectedDomain && (
            <button
              type="button"
              id="btn-delete-domain"
              disabled={isDeleting}
              onClick={() => setConfirmDeleteDomain(selectedDomain)}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer mr-auto"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف الدومين</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= CARD 4: HOSTINGER HONESTY & MANUAL SETUP GUIDE ================= */}
      <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-xs text-amber-950 leading-relaxed">
            <h4 className="font-black text-sm">
              تمييز تقني مهم: الحفظ في المنصة مقابل التعديل الفعلي لدى Hostinger
            </h4>
            <p>
              حفظ البيانات في هذه اللوحة يقوم بتخزين إعدادات الدومين وسجلات DNS داخل قاعدة بيانات المنصة (Firebase Firestore) لأغراض الربط والمتابعة والتحقق، ولا يغيّر إعدادات الدومين تلقائياً داخل حسابك في Hostinger لعدم ربط مفاتيح API أو بيانات دخول Hostinger حفاظاً على الأمان.
            </p>
            <div className="pt-1 space-y-1 text-[11px] text-amber-900">
              <div className="font-bold">لتطبيق الإعدادات فعلياً في حساب Hostinger:</div>
              <p>1. ادخل إلى لوحة Hostinger hPanel ← قسم <strong>Domains</strong> ← اختر <span className="font-mono font-bold" dir="ltr">{cleanPreviewDomain}</span>.</p>
              <p>2. في قسم <strong>DNS / Nameservers</strong>، تأكد من ضبط خوادم الأسماء على القيم التالية:</p>
              <div className="flex flex-wrap gap-2 py-1" dir="ltr">
                {nameservers.filter(Boolean).map((ns, i) => (
                  <button
                    key={`guide-ns-${i}`}
                    type="button"
                    onClick={() => handleCopyText(ns, `guide_ns_${i}`, `تم نسخ ${ns}`)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-950 font-mono text-[11px] flex items-center gap-1.5 hover:bg-amber-100 cursor-pointer"
                  >
                    <span>NS{i + 1}: {ns}</span>
                    {copiedKey === `guide_ns_${i}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-amber-700" />}
                  </button>
                ))}
              </div>
              <p>3. أضف سجلات DNS المطلوبة (A / CNAME / TXT / MX) في منطقة <strong>DNS Records</strong> داخل Hostinger مطابقةً للجدول أدناه، ثم اضغط <strong>«التحقق من إعدادات الدومين»</strong>.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ================= CARD 5: DNS RECORDS MANAGEMENT ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" />
              <span>إدارة سجلات DNS (A, AAAA, CNAME, TXT, MX, NS)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              إضافة وتعديل وحذف سجلات DNS المخصصة للدومين وحفظها في Firestore.
            </p>
          </div>

          <button
            type="button"
            id="btn-add-dns-record"
            onClick={handleOpenAddDnsRecord}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة سجل DNS جديد</span>
          </button>
        </div>

        {/* Add / Edit DNS Record Form */}
        {showRecordForm && (
          <form
            onSubmit={handleSubmitDnsRecord}
            className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900">
                {editingRecordId ? 'تعديل سجل DNS' : 'إضافة سجل DNS جديد'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowRecordForm(false);
                  setEditingRecordId(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  نوع السجل <span className="text-rose-500">*</span>
                </label>
                <select
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value as DnsRecordType)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl outline-none focus:border-sky-600"
                >
                  {DNS_RECORD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t} Record
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  الاسم (Host / Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={recordHost}
                  onChange={(e) => setRecordHost(e.target.value)}
                  placeholder="@ أو www"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl outline-none focus:border-sky-600"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  القيمة (Points to / Value) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={recordValue}
                  onChange={(e) => setRecordValue(e.target.value)}
                  placeholder={
                    recordType === 'A'
                      ? '185.199.108.153'
                      : recordType === 'AAAA'
                      ? '2606:50c0:8000::153'
                      : recordType === 'CNAME'
                      ? 'target.domain.com'
                      : recordType === 'MX'
                      ? 'mx1.hostinger.com'
                      : recordType === 'NS'
                      ? 'ns1.dns-parking.com'
                      : 'v=spf1 include:_spf.mail.hostinger.com ~all'
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  TTL (بالثواني)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    dir="ltr"
                    min={60}
                    max={604800}
                    value={recordTtl}
                    onChange={(e) => setRecordTtl(Number(e.target.value) || 3600)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl outline-none focus:border-sky-600"
                  />
                  <select
                    value={TTL_PRESETS.some((p) => p.value === recordTtl) ? recordTtl : ''}
                    onChange={(e) => {
                      if (e.target.value) setRecordTtl(Number(e.target.value));
                    }}
                    className="px-2 py-2 text-[11px] bg-white border border-slate-300 rounded-xl outline-none"
                    title="قيم TTL جاهزة"
                  >
                    <option value="">سريع</option>
                    {TTL_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  الأولوية (Priority){recordType === 'MX' ? ' *' : ' (اختياري)'}
                </label>
                <input
                  type="number"
                  dir="ltr"
                  min={0}
                  max={65535}
                  disabled={recordType !== 'MX'}
                  value={recordType === 'MX' ? recordPriority : ''}
                  onChange={(e) => setRecordPriority(e.target.value)}
                  placeholder={recordType === 'MX' ? '10' : 'غير مطلوب'}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl outline-none focus:border-sky-600 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRecordForm(false);
                  setEditingRecordId(null);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{editingRecordId ? 'حفظ تعديل السجل' : 'إضافة وحفظ السجل'}</span>
              </button>
            </div>
          </form>
        )}

        {/* DNS Records Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">نوع السجل</th>
                <th className="py-3 px-4">الاسم (Host)</th>
                <th className="py-3 px-4">القيمة (Points to / Value)</th>
                <th className="py-3 px-4">TTL</th>
                <th className="py-3 px-4">الأولوية</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dnsRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    لا توجد سجلات DNS مضافة حالياً. اضغط «إضافة سجل DNS جديد» لإضافة سجلات A أو AAAA أو CNAME أو TXT أو MX أو NS.
                  </td>
                </tr>
              ) : (
                dnsRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono font-black text-[11px]">
                        {rec.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800" dir="ltr">
                      {rec.host}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 max-w-xs truncate" dir="ltr" title={rec.value}>
                      {rec.value}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600" dir="ltr">
                      {rec.ttl}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600" dir="ltr">
                      {rec.priority !== undefined ? rec.priority : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDnsRecord(rec)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRecord(rec)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= CARD 6: LIVE DNS & SSL VERIFICATION DIAGNOSTICS ================= */}
      {selectedDomain?.lastVerification && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-sky-600" />
              <span>تقرير الفحص الفعلي لـ DNS و SSL</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono" dir="ltr">
              {formatArabicDateTime(selectedDomain.lastVerification.checkedAt)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 mb-1">خوادم الأسماء الفعلية (Live NS)</div>
              <div className="font-mono text-slate-800 space-y-0.5" dir="ltr">
                {selectedDomain.lastVerification.resolvedNameservers.length > 0
                  ? selectedDomain.lastVerification.resolvedNameservers.map((ns) => <div key={ns}>{ns}</div>)
                  : <span className="text-slate-400">غير منشورة بعد</span>}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 mb-1">سجلات A / AAAA / CNAME الفعلية</div>
              <div className="font-mono text-slate-800 space-y-0.5" dir="ltr">
                {selectedDomain.lastVerification.resolvedARecords.length > 0 && (
                  <div>A: {selectedDomain.lastVerification.resolvedARecords.join(', ')}</div>
                )}
                {selectedDomain.lastVerification.resolvedAaaaRecords.length > 0 && (
                  <div>AAAA: {selectedDomain.lastVerification.resolvedAaaaRecords.join(', ')}</div>
                )}
                {selectedDomain.lastVerification.resolvedCnameRecords.length > 0 && (
                  <div>CNAME: {selectedDomain.lastVerification.resolvedCnameRecords.join(', ')}</div>
                )}
                {selectedDomain.lastVerification.resolvedARecords.length === 0 &&
                  selectedDomain.lastVerification.resolvedAaaaRecords.length === 0 &&
                  selectedDomain.lastVerification.resolvedCnameRecords.length === 0 && (
                    <span className="text-slate-400">لا توجد سجلات منشورة بعد</span>
                  )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500 mb-1">شهادة SSL واستجابة الموقع</div>
              <div className="space-y-1 text-slate-800">
                <div>
                  الحالة:{' '}
                  <strong className={selectedDomain.lastVerification.sslEnabled ? 'text-emerald-700' : 'text-rose-700'}>
                    {selectedDomain.lastVerification.sslEnabled ? 'SSL مفعلة وصالحة' : 'SSL غير مفعلة'}
                  </strong>
                </div>
                {selectedDomain.lastVerification.sslIssuer && (
                  <div className="text-[11px] text-slate-600" dir="ltr">
                    Issuer: {selectedDomain.lastVerification.sslIssuer}
                  </div>
                )}
                {selectedDomain.lastVerification.sslValidTo && (
                  <div className="text-[11px] text-slate-600" dir="ltr">
                    Valid To: {selectedDomain.lastVerification.sslValidTo}
                  </div>
                )}
                <div className="text-[11px] text-slate-600">
                  استجابة HTTP/HTTPS:{' '}
                  {selectedDomain.lastVerification.targetReachable
                    ? `متاح (HTTP ${selectedDomain.lastVerification.httpStatus || 200})`
                    : 'غير متاح حالياً'}
                </div>
              </div>
            </div>
          </div>

          {selectedDomain.lastVerification.issuesAr.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5 text-xs text-rose-900">
              <div className="font-black flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>ملاحظات وأخطاء تم رصدها أثناء الفحص:</span>
              </div>
              <ul className="list-disc pr-5 space-y-1 text-[11px] leading-relaxed">
                {selectedDomain.lastVerification.issuesAr.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ================= CARD 7: CHANGE AUDIT LOG ================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            <span>سجل التعديلات والتحققات (محفوظ في Firestore)</span>
          </h3>
          <span className="text-[11px] text-slate-500">
            إجمالي السجلات: <strong>{domainAuditLogs.length}</strong>
          </span>
        </div>

        {domainAuditLogs.length === 0 ? (
          <div className="text-xs text-slate-400 py-4 text-center">
            لا توجد تعديلات مسجلة بعد لهذا الدومين.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {domainAuditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 font-bold text-[10px]">
                      {log.actionLabelAr}
                    </span>
                    <span className="font-mono font-bold text-slate-800" dir="ltr">
                      {log.domainName}
                    </span>
                    <span className="text-[11px] text-slate-500">• بواسطة: {log.performedBy}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{log.details}</p>
                </div>
                <span className="text-[10px] font-mono text-slate-500 shrink-0" dir="ltr">
                  {formatArabicDateTime(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= CONFIRM DELETE DOMAIN MODAL ================= */}
      {confirmDeleteDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-rose-900 mb-1.5">
              تأكيد حذف الدومين
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              هل أنت متأكد من رغبتك في حذف الدومين <strong dir="ltr" className="font-mono">{confirmDeleteDomain.domainName}</strong> وجميع سجلات DNS المرتبطة به من قاعدة البيانات؟ لا يؤثر هذا على حسابك لدى Hostinger.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteDomain(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteDomain}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>تأكيد حذف الدومين</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CONFIRM DELETE DNS RECORD MODAL ================= */}
      {confirmDeleteRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-rose-900 mb-1.5">
              تأكيد حذف سجل DNS
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              هل تريد حذف السجل <span className="font-mono font-bold" dir="ltr">{confirmDeleteRecord.type} ({confirmDeleteRecord.host} → {confirmDeleteRecord.value})</span>؟
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRecord}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تأكيد الحذف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
