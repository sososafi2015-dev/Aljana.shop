import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Building2,
  Wallet,
  DollarSign,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  Check,
  X,
  Settings,
  Save,
  ShieldCheck,
  Calendar,
  Phone,
  User,
  ExternalLink,
  RefreshCw,
  Sliders,
  Sparkles,
  Heart,
  FileText,
  History,
  MapPin,
  Download
} from 'lucide-react';
import { TenantPaymentRecord, PlatformPaymentSettings, PaymentStatus, AssociationTenant } from '../types';
import {
  defaultPlatformPaymentSettings,
  getAllTenantPayments,
  getPlatformPaymentSettings,
  getActivationFeeForCountry,
  savePlatformPaymentSettings,
  syncPlatformPaymentSettingsFromBackend,
  verifyTenantPayment,
  confirmPaymentAndActivateTenant,
  activatePendingTenantPlatform,
  rejectTenantPayment,
  syncPaymentsFromBackend,
} from '../paymentStorage';
import { getAllTenants, syncTenantsFromBackend } from '../tenantStorage';

interface PlatformPaymentsAdminProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onTenantsUpdated?: () => void;
}

type RequestFilterMode = 'pending_all' | 'pending' | 'verified' | 'awaiting_payment' | 'confirmed' | 'rejected';

interface UnifiedActivationRequest {
  key: string;
  tenantId: string;
  tenant?: AssociationTenant;
  payment?: TenantPaymentRecord;
  tenantName: string;
  ownerName: string;
  ownerPhone: string;
  country: string;
  city: string;
  registeredAt: string;
  submittedAt?: string;
  amount: number;
  currency: 'MAD' | 'USD';
  paymentMethod?: string;
  cardLast4?: string;
  transactionReference?: string;
  proofDocumentUrl?: string;
  proofFileName?: string;
  type: 'activation' | 'renewal' | 'ad_campaign';
  tenantStatus: AssociationTenant['status'];
  paymentStatus: 'unpaid' | PaymentStatus;
  paymentVerified: boolean;
  isPendingActivation: boolean;
  rejectionReason?: string;
  reviewedBy?: string;
  adminNotes?: string;
  statusHistory: Array<{ status?: string; label?: string; timestamp: string; actor?: string; note?: string }>;
}

export const PlatformPaymentsAdmin: React.FC<PlatformPaymentsAdminProps> = ({
  onShowToast,
  onTenantsUpdated,
}) => {
  const [payments, setPayments] = useState<TenantPaymentRecord[]>(getAllTenantPayments);
  const [tenants, setTenants] = useState<AssociationTenant[]>(getAllTenants);
  const [settings, setSettings] = useState<PlatformPaymentSettings>(getPlatformPaymentSettings);
  const [currentSubTab, setCurrentSubTab] = useState<'requests' | 'settings'>('requests');
  const [isSyncing, setIsSyncing] = useState(false);

  // Filter & Search states — default strictly shows pending/unactivated platforms only (excludes already-activated associations)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestFilterMode>('pending_all');

  // Proof Modal
  const [viewingProof, setViewingProof] = useState<{ url: string; title: string; fileName?: string } | null>(null);

  // Review Activation / Subscription Request & Operation Log Modal
  const [reviewingRequestKey, setReviewingRequestKey] = useState<string | null>(null);
  const [verificationNote, setVerificationNote] = useState('');

  // Reject Modal
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Confirm & Activate Modal State
  const [confirmingRequest, setConfirmingRequest] = useState<UnifiedActivationRequest | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Settings form states
  const [formSettings, setFormSettings] = useState<PlatformPaymentSettings>(settings);

  const refreshData = () => {
    const raw = getAllTenantPayments();
    // Strictly isolate valid association payments only
    const filtered = (raw || []).filter(
      (p) =>
        p &&
        p.id &&
        p.tenantId &&
        (p.type as string) !== 'platform_support' &&
        (p.type as string) !== 'support' &&
        p.tenantId !== 'platform' &&
        p.tenantId !== 'platform_support'
    );
    setPayments(filtered);
    setTenants(getAllTenants());
    setSettings(getPlatformPaymentSettings());
  };

  const syncLiveFromDatabase = async (force = true) => {
    setIsSyncing(true);
    try {
      await Promise.all([
        syncPaymentsFromBackend(force).catch(() => {}),
        syncTenantsFromBackend(force).catch(() => {}),
        syncPlatformPaymentSettingsFromBackend()
          .then((synced) => {
            setSettings(synced);
            setFormSettings(synced);
          })
          .catch(() => {}),
      ]);
      refreshData();
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshData();
    syncLiveFromDatabase(true);

    const handleUpdate = () => refreshData();
    const handlePaymentSettingsUpdate = () => {
      const latest = getPlatformPaymentSettings();
      setSettings(latest);
    };
    window.addEventListener('chayef-payments-changed', handleUpdate);
    window.addEventListener('chayef-tenants-changed', handleUpdate);
    window.addEventListener('platform-payment-settings-updated', handlePaymentSettingsUpdate);
    return () => {
      window.removeEventListener('chayef-payments-changed', handleUpdate);
      window.removeEventListener('chayef-tenants-changed', handleUpdate);
      window.removeEventListener('platform-payment-settings-updated', handlePaymentSettingsUpdate);
    };
  }, []);

  // Build unified live list directly from database `tenants` + `tenant_payments`
  const { pendingActivationRequests, archivedConfirmedRequests, rejectedRequests } = React.useMemo(() => {
    const tenantById = new Map<string, AssociationTenant>();
    for (const t of tenants) {
      if (t && t.id) tenantById.set(t.id, t);
    }

    // Group activation payments by tenantId (sorted newest first)
    const activationPaymentsByTenant = new Map<string, TenantPaymentRecord[]>();
    const sortedPayments = [...payments].sort(
      (a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime()
    );

    for (const p of sortedPayments) {
      if (!p.type || p.type === 'activation') {
        const list = activationPaymentsByTenant.get(p.tenantId) || [];
        list.push(p);
        activationPaymentsByTenant.set(p.tenantId, list);
      }
    }

    const pendingList: UnifiedActivationRequest[] = [];
    const seenPendingTenantIds = new Set<string>();

    // 1. ALL newly registered / unactivated associations from `tenants` (status !== 'active', excluding master template)
    for (const t of tenants) {
      if (!t || !t.id || t.isTemplate || t.id === 'tenant_nour') continue;
      if (t.status === 'active') continue; // Strictly exclude already-activated associations from pending requests!

      seenPendingTenantIds.add(t.id);
      const tenantPays = activationPaymentsByTenant.get(t.id) || [];
      // Prefer active pending/verified payment; fallback to latest payment (e.g., rejected)
      const latestPay =
        tenantPays.find((p) => p.status === 'verified' || p.status === 'pending') ||
        tenantPays[0];

      const feeInfo = getActivationFeeForCountry(t.country || 'المغرب', settings);
      const effectivePayStatus: 'unpaid' | PaymentStatus = latestPay ? latestPay.status : 'unpaid';
      const combinedHistory =
        Array.isArray(t.subscriptionStatusHistory) && t.subscriptionStatusHistory.length > 0
          ? t.subscriptionStatusHistory
          : Array.isArray(latestPay?.statusHistory)
          ? latestPay!.statusHistory!
          : [];

      pendingList.push({
        key: `tenant_${t.id}`,
        tenantId: t.id,
        tenant: t,
        payment: latestPay,
        tenantName: t.name,
        ownerName: t.ownerName || latestPay?.ownerName || 'مسؤول الجمعية',
        ownerPhone: t.ownerPhone || latestPay?.ownerPhone || '',
        country: t.country || latestPay?.country || 'المغرب',
        city: t.city || '',
        registeredAt: t.createdAt || latestPay?.createdAt || latestPay?.submittedAt || new Date().toISOString(),
        submittedAt: latestPay?.submittedAt,
        amount: latestPay?.amount || feeInfo.amount,
        currency: (latestPay?.currency as 'MAD' | 'USD') || (feeInfo.currency as 'MAD' | 'USD'),
        paymentMethod: latestPay?.paymentMethod,
        cardLast4: latestPay?.cardLast4,
        transactionReference: latestPay?.transactionReference,
        proofDocumentUrl: latestPay?.proofDocumentUrl,
        proofFileName: latestPay?.proofFileName,
        type: 'activation',
        tenantStatus: t.status,
        paymentStatus: effectivePayStatus,
        paymentVerified: Boolean(t.paymentVerified || latestPay?.paymentVerified || latestPay?.status === 'verified'),
        isPendingActivation: true,
        rejectionReason: latestPay?.rejectionReason,
        reviewedBy: latestPay?.reviewedBy,
        adminNotes: latestPay?.adminNotes,
        statusHistory: combinedHistory,
      });
    }

    // 2. Any pending/verified activation payments in `tenant_payments` whose tenant record isn't in `tenants` yet
    // (Skip any whose tenant is ALREADY active!)
    for (const p of sortedPayments) {
      const isActivation = !p.type || p.type === 'activation';
      if (isActivation && (p.status === 'pending' || p.status === 'verified')) {
        const linkedTenant = tenantById.get(p.tenantId);
        if (linkedTenant && linkedTenant.status === 'active') {
          continue; // Never show already-activated associations in pending activation requests!
        }
        if (seenPendingTenantIds.has(p.tenantId)) {
          continue;
        }
        seenPendingTenantIds.add(p.tenantId);
        pendingList.push({
          key: `payment_${p.id}`,
          tenantId: p.tenantId,
          tenant: linkedTenant,
          payment: p,
          tenantName: linkedTenant?.name || p.tenantName || 'جمعية مسجلة',
          ownerName: linkedTenant?.ownerName || p.ownerName || 'مسؤول الجمعية',
          ownerPhone: linkedTenant?.ownerPhone || p.ownerPhone || '',
          country: linkedTenant?.country || p.country || 'المغرب',
          city: linkedTenant?.city || '',
          registeredAt: linkedTenant?.createdAt || p.createdAt || p.submittedAt,
          submittedAt: p.submittedAt,
          amount: p.amount,
          currency: (p.currency as 'MAD' | 'USD') || 'MAD',
          paymentMethod: p.paymentMethod,
          cardLast4: p.cardLast4,
          transactionReference: p.transactionReference,
          proofDocumentUrl: p.proofDocumentUrl,
          proofFileName: p.proofFileName,
          type: 'activation',
          tenantStatus: linkedTenant?.status || 'pending_activation',
          paymentStatus: p.status,
          paymentVerified: Boolean(p.paymentVerified || p.status === 'verified'),
          isPendingActivation: true,
          rejectionReason: p.rejectionReason,
          reviewedBy: p.reviewedBy,
          adminNotes: p.adminNotes,
          statusHistory: Array.isArray(p.statusHistory) ? p.statusHistory : [],
        });
      } else if (!isActivation && (p.status === 'pending' || p.status === 'verified')) {
        // Also keep pending renewal / ad_campaign payments visible for review
        const linkedTenant = tenantById.get(p.tenantId);
        pendingList.push({
          key: `payment_${p.id}`,
          tenantId: p.tenantId,
          tenant: linkedTenant,
          payment: p,
          tenantName: linkedTenant?.name || p.tenantName || 'جمعية',
          ownerName: linkedTenant?.ownerName || p.ownerName || '',
          ownerPhone: linkedTenant?.ownerPhone || p.ownerPhone || '',
          country: linkedTenant?.country || p.country || 'المغرب',
          city: linkedTenant?.city || '',
          registeredAt: linkedTenant?.createdAt || p.createdAt || p.submittedAt,
          submittedAt: p.submittedAt,
          amount: p.amount,
          currency: (p.currency as 'MAD' | 'USD') || 'MAD',
          paymentMethod: p.paymentMethod,
          cardLast4: p.cardLast4,
          transactionReference: p.transactionReference,
          proofDocumentUrl: p.proofDocumentUrl,
          proofFileName: p.proofFileName,
          type: p.type === 'renewal' ? 'renewal' : 'ad_campaign',
          tenantStatus: linkedTenant?.status || 'active',
          paymentStatus: p.status,
          paymentVerified: Boolean(p.paymentVerified || p.status === 'verified'),
          isPendingActivation: true,
          rejectionReason: p.rejectionReason,
          reviewedBy: p.reviewedBy,
          adminNotes: p.adminNotes,
          statusHistory: Array.isArray(p.statusHistory) ? p.statusHistory : [],
        });
      }
    }

    pendingList.sort(
      (a, b) =>
        new Date(b.submittedAt || b.registeredAt || 0).getTime() -
        new Date(a.submittedAt || a.registeredAt || 0).getTime()
    );

    // 3. Archived confirmed payments (only displayed when user explicitly selects 'confirmed' filter)
    const confirmedList: UnifiedActivationRequest[] = sortedPayments
      .filter((p) => p.status === 'confirmed')
      .map((p) => {
        const linkedTenant = tenantById.get(p.tenantId);
        return {
          key: `confirmed_${p.id}`,
          tenantId: p.tenantId,
          tenant: linkedTenant,
          payment: p,
          tenantName: linkedTenant?.name || p.tenantName || 'جمعية',
          ownerName: linkedTenant?.ownerName || p.ownerName || '',
          ownerPhone: linkedTenant?.ownerPhone || p.ownerPhone || '',
          country: linkedTenant?.country || p.country || 'المغرب',
          city: linkedTenant?.city || '',
          registeredAt: linkedTenant?.createdAt || p.createdAt || p.submittedAt,
          submittedAt: p.submittedAt,
          amount: p.amount,
          currency: (p.currency as 'MAD' | 'USD') || 'MAD',
          paymentMethod: p.paymentMethod,
          cardLast4: p.cardLast4,
          transactionReference: p.transactionReference,
          proofDocumentUrl: p.proofDocumentUrl,
          proofFileName: p.proofFileName,
          type: p.type === 'renewal' ? 'renewal' : p.type === 'ad_campaign' ? 'ad_campaign' : 'activation',
          tenantStatus: linkedTenant?.status || 'active',
          paymentStatus: 'confirmed',
          paymentVerified: true,
          isPendingActivation: false,
          reviewedBy: p.reviewedBy,
          adminNotes: p.adminNotes,
          statusHistory: Array.isArray(p.statusHistory) ? p.statusHistory : [],
        };
      });

    // 4. Rejected payment records
    const rejectedList: UnifiedActivationRequest[] = sortedPayments
      .filter((p) => p.status === 'rejected')
      .map((p) => {
        const linkedTenant = tenantById.get(p.tenantId);
        return {
          key: `rejected_${p.id}`,
          tenantId: p.tenantId,
          tenant: linkedTenant,
          payment: p,
          tenantName: linkedTenant?.name || p.tenantName || 'جمعية',
          ownerName: linkedTenant?.ownerName || p.ownerName || '',
          ownerPhone: linkedTenant?.ownerPhone || p.ownerPhone || '',
          country: linkedTenant?.country || p.country || 'المغرب',
          city: linkedTenant?.city || '',
          registeredAt: linkedTenant?.createdAt || p.createdAt || p.submittedAt,
          submittedAt: p.submittedAt,
          amount: p.amount,
          currency: (p.currency as 'MAD' | 'USD') || 'MAD',
          paymentMethod: p.paymentMethod,
          cardLast4: p.cardLast4,
          transactionReference: p.transactionReference,
          proofDocumentUrl: p.proofDocumentUrl,
          proofFileName: p.proofFileName,
          type: p.type === 'renewal' ? 'renewal' : p.type === 'ad_campaign' ? 'ad_campaign' : 'activation',
          tenantStatus: linkedTenant?.status || 'pending_subscription',
          paymentStatus: 'rejected',
          paymentVerified: false,
          isPendingActivation: linkedTenant ? linkedTenant.status !== 'active' : true,
          rejectionReason: p.rejectionReason,
          reviewedBy: p.reviewedBy,
          adminNotes: p.adminNotes,
          statusHistory: Array.isArray(p.statusHistory) ? p.statusHistory : [],
        };
      });

    return {
      pendingActivationRequests: pendingList,
      archivedConfirmedRequests: confirmedList,
      rejectedRequests: rejectedList,
    };
  }, [tenants, payments, settings]);

  const allRequestLookup = React.useMemo(() => {
    const map = new Map<string, UnifiedActivationRequest>();
    for (const r of [...pendingActivationRequests, ...archivedConfirmedRequests, ...rejectedRequests]) {
      map.set(r.key, r);
    }
    return map;
  }, [pendingActivationRequests, archivedConfirmedRequests, rejectedRequests]);

  const reviewingRequest = reviewingRequestKey ? allRequestLookup.get(reviewingRequestKey) || null : null;

  // Select active dataset based on filter (default strictly excludes already-activated associations)
  const displayedRequests = React.useMemo(() => {
    let base: UnifiedActivationRequest[];
    if (statusFilter === 'pending_all') {
      base = pendingActivationRequests;
    } else if (statusFilter === 'pending') {
      base = pendingActivationRequests.filter((r) => r.paymentStatus === 'pending');
    } else if (statusFilter === 'verified') {
      base = pendingActivationRequests.filter((r) => r.paymentStatus === 'verified');
    } else if (statusFilter === 'awaiting_payment') {
      base = pendingActivationRequests.filter((r) => r.paymentStatus === 'unpaid' || r.paymentStatus === 'rejected');
    } else if (statusFilter === 'confirmed') {
      base = archivedConfirmedRequests;
    } else {
      base = rejectedRequests;
    }

    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter((r) => {
      const matchName = r.tenantName.toLowerCase().includes(q);
      const matchOwner = r.ownerName.toLowerCase().includes(q);
      const matchPhone = r.ownerPhone.toLowerCase().includes(q);
      const matchRef = (r.transactionReference || '').toLowerCase().includes(q);
      const matchCity = (r.city || '').toLowerCase().includes(q);
      return matchName || matchOwner || matchPhone || matchRef || matchCity;
    });
  }, [statusFilter, searchQuery, pendingActivationRequests, archivedConfirmedRequests, rejectedRequests]);

  // Calculate live metrics
  const totalPendingRequestsCount = pendingActivationRequests.length;
  const pendingReviewCount = pendingActivationRequests.filter((r) => r.paymentStatus === 'pending').length;
  const verifiedCount = pendingActivationRequests.filter((r) => r.paymentStatus === 'verified').length;
  const awaitingPaymentCount = pendingActivationRequests.filter((r) => r.paymentStatus === 'unpaid' || r.paymentStatus === 'rejected').length;
  const activePlatformsCount = tenants.filter((t) => t && !t.isTemplate && t.id !== 'tenant_nour' && t.status === 'active').length;
  const confirmedCount = archivedConfirmedRequests.length;
  const rejectedCount = rejectedRequests.length;

  const totalCollectedMad = payments
    .filter((p) => p.status === 'confirmed' && p.currency === 'MAD')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalCollectedUsd = payments
    .filter((p) => p.status === 'confirmed' && p.currency === 'USD')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Actions
  const handleVerifyPayment = (req: UnifiedActivationRequest, customNote?: string) => {
    if (!req.payment) {
      onShowToast('لا يوجد وصل دفع مرفق بعد — يمكنك تفعيل المنصة مباشرة عند التأكد من الاستيفاء.', 'info');
      return;
    }
    const result = verifyTenantPayment(req.payment.id, 'الإدارة العامة', customNote);
    if (result.success) {
      onShowToast(
        `تم التحقق من صحة الدفع لجمعية «${req.tenantName}» وتوثيق الحالة بنجاح ✓. يمكنك الآن تفعيل المنصة.`,
        'success'
      );
      refreshData();
      if (onTenantsUpdated) onTenantsUpdated();
    } else {
      onShowToast(result.error || 'تعذر التحقق من الدفع.', 'error');
    }
  };

  const handleOpenConfirmModal = (req: UnifiedActivationRequest) => {
    setConfirmingRequest(req);
  };

  const handleExecuteConfirmActivation = async () => {
    if (!confirmingRequest) return;
    setIsProcessingAction(true);

    try {
      if (confirmingRequest.type === 'ad_campaign' && confirmingRequest.payment) {
        const result = confirmPaymentAndActivateTenant(confirmingRequest.payment.id, 'الإدارة العامة');
        if (result.success) {
          onShowToast(`تم تأكيد دفع الحملة الإعلانية لجمعية «${confirmingRequest.tenantName}» بنجاح! ✅`, 'success');
          refreshData();
          if (onTenantsUpdated) onTenantsUpdated();
        } else {
          onShowToast(result.error || 'فشلت عملية التأكيد.', 'error');
        }
      } else {
        const result = await activatePendingTenantPlatform({
          tenantId: confirmingRequest.tenantId,
          tenantSnapshot: confirmingRequest.tenant || {
            id: confirmingRequest.tenantId,
            name: confirmingRequest.tenantName,
            ownerName: confirmingRequest.ownerName,
            ownerPhone: confirmingRequest.ownerPhone,
            country: confirmingRequest.country,
            city: confirmingRequest.city,
            createdAt: confirmingRequest.registeredAt,
          },
          paymentId: confirmingRequest.payment?.id,
          adminName: 'الإدارة العامة',
          note: verificationNote.trim() || undefined,
          amount: confirmingRequest.amount,
          currency: confirmingRequest.currency,
        });

        if (result.success) {
          onShowToast(
            `تم تفعيل منصة «${confirmingRequest.tenantName}» وحفظ حالتها في قاعدة البيانات بنجاح! ✅ تمت إزالتها تلقائياً من قائمة الطلبات المعلقة.`,
            'success'
          );
          setReviewingRequestKey(null);
          setVerificationNote('');
          refreshData();
          if (onTenantsUpdated) onTenantsUpdated();
        } else {
          onShowToast(result.error || 'فشلت عملية التأكيد والتفعيل.', 'error');
        }
      }
    } catch (err: any) {
      console.error('Error confirming activation:', err);
      onShowToast(err?.message || 'حدث خطأ أثناء تنفيذ عملية التفعيل.', 'error');
    } finally {
      setIsProcessingAction(false);
      setConfirmingRequest(null);
    }
  };

  const handleOpenReject = (paymentId: string) => {
    setRejectingPaymentId(paymentId);
    setRejectionReason('تعذر التحقق من صحة معلومات الدفع أو الإشعار المرفق.');
  };

  const handleConfirmReject = () => {
    if (!rejectingPaymentId) return;

    const result = rejectTenantPayment(rejectingPaymentId, 'الإدارة العامة', rejectionReason.trim());
    if (result.success) {
      onShowToast('تم رفض طلب الاشتراك وإرجاع حالة المنصة إلى «في انتظار الدفع» مع تسجيل العملية.', 'info');
      setRejectingPaymentId(null);
      setRejectionReason('');
      refreshData();
      if (onTenantsUpdated) onTenantsUpdated();
    } else {
      onShowToast(result.error || 'فشلت العملية.', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const defBank = defaultPlatformPaymentSettings.bankAccount;
    const normalizedSettings: PlatformPaymentSettings = {
      ...formSettings,
      activationFeeMad: Number(formSettings.activationFeeMad) > 0 ? Number(formSettings.activationFeeMad) : 180,
      activationFeeUsd: Number(formSettings.activationFeeUsd) > 0 ? Number(formSettings.activationFeeUsd) : 18,
      exchangeRate: Number(formSettings.exchangeRate) > 0 ? Number(formSettings.exchangeRate) : 10,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'الإدارة العامة للمنصة',
      bankAccount: {
        ...defBank,
        ...formSettings.bankAccount,
        accountHolder: formSettings.bankAccount.accountHolder?.trim() || defBank.accountHolder,
        bankName: formSettings.bankAccount.bankName?.trim() || defBank.bankName,
        rib: formSettings.bankAccount.rib?.trim() || defBank.rib,
        iban: formSettings.bankAccount.iban?.trim() || defBank.iban,
        additionalInstructions: formSettings.bankAccount.additionalInstructions?.trim() || defBank.additionalInstructions,
      },
    };
    savePlatformPaymentSettings(normalizedSettings);
    setSettings(normalizedSettings);
    setFormSettings(normalizedSettings);
    try {
      await fetch('/api/platform-payments/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedSettings),
      });
    } catch {}
    onShowToast('تم حفظ وتحديث إعدادات رسوم وطرق الدفع بشكل دائم في قاعدة البيانات.', 'success');
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Building2 className="w-3.5 h-3.5" />
            حساب بنكي
          </span>
        );
      case 'cash_plus':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Wallet className="w-3.5 h-3.5" />
            Cash Plus
          </span>
        );
      case 'credit_card':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CreditCard className="w-3.5 h-3.5" />
            بطاقة بنكية
          </span>
        );
      case 'paypal':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <DollarSign className="w-3.5 h-3.5" />
            PayPal
          </span>
        );
      default:
        return <span>{method}</span>;
    }
  };

  const getStatusBadge = (status: 'unpaid' | PaymentStatus) => {
    switch (status) {
      case 'unpaid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            لم يتم الدفع بعد
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            بانتظار التحقق من الدفع
          </span>
        );
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            تم التحقق من الدفع • بانتظار التفعيل
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            تم الدفع والتفعيل ✅
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            مرفوض ❌
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            ملغى
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const getTenantPlatformStatusBadge = (status: AssociationTenant['status']) => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          حالة التفعيل: مفعّلة
        </span>
      );
    }
    if (status === 'pending_activation') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          حالة التفعيل: في انتظار التفعيل
        </span>
      );
    }
    if (status === 'pending_subscription') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          حالة التفعيل: غير مفعّلة (بانتظار الدفع)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        حالة التفعيل: غير مفعّلة / معطلة
      </span>
    );
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>طلبات التفعيل المعلقة</span>
            <CreditCard className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{totalPendingRequestsCount}</div>
          <span className="text-[11px] text-slate-400">جمعيات غير مفعّلة بانتظار التفعيل</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm bg-amber-50/30">
          <div className="flex items-center justify-between text-xs text-amber-700 mb-1 font-bold">
            <span>إثباتات دفع قيد المراجعة</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 font-mono">{pendingReviewCount + verifiedCount}</div>
          <span className="text-[11px] text-amber-600">تحتاج فحص وتأكيد التفعيل</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm bg-emerald-50/30">
          <div className="flex items-center justify-between text-xs text-emerald-700 mb-1 font-bold">
            <span>تم تفعيلها بنجاح</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 font-mono">{activePlatformsCount}</div>
          <span className="text-[11px] text-emerald-600">منصات نشطة ومفعّلة حالياً</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>المحصل المالي</span>
            <DollarSign className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-lg font-black text-slate-900 font-mono">
            {totalCollectedMad.toLocaleString()} MAD
          </div>
          {totalCollectedUsd > 0 && (
            <span className="text-[11px] text-slate-500 block font-mono">
              + ${totalCollectedUsd.toLocaleString()} USD
            </span>
          )}
        </div>
      </div>

      {/* Sub-Tabs Nav */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentSubTab('requests')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              currentSubTab === 'requests'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span>طلبات تفعيل المنصات ({totalPendingRequestsCount})</span>
            {totalPendingRequestsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                {totalPendingRequestsCount} بانتظار التفعيل
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentSubTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              currentSubTab === 'settings'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Settings className="w-4 h-4 text-emerald-400" />
            <span>إعدادات رسوم وطرق الدفع</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => syncLiveFromDatabase(true)}
          disabled={isSyncing}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          title="مزامنة وتحديث الطلبات من قاعدة البيانات"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {/* SUB-TAB 1: REQUESTS */}
      {currentSubTab === 'requests' && (
        <div className="space-y-4">

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث باسم الجمعية، اسم المسؤول، رقم الهاتف، المدينة، أو رقم المرجع..."
                className="w-full pl-4 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as RequestFilterMode)}
                className="text-xs py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="pending_all">الطلبات المعلقة (في انتظار التفعيل) ({totalPendingRequestsCount})</option>
                <option value="pending">بانتظار التحقق من الدفع ({pendingReviewCount})</option>
                <option value="verified">تم التحقق من الدفع • بانتظار التفعيل ({verifiedCount})</option>
                <option value="awaiting_payment">جمعيات مسجلة لم تدفع بعد ({awaitingPaymentCount})</option>
                <option value="confirmed">أرشيف المدفوعات والمنصات المفعّلة ({confirmedCount})</option>
                <option value="rejected">الطلبات المرفوضة ({rejectedCount})</option>
              </select>
            </div>
          </div>

          {/* Unified Activation Requests Table */}
          {displayedRequests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-700">
                {statusFilter === 'pending_all'
                  ? 'لا توجد طلبات تفعيل معلقة حالياً'
                  : 'لا توجد طلبات مطابقة لخيارات البحث'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery || statusFilter !== 'pending_all'
                  ? 'جرب تعديل نص البحث أو اختيار حالة أخرى من القائمة.'
                  : 'جميع الجمعيات المسجلة مفعّلة حالياً، وستظهر أي جمعية جديدة هنا تلقائياً فور تسجيلها.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">الجمعية والمسؤول</th>
                      <th className="py-3.5 px-4">تاريخ التسجيل</th>
                      <th className="py-3.5 px-4">مبلغ التفعيل</th>
                      <th className="py-3.5 px-4">طريقة وإثبات الدفع</th>
                      <th className="py-3.5 px-4">حالة الدفع والتفعيل</th>
                      <th className="py-3.5 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedRequests.map((req) => {
                      const regDate = new Date(req.registeredAt);
                      const hasValidRegDate = !isNaN(regDate.getTime());
                      const subDate = req.submittedAt ? new Date(req.submittedAt) : null;
                      const hasValidSubDate = subDate && !isNaN(subDate.getTime());

                      return (
                        <tr key={req.key} className="hover:bg-slate-50/70 transition-colors">

                          {/* Association & Owner */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{req.tenantName}</span>
                              {req.type === 'renewal' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  تجديد سنوي
                                </span>
                              ) : req.type === 'ad_campaign' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  حملة إعلانية
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  تفعيل منصة جديدة
                                </span>
                              )}
                            </div>
                            <div className="text-slate-500 flex items-center gap-2 mt-0.5 text-[11px]">
                              <span>{req.ownerName}</span>
                              {req.ownerPhone && (
                                <>
                                  <span>•</span>
                                  <span dir="ltr" className="font-mono">{req.ownerPhone}</span>
                                </>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {req.country}{req.city ? ` • ${req.city}` : ''}
                            </div>
                          </td>

                          {/* Registration Date */}
                          <td className="py-3.5 px-4">
                            <div className="text-slate-700 font-mono font-semibold">
                              {hasValidRegDate ? regDate.toLocaleDateString('ar-MA') : '-'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {hasValidRegDate
                                ? regDate.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })
                                : ''}
                            </div>
                            {hasValidSubDate && req.payment && (
                              <div className="text-[10px] text-indigo-600 mt-0.5">
                                إرسال الإثبات: {subDate!.toLocaleDateString('ar-MA')}
                              </div>
                            )}
                          </td>

                          {/* Activation Fee Amount */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-indigo-900 text-sm">
                              {req.amount} {req.currency}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {req.transactionReference
                                ? `المرجع: ${req.transactionReference}`
                                : 'رسوم التفعيل المستحقة'}
                            </div>
                          </td>

                          {/* Method & Proof */}
                          <td className="py-3.5 px-4 space-y-1.5">
                            <div>
                              {req.paymentMethod ? (
                                getMethodBadge(req.paymentMethod)
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                  بانتظار اختيار وسيلة الدفع
                                </span>
                              )}
                              {req.cardLast4 && (
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  •••• {req.cardLast4}
                                </div>
                              )}
                            </div>
                            <div>
                              {req.proofDocumentUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setViewingProof({
                                      url: req.proofDocumentUrl!,
                                      title: `إثبات دفع جمعية «${req.tenantName}»`,
                                      fileName: req.proofFileName,
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>معاينة الإثبات</span>
                                </button>
                              ) : req.paymentMethod === 'credit_card' ? (
                                <span className="text-[11px] text-emerald-700 font-semibold">
                                  دفع إلكتروني مباشر
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">لم يُرفع إثبات دفع بعد</span>
                              )}
                            </div>
                          </td>

                          {/* Payment Status & Activation Status */}
                          <td className="py-3.5 px-4 space-y-1.5">
                            <div>{getStatusBadge(req.paymentStatus)}</div>
                            <div>{getTenantPlatformStatusBadge(req.tenantStatus)}</div>
                            {req.paymentStatus === 'rejected' && req.rejectionReason && (
                              <div className="text-[10px] text-rose-600 mt-1 max-w-xs truncate" title={req.rejectionReason}>
                                السبب: {req.rejectionReason}
                              </div>
                            )}
                            {req.statusHistory.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewingRequestKey(req.key);
                                  setVerificationNote(req.adminNotes || '');
                                }}
                                className="inline-flex items-center gap-1 text-[10px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                              >
                                <History className="w-3 h-3" />
                                <span>سجل العمليات ({req.statusHistory.length})</span>
                              </button>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewingRequestKey(req.key);
                                  setVerificationNote(req.adminNotes || '');
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                                title="مراجعة طلب التفعيل وسجل العمليات"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                <span>مراجعة الطلب</span>
                              </button>

                              {req.isPendingActivation && (
                                <>
                                  {req.payment && req.paymentStatus === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyPayment(req)}
                                      className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                      title="التحقق من صحة الدفع"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      <span>التحقق من الدفع</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleOpenConfirmModal(req)}
                                    className={`px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                                      req.paymentStatus === 'verified' ? 'animate-pulse' : ''
                                    }`}
                                    title="قبول الطلب وتفعيل منصة الجمعية فوراً"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{req.paymentStatus === 'verified' ? 'تفعيل المنصة الآن' : 'تفعيل المنصة'}</span>
                                  </button>

                                  {req.payment && (req.paymentStatus === 'pending' || req.paymentStatus === 'verified') && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReject(req.payment!.id)}
                                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                                      title="رفض إثبات الدفع"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>رفض</span>
                                    </button>
                                  )}
                                </>
                              )}

                              {!req.isPendingActivation && req.paymentStatus === 'confirmed' && (
                                <span className="text-[11px] text-emerald-700 font-bold px-2">
                                  مفعّلة بواسطة {req.reviewedBy || 'الإدارة'}
                                </span>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB 2: SETTINGS */}
      {currentSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          
          {/* Centralized Payment Support Integration Banner */}
          <div className="bg-gradient-to-r from-indigo-900 to-blue-900 text-white p-5 rounded-2xl shadow-sm border border-indigo-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>توحيد طرق الدفع مع قسم «دعم المنصة»</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                    المصدر المركزي الموحد
                  </span>
                </h4>
                <p className="text-xs text-indigo-200 mt-1 leading-relaxed">
                  طرق الدفع المعتمدة لتفعيل المنصات الجديدة والإعلانات مربوطة وموحدة كلياً مع قسم «دعم المنصة» بالإدارة العامة. أي إضافة أو تعديل أو تعطيل لطريقة دفع هناك ينعكس فوراً وتلقائياً على تفعيل المنصات.
                </p>
              </div>
            </div>
          </div>

          {/* General Fees */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                رسوم التفعيل والعملات الافتراضية
              </h3>
              <span className="text-[11px] text-slate-500">
                يمكنك التعديل مستقبلاً مباشرة دون الحاجة لتغيير الكود
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  رسوم التفعيل داخل المغرب (درهم مغربي MAD) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formSettings.activationFeeMad}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, activationFeeMad: Number(e.target.value) || 0 })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">القيمة الافتراضية: 180 MAD</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  رسوم التفعيل خارج المغرب (دولار أمريكي USD) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formSettings.activationFeeUsd}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, activationFeeUsd: Number(e.target.value) || 0 })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">القيمة الافتراضية: 18 USD</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  سعر الصرف المعتمد (1 USD = X MAD)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={formSettings.exchangeRate}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, exchangeRate: Number(e.target.value) || 10 })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Bank Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">معلومات التحويل البنكي (Virement)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formSettings.bankAccount.enabled}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>تفعيل خيار الدفع البنكي</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم صاحب الحساب</label>
                <input
                  type="text"
                  value={formSettings.bankAccount.accountHolder}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, accountHolder: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم البنك</label>
                <input
                  type="text"
                  value={formSettings.bankAccount.bankName}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, bankName: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الحساب / RIB (24 رقم)</label>
                <input
                  type="text"
                  value={formSettings.bankAccount.rib}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, rib: e.target.value },
                    })
                  }
                  dir="ltr"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رمز IBAN</label>
                <input
                  type="text"
                  value={formSettings.bankAccount.iban}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, iban: e.target.value },
                    })
                  }
                  dir="ltr"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">تعليمات إضافية للمستخدمين</label>
                <textarea
                  rows={2}
                  value={formSettings.bankAccount.additionalInstructions}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      bankAccount: { ...formSettings.bankAccount, additionalInstructions: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Cash Plus Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-800 text-sm">معلومات Cash Plus (كاش بليس)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formSettings.cashPlus.enabled}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      cashPlus: { ...formSettings.cashPlus, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>تفعيل خيار Cash Plus</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المستفيد</label>
                <input
                  type="text"
                  value={formSettings.cashPlus.beneficiaryName}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      cashPlus: { ...formSettings.cashPlus, beneficiaryName: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف المرتبط</label>
                <input
                  type="text"
                  value={formSettings.cashPlus.phone}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      cashPlus: { ...formSettings.cashPlus, phone: e.target.value },
                    })
                  }
                  dir="ltr"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الحساب أو المرجع</label>
                <input
                  type="text"
                  value={formSettings.cashPlus.accountOrRef}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      cashPlus: { ...formSettings.cashPlus, accountOrRef: e.target.value },
                    })
                  }
                  dir="ltr"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">تعليمات الدفع عبر الوكالات</label>
                <textarea
                  rows={2}
                  value={formSettings.cashPlus.instructions}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      cashPlus: { ...formSettings.cashPlus, instructions: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Credit Card & PayPal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Credit Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 text-sm">البطاقة البنكية</h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formSettings.creditCard.enabled}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        creditCard: { ...formSettings.creditCard, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>تفعيل الدفع بالبطاقة</span>
                </label>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم بوابة الدفع</label>
                  <input
                    type="text"
                    value={formSettings.creditCard.gatewayName}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        creditCard: { ...formSettings.creditCard, gatewayName: e.target.value },
                      })
                    }
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تعليمات الأمان</label>
                  <textarea
                    rows={2}
                    value={formSettings.creditCard.instructions}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        creditCard: { ...formSettings.creditCard, instructions: e.target.value },
                      })
                    }
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* PayPal */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-sky-600" />
                  <h3 className="font-bold text-slate-800 text-sm">حساب PayPal</h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formSettings.paypal.enabled}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        paypal: { ...formSettings.paypal, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>تفعيل الدفع بـ PayPal</span>
                </label>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني لحساب PayPal</label>
                  <input
                    type="email"
                    value={formSettings.paypal.email}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        paypal: { ...formSettings.paypal, email: e.target.value },
                      })
                    }
                    dir="ltr"
                    className="w-full p-3 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تعليمات PayPal</label>
                  <textarea
                    rows={2}
                    value={formSettings.paypal.instructions}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        paypal: { ...formSettings.paypal, instructions: e.target.value },
                      })
                    }
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 text-xs"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="px-8 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              <span>حفظ وتطبيق إعدادات الدفع</span>
            </button>
          </div>

        </form>
      )}

      {/* Proof Lightbox Modal */}
      {viewingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-bold text-sm truncate">{viewingProof.title}</span>
              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[80vh] overflow-y-auto text-center bg-slate-50 flex items-center justify-center">
              {viewingProof.url.startsWith('data:application/pdf') || viewingProof.url.toLowerCase().includes('.pdf') || viewingProof.fileName?.toLowerCase().endsWith('.pdf') ? (
                <div className="p-8 text-center space-y-3 bg-white rounded-xl shadow-xs border border-slate-200">
                  <FileText className="w-12 h-12 text-rose-600 mx-auto" />
                  <p className="font-bold text-slate-800 text-sm">ملف PDF مرفق: {viewingProof.fileName || 'وصل_الدفع.pdf'}</p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <a
                      href={viewingProof.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>فتح وعرض ملف الـ PDF</span>
                    </a>
                    <a
                      href={viewingProof.url}
                      download={viewingProof.fileName || 'proof.pdf'}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>تحميل</span>
                    </a>
                  </div>
                </div>
              ) : (
                <img
                  src={viewingProof.url}
                  alt={viewingProof.title}
                  className="max-h-[70vh] max-w-full object-contain rounded-xl border border-slate-200 shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <AlertCircle className="w-5 h-5" />
              <span>رفض عملية الدفع</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              يرجى توضيح سبب رفض هذه العملية ليظهر لصاحب الجمعية عند تسجيل دخوله:
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              placeholder="مثال: تعذر التحقق من الوصل المرفق / المبلغ غير مطابق..."
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingPaymentId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm & Activate Modal */}
      {confirmingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  تأكيد قبول الطلب وتفعيل منصة الجمعية
                </h3>
                <p className="text-xs text-slate-500">الإدارة العامة للمنصة</p>
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 space-y-2 text-xs text-slate-700">
              <div className="flex justify-between items-center py-1 border-b border-emerald-100/60">
                <span className="text-slate-500 font-medium">اسم الجمعية:</span>
                <span className="font-bold text-slate-900">{confirmingRequest.tenantName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-emerald-100/60">
                <span className="text-slate-500 font-medium">المسؤول / الممثل:</span>
                <span className="font-bold text-slate-900">{confirmingRequest.ownerName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-emerald-100/60">
                <span className="text-slate-500 font-medium">تاريخ التسجيل:</span>
                <span className="font-mono font-bold text-slate-800">
                  {new Date(confirmingRequest.registeredAt).toLocaleDateString('ar-MA')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-emerald-100/60">
                <span className="text-slate-500 font-medium">مبلغ التفعيل:</span>
                <span className="font-black text-emerald-800 font-mono">
                  {confirmingRequest.amount.toLocaleString()} {confirmingRequest.currency}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">حالة الدفع:</span>
                {getStatusBadge(confirmingRequest.paymentStatus)}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 leading-relaxed space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>الإجراءات التي ستتم تلقائياً:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pr-1 text-[11px]">
                <li>تحديث حالة الجمعية مباشرة في قاعدة البيانات إلى <strong>«مفعّلة»</strong> وإزالتها تلقائياً من قائمة الطلبات المعلقة.</li>
                <li>توثيق وتأكيد عملية التفعيل والدفع بشكل دائم في قاعدة البيانات السحابية.</li>
                <li>إتاحة الدخول الكامل لصاحب الجمعية إلى لوحة تحكم منصته والبدء في استخدامها فوراً.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setConfirmingRequest(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleExecuteConfirmActivation}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessingAction ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري التفعيل...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>نعم، قبول الطلب وتفعيل المنصة الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Activation Request Review & Operation Status Log Modal */}
      {reviewingRequest && (() => {
        const targetTenant = reviewingRequest.tenant || tenants.find((t) => t.id === reviewingRequest.tenantId);
        const historyItems = reviewingRequest.statusHistory || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" dir="rtl">
            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-5 max-h-[90vh] overflow-y-auto text-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      مراجعة طلب التفعيل — «{reviewingRequest.tenantName}»
                    </h3>
                    <p className="text-xs text-slate-500">
                      بيانات الجمعية • التحقق من الدفع وإثباته • قبول التفعيل أو الرفض
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewingRequestKey(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Association & Payment Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div className="space-y-2">
                  <div className="font-black text-slate-800 border-b border-slate-200 pb-1">بيانات الجمعية والمسؤول</div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">اسم الجمعية:</span>
                    <span className="font-bold text-slate-900">{reviewingRequest.tenantName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">اسم المسؤول:</span>
                    <span className="font-bold text-slate-900">{reviewingRequest.ownerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">رقم الهاتف:</span>
                    <span className="font-mono font-bold text-slate-900" dir="ltr">{reviewingRequest.ownerPhone || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">الدولة والمدينة:</span>
                    <span className="font-bold text-slate-900">
                      {reviewingRequest.country}{reviewingRequest.city ? ` • ${reviewingRequest.city}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">تاريخ التسجيل:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {new Date(reviewingRequest.registeredAt).toLocaleString('ar-MA')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">حالة التفعيل:</span>
                    {getTenantPlatformStatusBadge(reviewingRequest.tenantStatus)}
                  </div>
                  {targetTenant?.legalDocument?.fileUrl && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setViewingProof({
                            url: targetTenant.legalDocument!.fileUrl,
                            title: `الوثيقة القانونية لجمعية «${reviewingRequest.tenantName}»`,
                            fileName: targetTenant.legalDocument!.fileName,
                          })
                        }
                        className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        <span>معاينة الوثيقة القانونية للجمعية</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="font-black text-slate-800 border-b border-slate-200 pb-1">بيانات الدفع ومبلغ التفعيل</div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">مبلغ التفعيل:</span>
                    <span className="font-mono font-black text-indigo-900 text-sm">
                      {reviewingRequest.amount} {reviewingRequest.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">طريقة الدفع:</span>
                    {reviewingRequest.paymentMethod ? (
                      getMethodBadge(reviewingRequest.paymentMethod)
                    ) : (
                      <span className="text-slate-400 font-semibold">لم تُحدد بعد</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">رقم المرجع:</span>
                    <span className="font-mono font-bold text-slate-800">{reviewingRequest.transactionReference || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">حالة الدفع:</span>
                    {getStatusBadge(reviewingRequest.paymentStatus)}
                  </div>
                  {reviewingRequest.proofDocumentUrl ? (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setViewingProof({
                            url: reviewingRequest.proofDocumentUrl!,
                            title: `إثبات دفع جمعية «${reviewingRequest.tenantName}»`,
                            fileName: reviewingRequest.proofFileName,
                          })
                        }
                        className="w-full py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-indigo-200 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة وثيقة إثبات الدفع المرفقة</span>
                      </button>
                    </div>
                  ) : (
                    <div className="pt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
                      لم تقم الجمعية برفع إثبات دفع إلكتروني بعد — يمكن تفعيلها إدارياً مباشرة عند التحقق.
                    </div>
                  )}
                </div>
              </div>

              {/* Administrative Review Note Input & Decision Controls */}
              {reviewingRequest.isPendingActivation && (
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-3">
                  <div className="font-black text-xs text-indigo-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>إجراءات المراجعة والتحقق من الدفع والتفعيل الإداري:</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ملاحظة إدارية (تُسجّل في سجل العمليات):
                    </label>
                    <input
                      type="text"
                      value={verificationNote}
                      onChange={(e) => setVerificationNote(e.target.value)}
                      placeholder="مثال: تم التحقق من الوصل البنكي ومطابقة مبلغ التفعيل..."
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {reviewingRequest.payment && reviewingRequest.paymentStatus === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleVerifyPayment(reviewingRequest, verificationNote)}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>1. التحقق من الدفع وتوثيق الحالة</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const toConfirm = reviewingRequest;
                        setReviewingRequestKey(null);
                        handleOpenConfirmModal(toConfirm);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {reviewingRequest.paymentStatus === 'verified'
                          ? 'تفعيل المنصة الآن (تم التحقق مسبقاً)'
                          : 'قبول الطلب وتفعيل المنصة'}
                      </span>
                    </button>
                    {reviewingRequest.payment && (reviewingRequest.paymentStatus === 'pending' || reviewingRequest.paymentStatus === 'verified') && (
                      <button
                        type="button"
                        onClick={() => {
                          const toRejectId = reviewingRequest.payment!.id;
                          setReviewingRequestKey(null);
                          handleOpenReject(toRejectId);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>رفض الطلب</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Chronological Operation Log */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>سجل حالة العمليات ومراحل التسجيل والتفعيل ({historyItems.length})</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">توثيق زمني لكل عملية</span>
                </div>

                {historyItems.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">لا توجد عمليات مسجلة إضافية.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {historyItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-xl border border-slate-200/90 text-xs flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            <span>{item.label}</span>
                          </div>
                          {item.note && <p className="text-[11px] text-slate-600 leading-relaxed">{item.note}</p>}
                          {item.actor && (
                            <span className="text-[10px] text-slate-400 block">بواسطة: {item.actor}</span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0" dir="ltr">
                          {new Date(item.timestamp).toLocaleString('ar-MA')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setReviewingRequestKey(null)}
                  className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
