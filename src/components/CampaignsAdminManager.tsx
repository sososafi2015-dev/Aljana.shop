import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  Plus,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  Users,
  Search,
  Filter,
  Coins,
  Calendar,
  Image as ImageIcon,
  Upload,
  Link,
  Target,
  FileSpreadsheet,
  FileDown,
  ChevronDown,
  X,
  Sparkles,
  Info,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  UserCheck,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  Star,
  Check,
  RotateCcw,
  Video,
  Play,
  Film,
} from 'lucide-react';
import { VideoPlayer, parseVideoUrl, validateVideoUrl } from '../utils/videoUtils';
import type {
  DonationCampaign,
  CampaignContribution,
  ContributionTypeConfig,
  CurrentAdminSession,
  AssociationSettings,
  CampaignStatus,
} from '../types';
import {
  apiCreateCampaign,
  apiUpdateCampaign,
  apiToggleCampaignStatus,
  apiToggleCampaignVisibility,
  apiDeleteCampaign,
  apiDeleteContribution,
  apiSubmitDonationContribution,
} from '../api/campaignsApi';
import { ensurePermanentImageUrl } from '../api/imageApi';
import {
  getStoredContributions,
  getStoredOperations,
  saveContributionsAndOperations,
  getActiveTenantIdFromStorage,
} from '../storage';

interface CampaignsAdminManagerProps {
  campaigns: DonationCampaign[];
  contributions: CampaignContribution[];
  contributionTypes: ContributionTypeConfig[];
  currentSession: CurrentAdminSession | null;
  settings: AssociationSettings;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onCampaignsUpdated: (updatedCampaigns: DonationCampaign[]) => void;
  onContributionsUpdated: (updatedContributions: CampaignContribution[]) => void;
  onContributionTypesUpdated?: (updatedTypes: ContributionTypeConfig[]) => void;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const CampaignsAdminManager: React.FC<CampaignsAdminManagerProps> = ({
  campaigns,
  contributions,
  contributionTypes,
  currentSession,
  settings,
  canAdd,
  canEdit,
  canDelete,
  onCampaignsUpdated,
  onContributionsUpdated,
  onContributionTypesUpdated,
  addToast,
}) => {
  // Authoritative permissions check
  const isSuperAdmin = currentSession?.type === 'super_admin' || currentSession?.role === 'main_admin' || currentSession?.isMasterPlatformAdmin === true;
  const effectiveCanAdd = canAdd !== undefined ? canAdd : (isSuperAdmin || currentSession?.subAdmin?.permissions?.campaigns?.canAdd !== false);
  const effectiveCanEdit = canEdit !== undefined ? canEdit : (isSuperAdmin || currentSession?.subAdmin?.permissions?.campaigns?.canEdit !== false);
  const effectiveCanDelete = canDelete !== undefined ? canDelete : (isSuperAdmin || currentSession?.subAdmin?.permissions?.campaigns?.canDelete !== false);

  // Tabs: 'campaigns' | 'contributions' (Contribution Types are exclusively managed by Super Admin)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'contributions'>('campaigns');

  // Form Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<DonationCampaign | null>(null);

  // Campaign Deletion Modal State
  const [campaignToDelete, setCampaignToDelete] = useState<DonationCampaign | null>(null);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);

  // Contribution Deletion Modal State
  const [contribToDelete, setContribToDelete] = useState<CampaignContribution | null>(null);
  const [isDeletingContribution, setIsDeletingContribution] = useState(false);

  // Manual Contribution Modal
  const [isManualContributionOpen, setIsManualContributionOpen] = useState(false);
  const [manualCampaignId, setManualCampaignId] = useState<string>('');
  const [manualDonorName, setManualDonorName] = useState('');
  const [manualDonorPhone, setManualDonorPhone] = useState('');
  const [manualAmount, setManualAmount] = useState<number | string>(500);
  const [manualTypeId, setManualTypeId] = useState<string>('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState<'cash' | 'bank_transfer' | 'check'>('cash');

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string>('all');
  const [isTogglingVisibility, setIsTogglingVisibility] = useState<Record<string, boolean>>({});
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);
  const [previewVideoCampaign, setPreviewVideoCampaign] = useState<DonationCampaign | null>(null);
  const [previewProofContribution, setPreviewProofContribution] = useState<CampaignContribution | null>(null);

  // Campaign Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetProject: '',
    targetAmount: 100000,
    coverImage: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
    videoUrl: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    status: 'active' as CampaignStatus,
    allowOverfunding: true,
    isVisibleOnStore: true,
  });

  const openCreateModal = () => {
    setEditingCampaign(null);
    setFormData({
      title: '',
      description: '',
      targetProject: '',
      targetAmount: 50000,
      coverImage: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
      videoUrl: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      status: 'active',
      allowOverfunding: true,
      isVisibleOnStore: true,
    });
    setIsFormOpen(true);
  };

  const openEditModal = (camp: DonationCampaign) => {
    setEditingCampaign(camp);
    setFormData({
      title: camp.title,
      description: camp.description,
      targetProject: camp.targetProject,
      targetAmount: camp.targetAmount,
      coverImage: camp.coverImage,
      videoUrl: camp.videoUrl || '',
      startDate: camp.startDate,
      endDate: camp.endDate || '',
      status: camp.status,
      allowOverfunding: camp.allowOverfunding,
      isVisibleOnStore: camp.isVisibleOnStore !== false,
    });
    setIsFormOpen(true);
  };

  // Image Upload helper (uploads directly to Firebase Cloud Storage with server disk fallback)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('error', 'يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      addToast('error', 'حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 20 ميغابايت.');
      return;
    }
    try {
      setImageUploadProgress(10);
      const currentActiveTenant = (settings as any)?.id || currentSession?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
      const permanentUrl = await ensurePermanentImageUrl(file, {
        category: 'campaigns',
        fileName: file.name || 'campaign-cover.jpg',
        recordId: editingCampaign?.id,
        tenantId: currentActiveTenant,
        onProgress: (pct) => setImageUploadProgress(pct),
      });
      setFormData((prev) => ({ ...prev, coverImage: permanentUrl }));
      addToast('success', 'تم رفع وحفظ صورة غلاف الحملة في التخزين الدائم بنجاح (100%).');
    } catch (err: any) {
      addToast('error', err?.message || 'فشل رفع صورة الغلاف.');
    } finally {
      setImageUploadProgress(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      addToast('error', 'يرجى إدخال عنوان الحملة.');
      return;
    }
    if (!formData.targetProject.trim()) {
      addToast('error', 'يرجى تحديد المشروع المستهدف من التبرعات.');
      return;
    }
    const numTarget = Number(formData.targetAmount);
    if (numTarget <= 0) {
      addToast('error', 'ميزانية المشروع يجب أن تكون أكبر من صفر.');
      return;
    }

    // Validate videoUrl if provided
    const cleanVideoUrl = formData.videoUrl.trim();
    if (cleanVideoUrl) {
      const vidValidation = validateVideoUrl(cleanVideoUrl);
      if (!vidValidation.isValid) {
        addToast(
          'error',
          vidValidation.error ||
            'يرجى إدخال رابط فيديو صالح للحملة (يدعم YouTube، YouTube Shorts، Vimeo، أو رابط MP4 مباشر).'
        );
        return;
      }
    }

    const targetTenantId = (settings as any)?.id || currentSession?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';

    let finalCoverImage = formData.coverImage;
    if (finalCoverImage && finalCoverImage.startsWith('data:')) {
      try {
        finalCoverImage = await ensurePermanentImageUrl(finalCoverImage, {
          category: 'campaigns',
          fileName: 'campaign-cover.jpg',
          recordId: editingCampaign?.id,
          tenantId: targetTenantId,
        });
      } catch {}
    }

    const payload: Partial<DonationCampaign> = {
      ...(editingCampaign
        ? {
            id: editingCampaign.id,
            collectedAmount: editingCampaign.collectedAmount,
            progressPercentage: editingCampaign.progressPercentage,
            createdAt: editingCampaign.createdAt,
          }
        : {
            collectedAmount: 0,
            progressPercentage: 0,
            createdAt: new Date().toISOString(),
          }),
      ...formData,
      coverImage: finalCoverImage,
      videoUrl: cleanVideoUrl !== '' ? cleanVideoUrl : '',
      tenantId: targetTenantId,
      associationId: targetTenantId,
    };

    if (editingCampaign) {
      const res = await apiUpdateCampaign(editingCampaign.id, payload, currentSession, targetTenantId);
      if (res.success && res.campaign) {
        const updated = campaigns.map((c) => (c.id === editingCampaign.id ? res.campaign! : c));
        onCampaignsUpdated(updated);
        addToast('success', 'تم تعديل وتحديث بيانات حملة التبرع وحفظها في قاعدة البيانات بنجاح.');
        setIsFormOpen(false);
      } else {
        addToast('error', res.error || 'فشل تحديث الحملة في قاعدة البيانات.');
      }
    } else {
      const res = await apiCreateCampaign(payload, currentSession, targetTenantId);
      if (res.success && res.campaign) {
        const updated = [res.campaign, ...campaigns];
        onCampaignsUpdated(updated);
        addToast('success', 'تم إنشاء وتفعيل حملة التبرع الجديدة وحفظها في قاعدة البيانات بنجاح.');
        setIsFormOpen(false);
      } else {
        addToast('error', res.error || 'فشل إنشاء الحملة في قاعدة البيانات.');
      }
    }
  };

  const handleToggleStatus = async (camp: DonationCampaign) => {
    const nextStatus: CampaignStatus = camp.status === 'active' ? 'paused' : 'active';
    const targetTenantId = (settings as any)?.id || currentSession?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
    const res = await apiToggleCampaignStatus(camp.id, nextStatus, currentSession, targetTenantId);
    if (res.success && res.campaign) {
      const updated = campaigns.map((c) => (c.id === camp.id ? res.campaign! : c));
      onCampaignsUpdated(updated);
      addToast(
        'info',
        nextStatus === 'active'
          ? `تم تفعيل استقبال التبرعات لحملة "${camp.title}".`
          : `تم إيقاف حملة "${camp.title}" مؤقتاً.`
      );
    }
  };

  const handleToggleVisibility = async (camp: DonationCampaign, explicitVisibility?: boolean) => {
    const isCurrentlyVisible = camp.isVisibleOnStore !== false;
    const nextVisibility = explicitVisibility !== undefined ? explicitVisibility : !isCurrentlyVisible;
    const targetTenantId = (settings as any)?.id || currentSession?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';

    setIsTogglingVisibility((prev) => ({ ...prev, [camp.id]: true }));
    try {
      const res = await apiToggleCampaignVisibility(camp.id, currentSession, nextVisibility, targetTenantId);
      if (res.success && res.campaign) {
        const updated = campaigns.map((c) => (c.id === camp.id ? res.campaign! : c));
        onCampaignsUpdated(updated);
        addToast(
          'success',
          nextVisibility
            ? `● تم تفعيل ظهور حملة «${camp.title}» على واجهة المتجر بنجاح.`
            : `● تم إخفاء حملة «${camp.title}» من واجهة المتجر. (جميع التبرعات والبيانات محفوظة بالكامل).`
        );
      } else {
        addToast('error', res.error || 'فشل تغيير حالة ظهور الحملة.');
      }
    } catch (err: any) {
      addToast('error', 'حدث خطأ أثناء تغيير حالة ظهور الحملة.');
    } finally {
      setIsTogglingVisibility((prev) => ({ ...prev, [camp.id]: false }));
    }
  };

  const handleDeleteCampaign = (camp: DonationCampaign) => {
    if (!effectiveCanDelete) {
      addToast('error', 'ليس لديك صلاحية أمنية لحذف حملات التبرع والمشاريع.');
      return;
    }
    setCampaignToDelete(camp);
  };

  const handleConfirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    if (!effectiveCanDelete) {
      addToast('error', 'ليس لديك صلاحية أمنية لحذف حملات التبرع والمشاريع.');
      return;
    }

    setIsDeletingCampaign(true);
    const targetTenantId = (settings as any)?.id || currentSession?.tenantId || getActiveTenantIdFromStorage() || 'tenant_nour';
    try {
      const res = await apiDeleteCampaign(campaignToDelete.id, currentSession, targetTenantId);
      if (res.success) {
        const remainingCampaigns = campaigns.filter((c) => c.id !== campaignToDelete.id);
        const remainingContribs = contributions.filter((c) => c.campaignId !== campaignToDelete.id);
        onCampaignsUpdated(remainingCampaigns);
        onContributionsUpdated(remainingContribs);
        addToast('success', `تم حذف حملة «${campaignToDelete.title}» وجميع سجلات مساهماتها نهائياً بنجاح.`);
        setCampaignToDelete(null);
      } else {
        addToast('error', res.error || 'تعذر حذف الحملة من قاعدة البيانات.');
      }
    } catch (err: any) {
      addToast('error', 'حدث خطأ غير متوقع أثناء حذف الحملة.');
    } finally {
      setIsDeletingCampaign(false);
    }
  };

  const handleDeleteContribution = (contrib: CampaignContribution) => {
    if (!effectiveCanDelete) {
      addToast('error', 'ليس لديك صلاحية أمنية لحذف مساهمات التبرع.');
      return;
    }
    setContribToDelete(contrib);
  };

  const handleConfirmDeleteContribution = async () => {
    if (!contribToDelete) return;
    setIsDeletingContribution(true);
    try {
      const res = await apiDeleteContribution(contribToDelete.id, currentSession);
      if (res.success) {
        const updatedContribs = contributions.map((c) =>
          c.id === contribToDelete.id
            ? { ...c, status: 'unpaid' as const, isNegative: true, amountSign: '-' as const }
            : c
        );
        onContributionsUpdated(updatedContribs);

        // Recalculate campaigns (excluding pending/unpaid/negative)
        const camp = campaigns.find((c) => c.id === contribToDelete.campaignId);
        if (camp) {
          const campContribs = updatedContribs.filter(
            (c) =>
              c.campaignId === camp.id &&
              c.isFinancial &&
              c.status !== 'pending' &&
              c.status !== 'unpaid' &&
              !c.isNegative
          );
          const newCollected = campContribs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
          const rawPct = camp.targetAmount > 0 ? (newCollected / camp.targetAmount) * 100 : 0;
          const updatedCamp: DonationCampaign = {
            ...camp,
            collectedAmount: newCollected,
            progressPercentage: Math.round(rawPct * 10) / 10,
          };
          onCampaignsUpdated(campaigns.map((c) => (c.id === camp.id ? updatedCamp : c)));
        }

        window.dispatchEvent(new CustomEvent('transparency_records_updated'));
        addToast('success', `تم تحويل حالة مساهمة «${contribToDelete.donorName}» إلى «لم يتم الدفع» وتحديث سجل الشفافية بنجاح.`);
        setContribToDelete(null);
      } else {
        addToast('error', res.error || 'تعذر تحديث حالة المساهمة.');
      }
    } catch (err: any) {
      addToast('error', 'حدث خطأ غير متوقع أثناء تحديث المساهمة.');
    } finally {
      setIsDeletingContribution(false);
    }
  };

  // Manual Contribution handler
  const handleOpenManualContribution = (campId?: string) => {
    setManualCampaignId(campId || campaigns[0]?.id || '');
    setManualDonorName('');
    setManualDonorPhone('');
    setManualAmount(500);
    const defaultType = contributionTypes.find((t) => t.isDefault) || contributionTypes[0];
    setManualTypeId(defaultType?.id || 'type-charity-donation');
    setManualNotes('');
    setManualPaymentMethod('cash');
    setIsManualContributionOpen(true);
  };

  const handleSaveManualContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCampaignId) {
      addToast('error', 'يرجى اختيار الحملة المستهدفة.');
      return;
    }
    const numAmt = Number(manualAmount);
    if (numAmt <= 0) {
      addToast('error', 'المبلغ يجب أن يكون أكبر من صفر (0 درهم).');
      return;
    }

    const res = await apiSubmitDonationContribution({
      campaignId: manualCampaignId,
      donorName: manualDonorName.trim() || 'فاعل خير',
      donorPhone: manualDonorPhone.trim(),
      isAnonymous: !manualDonorName.trim(),
      contributionTypeId: manualTypeId,
      amount: numAmt,
      notes: manualNotes.trim() ? `(إدخال يدوي من الإدارة) ${manualNotes.trim()}` : '(إدخال يدوي من الإدارة)',
      paymentMethod: manualPaymentMethod,
    });

    if (res.success && res.contribution) {
      onContributionsUpdated([res.contribution, ...contributions]);
      if (res.campaign) {
        onCampaignsUpdated(campaigns.map((c) => (c.id === res.campaign!.id ? res.campaign! : c)));
      }

      // Also persist in «سجل المساهمات والانخراطات» and the financial ledger so balance & records update immediately
      try {
        const targetTenant =
          res.contribution.tenantId ||
          res.contribution.associationId ||
          currentSession?.tenantId ||
          'tenant_nour';
        const newOpId = `op-camp-${res.contribution.id}`;
        const memberContribId = `contrib-don-${res.contribution.id}`;

        const currentMemberContribs = getStoredContributions(targetTenant);
        const currentOps = getStoredOperations(targetTenant);

        let nextContribs = currentMemberContribs;
        if (!currentMemberContribs.some((c) => c.id === memberContribId || c.financialOperationId === newOpId)) {
          nextContribs = [
            {
              id: memberContribId,
              memberId: res.contribution.isAnonymous ? 'anonymous-donor' : `donor-${Date.now().toString(36)}`,
              memberCode: res.contribution.isAnonymous ? 'فاعل خير' : 'متبرع',
              memberName: res.contribution.donorName || 'فاعل خير',
              amount: Number(res.contribution.amount) || 0,
              date: res.contribution.date || new Date().toISOString().slice(0, 10),
              time: res.contribution.time || new Date().toTimeString().slice(0, 8),
              createdAt: res.contribution.createdAt || new Date().toISOString(),
              status: 'pending',
              category: 'donation',
              paymentMethod: (res.contribution.paymentMethod as any) || 'cash',
              notes: `تبرع لحملة: ${res.contribution.campaignTitle}${res.contribution.notes ? ` - ${res.contribution.notes}` : ''}`,
              financialOperationId: newOpId,
              contributionTypeId: res.contribution.contributionTypeId,
              contributionTypeName: res.contribution.contributionTypeName,
              tenantId: targetTenant,
              associationId: targetTenant,
              campaignId: res.contribution.campaignId,
              campaignTitle: res.contribution.campaignTitle,
              donorPhone: res.contribution.donorPhone,
              isAnonymous: res.contribution.isAnonymous,
            },
            ...currentMemberContribs,
          ];
        }

        let nextOps = currentOps;
        if (!currentOps.some((op) => op.id === newOpId) && Number(res.contribution.amount) > 0) {
          nextOps = [
            {
              id: newOpId,
              code: `OP-${new Date().getFullYear()}-${String(currentOps.length + 1).padStart(3, '0')}`,
              type: 'income',
              category: 'donation',
              title: `تبرع لحملة: ${res.contribution.campaignTitle} (${res.contribution.donorName})`,
              description: `مساهمة (${res.contribution.contributionTypeName || 'تبرع مالي'}) - طريقة الدفع: ${res.contribution.paymentMethod || 'نقداً'}`,
              amount: Number(res.contribution.amount) || 0,
              date: res.contribution.date || new Date().toISOString().slice(0, 10),
              addedBy: res.contribution.donorName || 'إدارة الجمعية',
              createdAt: res.contribution.createdAt || new Date().toISOString(),
              tenantId: targetTenant,
              associationId: targetTenant,
            },
            ...currentOps,
          ];
        }

        await saveContributionsAndOperations(nextContribs, nextOps, targetTenant);
        window.dispatchEvent(new CustomEvent('transparency_records_updated'));
      } catch (syncErr) {
        console.warn('[CampaignsAdminManager] Sync to member contributions warning:', syncErr);
      }

      addToast('success', 'تم تسجيل المساهمة يدوياً وتحديث الرصيد ونسبة الإنجاز بنجاح.');
      setIsManualContributionOpen(false);
    } else {
      addToast('error', res.error || 'فشل تسجيل المساهمة.');
    }
  };

  // Export Contributions CSV
  const handleExportCSV = () => {
    const headers = ['رقم الوصل', 'الحملة', 'المتبرع', 'الهاتف', 'نوع المساهمة', 'المبلغ (د.م)', 'طريقة الدفع', 'التاريخ', 'الوقت', 'ملاحظات'];
    const rows = contributions.map((c) => [
      `"${c.id}"`,
      `"${c.campaignTitle.replace(/"/g, '""')}"`,
      `"${c.donorName.replace(/"/g, '""')}"`,
      `"${c.donorPhone || ''}"`,
      `"${c.contributionTypeName}"`,
      `"${c.amount}"`,
      `"${c.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : c.paymentMethod === 'cash' ? 'نقداً' : 'شيك'}"`,
      `"${c.date}"`,
      `"${c.time || ''}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `سجل_مساهمات_حملات_التبرع_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('info', 'تم تصدير سجل المساهمات كملف CSV بنجاح.');
  };

  // Filtered lists
  const filteredCampaigns = campaigns.filter((camp) => {
    if (statusFilter !== 'all' && camp.status !== statusFilter) return false;
    if (visibilityFilter === 'visible' && camp.isVisibleOnStore === false) return false;
    if (visibilityFilter === 'hidden' && camp.isVisibleOnStore !== false) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        camp.title.toLowerCase().includes(q) ||
        camp.targetProject.toLowerCase().includes(q) ||
        camp.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredContributions = contributions.filter((c) => {
    if (selectedCampaignFilter !== 'all' && c.campaignId !== selectedCampaignFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.donorName.toLowerCase().includes(q) ||
        c.campaignTitle.toLowerCase().includes(q) ||
        c.contributionTypeName.toLowerCase().includes(q) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Calculate totals
  const totalTargetAll = campaigns.reduce((sum, c) => sum + c.targetAmount, 0);
  const totalCollectedAll = campaigns.reduce((sum, c) => sum + c.collectedAmount, 0);
  const overallProgress = totalTargetAll > 0 ? Math.round((totalCollectedAll / totalTargetAll) * 1000) / 10 : 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 text-xs font-semibold mb-2">
              <HeartHandshake className="w-4 h-4 text-amber-300" />
              <span>إدارة حملات التبرع والمشاريع المستهدفة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              حملات التبرع والمشاريع الخيرية
            </h1>
            <p className="text-emerald-100/90 text-sm max-w-2xl mt-1">
              لوحة متكاملة لإنشاء حملات التبرع لتمويل مشاريع الجمعية، ومتابعة سجلات المساهمات ونسب التحصيل الحية مع التوثيق المالي.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openCreateModal}
              className="px-5 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة حملة تبرع جديدة</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenManualContribution()}
              className="px-4 py-2.5 rounded-xl bg-emerald-900/80 hover:bg-emerald-950 text-emerald-100 border border-emerald-500/40 font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Coins className="w-4 h-4 text-amber-300" />
              <span>تسجيل مساهمة يدوية</span>
            </button>
          </div>
        </div>

        {/* Global Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-emerald-600/40 relative z-10">
          <div className="bg-emerald-900/40 backdrop-blur-sm rounded-2xl p-3 border border-emerald-500/30">
            <span className="text-xs text-emerald-200 block">إجمالي الحملات</span>
            <span className="text-lg sm:text-2xl font-bold text-white mt-1 block">
              {campaigns.length} حملة
            </span>
          </div>
          <div className="bg-emerald-900/40 backdrop-blur-sm rounded-2xl p-3 border border-emerald-500/30">
            <span className="text-xs text-emerald-200 block">الأهداف المالية المستهدفة</span>
            <span className="text-lg sm:text-2xl font-bold text-white mt-1 block">
              {totalTargetAll.toLocaleString()} {settings.currency}
            </span>
          </div>
          <div className="bg-emerald-900/40 backdrop-blur-sm rounded-2xl p-3 border border-emerald-500/30">
            <span className="text-xs text-emerald-200 block">إجمالي التبرعات المحصلة</span>
            <span className="text-lg sm:text-2xl font-bold text-amber-300 mt-1 block">
              {totalCollectedAll.toLocaleString()} {settings.currency}
            </span>
          </div>
          <div className="bg-emerald-900/40 backdrop-blur-sm rounded-2xl p-3 border border-emerald-500/30">
            <span className="text-xs text-emerald-200 block">عدد المساهمات المسجلة</span>
            <span className="text-lg sm:text-2xl font-bold text-emerald-100 mt-1 block">
              {contributions.length} مساهمة
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('campaigns')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'campaigns'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>الحملات ({campaigns.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contributions')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'contributions'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>سجل التبرعات والمساهمات ({contributions.length})</span>
          </button>
        </div>

        {activeTab === 'contributions' && (
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>تصدير كملف Excel / CSV</span>
          </button>
        )}
      </div>

      {/* ===================== TAB 1: CAMPAIGNS LIST ===================== */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن حملة أو مشروع..."
                className="w-full pr-9 pl-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">الظهور بالمتجر:</span>
                <select
                  value={visibilityFilter}
                  onChange={(e) => setVisibilityFilter(e.target.value as any)}
                  className="text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none cursor-pointer font-medium"
                >
                  <option value="all">الكل ({campaigns.length})</option>
                  <option value="visible">ظاهرة بالمتجر ({campaigns.filter((c) => c.isVisibleOnStore !== false).length})</option>
                  <option value="hidden">مخفية عن المتجر ({campaigns.filter((c) => c.isVisibleOnStore === false).length})</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">تصفية الحالة:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none cursor-pointer font-medium"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="active">نشطة فقط</option>
                  <option value="paused">متوقفة مؤقتاً</option>
                  <option value="completed">مكتملة</option>
                </select>
              </div>
            </div>
          </div>

          {/* Campaigns Table / Cards */}
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
              <HeartHandshake className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">لا توجد حملات تبرع مطابقة</h3>
              <p className="text-xs text-slate-500 mt-1">ابدأ بإنشاء أول حملة تبرع لمشاريع الجمعية الآن.</p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                + إنشاء حملة تبرع جديدة
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map((camp) => {
                const target = camp.targetAmount || 0;
                const collected = camp.collectedAmount || 0;
                const rawPct = target > 0 ? (collected / target) * 100 : 0;
                const progressPct = camp.progressPercentage ?? Math.round(rawPct * 10) / 10;
                const visualProgress = Math.min(100, Math.max(0, (collected / (target || 1)) * 100));
                const isCompleted = camp.status === 'completed' || collected >= target;
                const isPaused = camp.status === 'paused';

                return (
                  <div
                    key={camp.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Image header */}
                      <div className="relative h-44 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <img
                          src={camp.coverImage}
                          alt={camp.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                        {/* Visibility badge on top left of image */}
                        <div className="absolute top-3 left-3">
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(camp)}
                            disabled={isTogglingVisibility[camp.id]}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-md shadow-md flex items-center gap-1.5 transition-all cursor-pointer ${
                              camp.isVisibleOnStore !== false
                                ? 'bg-emerald-950/85 text-emerald-200 border border-emerald-400/40 hover:bg-emerald-900'
                                : 'bg-slate-900/85 text-amber-300 border border-amber-400/40 hover:bg-slate-800'
                            }`}
                            title="انقر لتغيير ظهور الحملة على واجهة المتجر"
                          >
                            {camp.isVisibleOnStore !== false ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>ظاهرة على المتجر</span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <span>مخفية عن المتجر</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Video badge on image if videoUrl exists */}
                        {camp.videoUrl && (
                          <div className="absolute top-3 left-36">
                            <button
                              type="button"
                              onClick={() => setPreviewVideoCampaign(camp)}
                              className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600/90 hover:bg-rose-700 text-white backdrop-blur-md shadow-md flex items-center gap-1 transition-all cursor-pointer"
                              title="مشاهدة ومعاينة الفيديو التعريفي للحملة"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>فيديو تعريفي</span>
                            </button>
                          </div>
                        )}

                        {/* Status Toggle on image */}
                        <div className="absolute top-3 right-3">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(camp)}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-md shadow-md flex items-center gap-1 cursor-pointer ${
                              camp.status === 'active'
                                ? 'bg-emerald-600/90 text-white'
                                : camp.status === 'paused'
                                ? 'bg-amber-600/90 text-white'
                                : 'bg-blue-600/90 text-white'
                            }`}
                          >
                            {camp.status === 'active' && <PlayCircle className="w-3.5 h-3.5" />}
                            {camp.status === 'paused' && <PauseCircle className="w-3.5 h-3.5" />}
                            {camp.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>
                              {camp.status === 'active'
                                ? 'نشطة'
                                : camp.status === 'paused'
                                ? 'متوقفة مؤقتاً'
                                : 'مكتملة'}
                            </span>
                          </button>
                        </div>

                        {/* Target Project tag */}
                        <div className="absolute bottom-3 right-3 left-3">
                          <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-black/60 text-emerald-200 border border-emerald-500/30 truncate block">
                            المشروع المستهدف: {camp.targetProject}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base line-clamp-1">
                          {camp.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {camp.description}
                        </p>

                        {/* Metrics Bar */}
                        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">تم جمع:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {collected.toLocaleString()} {settings.currency}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-slate-500">الهدف المالي:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {target.toLocaleString()} {settings.currency}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-full rounded-full transition-all"
                              style={{ width: `${visualProgress}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                            <span>نسبة الإنجاز: {progressPct}%</span>
                            <span>
                              {collected >= target
                                ? 'اكتمل الهدف 🎉'
                                : `المتبقي: ${(target - collected).toLocaleString()} ${settings.currency}`}
                            </span>
                          </div>
                        </div>

                        {/* Direct Store Visibility Control Box */}
                        <div
                          className={`mt-3 p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                            camp.isVisibleOnStore !== false
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-800/60'
                              : 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {camp.isVisibleOnStore !== false ? (
                              <>
                                <span className="relative flex h-2.5 w-2.5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1 truncate">
                                    <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>● ظاهرة على المتجر</span>
                                  </span>
                                  <span className="text-[10.5px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
                                    متاحة لزوار المتجر للتبرع المباشر
                                  </span>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0"></span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1 truncate">
                                    <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>● مخفية عن المتجر</span>
                                  </span>
                                  <span className="text-[10.5px] text-amber-700/80 dark:text-amber-400/80 truncate">
                                    محفوظة دون حذف وتبرعاتها مسجلة
                                  </span>
                                </div>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(camp)}
                            disabled={isTogglingVisibility[camp.id]}
                            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                              camp.isVisibleOnStore !== false
                                ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
                            }`}
                            title={
                              camp.isVisibleOnStore !== false
                                ? 'انقر لإخفاء الحملة من واجهة المتجر'
                                : 'انقر لإظهار الحملة على واجهة المتجر'
                            }
                          >
                            {isTogglingVisibility[camp.id] ? (
                              <span className="text-[11px]">جاري التحديث...</span>
                            ) : camp.isVisibleOnStore !== false ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span>إخفاء</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-emerald-200" />
                                <span>تفعيل الظهور</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Dates info */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span>بدأت: {camp.startDate}</span>
                          <span>{camp.endDate ? `تنتهي: ${camp.endDate}` : 'مستمرة دون تحديد'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="p-4 pt-0 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(camp)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title="تعديل الحملة"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {camp.videoUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewVideoCampaign(camp)}
                            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
                            title="مشاهدة الفيديو التعريفي للحملة"
                          >
                            <Video className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(camp)}
                          className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
                          title="حذف الحملة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenManualContribution(camp.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer border border-emerald-200 dark:border-emerald-800"
                        >
                          <Coins className="w-3.5 h-3.5 text-amber-500" />
                          <span>إضافة مساهمة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCampaignFilter(camp.id);
                            setActiveTab('contributions');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <span>سجل التبرعات</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: CONTRIBUTIONS LOG ===================== */}
      {activeTab === 'contributions' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الوصل أو الملاحظات..."
                className="w-full pr-9 pl-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">الحملة:</span>
                <select
                  value={selectedCampaignFilter}
                  onChange={(e) => setSelectedCampaignFilter(e.target.value)}
                  className="text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                >
                  <option value="all">جميع الحملات</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleOpenManualContribution()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>تسجيل مساهمة جديدة</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-3.5">المتبرع</th>
                    <th className="p-3.5">الحملة المستهدفة</th>
                    <th className="p-3.5">نوع المساهمة</th>
                    <th className="p-3.5">المبلغ</th>
                    <th className="p-3.5">طريقة الدفع</th>
                    <th className="p-3.5">إثبات الدفع</th>
                    <th className="p-3.5">التاريخ والوقت</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">ملاحظات</th>
                    <th className="p-3.5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredContributions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        لا توجد مساهمات مسجلة مطابقة للبحث
                      </td>
                    </tr>
                  ) : (
                    filteredContributions.map((c) => {
                      const proofUrl = c.proofImageUrl || c.receiptUrl;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {c.isAnonymous ? (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs">
                                  فاعل خير (مجهول)
                                </span>
                              ) : (
                                <span>{c.donorName}</span>
                              )}
                            </div>
                            {c.donorPhone && (
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {c.donorPhone}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {c.campaignTitle}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                              {c.contributionTypeName}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {c.isFinancial ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                                {c.amount.toLocaleString()} {settings.currency}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">مساهمة عينية / تطوعية</span>
                            )}
                          </td>
                          <td className="p-3.5 text-xs">
                            {c.paymentMethod === 'bank_transfer'
                              ? 'تحويل بنكي'
                              : c.paymentMethod === 'cash'
                              ? 'نقداً'
                              : 'شيك بنكي'}
                          </td>
                          <td className="p-3.5 text-xs whitespace-nowrap">
                            {proofUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreviewProofContribution(c)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs transition cursor-pointer"
                                title="مراجعة ومعاينة صورة إثبات التحويل البنكي"
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>عرض إثبات الدفع</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">غير مرفق</span>
                            )}
                          </td>
                          <td className="p-3.5 text-xs text-slate-500 font-mono">
                            <div>{c.date}</div>
                            {c.time && <div className="text-[10px] text-slate-400">{c.time}</div>}
                          </td>
                          <td className="p-3.5 text-xs whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                                c.status === 'pending'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-300'
                                  : c.status === 'unpaid'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-300'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {c.status === 'pending'
                                ? '⏳ قيد المراجعة'
                                : c.status === 'unpaid'
                                ? '🔴 لم يتم الدفع'
                                : '🟢 مكتملة'}
                            </span>
                          </td>
                          <td className="p-3.5 text-xs max-w-xs truncate text-slate-500" title={c.notes}>
                            {c.notes || '-'}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {proofUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewProofContribution(c)}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                                  title="معاينة صورة إثبات الدفع"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteContribution(c)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="حذف المساهمة وإعادة الخصم"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CREATE / EDIT CAMPAIGN ===================== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-l from-emerald-800 to-teal-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-6 h-6 text-amber-300" />
                <h3 className="text-lg font-bold">
                  {editingCampaign ? 'تعديل بيانات حملة التبرع' : 'إضافة حملة تبرع جديدة'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCampaign} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان الحملة *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثال: حملة كفالة اليتيم - رمضان 1446هـ"
                  className="w-full p-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Target Project */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المشروع المستهدف من التبرعات *
                </label>
                <input
                  type="text"
                  required
                  value={formData.targetProject}
                  onChange={(e) => setFormData({ ...formData, targetProject: e.target.value })}
                  placeholder="مثال: تجهيز مكتبة أطفال القرية / كفالة 50 أسرة معوزة"
                  className="w-full p-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Target Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ميزانية المشروع / الهدف المالي ({settings.currency}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.targetAmount}
                    onChange={(e) => setFormData({ ...formData, targetAmount: Number(e.target.value) })}
                    className="w-full p-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حالة الحملة
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                  >
                    <option value="active">نشطة (تستقبل التبرعات الآن)</option>
                    <option value="paused">متوقفة مؤقتاً</option>
                    <option value="completed">مكتملة</option>
                  </select>
                </div>
              </div>

              {/* Cover Image */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  صورة الحملة الرئيسية (رابط مباشر أو رفع من الجهاز)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.coverImage}
                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                  <label className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-300 dark:border-slate-600 text-xs font-semibold cursor-pointer flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{imageUploadProgress !== null ? `جارٍ الرفع (${imageUploadProgress}%)` : 'رفع صورة'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {imageUploadProgress !== null && (
                  <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full transition-all duration-200"
                      style={{ width: `${imageUploadProgress}%` }}
                    />
                  </div>
                )}

                {/* Preview Image */}
                {formData.coverImage && (
                  <div className="mt-2 h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img
                      src={formData.coverImage}
                      alt="معاينة"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Promotional Video URL & Live Preview */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Video className="w-4 h-4 text-rose-500" />
                    <span>رابط الفيديو التعريفي للحملة</span>
                    <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                      (اختياري)
                    </span>
                  </label>
                  {formData.videoUrl && formData.videoUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, videoUrl: '' })}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-colors"
                      title="حذف رابط الفيديو"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>حذف رابط الفيديو</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  أدخل رابط فيديو ترويجي أو تعريفي للحملة من <strong>YouTube</strong> أو <strong>Vimeo</strong> أو رابط فيديو مباشر <strong>(MP4 / WebM)</strong> لتعزيز مصداقية الحملة وجذب المساهمين.
                </p>

                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <Film className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=... أو https://vimeo.com/... أو https://.../video.mp4"
                    dir="ltr"
                    className="w-full pr-9 pl-9 py-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all placeholder:font-sans placeholder:text-slate-400"
                  />
                  {formData.videoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, videoUrl: '' })}
                      className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      title="مسح الحقل"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Live Video Preview Box Before Saving */}
                {formData.videoUrl && formData.videoUrl.trim() && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    {(() => {
                      const videoInfo = parseVideoUrl(formData.videoUrl);
                      if (videoInfo.isValid) {
                        const platformLabel =
                          videoInfo.platform === 'youtube'
                            ? 'YouTube'
                            : videoInfo.platform === 'vimeo'
                            ? 'Vimeo'
                            : 'فيديو مباشر MP4';
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>معاينة الفيديو المباشرة قبل الحفظ:</span>
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                منصة الفيديو: {platformLabel}
                              </span>
                            </div>
                            <div className="rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm bg-black">
                              <VideoPlayer
                                url={formData.videoUrl.trim()}
                                title={formData.title || 'معاينة فيديو الحملة'}
                                aspectRatio="video"
                                showPlatformBadge={true}
                                lazy={false}
                              />
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">الرابط المدخل غير مكتمل أو غير مدعوم حالياً</p>
                              <p className="text-[11px] mt-0.5 text-amber-700 dark:text-amber-400">
                                تأكد من نسخ الرابط كاملاً من شريط المتصفح (مثال: YouTube watch/shorts، Vimeo، أو رابط MP4 مباشر).
                              </p>
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  وصف الحملة وتفاصيل المشروع
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="اكتب نبذة توضيحية عن أهداف الحملة والفئة المستفيدة وأوجه الصرف..."
                  className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاريخ بدء الحملة
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاريخ انتهاء الحملة (اختياري)
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Store Visibility Setting - ظهور الحملة على واجهة المتجر */}
              <div className="p-3.5 sm:p-4 rounded-2xl border bg-slate-50/90 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        ظهور الحملة على واجهة المتجر
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          formData.isVisibleOnStore
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {formData.isVisibleOnStore ? (
                          <>
                            <Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>مفعّلة (ON)</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>معطّلة (OFF)</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {formData.isVisibleOnStore
                        ? 'الحملة ظاهرة حالياً على واجهة المتجر للزوار، ومتاحة للتبرع المباشر.'
                        : 'الحملة مخفية عن واجهة المتجر. (مهم: تعطيل الظهور لا يحذف الحملة أو أي من التبرعات والمساهمات المسجلة).'}
                    </p>
                  </div>

                  {/* Switch ON / OFF Buttons */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto shrink-0 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isVisibleOnStore: true })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        formData.isVisibleOnStore
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>مفعّلة (ON)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isVisibleOnStore: false })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        !formData.isVisibleOnStore
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>معطّلة (OFF)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Allow Overfunding */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allowOverfunding}
                    onChange={(e) => setFormData({ ...formData, allowOverfunding: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>السماح بمواصلة التبرع حتى بعد اكتمال الهدف المالي (100%)</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mr-6 mt-0.5">
                  إذا تم إلغاء التحديد، سيتم إغلاق الحملة تلقائياً عند تحصيل 100% من الهدف.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingCampaign ? 'حفظ التعديلات' : 'إنشاء وتفعيل الحملة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: MANUAL CONTRIBUTION ===================== */}
      {isManualContributionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
            <div className="bg-gradient-to-l from-emerald-800 to-teal-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-bold">تسجيل مساهمة يدوية من الإدارة</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsManualContributionOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualContribution} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الحملة المستهدفة *
                </label>
                <select
                  required
                  value={manualCampaignId}
                  onChange={(e) => setManualCampaignId(e.target.value)}
                  className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.targetProject})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المتبرع (أو اتركه فارغاً لفاعل خير)
                  </label>
                  <input
                    type="text"
                    value={manualDonorName}
                    onChange={(e) => setManualDonorName(e.target.value)}
                    placeholder="فاعل خير"
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="tel"
                    value={manualDonorPhone}
                    onChange={(e) => setManualDonorPhone(e.target.value)}
                    placeholder="06XXXXXXXX"
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المبلغ ({settings.currency}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="w-full p-2 text-sm font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    طريقة الدفع
                  </label>
                  <select
                    value={manualPaymentMethod}
                    onChange={(e) => setManualPaymentMethod(e.target.value as any)}
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="cash">نقداً بمقر الجمعية</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="check">شيك بنكي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نوع المساهمة
                </label>
                <select
                  value={manualTypeId}
                  onChange={(e) => setManualTypeId(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer"
                >
                  {contributionTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات أو توثيق إضافي
                </label>
                <textarea
                  rows={2}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="ملاحظات حول مصدر المساهمة أو رقم الشيك أو الوصل..."
                  className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualContributionOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  تأكيد وحفظ المساهمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          CAMPAIGN DELETION CONFIRMATION MODAL (حذف الحملة والمشروع الخيري نهائياً)
          ========================================================================= */}
      {campaignToDelete && (
        <div
          id="modal-delete-campaign-confirm"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          dir="rtl"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
                  <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    هل أنت متأكد من حذف هذا النشاط / الحملة؟
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    حذف نهائي ودائم من قاعدة بيانات الجمعية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingCampaign) setCampaignToDelete(null);
                }}
                disabled={isDeletingCampaign}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campaign Summary */}
            <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-2">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300">اسم الحملة المستهدفة:</span>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                «{campaignToDelete.title}»
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-rose-200/50 dark:border-rose-900/40">
                <div>
                  المبلغ المحصل: <span className="font-bold text-emerald-600 dark:text-emerald-400">{campaignToDelete.collectedAmount?.toLocaleString() || 0} {settings.currency}</span>
                </div>
                <div>
                  الهدف: <span className="font-bold text-slate-700 dark:text-slate-300">{campaignToDelete.targetAmount?.toLocaleString()} {settings.currency}</span>
                </div>
              </div>
            </div>

            {/* Danger Warning Note */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1.5 text-right">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>تحذير أمني وقانوني لا رجعة فيه</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                سيتم حذف هذه الحملة وجميع سجلات التبرعات والمساهمات المرتبطة بها نهائياً من قاعدة البيانات، ولن تظهر بعد الآن في واجهة المتجر أو لوحة التحكم.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-campaign"
                onClick={() => {
                  if (!isDeletingCampaign) setCampaignToDelete(null);
                }}
                disabled={isDeletingCampaign}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء التراجع
              </button>

              <button
                type="button"
                id="btn-confirm-delete-campaign"
                onClick={handleConfirmDeleteCampaign}
                disabled={isDeletingCampaign}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingCampaign ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>نعم، حذف نهائي</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONTRIBUTION DELETION CONFIRMATION MODAL (حذف سجل مساهمة تبرع)
          ========================================================================= */}
      {contribToDelete && (
        <div
          id="modal-delete-contrib-confirm"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          dir="rtl"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
                  <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    تأكيد حذف مساهمة التبرع
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    خصم فوري من إجمالي الحملة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingContribution) setContribToDelete(null);
                }}
                disabled={isDeletingContribution}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-slate-600 dark:text-slate-400">المتبرع:</span>
                <span className="text-slate-900 dark:text-white">{contribToDelete.donorName}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-slate-600 dark:text-slate-400">المبلغ:</span>
                <span className="text-rose-600 dark:text-rose-400 font-black">{contribToDelete.amount} {settings.currency}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              سيتم حذف سجل هذه المساهمة نهائياً وإعادة احتساب المبالغ المحصلة في الحملة تلقائياً.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-contribution"
                onClick={() => {
                  if (!isDeletingContribution) setContribToDelete(null);
                }}
                disabled={isDeletingContribution}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="button"
                id="btn-confirm-delete-contribution"
                onClick={handleConfirmDeleteContribution}
                disabled={isDeletingContribution}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingContribution ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CAMPAIGN VIDEO PREVIEW ===================== */}
      {previewVideoCampaign && previewVideoCampaign.videoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" dir="rtl">
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      معاينة الفيديو التعريفي
                    </span>
                    <span className="text-xs text-slate-400">حملات التبرع</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white line-clamp-1 mt-0.5">
                    {previewVideoCampaign.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVideoCampaign(null)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player Container */}
            <div className="p-3 sm:p-6 bg-slate-950 overflow-y-auto">
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-black">
                <VideoPlayer
                  url={previewVideoCampaign.videoUrl}
                  title={previewVideoCampaign.title}
                  aspectRatio="video"
                  showPlatformBadge={true}
                  autoPlay={true}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span>المشروع المستهدف:</span>
                <strong className="text-slate-900 dark:text-white">{previewVideoCampaign.targetProject}</strong>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const c = previewVideoCampaign;
                    setPreviewVideoCampaign(null);
                    openEditModal(c);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل رابط الفيديو أو بيانات الحملة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewVideoCampaign(null)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: PAYMENT PROOF IMAGE PREVIEW ===================== */}
      {previewProofContribution && (previewProofContribution.proofImageUrl || previewProofContribution.receiptUrl) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          dir="rtl"
          onClick={() => setPreviewProofContribution(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-l from-emerald-800 to-teal-800 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    مراجعة إثبات الدفع (التحويل البنكي)
                  </h3>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    المتبرع: {previewProofContribution.isAnonymous ? 'فاعل خير' : previewProofContribution.donorName} — المبلغ:{' '}
                    {previewProofContribution.amount.toLocaleString()} {settings.currency}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProofContribution(null)}
                className="p-2 rounded-full hover:bg-white/15 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Preview Container */}
            <div className="p-4 sm:p-6 bg-slate-950 overflow-y-auto flex-1 flex flex-col items-center justify-center">
              <img
                src={previewProofContribution.proofImageUrl || previewProofContribution.receiptUrl}
                alt="إثبات التحويل البنكي"
                className="max-h-[60vh] w-auto object-contain rounded-2xl border border-slate-800 shadow-lg mx-auto"
              />
            </div>

            {/* Details & Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
                <span>
                  الحملة: <strong className="text-slate-900 dark:text-white">{previewProofContribution.campaignTitle}</strong>
                </span>
                <span>•</span>
                <span>
                  التاريخ: <strong className="font-mono text-slate-900 dark:text-white">{previewProofContribution.date}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <a
                  href={previewProofContribution.proofImageUrl || previewProofContribution.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={`proof-${previewProofContribution.id}.jpg`}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold transition-colors flex items-center gap-1.5"
                >
                  <FileDown className="w-4 h-4" />
                  <span>تحميل الصورة</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewProofContribution(null)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
