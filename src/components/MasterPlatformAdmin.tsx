import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  DollarSign, 
  ShieldCheck, 
  Search, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Key, 
  Lock, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  LogOut, 
  Eye, 
  EyeOff,
  MapPin, 
  Phone, 
  Layers, 
  CreditCard, 
  ShieldAlert,
  Info,
  Calendar,
  Image as ImageIcon,
  Sliders,
  HeartHandshake,
  Heart,
  FileText,
  Download,
  Check,
  Megaphone,
  UserPlus,
  UserCheck,
  Banknote,
  Save,
  Upload,
  AlertCircle,
  X,
  Mail,
  Video
} from 'lucide-react';
import { 
  getAllTenants, 
  getAllOwners, 
  calculatePlatformMasterStats, 
  toggleTenantStatus, 
  setTenantStatus, 
  deleteTenant, 
  deleteTenantFromDatabase,
  updateTenantDetails,
  updateTenantDetailsPermanent,
  resetOwnerPassword,
  getTenantLiveStats,
  MASTER_TEMPLATE_TENANT_ID,
  getMasterAdminSession,
  setMasterAdminSession,
  updateTenantLegalDocumentStatus,
  syncTenantsFromBackend
} from '../tenantStorage';
import { AssociationTenant, AssociationOwner, SubscriptionTier, MasterAdminSession, PlatformPermissionKey } from '../types';
import { uploadImageToServer, ensurePermanentImageUrl } from '../api/imageApi';
import { PlatformPortalAdminSettings } from './PlatformPortalAdminSettings';
import { PlatformPaymentsAdmin } from './PlatformPaymentsAdmin';
import { PlatformActivationFeeAdmin } from './PlatformActivationFeeAdmin';
import { PlatformAdCreationFeeAdmin } from './PlatformAdCreationFeeAdmin';
import { PlatformContributionTypesAdmin } from './PlatformContributionTypesAdmin';
import { PlatformAdCampaignsAdmin } from './PlatformAdCampaignsAdmin';
import { PlatformSubscriptionRenewalsAdmin } from './PlatformSubscriptionRenewalsAdmin';
import { PlatformManageSubAdmins } from './PlatformManageSubAdmins';
import { PlatformIdentityAdminSettings } from './PlatformIdentityAdminSettings';
import { PlatformSupportAdminSettings } from './PlatformSupportAdminSettings';
import { PlatformSupportModal } from './PlatformSupportModal';
import { PlatformAssociationSectionsAdmin } from './PlatformAssociationSectionsAdmin';
import { PlatformTutorialsSection } from './PlatformTutorialsSection';
import { usePlatformIdentity, verifyMasterSuperAdminPin, apiUnifiedMasterAdminLogin } from '../api/platformIdentityApi';
import { apiLoginPlatformSubAdmin, apiLogPlatformAdminActivity } from '../api/platformSubAdminsApi';
import { getAllTenantPayments, getTenantsRequiringRenewal } from '../paymentStorage';
import { getCountryFlag, COUNTRIES_LIST } from './CreateAssociationWizardModal';
import { getCitiesForCountry, isCityValidForCountry } from '../data/geoCitiesDatabase';

interface MasterPlatformAdminProps {
  onBackToPortal: () => void;
  onSwitchToTenant: (tenantId: string, openAdminPanel?: boolean) => void;
  onOpenCreateWizard: () => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const MasterPlatformAdmin: React.FC<MasterPlatformAdminProps> = ({
  onBackToPortal,
  onSwitchToTenant,
  onOpenCreateWizard,
  onShowToast,
}) => {
  // Master Admin Authentication & Session state
  const initialSession = getMasterAdminSession();
  const [currentSession, setCurrentSession] = useState<MasterAdminSession | null>(initialSession);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!initialSession);
  const { identity: platformIdentity } = usePlatformIdentity();

  // Unified Login State: single password field for both Super Admin and Secondary Admins
  const [unifiedPassword, setUnifiedPassword] = useState('');
  const [showUnifiedPassword, setShowUnifiedPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check role & permissions
  const isSuperAdmin = currentSession?.role === 'super_admin' || currentSession?.isMaster === true;

  const hasPermission = (key: PlatformPermissionKey): boolean => {
    if (isSuperAdmin) return true;
    return !!currentSession?.permissions?.[key];
  };

  type MasterTabType = 
    | 'associations' 
    | 'association_sections' 
    | 'users' 
    | 'portal_ui' 
    | 'payments' 
    | 'activation_fee'
    | 'ad_creation_fee'
    | 'contribution_types' 
    | 'ad_campaigns' 
    | 'renewals' 
    | 'add_admin' 
    | 'platform_identity' 
    | 'platform_support'
    | 'platform_tutorials';

  // Helper to determine first allowed tab
  const getFirstAllowedTab = (session: MasterAdminSession | null): MasterTabType => {
    if (!session || session.isMaster || session.role === 'super_admin') return 'associations';
    const perms = session.permissions || ({} as Record<PlatformPermissionKey, boolean>);
    if (perms.associations_view || perms.associations_manage) return 'associations';
    if (perms.association_sections_manage || perms.association_sections_view) return 'association_sections';
    if (perms.users_manage) return 'users';
    if (perms.payments_manage) return 'payments';
    if (perms.portal_settings_manage) return 'portal_ui';
    if (perms.contribution_types_manage) return 'contribution_types';
    if (perms.platform_support_manage) return 'platform_support';
    if (perms.ad_campaigns_manage || perms.ad_campaign_requests_manage) return 'ad_campaigns';
    if (perms.subscriptions_renewals_manage) return 'renewals';
    return 'associations';
  };

  // Active Tab
  const [activeTab, setActiveTab] = useState<MasterTabType>(() => getFirstAllowedTab(initialSession));
  const [previewSupportModalOpen, setPreviewSupportModalOpen] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending_subscription' | 'pending_activation'>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  // Tenants & Owners Data
  const [tenants, setTenants] = useState<AssociationTenant[]>(getAllTenants);
  const [owners, setOwners] = useState<AssociationOwner[]>(getAllOwners);
  const stats = calculatePlatformMasterStats();

  // Automatic real-time synchronization with disk/backend database
  useEffect(() => {
    syncTenantsFromBackend().then((fresh) => {
      if (Array.isArray(fresh) && fresh.length > 0) {
        setTenants(fresh);
        setOwners(getAllOwners());
      }
    }).catch(console.warn);

    const handleTenantsChanged = () => {
      setTenants(getAllTenants());
      setOwners(getAllOwners());
    };
    window.addEventListener('chayef-tenants-changed', handleTenantsChanged);
    window.addEventListener('storage', handleTenantsChanged);
    return () => {
      window.removeEventListener('chayef-tenants-changed', handleTenantsChanged);
      window.removeEventListener('storage', handleTenantsChanged);
    };
  }, []);

  // View Modal State
  const [viewingTenant, setViewingTenant] = useState<AssociationTenant | null>(null);

  // Edit Modal State
  const [editingTenant, setEditingTenant] = useState<AssociationTenant | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameFr, setEditNameFr] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editOwnerPhone, setEditOwnerPhone] = useState('');
  const [editTier, setEditTier] = useState<SubscriptionTier>('basic');
  const [editFee, setEditFee] = useState<number>(199);
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSaveMessage, setEditSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Status Change Confirmation Modal
  const [statusChangeTenant, setStatusChangeTenant] = useState<{
    tenant: AssociationTenant;
    targetStatus: 'active' | 'inactive';
  } | null>(null);

  // Delete Confirmation Modal
  const [deletingTenant, setDeletingTenant] = useState<AssociationTenant | null>(null);
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);

  // Reset Password Modal
  const [resetPasswordOwner, setResetPasswordOwner] = useState<AssociationOwner | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Legal Document Preview & Review Modals
  const [documentPreviewTenant, setDocumentPreviewTenant] = useState<AssociationTenant | null>(null);
  const [rejectModalTenant, setRejectModalTenant] = useState<AssociationTenant | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [documentActionSuccess, setDocumentActionSuccess] = useState<string | null>(null);

  // Counts
  const activeTenantsCount = tenants.filter((t) => t.status === 'active').length;
  const inactiveTenantsCount = tenants.filter((t) => t.status === 'inactive').length;
  const pendingSubscriptionCount = tenants.filter((t) => t.status === 'pending_subscription').length;
  const pendingActivationCount = tenants.filter((t) => t.status === 'pending_activation').length;
  const pendingPaymentsCount = getAllTenantPayments().filter((p) => p.status === 'pending' || p.status === 'verified').length;
  const renewalRequiredCount = getTenantsRequiringRenewal(20).length;

  // Unified Login: automatically verifies password and determines role (Super Admin vs. Secondary Admin)
  const handleUnifiedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const trimmed = unifiedPassword.trim();

    if (!trimmed) {
      setLoginError('كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await apiUnifiedMasterAdminLogin(trimmed);
      if (res.success && res.session) {
        setMasterAdminSession(res.session);
        setCurrentSession(res.session);
        setIsAuthenticated(true);
        if (res.role === 'secondary_admin') {
          const targetTab = getFirstAllowedTab(res.session);
          setActiveTab(targetTab);
          onShowToast(res.message || `مرحباً بك يا ${res.session.fullName || 'أدمن مساعد'}، تم تسجيل الدخول بنجاح`, 'success');
        } else {
          setActiveTab('associations');
          onShowToast('تم تسجيل الدخول إلى الإدارة العامة للمنصة بنجاح (Super Admin)', 'success');
        }
      } else {
        setLoginError(res.error || 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
      }
    } catch {
      setLoginError('كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (currentSession && !isSuperAdmin) {
      apiLogPlatformAdminActivity({
        adminId: currentSession.id || 'subadmin',
        adminName: currentSession.fullName || 'أدمن مساعد',
        adminPhone: currentSession.phone || '',
        action: `تسجيل خروج الأدمن المساعد ${currentSession.fullName}`,
        actionKey: 'login',
        targetItem: 'لوحة الإدارة العامة',
        details: `تسجيل خروج الأدمن المساعد ${currentSession.fullName} من لوحة الإدارة العامة`,
      });
    }
    setIsAuthenticated(false);
    setCurrentSession(null);
    setMasterAdminSession(null);
    setUnifiedPassword('');
    setActiveTab('associations');
    onShowToast('تم تسجيل الخروج من الإدارة العامة للمنصة', 'info');
    onBackToPortal();
  };

  // Open Status Change Confirmation or Activate directly
  const handlePromptStatusChange = (tenant: AssociationTenant) => {
    if (!isSuperAdmin && !hasPermission('associations_toggle_status')) {
      onShowToast('عذراً، ليس لديك صلاحية تفعيل أو تعطيل الجمعيات.', 'error');
      return;
    }
    const isCurrentlyActive = tenant.status === 'active';
    if (isCurrentlyActive) {
      // Confirmation modal required before disabling
      setStatusChangeTenant({ tenant, targetStatus: 'inactive' });
    } else {
      if (tenant.status === 'pending_subscription') {
        onShowToast('لا يمكن تفعيل المنصة وهي في حالة «في انتظار الدفع» قبل تسديد مبلغ الاشتراك المطلوب والتحقق من صحة الدفع.', 'error');
        return;
      }
      if (tenant.status === 'pending_activation' && !tenant.paymentVerified) {
        onShowToast('المنصة في حالة «في انتظار التفعيل». يرجى التحقق من صحة الدفع أولاً في قسم «مدفوعات التفعيل» ثم الموافقة على التفعيل.', 'info');
        setActiveTab('payments');
        return;
      }
      const updated = setTenantStatus(tenant.id, 'active');
      if (updated) {
        setTenants(getAllTenants());
        if (viewingTenant && viewingTenant.id === tenant.id) {
          setViewingTenant(updated);
        }
        apiLogPlatformAdminActivity({
          adminId: currentSession?.id || (isSuperAdmin ? 'super_admin' : 'admin'),
          adminName: currentSession?.fullName || 'الأدمين الرئيسي',
          adminPhone: currentSession?.phone || '',
          action: 'تفعيل منصة الجمعية',
          actionKey: 'tenant_toggle',
          targetItem: tenant.name,
          details: `تفعيل منصة الجمعية «${tenant.name}» وإتاحتها للمستخدمين`,
        });
        onShowToast('تم تفعيل الجمعية بنجاح، وأصبحت حالتها «مفعّلة».', 'success');
      }
    }
  };

  // Confirm Status Change
  const handleConfirmStatusChange = () => {
    if (!statusChangeTenant) return;
    if (!isSuperAdmin && !hasPermission('associations_toggle_status')) {
      onShowToast('عذراً، ليس لديك صلاحية تفعيل أو تعطيل الجمعيات.', 'error');
      setStatusChangeTenant(null);
      return;
    }
    const { tenant, targetStatus } = statusChangeTenant;
    const updated = setTenantStatus(tenant.id, targetStatus);
    if (updated) {
      setTenants(getAllTenants());
      if (viewingTenant && viewingTenant.id === tenant.id) {
        setViewingTenant(updated);
      }
      apiLogPlatformAdminActivity({
        adminId: currentSession?.id || (isSuperAdmin ? 'super_admin' : 'admin'),
        adminName: currentSession?.fullName || 'الأدمين الرئيسي',
        adminPhone: currentSession?.phone || '',
        action: 'تغيير حالة الجمعية',
        actionKey: 'tenant_toggle',
        targetItem: tenant.name,
        details: `تغيير حالة الجمعية «${tenant.name}» إلى ${targetStatus === 'active' ? 'مفعلة' : 'معطلة مؤقتاً'}`,
      });
      if (targetStatus === 'inactive') {
        onShowToast(
          `تم تعطيل الجمعية «${tenant.name}» مؤقتاً. لن يتم حذف أي بيانات، ويمكنك إعادة تفعيلها في أي وقت.`,
          'info'
        );
      } else {
        onShowToast(
          'تم تفعيل الجمعية بنجاح، وأصبحت منصتها متاحة للمستخدمين.',
          'success'
        );
      }
    }
    setStatusChangeTenant(null);
  };

  // Prompt Delete (Super Admin Only)
  const handlePromptDelete = (tenant: AssociationTenant) => {
    if (!isSuperAdmin) {
      onShowToast('عذراً، صلاحية حذف الجمعيات محصورة بالأدمن الرئيسي (Super Admin) فقط.', 'error');
      return;
    }
    if (tenant.isTemplate || tenant.id === MASTER_TEMPLATE_TENANT_ID) {
      onShowToast('لا يمكن حذف القالب الأساسي للمنصة (جمعية النور للتنمية والتضامن).', 'error');
      return;
    }
    setDeletingTenant(tenant);
  };

  // Confirm Permanent Delete (Super Admin Only - Connected to Database)
  const handleConfirmDelete = async () => {
    if (!deletingTenant || isDeletingTenant) return;
    if (!isSuperAdmin) {
      onShowToast('عذراً، صلاحية حذف الجمعيات محصورة بالأدمن الرئيسي (Super Admin) فقط.', 'error');
      setDeletingTenant(null);
      return;
    }
    if (deletingTenant.isTemplate || deletingTenant.id === MASTER_TEMPLATE_TENANT_ID) {
      onShowToast('لا يمكن حذف القالب الأساسي للمنصة (جمعية النور للتنمية والتضامن).', 'error');
      setDeletingTenant(null);
      return;
    }

    const tenantName = deletingTenant.name;
    const tenantId = deletingTenant.id;
    setIsDeletingTenant(true);

    try {
      const res = await deleteTenantFromDatabase(tenantId);
      if (res.success) {
        setTenants(res.tenants);
        setOwners(getAllOwners());
        if (viewingTenant && viewingTenant.id === tenantId) {
          setViewingTenant(null);
        }
        apiLogPlatformAdminActivity({
          adminId: currentSession?.id || 'super_admin',
          adminName: currentSession?.fullName || 'الأدمن الرئيسي',
          adminPhone: currentSession?.phone || '',
          action: 'حذف الجمعية نهائياً',
          actionKey: 'tenant_delete',
          targetItem: tenantName,
          details: `حذف جمعية «${tenantName}» (${tenantId}) نهائياً من قاعدة البيانات مع الحفاظ التام على بيانات الجمعيات الأخرى`,
        });
        onShowToast(`تم حذف جمعية «${tenantName}» نهائياً من قاعدة البيانات وتحديث قائمة الجمعيات بنجاح.`, 'success');
        setDeletingTenant(null);
      } else {
        onShowToast(res.error || 'تعذر تنفيذ عملية حذف الجمعية.', 'error');
      }
    } catch {
      onShowToast('حدث خطأ أثناء الاتصال بقاعدة البيانات لحذف الجمعية.', 'error');
    } finally {
      setIsDeletingTenant(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (tenant: AssociationTenant) => {
    if (!isSuperAdmin && !hasPermission('associations_manage')) {
      onShowToast('عذراً، صلاحية تعديل بيانات الجمعيات محصورة بالأدمين المخول.', 'error');
      return;
    }
    setEditingTenant(tenant);
    setEditName(tenant.name || '');
    setEditNameFr(tenant.nameFr || '');
    setEditNameEn(tenant.nameEn || '');
    setEditCountry(tenant.country || 'المغرب');
    setEditCity(tenant.city || '');
    setEditTagline(tenant.tagline || '');
    setEditDescription(tenant.description || '');
    setEditAddress(tenant.address || '');
    setEditEmail(tenant.email || '');
    setEditWhatsapp(tenant.whatsapp || '');
    setEditOwnerName(tenant.ownerName || '');
    setEditOwnerPhone(tenant.ownerPhone || '');
    setEditTier(tenant.tier || 'basic');
    setEditFee(tenant.monthlyFee || 199);
    setEditLogoUrl(tenant.logoUrl || '');
    setEditBannerUrl(tenant.bannerImageUrl || '');
    setEditSaveMessage(null);
  };

  // Handle Logo file selection & direct permanent upload
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTenant) return;
    setIsUploadingLogo(true);
    setEditSaveMessage(null);
    try {
      const url = await uploadImageToServer(file, {
        tenantId: editingTenant.id,
        category: 'branding',
        fileName: `logo_${editingTenant.id}_${Date.now()}.jpg`,
      });
      setEditLogoUrl(url);
      onShowToast('تم رفع شعار الجمعية بنجاح إلى التخزين الدائم', 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'تعذر رفع صورة الشعار', 'error');
    } finally {
      setIsUploadingLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle Banner file selection & direct permanent upload
  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTenant) return;
    setIsUploadingBanner(true);
    setEditSaveMessage(null);
    try {
      const url = await uploadImageToServer(file, {
        tenantId: editingTenant.id,
        category: 'banners',
        fileName: `banner_${editingTenant.id}_${Date.now()}.jpg`,
      });
      setEditBannerUrl(url);
      onShowToast('تم رفع صورة الغلاف بنجاح إلى التخزين الدائم', 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'تعذر رفع صورة الغلاف', 'error');
    } finally {
      setIsUploadingBanner(false);
      if (e.target) e.target.value = '';
    }
  };

  // Save Edit permanently in database
  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTenant || isSavingEdit) return;
    if (!isSuperAdmin && !hasPermission('associations_manage')) {
      onShowToast('عذراً، صلاحية تعديل بيانات الجمعيات محصورة بالأدمين المخول.', 'error');
      setEditingTenant(null);
      return;
    }

    if (!editName.trim()) {
      setEditSaveMessage({ type: 'error', text: 'يرجى إدخال اسم الجمعية بالعربية.' });
      onShowToast('يرجى إدخال اسم الجمعية بالعربية.', 'error');
      return;
    }

    if (!editCity.trim()) {
      setEditSaveMessage({ type: 'error', text: 'يرجى تحديد مدينة الجمعية.' });
      onShowToast('يرجى تحديد مدينة الجمعية.', 'error');
      return;
    }

    if (!isCityValidForCountry(editCity, editCountry)) {
      const msg = `المدينة المحددة «${editCity}» غير مسجلة ضمن مدن ${editCountry}. يرجى اختيار مدينة صحيحة.`;
      setEditSaveMessage({ type: 'error', text: msg });
      onShowToast(msg, 'error');
      return;
    }

    if (!editOwnerName.trim() || !editOwnerPhone.trim()) {
      setEditSaveMessage({ type: 'error', text: 'يرجى إدخال اسم مسؤول الجمعية ورقم هاتفه.' });
      onShowToast('يرجى إدخال اسم مسؤول الجمعية ورقم هاتفه.', 'error');
      return;
    }

    setIsSavingEdit(true);
    setEditSaveMessage(null);

    try {
      // 1. Ensure any data URLs are uploaded to permanent storage
      let finalLogo = editLogoUrl.trim();
      if (finalLogo.startsWith('data:')) {
        finalLogo = await ensurePermanentImageUrl(finalLogo, {
          tenantId: editingTenant.id,
          category: 'branding',
        });
      }

      let finalBanner = editBannerUrl.trim();
      if (finalBanner.startsWith('data:')) {
        finalBanner = await ensurePermanentImageUrl(finalBanner, {
          tenantId: editingTenant.id,
          category: 'banners',
        });
      }

      // 2. Perform permanent database update
      const result = await updateTenantDetailsPermanent(editingTenant.id, {
        name: editName.trim(),
        nameFr: editNameFr.trim(),
        nameEn: editNameEn.trim(),
        country: editCountry.trim(),
        city: editCity.trim(),
        tagline: editTagline.trim(),
        description: editDescription.trim(),
        address: editAddress.trim(),
        email: editEmail.trim(),
        whatsapp: editWhatsapp.trim(),
        phone: editOwnerPhone.trim(),
        ownerName: editOwnerName.trim(),
        ownerPhone: editOwnerPhone.trim(),
        tier: editTier,
        monthlyFee: Number(editFee) || 0,
        logoUrl: finalLogo,
        bannerImageUrl: finalBanner,
      });

      if (!result.success || !result.tenant) {
        const errorText = result.error || 'تعذر حفظ التعديلات في قاعدة البيانات.';
        setEditSaveMessage({ type: 'error', text: errorText });
        onShowToast(errorText, 'error');
        return;
      }

      // 3. Update local states
      const updatedTenant = result.tenant;
      setTenants(getAllTenants());
      setOwners(getAllOwners());
      if (viewingTenant && viewingTenant.id === editingTenant.id) {
        setViewingTenant(updatedTenant);
      }

      // 4. Activity log
      apiLogPlatformAdminActivity({
        adminId: currentSession?.id || (isSuperAdmin ? 'super_admin' : 'admin'),
        adminName: currentSession?.fullName || 'الأدمين الرئيسي',
        adminPhone: currentSession?.phone || '',
        action: 'تعديل بيانات الجمعية',
        actionKey: 'tenant_edit',
        targetItem: editName.trim(),
        details: `تعديل وحفظ بيانات منصة الجمعية «${editName.trim()}» بشكل دائم في قاعدة البيانات`,
      });

      // 5. Success message
      setEditSaveMessage({
        type: 'success',
        text: 'تم حفظ التعديلات بنجاح في قاعدة البيانات',
      });
      onShowToast('تم حفظ التعديلات بنجاح', 'success');

      // Update active editing tenant reference to match fresh data
      setEditingTenant(updatedTenant);
      setEditLogoUrl(finalLogo);
      setEditBannerUrl(finalBanner);

      // Close modal after brief feedback
      setTimeout(() => {
        setEditingTenant(null);
        setEditSaveMessage(null);
      }, 1200);

    } catch (err: any) {
      console.error('[MasterPlatformAdmin] handleSaveEdit error:', err);
      const errText = err?.message || 'حدث خطأ أثناء حفظ التعديلات في قاعدة البيانات.';
      setEditSaveMessage({ type: 'error', text: errText });
      onShowToast(errText, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Reset Password
  const handleConfirmResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordOwner || newPassword.length < 6) {
      onShowToast('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل', 'error');
      return;
    }
    if (!isSuperAdmin && !hasPermission('associations_manage')) {
      onShowToast('عذراً، صلاحية إعادة تعيين كلمات المرور محصورة بالأدمين المخول.', 'error');
      setResetPasswordOwner(null);
      return;
    }

    const success = resetOwnerPassword(
      resetPasswordOwner.phone,
      newPassword,
      resetPasswordOwner.id,
      resetPasswordOwner.tenantId
    );
    if (success) {
      apiLogPlatformAdminActivity({
        adminId: currentSession?.id || (isSuperAdmin ? 'super_admin' : 'admin'),
        adminName: currentSession?.fullName || 'الأدمين الرئيسي',
        adminPhone: currentSession?.phone || '',
        action: 'إعادة تعيين كلمة المرور',
        actionKey: 'tenant_edit',
        targetItem: resetPasswordOwner.fullName,
        details: `إعادة تعيين كلمة المرور لحساب مسؤول الجمعية (${resetPasswordOwner.fullName})`,
      });
      onShowToast(`تمت إعادة تعيين كلمة المرور للحساب (${resetPasswordOwner.fullName}) بنجاح`, 'success');
      setResetPasswordOwner(null);
      setNewPassword('');
    } else {
      onShowToast('تعذر إعادة تعيين كلمة المرور', 'error');
    }
  };

  // Filtered tenants
  const filteredTenants = tenants.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      t.name.toLowerCase().includes(q) ||
      (t.nameFr && t.nameFr.toLowerCase().includes(q)) ||
      (t.nameEn && t.nameEn.toLowerCase().includes(q)) ||
      t.city.toLowerCase().includes(q) ||
      t.country.toLowerCase().includes(q) ||
      t.ownerName.toLowerCase().includes(q) ||
      t.ownerPhone.includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' ? true : t.status === statusFilter;
    const matchesTier = tierFilter === 'all' ? true : t.tier === tierFilter;

    return matchesSearch && matchesStatus && matchesTier;
  });

  // Filtered owners
  const filteredOwners = owners.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    const assoc = tenants.find((t) => t.id === o.tenantId);
    const assocName = assoc ? assoc.name : '';
    return (
      !q ||
      o.fullName.toLowerCase().includes(q) ||
      o.phone.includes(q) ||
      assocName.toLowerCase().includes(q)
    );
  });

  // ==================== LEGAL DOCUMENT REVIEW HANDLERS ====================
  const handleApproveDocument = (tenantId: string, activateTenant: boolean = false) => {
    if (!isSuperAdmin && !hasPermission('tenants_requests_manage')) {
      onShowToast('عذراً، صلاحية مراجعة واعتماد الوثائق القانونية محصورة بالأدمين المخول.', 'error');
      return;
    }
    const updated = updateTenantLegalDocumentStatus(tenantId, 'approved', {
      activateTenant,
      verifiedBy: currentSession?.fullName || 'الإدارة العامة للمنصة',
    });
    if (updated) {
      setTenants(getAllTenants());
      if (viewingTenant && viewingTenant.id === tenantId) {
        setViewingTenant(updated);
      }
      if (documentPreviewTenant && documentPreviewTenant.id === tenantId) {
        setDocumentPreviewTenant(updated);
      }
      apiLogPlatformAdminActivity({
        adminId: currentSession?.id || (isSuperAdmin ? 'super_admin' : 'admin'),
        adminName: currentSession?.fullName || 'الأدمين الرئيسي',
        adminPhone: currentSession?.phone || '',
        action: 'اعتماد الوثيقة القانونية',
        actionKey: 'tenant_edit',
        targetItem: updated.name,
        details: `اعتماد الوثيقة القانونية لجمعية «${updated.name}»${activateTenant ? ' وتفعيل المنصة فورياً' : ''}`,
      });
      onShowToast(
        `تم قبول واعتماد الوثيقة القانونية لجمعية «${updated.name}» بنجاح${activateTenant ? ' وتم تفعيل المنصة فورياً' : ''}.`,
        'success'
      );
    }
  };

  const handleOpenRejectModal = (tenant: AssociationTenant) => {
    if (!isSuperAdmin && !hasPermission('tenants_requests_manage')) {
      onShowToast('عذراً، صلاحية رفض الوثائق القانونية محصورة بالأدمين المخول.', 'error');
      return;
    }
    setRejectModalTenant(tenant);
    setRejectionReasonText('الوثيقة غير واضحة أو غير مطابقة للضوابط القانونية والتراخيص المطلوبة.');
  };

  const handleConfirmRejectDocument = () => {
    if (!rejectModalTenant) return;
    if (!isSuperAdmin && !hasPermission('tenants_requests_manage')) {
      onShowToast('عذراً، صلاحية رفض الوثائق القانونية محصورة بالأدمين المخول.', 'error');
      setRejectModalTenant(null);
      return;
    }
    const reason = rejectionReasonText.trim() || 'الوثيقة غير واضحة أو غير مطابقة للضوابط القانونية والتراخيص المطلوبة.';
    const tenantName = rejectModalTenant.name;
    const tenantId = rejectModalTenant.id;
    const updated = updateTenantLegalDocumentStatus(rejectModalTenant.id, 'rejected', {
      rejectionReason: reason,
      verifiedBy: currentSession?.fullName || 'الإدارة العامة للمنصة',
    });
    if (updated) {
      setTenants(getAllTenants());
      if (viewingTenant && viewingTenant.id === rejectModalTenant.id) {
        setViewingTenant(updated);
      }
      if (documentPreviewTenant && documentPreviewTenant.id === rejectModalTenant.id) {
        setDocumentPreviewTenant(updated);
      }
      apiLogPlatformAdminActivity({
        adminId: currentSession?.id || (isSuperAdmin ? 'super_admin' : 'admin'),
        adminName: currentSession?.fullName || 'الأدمين الرئيسي',
        adminPhone: currentSession?.phone || '',
        action: 'رفض الوثيقة القانونية',
        actionKey: 'tenant_edit',
        targetItem: tenantName,
        details: `رفض الوثيقة القانونية لجمعية «${tenantName}» بسبب: ${reason}`,
      });
      onShowToast(`تم تسجيل رفض وثيقة «${rejectModalTenant.name}» مع إرفاق سبب الرفض.`, 'info');
    }
    setRejectModalTenant(null);
  };

  // ==================== LOGIN SCREEN IF NOT AUTHENTICATED ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-800 relative overflow-hidden" dir="rtl">
        {/* Subtle decorative background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-slate-100 animate-scale-in relative z-10">
          <div className="text-center mb-6">
            {platformIdentity?.platformLogo ? (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white border-2 border-emerald-500/30 shadow-lg p-2 mx-auto mb-4 flex items-center justify-center overflow-hidden">
                <img
                  src={platformIdentity.platformLogo}
                  alt={platformIdentity.platformName}
                  className="w-full h-full object-contain rounded-full select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                <ShieldCheck className="w-10 h-10" />
              </div>
            )}
            <h1 className="text-2xl font-black text-slate-900">الإدارة العامة للمنصة</h1>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-bold">
              {platformIdentity?.platformName || 'syoumax منصة العمل الجمعوي'}
            </p>
          </div>

          {loginError && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Unified Login Form: Single Password field for Super Admin and Secondary Admins */}
          <form onSubmit={handleUnifiedLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  كلمة المرور
                </label>
                <span className="text-[11px] text-slate-400 font-medium">مطلوبة للدخول</span>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showUnifiedPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  disabled={isLoggingIn}
                  value={unifiedPassword}
                  onChange={(e) => {
                    setUnifiedPassword(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  placeholder="أدخل كلمة المرور الخاصة بحسابك"
                  className="w-full pr-11 pl-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none text-left font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowUnifiedPassword((prev) => !prev)}
                  disabled={isLoggingIn}
                  className="absolute inset-y-0 left-0 pl-3.5 pr-2 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showUnifiedPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showUnifiedPassword ? (
                    <EyeOff className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>تسجيل دخول موحد • يتعرف النظام تلقائياً على نوع الحساب والصلاحيات المخصصة</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ التحقق من كلمة المرور والصلاحيات...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>دخول إلى الإدارة العامة للمنصة</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <button
              onClick={onBackToPortal}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-1.5 mx-auto font-medium"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة إلى بوابة المنصة الرئيسية</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MASTER ADMIN DASHBOARD ====================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-16" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {platformIdentity?.platformLogo ? (
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-white border-2 border-emerald-500/40 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-sm transition-all hover:scale-105">
                <img
                  src={platformIdentity.platformLogo}
                  alt={platformIdentity.platformName}
                  className="w-full h-full object-contain rounded-full select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center font-black text-white shadow-md shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white">
                  {platformIdentity?.platformName || 'syoumax منصة العمل الجمعوي'}
                </h1>
                {isSuperAdmin ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Super Admin
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-blue-300" />
                    <span>أدمن مساعد: {currentSession?.fullName}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {isSuperAdmin 
                  ? 'التحكم المركزي بالجمعيات والمنصات المنشأة والحسابات والصلاحيات' 
                  : `لوحة التحكم الإدارية للأدمن المساعد (${currentSession?.phone || ''})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {(isSuperAdmin || hasPermission('associations_manage')) && (
              <button
                onClick={onOpenCreateWizard}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>تدشين جمعية جديدة</span>
              </button>
            )}

            <button
              onClick={onBackToPortal}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">بوابة المنصة</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl transition-all border border-rose-500/30"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* KPI Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Total Associations */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold">إجمالي الجمعيات</span>
              <Building2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{tenants.length}</div>
            <div className="text-[11px] text-slate-400 mt-1">جمعيات مسجلة بالنظام</div>
          </div>

          {/* Card 2: Active Associations */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between text-emerald-600 mb-2">
              <span className="text-xs font-bold">الجمعيات المفعلة 🟢</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-emerald-700">{activeTenantsCount}</div>
            <div className="text-[11px] text-emerald-600/80 mt-1">تعمل بكامل طاقتها</div>
          </div>

          {/* Card 3: Disabled Associations */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between text-rose-600 mb-2">
              <span className="text-xs font-bold">الجمعيات المعطلة 🔴</span>
              <XCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-rose-700">{inactiveTenantsCount}</div>
            <div className="text-[11px] text-rose-600/80 mt-1">معطلة مع حفظ البيانات</div>
          </div>

          {/* Card 4: Total Users */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between text-blue-600 mb-2">
              <span className="text-xs font-bold">إجمالي المستخدمين</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-slate-900">{stats.totalUsers}</div>
            <div className="text-[11px] text-slate-400 mt-1">مسؤولين ومنخرطين</div>
          </div>

          {/* Card 5: Subscriptions Profit */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 col-span-2 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-amber-600 mb-2">
              <span className="text-xs font-bold">أرباح الاشتراكات</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-amber-700">
              {stats.totalProfits.toLocaleString()} <span className="text-xs font-bold">د.م</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">شهرياً من الباقات</div>
          </div>
        </div>

        {/* ================= TABS SELECTION ================= */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary Requested Section: الجمعيات */}
            {(isSuperAdmin || hasPermission('associations_view') || hasPermission('associations_manage')) && (
              <button
                onClick={() => setActiveTab('associations')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'associations'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>الجمعيات ({tenants.length})</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'associations' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-100 text-slate-500'
                }`}>
                  🟢 {activeTenantsCount} / 🔴 {inactiveTenantsCount}
                </span>
              </button>
            )}

            {/* Requested Section: أقسام الجمعيات (تحكم مركزي في ظهور الأقسام) */}
            {(isSuperAdmin || hasPermission('association_sections_manage') || hasPermission('association_sections_view')) && (
              <button
                id="tab-btn-association-sections"
                onClick={() => setActiveTab('association_sections')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'association_sections'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md ring-2 ring-emerald-400/50'
                    : 'bg-white text-slate-700 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300'
                }`}
              >
                <Layers className={`w-4 h-4 ${activeTab === 'association_sections' ? 'text-emerald-200' : 'text-emerald-600'}`} />
                <span>أقسام الجمعيات</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'association_sections' ? 'bg-black/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  تحكم مركزي
                </span>
              </button>
            )}

            {/* Secondary Tab: المستخدمون والمسؤولون */}
            {(isSuperAdmin || hasPermission('users_manage')) && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>المستخدمون والمسؤولون ({owners.length})</span>
              </button>
            )}

            {/* Requested Section: إدارة مدفوعات تفعيل المنصات */}
            {(isSuperAdmin || hasPermission('payments_manage')) && (
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'payments'
                    ? 'bg-slate-900 text-white shadow-md ring-2 ring-indigo-500/50'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <CreditCard className="w-4 h-4 text-indigo-400" />
                <span>إدارة مدفوعات تفعيل المنصات</span>
                {pendingPaymentsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                    {pendingPaymentsCount} قيد المراجعة
                  </span>
                )}
              </button>
            )}

            {/* Requested Section: مبلغ تفعيل المنصة (المدير العام فقط) */}
            {isSuperAdmin && (
              <button
                id="tab-btn-activation-fee"
                onClick={() => setActiveTab('activation_fee')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'activation_fee'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md ring-2 ring-emerald-400/50'
                    : 'bg-white text-emerald-950 hover:bg-emerald-50/70 border border-emerald-200/80 hover:border-emerald-400'
                }`}
              >
                <Banknote className={`w-4 h-4 ${activeTab === 'activation_fee' ? 'text-white' : 'text-emerald-600'}`} />
                <span>مبلغ تفعيل المنصة</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'activation_fee' ? 'bg-black/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  المدير العام
                </span>
              </button>
            )}

            {/* Requested Section: مبلغ إنشاء الإعلان (الإدارة العامة) */}
            {(isSuperAdmin || hasPermission('ad_campaigns_manage')) && (
              <button
                id="tab-btn-ad-creation-fee"
                onClick={() => setActiveTab('ad_creation_fee')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'ad_creation_fee'
                    ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-md ring-2 ring-amber-400/50'
                    : 'bg-white text-amber-950 hover:bg-amber-50/70 border border-amber-200/80 hover:border-amber-400'
                }`}
              >
                <Megaphone className={`w-4 h-4 ${activeTab === 'ad_creation_fee' ? 'text-white' : 'text-amber-600'}`} />
                <span>مبلغ إنشاء الإعلان</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'ad_creation_fee' ? 'bg-black/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  الإدارة العامة
                </span>
              </button>
            )}

            {/* Requested Section: تحكم بواجهة المنصة */}
            {(isSuperAdmin || hasPermission('portal_settings_manage')) && (
              <button
                onClick={() => setActiveTab('portal_ui')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'portal_ui'
                    ? 'bg-slate-900 text-white shadow-md ring-2 ring-emerald-500/50'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <Sliders className="w-4 h-4 text-teal-400" />
                <span>التحكم بواجهة المنصة</span>
              </button>
            )}

            {/* Requested Section: شاهد شرح بالفيديو كيفية استخدام المنصة */}
            {(isSuperAdmin || hasPermission('portal_settings_manage') || hasPermission('association_sections_manage')) && (
              <button
                id="tab-btn-platform-tutorials"
                onClick={() => setActiveTab('platform_tutorials')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'platform_tutorials'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-700 text-white shadow-md ring-2 ring-indigo-400/50'
                    : 'bg-white text-indigo-950 hover:bg-indigo-50/70 border border-indigo-200/80 hover:border-indigo-400'
                }`}
              >
                <Video className={`w-4 h-4 ${activeTab === 'platform_tutorials' ? 'text-indigo-200' : 'text-indigo-600'}`} />
                <span>شاهد شرح بالفيديو كيفية استخدام المنصة</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'platform_tutorials' ? 'bg-black/20 text-white' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  إدارة الفيديوهات
                </span>
              </button>
            )}

            {/* Requested Section: قسم أنواع المساهمات */}
            {(isSuperAdmin || hasPermission('contribution_types_manage')) && (
              <button
                onClick={() => setActiveTab('contribution_types')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'contribution_types'
                    ? 'bg-slate-900 text-white shadow-md ring-2 ring-rose-500/50'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <HeartHandshake className="w-4 h-4 text-rose-400" />
                <span>قسم أنواع المساهمات</span>
              </button>
            )}

            {/* Requested Section: دعم المنصة */}
            {(isSuperAdmin || hasPermission('platform_support_manage')) && (
              <button
                id="tab-btn-platform-support"
                onClick={() => setActiveTab('platform_support')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'platform_support'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md ring-2 ring-orange-400/50'
                    : 'bg-white text-orange-950 hover:bg-orange-50/70 border border-orange-200/80 hover:border-orange-400'
                }`}
              >
                <Heart className={`w-4 h-4 ${activeTab === 'platform_support' ? 'text-white fill-white/20' : 'text-orange-600 fill-orange-500/20'}`} />
                <span>دعم المنصة</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'platform_support' ? 'bg-black/20 text-white' : 'bg-orange-100 text-orange-800'
                }`}>
                  إعدادات
                </span>
              </button>
            )}

            {/* Requested Section: الحملات الإعلانية وترتيب الظهور */}
            {(isSuperAdmin || hasPermission('ad_campaigns_manage') || hasPermission('ad_campaign_requests_manage')) && (
              <button
                id="tab-btn-ad-campaigns"
                onClick={() => setActiveTab('ad_campaigns')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'ad_campaigns'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md ring-2 ring-amber-400/50'
                    : 'bg-white text-slate-600 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300'
                }`}
              >
                <Megaphone className={`w-4 h-4 ${activeTab === 'ad_campaigns' ? 'text-amber-200' : 'text-amber-500'}`} />
                <span>الحملات الإعلانية</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'ad_campaigns' ? 'bg-black/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  ترتيب الظهور
                </span>
              </button>
            )}

            {/* Requested Section: إدارة تجديد الاشتراك */}
            {(isSuperAdmin || hasPermission('subscriptions_renewals_manage')) && (
              <button
                id="tab-btn-renewals"
                onClick={() => setActiveTab('renewals')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'renewals'
                    ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md ring-2 ring-amber-400/60'
                    : 'bg-white text-slate-700 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300'
                }`}
              >
                <Calendar className={`w-4 h-4 ${activeTab === 'renewals' ? 'text-amber-300' : 'text-amber-600'}`} />
                <span>إدارة تجديد الاشتراك</span>
                {renewalRequiredCount > 0 ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    activeTab === 'renewals' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800 animate-pulse'
                  }`}>
                    {renewalRequiredCount} مستحقة
                  </span>
                ) : (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === 'renewals' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    سارية
                  </span>
                )}
              </button>
            )}

            {/* Requested Section: إضافة أدمين (Super Admin فقط) */}
            {isSuperAdmin && (
              <button
                id="tab-btn-add-admin"
                onClick={() => setActiveTab('add_admin')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'add_admin'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md ring-2 ring-emerald-400/50'
                    : 'bg-white text-emerald-800 hover:bg-emerald-50/60 border border-emerald-200 hover:border-emerald-300'
                }`}
              >
                <UserPlus className={`w-4 h-4 ${activeTab === 'add_admin' ? 'text-emerald-200' : 'text-emerald-600'}`} />
                <span>إضافة أدمين</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'add_admin' ? 'bg-black/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  مساعد
                </span>
              </button>
            )}

            {/* New Requested Section: تعديل بيانات المنصة (Super Admin فقط) */}
            {isSuperAdmin && (
              <button
                id="tab-btn-platform-identity"
                onClick={() => setActiveTab('platform_identity')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'platform_identity'
                    ? 'bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-900 text-white shadow-md ring-2 ring-purple-400/50'
                    : 'bg-white text-indigo-900 hover:bg-indigo-50/60 border border-indigo-200 hover:border-indigo-300'
                }`}
              >
                <Sliders className={`w-4 h-4 ${activeTab === 'platform_identity' ? 'text-purple-200' : 'text-indigo-600'}`} />
                <span>تعديل بيانات المنصة</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'platform_identity' ? 'bg-black/20 text-white' : 'bg-purple-100 text-purple-800'
                }`}>
                  Super Admin
                </span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 hidden sm:block">
            {activeTab === 'association_sections' ? (
              <span className="text-emerald-700 font-bold">التحكم المركزي في إظهار أو إخفاء أقسام لوحات التحكم الإدارية لجميع الجمعيات</span>
            ) : activeTab === 'portal_ui' ? (
              <span className="text-teal-700 font-bold">إدارة عناصر ونصوص الواجهة العامة</span>
            ) : activeTab === 'payments' ? (
              <span className="text-indigo-700 font-bold">إدارة عمليات التحقق والاشتراكات</span>
            ) : activeTab === 'activation_fee' ? (
              <span className="text-emerald-700 font-bold">تحديد وضبط مبلغ تفعيل المنصات الجديدة وحفظه في قاعدة البيانات</span>
            ) : activeTab === 'ad_creation_fee' ? (
              <span className="text-amber-700 font-bold">تحديد وضبط مبلغ إنشاء وترويج إعلانات الجمعيات وحفظه مركزيًا في قاعدة البيانات</span>
            ) : activeTab === 'contribution_types' ? (
              <span className="text-rose-700 font-bold">الإدارة المركزية لأنواع المساهمات والمبالغ الجاهزة</span>
            ) : activeTab === 'platform_support' ? (
              <span className="text-orange-700 font-bold">التحكم في مبالغ وخيارات وطرق دفع زر «دعم المنصة»</span>
            ) : activeTab === 'ad_campaigns' ? (
              <span className="text-amber-700 font-bold">إدارة ترتيب ظهور الجمعيات في قسم مشاريع التنمية والتبرع</span>
            ) : activeTab === 'renewals' ? (
              <span className="text-amber-700 font-bold">متابعة وتجديد اشتراكات الجمعيات (المستحقة خلال 20 يوماً أو المنتهية)</span>
            ) : activeTab === 'add_admin' ? (
              <span className="text-emerald-700 font-bold">إدارة الأدمن المساعدين وتعيين الصلاحيات</span>
            ) : activeTab === 'platform_identity' ? (
              <span className="text-purple-700 font-bold">تعديل الرمز السري وشعار واسم المنصة الرسمي</span>
            ) : activeTab === 'platform_tutorials' ? (
              <span className="text-indigo-700 font-bold">إدارة قسم «شاهد شرح بالفيديو كيفية استخدام المنصة» وحفظ الفيديوهات والأغلفة بشكل دائم</span>
            ) : (
              <>السجلات المعروضة: <strong>{activeTab === 'associations' ? filteredTenants.length : filteredOwners.length}</strong></>
            )}
          </div>
        </div>

        {/* ================= FILTERS & SEARCH ================= */}
        {activeTab !== 'association_sections' && activeTab !== 'portal_ui' && activeTab !== 'platform_tutorials' && activeTab !== 'payments' && activeTab !== 'activation_fee' && activeTab !== 'ad_creation_fee' && activeTab !== 'contribution_types' && activeTab !== 'platform_support' && activeTab !== 'ad_campaigns' && activeTab !== 'renewals' && activeTab !== 'add_admin' && activeTab !== 'platform_identity' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'associations' ? "البحث باسم الجمعية، المدينة، الدولة، اسم صاحب الجمعية، أو رقم الهاتف..." : "البحث باسم المستخدم، رقم الهاتف، أو اسم الجمعية..."}
                className="w-full pl-4 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
              />
            </div>

            {activeTab === 'associations' && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="all">كل الحالات (الكل)</option>
                  <option value="active">🟢 مفعّلة فقط ({activeTenantsCount})</option>
                  <option value="pending_subscription">💳 في انتظار الدفع ({pendingSubscriptionCount})</option>
                  <option value="pending_activation">⏳ في انتظار التفعيل ({pendingActivationCount})</option>
                  <option value="inactive">🔴 معطلة فقط ({inactiveTenantsCount})</option>
                </select>

                {/* Tier Filter */}
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="all">كل الباقات</option>
                  <option value="pro">باقة Pro</option>
                  <option value="basic">باقة Basic</option>
                  <option value="enterprise">باقة Enterprise</option>
                  <option value="free">باقة Free</option>
                </select>

                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setTierFilter('all');
                  }}
                  className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="إعادة تعيين الفلاتر"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= SECTION: الجمعيات (ASSOCIATIONS) ================= */}
        {activeTab === 'associations' && (
          <div className="space-y-4">
            {/* Section Header Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>قسم «الجمعيات» المسجلة في المنصة</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تحكم مركزي كامل مخصص لمدير المنصة الرئيسي (Super Admin): عرض، تعديل البيانات، التفعيل، التعطيل، والحذف النهائي.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  إجمالي الجمعيات: <strong className="text-slate-900">{tenants.length}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs text-emerald-700 font-bold">🟢 {activeTenantsCount} مفعلة</span>
                <span className="text-slate-300">|</span>
                <span className="text-xs text-rose-700 font-bold">🔴 {inactiveTenantsCount} معطلة</span>
              </div>
            </div>

            {/* Mobile Association Cards (Phones & Tablets) */}
            <div className="block lg:hidden space-y-3">
              {filteredTenants.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs shadow-xs">
                  لا توجد جمعيات مطابقة لشروط البحث أو التصفية الحالية.
                </div>
              ) : (
                filteredTenants.map((t, tIdx) => {
                  const isInactive = t.status === 'inactive';
                  const isPendingSubscription = t.status === 'pending_subscription';
                  const isPendingActivation = t.status === 'pending_activation';
                  const liveStats = getTenantLiveStats(t.id, t.isTemplate);

                  return (
                    <div
                      key={`mob_tenant_${t.id || tIdx}`}
                      className={`bg-white rounded-2xl border p-4 shadow-xs transition-all space-y-3.5 ${
                        isInactive
                          ? 'border-rose-300 bg-rose-50/20'
                          : isPendingSubscription || isPendingActivation
                          ? 'border-amber-300 bg-amber-50/20'
                          : 'border-slate-200'
                      }`}
                    >
                      {/* Top Header: Logo, Name, Badges */}
                      <div className="flex items-start gap-3">
                        {t.logoUrl ? (
                          <img
                            src={t.logoUrl}
                            alt={t.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0 shadow-2xs"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-black text-sm flex-shrink-0">
                            {t.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-slate-900 text-sm leading-tight">{t.name}</h3>
                            {t.isTemplate ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                القالب الأساسي
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                منصة خاصة
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                            <span>/{t.slug}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500 font-sans">{t.city}، {t.country}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {/* Status badge */}
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isInactive
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : isPendingSubscription
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : isPendingActivation
                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-rose-600' : isPendingSubscription ? 'bg-amber-600' : isPendingActivation ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
                              <span>{isInactive ? 'معطلة' : isPendingSubscription ? 'في انتظار الدفع' : isPendingActivation ? 'في انتظار التفعيل' : 'مفعّلة'}</span>
                            </span>

                            {/* Plan tier badge */}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              باقة {t.tier?.toUpperCase() || 'PRO'}
                            </span>

                            {/* Legal document status badge */}
                            {t.legalDocument && (
                              <button
                                type="button"
                                onClick={() => setDocumentPreviewTenant(t)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                  t.legalDocument.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : t.legalDocument.status === 'rejected'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}
                              >
                                <FileText className="w-3 h-3" />
                                <span>الترخيص: {t.legalDocument.status === 'approved' ? 'معتمد ✓' : t.legalDocument.status === 'rejected' ? 'مرفوض ✗' : 'مراجعة ⏳'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Info & Live stats row */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs">
                        <div>
                          <span className="block text-[10px] text-slate-400">المنخرطون</span>
                          <span className="font-black text-slate-800">{liveStats.membersCount}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">الأنشطة</span>
                          <span className="font-black text-slate-800">{liveStats.activitiesCount}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400">الرصيد الحي</span>
                          <span className="font-black text-emerald-700 font-mono">{liveStats.totalBalance.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Primary Action Buttons: Clear, touch-friendly, high contrast */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
                        {/* Direct Super Admin Control Panel entrance */}
                        <button
                          type="button"
                          id={`mob-btn-enter-assoc-${t.id}`}
                          onClick={() => onSwitchToTenant(t.id, true)}
                          className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          title="دخول لوحة تحكم الجمعية كأدمن رئيسي"
                        >
                          <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                          <span>دخول لوحة التحكم</span>
                        </button>

                        {/* Preview Storefront */}
                        <button
                          type="button"
                          onClick={() => onSwitchToTenant(t.id, false)}
                          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                          title="معاينة وتصفح واجهة الجمعية"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>معاينة</span>
                        </button>

                        {/* View Card Modal */}
                        <button
                          type="button"
                          onClick={() => setViewingTenant(t)}
                          className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl transition-all cursor-pointer border border-slate-200"
                          title="عرض تفاصيل الجمعية"
                        >
                          <Eye className="w-4 h-4 text-slate-600" />
                        </button>

                        {/* Edit Association */}
                        {(isSuperAdmin || hasPermission('associations_manage')) && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            className="p-2.5 text-blue-600 hover:bg-blue-50 active:scale-95 border border-blue-200 rounded-xl transition-all cursor-pointer"
                            title="تعديل بيانات الجمعية"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Association Button (Super Admin Only) */}
                        {isSuperAdmin && (
                          !t.isTemplate && t.id !== MASTER_TEMPLATE_TENANT_ID ? (
                            <button
                              type="button"
                              id={`mob-btn-delete-assoc-${t.id}`}
                              onClick={() => handlePromptDelete(t)}
                              className="py-2.5 px-3 text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white active:scale-95 border border-rose-200 hover:border-rose-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              title="حذف الجمعية نهائياً من قاعدة البيانات"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>حذف الجمعية</span>
                            </button>
                          ) : (
                            <span
                              className="py-2 px-2.5 text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-not-allowed"
                              title="القالب الأساسي محمي من الحذف"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>محمية</span>
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Associations Table */}
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">الجمعية والمعرف</th>
                      <th className="py-3.5 px-4">الموقع</th>
                      <th className="py-3.5 px-4">المسؤول الرئيسي</th>
                      <th className="py-3.5 px-4">الباقة والاشتراك</th>
                      <th className="py-3.5 px-4 text-center">الحالة</th>
                      <th className="py-3.5 px-4">إحصائيات حية</th>
                      <th className="py-3.5 px-4">تاريخ التدشين</th>
                      <th className="py-3.5 px-4 text-center">إجراءات التحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                          لا توجد جمعيات مطابقة لشروط البحث أو التصفية الحالية.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map((t, tIdx) => {
                        const isInactive = t.status === 'inactive';
                        const isPendingSubscription = t.status === 'pending_subscription';
                        const isPendingActivation = t.status === 'pending_activation';
                        const isActive = t.status === 'active';
                        const liveStats = getTenantLiveStats(t.id, t.isTemplate);

                        return (
                          <tr key={`${t.id || 'tenant'}_${tIdx}`} className={`transition-colors ${isInactive ? 'bg-rose-50/25 hover:bg-rose-50/40' : 'hover:bg-slate-50/70'}`}>
                            {/* Association Name & Logo */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                {t.logoUrl ? (
                                  <img
                                    src={t.logoUrl}
                                    alt={t.name}
                                    className="w-9 h-9 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xs flex-shrink-0">
                                    {t.name.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                    <span>{t.name}</span>
                                    {t.isTemplate ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                        القالب الأساسي (ظاهر بالواجهة العامة)
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                        منصة خاصة (مخفية عن الواجهة العامة)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      /{t.slug}
                                    </span>
                                    {t.nameFr && (
                                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                        ({t.nameFr})
                                      </span>
                                    )}
                                  </div>

                                  {/* Legal Document Status Badge */}
                                  {t.legalDocument && (
                                    <div className="mt-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDocumentPreviewTenant(t);
                                        }}
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer shadow-2xs ${
                                          t.legalDocument.status === 'approved'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                            : t.legalDocument.status === 'rejected'
                                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                            : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                        }`}
                                        title="انقر لمعاينة وفحص وثيقة الترخيص القانونية"
                                      >
                                        <FileText className="w-3 h-3" />
                                        <span>الترخيص:</span>
                                        <span>
                                          {t.legalDocument.status === 'approved'
                                            ? 'معتمد ✓'
                                            : t.legalDocument.status === 'rejected'
                                            ? 'مرفوض ✗'
                                            : 'قيد المراجعة ⏳'}
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Location */}
                            <td className="py-3.5 px-4 text-slate-600">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span>{t.city}، {t.country}</span>
                              </div>
                            </td>

                            {/* Owner */}
                            <td className="py-3.5 px-4">
                              <div className="text-slate-900 font-semibold">{t.ownerName}</div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1" dir="ltr">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{t.ownerPhone}</span>
                              </div>
                            </td>

                            {/* Subscription Tier & Fee */}
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                t.tier === 'pro'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : t.tier === 'enterprise'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {t.tier || 'BASIC'}
                              </span>
                              <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                {t.monthlyFee || 0} د.م / شهر
                              </div>
                            </td>

                            {/* Association Status (الحالة: زر تبديل Toggle Switch + مؤشر بصري) */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex items-center justify-center gap-2.5 bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                                {/* Toggle Switch Button */}
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={isActive}
                                  onClick={() => handlePromptStatusChange(t)}
                                  dir="ltr"
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    isActive
                                      ? 'bg-emerald-600 focus:ring-emerald-500'
                                      : 'bg-slate-300 hover:bg-slate-400 focus:ring-slate-400'
                                  }`}
                                  title={isActive ? 'انقر لتعطيل الجمعية مؤقتاً' : 'انقر لتفعيل الجمعية'}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                      isActive ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>

                                {/* Visual indicator */}
                                {isPendingSubscription ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-xs">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                    <span>💳 في انتظار الدفع</span>
                                  </span>
                                ) : isPendingActivation ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-300 shadow-xs">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                                    <span>⏳ في انتظار التفعيل</span>
                                  </span>
                                ) : (
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-black shadow-xs ${
                                      isActive
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                                    }`}
                                  >
                                    {isActive ? (
                                      <>
                                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                                        <span>🟢 مفعّلة</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="w-2 h-2 rounded-full bg-rose-600" />
                                        <span>🔴 معطّلة</span>
                                      </>
                                    )}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Live Stats */}
                            <td className="py-3.5 px-4">
                              <div className="text-[11px] text-slate-700 font-semibold space-y-0.5">
                                <div>منخرطون: <strong className="font-mono text-emerald-700">{liveStats.membersCount}</strong></div>
                                <div>أنشطة: <strong className="font-mono text-blue-700">{liveStats.activitiesCount}</strong></div>
                                <div>الرصيد: <strong className="font-mono text-slate-900">{liveStats.totalBalance.toLocaleString()} د.م</strong></div>
                              </div>
                            </td>

                            {/* Created Date */}
                            <td className="py-3.5 px-4 text-[11px] text-slate-500">
                              {new Date(t.createdAt).toLocaleDateString('ar-MA')}
                            </td>

                            {/* Action Buttons: View, Edit, Activate/Deactivate, Delete */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* 1. View Details Modal */}
                                <button
                                  onClick={() => setViewingTenant(t)}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                                  title="عرض بطاقة وتفاصيل الجمعية"
                                >
                                  <Eye className="w-4 h-4 text-slate-600" />
                                </button>

                                {/* 2. Direct Control Panel Entrance for Super Admin */}
                                <button
                                  onClick={() => onSwitchToTenant(t.id, true)}
                                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="دخول لوحة تحكم الجمعية كأدمن رئيسي"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>لوحة التحكم</span>
                                </button>

                                {/* 3. Switch/Browse Storefront */}
                                <button
                                  onClick={() => onSwitchToTenant(t.id, false)}
                                  className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="معاينة وتصفح واجهة الجمعية"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline">معاينة</span>
                                </button>

                                {/* 3. Edit Association */}
                                <button
                                  onClick={() => handleOpenEdit(t)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                                  title="تعديل بيانات وإعدادات الجمعية"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                {/* 4. Activate / Deactivate Toggle */}
                                <button
                                  onClick={() => handlePromptStatusChange(t)}
                                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                    isActive
                                      ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                  }`}
                                  title={isActive ? 'تعطيل الجمعية مؤقتاً' : 'تفعيل الجمعية'}
                                >
                                  {isActive ? (
                                    <>
                                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                      <span className="hidden xl:inline">تعطيل</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span className="hidden xl:inline">تفعيل</span>
                                    </>
                                  )}
                                </button>

                                {/* 5. Delete Association Permanently (Super Admin Only, Protected for Master Template) */}
                                {isSuperAdmin && (
                                  !t.isTemplate && t.id !== MASTER_TEMPLATE_TENANT_ID ? (
                                    <button
                                      type="button"
                                      id={`btn-delete-assoc-${t.id}`}
                                      onClick={() => handlePromptDelete(t)}
                                      className="px-2.5 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                                      title="حذف الجمعية نهائياً من قاعدة البيانات"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>حذف الجمعية</span>
                                    </button>
                                  ) : (
                                    <span 
                                      className="px-2 py-1.5 text-slate-400 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-not-allowed"
                                      title="القالب الأساسي محمي من الحذف"
                                    >
                                      <Lock className="w-3.5 h-3.5" />
                                      <span className="hidden xl:inline">محمية</span>
                                    </span>
                                  )
                                )}
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

        {/* ================= TAB 2: USERS & OWNERS MANAGEMENT ================= */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">إدارة حسابات المسؤولين ورؤساء الجمعيات</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  عرض وتحديث كلمات مرور مسؤولي المنصات المعتمدين في النظام
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">اسم المسؤول</th>
                    <th className="py-3.5 px-4">رقم الهاتف (اسم المستخدم)</th>
                    <th className="py-3.5 px-4">الجمعية المسندة</th>
                    <th className="py-3.5 px-4">حالة الحساب</th>
                    <th className="py-3.5 px-4">تاريخ التسجيل</th>
                    <th className="py-3.5 px-4 text-center">إجراءات الأمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredOwners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                        لا توجد حسابات مطابقة لشروط البحث.
                      </td>
                    </tr>
                  ) : (
                    filteredOwners.map((o, oIdx) => {
                      const assoc = tenants.find((t) => t.id === o.tenantId);
                      return (
                        <tr key={`${o.id || 'owner'}_${o.tenantId || ''}_${oIdx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {o.fullName}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700" dir="ltr">
                            {o.phone}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-emerald-700">
                              {assoc ? assoc.name : 'غير محدد'}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Tenant: {o.tenantId}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              o.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {o.status === 'active' ? 'نشط' : 'معطل'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {new Date(o.createdAt).toLocaleDateString('ar-MA')}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                setResetPasswordOwner(o);
                                setNewPassword('');
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                            >
                              <Key className="w-3.5 h-3.5 text-amber-600" />
                              <span>إعادة تعيين كلمة المرور</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= SECTION: أقسام الجمعيات (CENTRAL ASSOCIATION SECTIONS VISIBILITY) ================= */}
        {activeTab === 'association_sections' && (isSuperAdmin || hasPermission('association_sections_manage') || hasPermission('association_sections_view')) && (
          <PlatformAssociationSectionsAdmin
            onShowToast={onShowToast}
            adminName={currentSession?.fullName || 'الإدارة العامة للمنصة'}
            onBackToAssociations={() => setActiveTab('associations')}
            isSuperAdmin={isSuperAdmin}
            currentAdminSession={currentSession}
          />
        )}

        {/* ================= SECTION: إدارة مدفوعات تفعيل المنصات ================= */}
        {activeTab === 'payments' && (
          <PlatformPaymentsAdmin
            onShowToast={onShowToast}
            onTenantsUpdated={() => setTenants(getAllTenants())}
          />
        )}

        {/* ================= SECTION: مبلغ تفعيل المنصة (المدير العام فقط) ================= */}
        {activeTab === 'activation_fee' && isSuperAdmin && (
          <PlatformActivationFeeAdmin
            onShowToast={onShowToast}
            currentSession={currentSession}
          />
        )}

        {/* ================= SECTION: مبلغ إنشاء الإعلان (الإدارة العامة) ================= */}
        {activeTab === 'ad_creation_fee' && (isSuperAdmin || hasPermission('ad_campaigns_manage')) && (
          <PlatformAdCreationFeeAdmin
            onShowToast={onShowToast}
            currentSession={currentSession}
          />
        )}

        {/* ================= SECTION: تحكم بواجهة المنصة (PORTAL UI SETTINGS) ================= */}
        {activeTab === 'portal_ui' && (
          <PlatformPortalAdminSettings 
            onShowToast={onShowToast}
            onPreviewPortal={onBackToPortal}
          />
        )}

        {/* ================= SECTION: قسم أنواع المساهمات (CENTRAL CONTRIBUTION TYPES & PRESETS) ================= */}
        {activeTab === 'contribution_types' && (
          <PlatformContributionTypesAdmin
            onShowToast={onShowToast}
          />
        )}

        {/* ================= SECTION: دعم المنصة (PLATFORM SUPPORT SETTINGS) ================= */}
        {activeTab === 'platform_support' && (isSuperAdmin || hasPermission('platform_support_manage')) && (
          <PlatformSupportAdminSettings
            onShowToast={onShowToast}
            onPreviewSupportModal={() => setPreviewSupportModalOpen(true)}
          />
        )}

        {/* ================= SECTION: الحملات الإعلانية وترتيب الظهور ================= */}
        {activeTab === 'ad_campaigns' && (isSuperAdmin || hasPermission('ad_campaigns_manage') || hasPermission('ad_campaign_requests_manage')) && (
          <PlatformAdCampaignsAdmin
            onShowToast={onShowToast}
            onPreviewTenant={onSwitchToTenant}
            canApprove={isSuperAdmin || hasPermission('ad_campaign_approve')}
          />
        )}

        {/* ================= SECTION: إدارة تجديد الاشتراك ================= */}
        {activeTab === 'renewals' && (isSuperAdmin || hasPermission('subscriptions_renewals_manage')) && (
          <PlatformSubscriptionRenewalsAdmin
            onShowToast={onShowToast}
            onPreviewTenant={onSwitchToTenant}
            onTenantsUpdated={() => setTenants(getAllTenants())}
          />
        )}

        {/* ================= SECTION: إضافة أدمين وإدارة الأدمن المساعدين ================= */}
        {activeTab === 'add_admin' && isSuperAdmin && (
          <PlatformManageSubAdmins
            currentSession={currentSession}
            onShowToast={onShowToast}
          />
        )}

        {/* ================= SECTION: تعديل بيانات المنصة (Super Admin فقط) ================= */}
        {activeTab === 'platform_identity' && isSuperAdmin && (
          <PlatformIdentityAdminSettings
            currentSession={currentSession}
            onShowToast={onShowToast}
          />
        )}

        {/* ================= SECTION: شاهد شرح بالفيديو كيفية استخدام المنصة ================= */}
        {activeTab === 'platform_tutorials' && (
          <PlatformTutorialsSection
            activeTenantId="main_portal_watch_videos"
            isSuperAdmin={true}
            isMasterPlatformAdmin={true}
            currentAdminSession={currentSession}
            customTitle="شاهد شرح بالفيديو كيفية استخدام المنصة"
            addToast={(type, message) => onShowToast(message, type === 'warning' ? 'info' : type)}
          />
        )}
      </main>

      {/* ================= MODAL 1: VIEW ASSOCIATION DETAILS (عرض الجمعية) ================= */}
      {viewingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                {viewingTenant.logoUrl ? (
                  <img
                    src={viewingTenant.logoUrl}
                    alt={viewingTenant.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-black text-lg">
                    {viewingTenant.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {viewingTenant.name}
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{viewingTenant.city}، {viewingTenant.country}</span>
                    <span>•</span>
                    <span className="font-mono">Slug: /{viewingTenant.slug}</span>
                  </div>
                </div>
              </div>

              {/* Status and Visibility Pills */}
              <div className="flex items-center gap-2">
                {viewingTenant.isTemplate ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                    القالب الأساسي المعتمد
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    منصة خاصة (مخفية بالواجهة العامة)
                  </span>
                )}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                    viewingTenant.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {viewingTenant.status === 'active' ? '🟢 مفعلة' : '🔴 معطلة'}
                </span>
              </div>
            </div>

            {/* Tagline / Hero */}
            {viewingTenant.tagline && (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
                <strong>الشعار / الوصف:</strong> {viewingTenant.tagline}
              </div>
            )}

            {/* Association Basic Info Grid */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">رئيس / مسؤول الجمعية:</span>
                <span className="font-bold text-slate-900">{viewingTenant.ownerName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">رقم الهاتف:</span>
                <span className="font-mono font-bold text-slate-900" dir="ltr">{viewingTenant.ownerPhone}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">باقة الاشتراك:</span>
                <span className="font-black text-emerald-700 uppercase">{viewingTenant.tier || 'BASIC'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">رسوم الاشتراك:</span>
                <span className="font-bold text-slate-900">{viewingTenant.monthlyFee || 0} د.م / شهرياً</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">تاريخ التدشين:</span>
                <span className="text-slate-700">{new Date(viewingTenant.createdAt).toLocaleString('ar-MA')}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">معرف النظام الفريد (Tenant ID):</span>
                <span className="font-mono text-[11px] text-slate-600 truncate block">{viewingTenant.id}</span>
              </div>
            </div>

            {/* Live Data Statistics */}
            <div className="mt-4 p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
              <h4 className="text-xs font-black text-emerald-900 mb-2.5 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>البيانات والإحصائيات المعزولة الحالية</span>
              </h4>
              {(() => {
                const liveStats = getTenantLiveStats(viewingTenant.id, viewingTenant.isTemplate);
                return (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200/60">
                      <div className="text-[10px] text-slate-400 font-bold">المنخرطون</div>
                      <div className="text-base font-black text-emerald-700 font-mono mt-0.5">{liveStats.membersCount}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200/60">
                      <div className="text-[10px] text-slate-400 font-bold">الأنشطة</div>
                      <div className="text-base font-black text-blue-700 font-mono mt-0.5">{liveStats.activitiesCount}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200/60">
                      <div className="text-[10px] text-slate-400 font-bold">الحملات</div>
                      <div className="text-base font-black text-amber-700 font-mono mt-0.5">{liveStats.campaignsCount}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200/60">
                      <div className="text-[10px] text-slate-400 font-bold">الرصيد</div>
                      <div className="text-base font-black text-slate-900 font-mono mt-0.5">{liveStats.totalBalance.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Legal Document Review Section (قسم مراجعة وثيقة ترخيص الجمعية) */}
            <div className="mt-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/70">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>وثيقة إثبات ترخيص الجمعية (الوضع القانوني)</span>
                </h4>
                {viewingTenant.legalDocument && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      viewingTenant.legalDocument.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : viewingTenant.legalDocument.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    {viewingTenant.legalDocument.status === 'approved'
                      ? '✓ معتمدة ومقبولة'
                      : viewingTenant.legalDocument.status === 'rejected'
                      ? '✗ وثيقة مرفوضة'
                      : '⏳ قيد المراجعة والتحقق'}
                  </span>
                )}
              </div>

              {viewingTenant.legalDocument ? (
                <div className="space-y-3">
                  {/* File Metadata Card */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        {viewingTenant.legalDocument.fileType.startsWith('image/') ? (
                          <ImageIcon className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <FileText className="w-5 h-5 text-rose-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate" title={viewingTenant.legalDocument.fileName}>
                          {viewingTenant.legalDocument.fileName}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {viewingTenant.legalDocument.fileSizeFormatted} • رُفعت في {new Date(viewingTenant.legalDocument.uploadedAt).toLocaleString('ar-MA')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDocumentPreviewTenant(viewingTenant)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة</span>
                      </button>

                      <a
                        href={viewingTenant.legalDocument.fileUrl}
                        download={viewingTenant.legalDocument.fileName}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تحميل</span>
                      </a>
                    </div>
                  </div>

                  {/* Rejection reason display if rejected */}
                  {viewingTenant.legalDocument.status === 'rejected' && viewingTenant.legalDocument.rejectionReason && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                      <span className="font-bold block mb-1">سبب رفض الوثيقة:</span>
                      <p className="text-[11px] leading-relaxed text-rose-700">
                        {viewingTenant.legalDocument.rejectionReason}
                      </p>
                    </div>
                  )}

                  {/* Approval metadata if approved */}
                  {viewingTenant.legalDocument.status === 'approved' && (
                    <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                      <span className="text-[11px] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>تم التدقيق والاعتماد من قبل: <strong>{viewingTenant.legalDocument.verifiedBy || 'الإدارة العامة للمنصة'}</strong></span>
                      </span>
                      {viewingTenant.legalDocument.verifiedAt && (
                        <span className="text-[10px] text-emerald-700">
                          {new Date(viewingTenant.legalDocument.verifiedAt).toLocaleDateString('ar-MA')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Admin Verification Action Buttons */}
                  {(isSuperAdmin || hasPermission('tenants_requests_manage')) && (
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500">إجراءات المراجعة والتحقق:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {viewingTenant.legalDocument.status !== 'approved' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApproveDocument(viewingTenant.id, false)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>قبول واعتماد الوثيقة</span>
                            </button>

                            {viewingTenant.status !== 'active' && (
                              <button
                                type="button"
                                onClick={() => handleApproveDocument(viewingTenant.id, true)}
                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                title="قبول الوثيقة وتفعيل الجمعية لتصبح مفعلة رسمياً"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>قبول + تفعيل الجمعية</span>
                              </button>
                            )}
                          </>
                        )}

                        {viewingTenant.legalDocument.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => handleOpenRejectModal(viewingTenant)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>رفض الوثيقة</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                  <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                  لم يتم إرفاق وثيقة إثبات ترخيص لهذه الجمعية عند إنشائها.
                </div>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {(isSuperAdmin || hasPermission('associations_toggle_status')) && (
                  <button
                    type="button"
                    onClick={() => {
                      handlePromptStatusChange(viewingTenant);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      viewingTenant.status === 'active'
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    {viewingTenant.status === 'active' ? (
                      <>
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>تعطيل الجمعية</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>تفعيل الجمعية</span>
                      </>
                    )}
                  </button>
                )}

                {(isSuperAdmin || hasPermission('associations_manage')) && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingTenant;
                      setViewingTenant(null);
                      handleOpenEdit(target);
                    }}
                    className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>تعديل</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onSwitchToTenant(viewingTenant.id, true)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="الدخول مباشرة إلى لوحة تحكم الجمعية كأدمن رئيسي"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>دخول لوحة التحكم</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSwitchToTenant(viewingTenant.id, false)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="معاينة وتصفح منصة الجمعية"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>معاينة المنصة</span>
                </button>

                {isSuperAdmin && !viewingTenant.isTemplate && viewingTenant.id !== MASTER_TEMPLATE_TENANT_ID && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingTenant;
                      setViewingTenant(null);
                      handlePromptDelete(target);
                    }}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    title="حذف الجمعية نهائياً من قاعدة البيانات"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>حذف الجمعية</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewingTenant(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: EDIT ASSOCIATION (تعديل بيانات الجمعية) ================= */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 animate-scale-in max-h-[92vh] overflow-y-auto flex flex-col justify-between">
            {/* Modal Header */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>تعديل بيانات الجمعية</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {editingTenant.name}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تعديل بيانات الجمعية وحفظها بشكل دائم في قاعدة البيانات دون التأثير على أي جمعية أخرى.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Message Banner (Success / Error) */}
              {editSaveMessage && (
                <div
                  className={`mb-4 p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs sm:text-sm font-bold ${
                    editSaveMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {editSaveMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 leading-relaxed">
                    <span>{editSaveMessage.text}</span>
                  </div>
                </div>
              )}

              <form id="edit-association-form" onSubmit={handleSaveEdit} className="space-y-4">
                {/* Section 1: Names */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  <span className="text-xs font-black text-slate-800 block border-b border-slate-200 pb-1.5">
                    1. الاسم والتعريف بالجمعية
                  </span>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اسم الجمعية (بالعربية) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="اسم الجمعية الرسمي..."
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-bold text-slate-900 shadow-2xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالفرنسية</label>
                      <input
                        type="text"
                        value={editNameFr}
                        onChange={(e) => setEditNameFr(e.target.value)}
                        placeholder="Nom de l'association en français"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-medium"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالإنجليزية</label>
                      <input
                        type="text"
                        value={editNameEn}
                        onChange={(e) => setEditNameEn(e.target.value)}
                        placeholder="Association name in English"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-medium"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الشعار اللفظي أو العبارة التقديمية (Tagline)</label>
                    <input
                      type="text"
                      value={editTagline}
                      onChange={(e) => setEditTagline(e.target.value)}
                      placeholder="شعار الجمعية، مثلاً: معاً نبني مستقبلاً أفضل..."
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الوصف التفصيلي وأهداف الجمعية</label>
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="نبذة شاملة عن أهداف وأنشطة الجمعية ومشاريعها الاجتماعية..."
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 resize-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Section 2: Country, City & Address */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  <span className="text-xs font-black text-slate-800 block border-b border-slate-200 pb-1.5">
                    2. الموقع الجغرافي والعنوان
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الدولة <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-base">
                          {getCountryFlag(editCountry)}
                        </span>
                        <select
                          value={editCountry}
                          onChange={(e) => {
                            const newCountry = e.target.value;
                            setEditCountry(newCountry);
                            const newCities = getCitiesForCountry(newCountry);
                            if (newCities.length > 0 && !isCityValidForCountry(editCity, newCountry)) {
                              setEditCity(newCities[0].name);
                            }
                          }}
                          className="w-full pl-3 pr-9 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 cursor-pointer font-bold"
                        >
                          {COUNTRIES_LIST.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.flag} {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          المدينة <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400">
                          {getCitiesForCountry(editCountry).length} مدينة
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                          <MapPin className="w-4 h-4 text-emerald-600" />
                        </span>
                        <input
                          type="text"
                          required
                          list="edit-cities-datalist"
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          placeholder="اختر أو ابحث عن المدينة..."
                          className="w-full pl-3 pr-9 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-bold"
                        />
                        <datalist id="edit-cities-datalist">
                          {getCitiesForCountry(editCountry).map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.nameFr ? `${c.name} (${c.nameFr})` : c.name}
                            </option>
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المقر والعنوان التفصيلي للجمعية</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="شارع، حي، الرمز البريدي، مقر الجمعية..."
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Section 3: Owner & Contact Info */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  <span className="text-xs font-black text-slate-800 block border-b border-slate-200 pb-1.5">
                    3. بيانات الإدارة والتواصل
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        رئيس / مسؤول الجمعية <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editOwnerName}
                        onChange={(e) => setEditOwnerName(e.target.value)}
                        placeholder="الاسم الكامل لمسؤول الجمعية"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        رقم الهاتف للتواصل <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={editOwnerPhone}
                          onChange={(e) => setEditOwnerPhone(e.target.value)}
                          placeholder="06XXXXXXXX"
                          className="w-full pr-9 pl-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-mono font-bold"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">رقم الواتساب للتواصل (اختياري)</label>
                      <input
                        type="text"
                        value={editWhatsapp}
                        onChange={(e) => setEditWhatsapp(e.target.value)}
                        placeholder="06XXXXXXXX"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-mono"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني للجمعية (اختياري)</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="contact@association.org"
                          className="w-full pr-9 pl-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Branding & Images (Direct File Upload + Permanent Storage) */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-xs font-black text-slate-800">
                      4. الهوية البصرية وشعار وصورة غلاف الجمعية
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      حفظ ورفع دائم
                    </span>
                  </div>

                  {/* Logo Upload & Preview */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800">شعار الجمعية (Logo)</label>
                      <span className="text-[10px] text-slate-500 font-medium">مفضل بصيغة PNG أو JPG مربعة</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-emerald-300 bg-slate-50 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                        {editLogoUrl ? (
                          <img
                            src={editLogoUrl}
                            alt="شعار الجمعية"
                            className="w-full h-full object-contain rounded-xl"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 w-full space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isUploadingLogo ? 'جاري رفع الشعار...' : 'رفع الشعار من الجهاز'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploadingLogo}
                              onChange={handleLogoFileChange}
                              className="hidden"
                            />
                          </label>

                          {editLogoUrl && (
                            <button
                              type="button"
                              onClick={() => setEditLogoUrl('')}
                              className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                            >
                              إزالة الشعار
                            </button>
                          )}
                        </div>

                        <input
                          type="url"
                          value={editLogoUrl}
                          onChange={(e) => setEditLogoUrl(e.target.value)}
                          placeholder="أو أدخل رابط الشعار مباشرة: https://..."
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-600 font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Banner Upload & Preview */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800">صورة الغلاف والبانر (Cover Banner)</label>
                      <span className="text-[10px] text-slate-500 font-medium">مفضل بأبعاد عريضة 16:9 أو 3:1</span>
                    </div>

                    <div className="space-y-2">
                      <div className="w-full h-24 rounded-2xl border-2 border-dashed border-emerald-300 bg-slate-50 flex items-center justify-center overflow-hidden shadow-xs relative">
                        {editBannerUrl ? (
                          <img
                            src={editBannerUrl}
                            alt="غلاف الجمعية"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                            <ImageIcon className="w-5 h-5" />
                            <span>لا توجد صورة غلاف حالية</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploadingBanner ? 'جاري رفع صورة الغلاف...' : 'رفع صورة الغلاف من الجهاز'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingBanner}
                            onChange={handleBannerFileChange}
                            className="hidden"
                          />
                        </label>

                        {editBannerUrl && (
                          <button
                            type="button"
                            onClick={() => setEditBannerUrl('')}
                            className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                          >
                            إزالة الغلاف
                          </button>
                        )}
                      </div>

                      <input
                        type="url"
                        value={editBannerUrl}
                        onChange={(e) => setEditBannerUrl(e.target.value)}
                        placeholder="أو أدخل رابط الغلاف مباشرة: https://..."
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-600 font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Subscription Plan & Monthly Fee */}
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  <span className="text-xs font-black text-slate-800 block border-b border-slate-200 pb-1.5">
                    5. باقة الاشتراك والرسوم
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">باقة الاشتراك</label>
                      <select
                        value={editTier}
                        onChange={(e) => setEditTier(e.target.value as any)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-bold"
                      >
                        <option value="free">Free (مجانية)</option>
                        <option value="basic">Basic (أساسية)</option>
                        <option value="pro">Pro (احترافية)</option>
                        <option value="enterprise">Enterprise (مؤسسية)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">رسوم الاشتراك (درهم مغربي / شهر)</label>
                      <input
                        type="number"
                        value={editFee}
                        onChange={(e) => setEditFee(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-600 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Bottom Action Bar (Clear & prominent Save Button) */}
            <div className="pt-4 mt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
              <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                🔒 تُحفظ التعديلات فورياً ودائماً في قاعدة البيانات وقاعدة Firestore.
              </span>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  disabled={isSavingEdit}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveEdit()}
                  disabled={isSavingEdit || isUploadingLogo || isUploadingBanner}
                  id="save-association-edits-btn"
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري حفظ التعديلات في قاعدة البيانات...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>حفظ التعديلات</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: STATUS CHANGE CONFIRMATION (تفعيل / تعطيل) ================= */}
      {statusChangeTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              statusChangeTenant.targetStatus === 'inactive'
                ? 'bg-rose-50 border border-rose-200 text-rose-600'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
            }`}>
              {statusChangeTenant.targetStatus === 'inactive' ? (
                <ShieldAlert className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>

            <h3 className="text-base font-black text-slate-900 mb-2">
              {statusChangeTenant.targetStatus === 'inactive'
                ? `تعطيل جمعية «${statusChangeTenant.tenant.name}»`
                : `تفعيل جمعية «${statusChangeTenant.tenant.name}»`}
            </h3>

            {statusChangeTenant.targetStatus === 'inactive' ? (
              <div className="text-xs text-slate-600 leading-relaxed mb-6 space-y-3">
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 font-bold leading-relaxed text-sm">
                  «هل أنت متأكد من رغبتك في تعطيل هذه الجمعية؟ لن يتم حذف أي بيانات، ولكن سيتم إيقاف الوصول إلى منصتها مؤقتًا.»
                </div>
                <div className="space-y-1.5 text-slate-600 pr-1 text-xs">
                  <p>• سيتم إيقاف وصول المستخدمين إلى واجهة الجمعية ومتجرها الإلكتروني.</p>
                  <p>• لا يستطيع أعضاء الجمعية أو الزوار استخدام وظائف الجمعية أثناء فترة التعطيل.</p>
                  <p>• تظهر رسالة واضحة للمستخدم تفيد بأن <strong>الجمعية غير مفعّلة حاليًا</strong>.</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] leading-relaxed">
                  <strong>البيانات محفوظة بالكامل:</strong> لا يتم حذف الجمعية أو أعضائها أو منتجاتها أو أنشطتها أو مساهماتها أو أي من سجلاتها، وتبقى جميع البيانات محفوظة ويمكن استرجاع الجمعية بمجرد إعادة تفعيلها.
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-600 leading-relaxed mb-6 space-y-2">
                <p>
                  عند إعادة تفعيل الجمعية، ستعود واجهة الجمعية وجميع وظائفها للعمل بشكل طبيعي، ويتمكن المستخدمون من الوصول إليها واستخدام الخدمات.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStatusChangeTenant(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer ${
                  statusChangeTenant.targetStatus === 'inactive'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                {statusChangeTenant.targetStatus === 'inactive' ? 'تأكيد تعطيل الجمعية' : 'تأكيد تفعيل الجمعية'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: PERMANENT DELETE CONFIRMATION (حذف الجمعية نهائياً) ================= */}
      {deletingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-rose-900 mb-1.5">
              تأكيد حذف الجمعية نهائياً
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed mb-4">
              هل أنت متأكد من رغبتك في حذف جمعية <strong>«{deletingTenant.name}»</strong> ({deletingTenant.city}، {deletingTenant.country}) نهائياً من قاعدة البيانات؟
            </p>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1.5 mb-3">
              <div className="font-black text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>تنبيه قبل التنفيذ: هذا الإجراء نهائي ولا يمكن التراجع عنه</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-700">
                سيتم حذف هذه الجمعية وجميع سجلاتها المرتبطة بها (المنخرطين، العمليات المالية، الأنشطة، والحملات الخاصة بها) فعلياً من قاعدة البيانات.
              </p>
            </div>

            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 leading-relaxed mb-5 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>حماية الجمعيات الأخرى وسلامة النظام:</strong> يقتصر الحذف على جمعية «{deletingTenant.name}» فقط، ولن تتأثر أي جمعية أخرى أو بياناتها أو صلاحيات المستخدمين في المنصة.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingTenant}
                onClick={() => {
                  setDeletingTenant(null);
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeletingTenant}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingTenant ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ حذف الجمعية...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تأكيد حذف الجمعية نهائياً</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 5: RESET PASSWORD MODAL ================= */}
      {resetPasswordOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
              <Key className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-slate-900 mb-1">
              إعادة تعيين كلمة المرور
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              للمسؤول: <strong>{resetPasswordOwner.fullName}</strong> ({resetPasswordOwner.phone})
            </p>

            <form onSubmit={handleConfirmResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  كلمة المرور الجديدة
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordOwner(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  تحديث كلمة المرور
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 6: LEGAL DOCUMENT PREVIEW MODAL ================= */}
      {documentPreviewTenant && documentPreviewTenant.legalDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-slate-900">
                      معاينة وثيقة إثبات الترخيص
                    </h3>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {documentPreviewTenant.name}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="font-mono font-medium">{documentPreviewTenant.legalDocument.fileName}</span>
                    <span>•</span>
                    <span>{documentPreviewTenant.legalDocument.fileSizeFormatted}</span>
                    <span>•</span>
                    <span>رُفعت في: {new Date(documentPreviewTenant.legalDocument.uploadedAt).toLocaleString('ar-MA')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    documentPreviewTenant.legalDocument.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : documentPreviewTenant.legalDocument.status === 'rejected'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}
                >
                  {documentPreviewTenant.legalDocument.status === 'approved'
                    ? '✓ معتمدة ومقبولة'
                    : documentPreviewTenant.legalDocument.status === 'rejected'
                    ? '✗ وثيقة مرفوضة'
                    : '⏳ قيد المراجعة والتحقق'}
                </span>
                <button
                  type="button"
                  onClick={() => setDocumentPreviewTenant(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Viewer */}
            <div className="my-4 flex-1 overflow-auto bg-slate-100 rounded-2xl p-2 flex items-center justify-center min-h-[350px]">
              {documentPreviewTenant.legalDocument.fileType.startsWith('image/') ? (
                <img
                  src={documentPreviewTenant.legalDocument.fileUrl}
                  alt={documentPreviewTenant.legalDocument.fileName}
                  className="max-h-[62vh] max-w-full object-contain rounded-xl shadow-md"
                />
              ) : (
                <iframe
                  src={documentPreviewTenant.legalDocument.fileUrl}
                  title={documentPreviewTenant.legalDocument.fileName}
                  className="w-full h-[62vh] rounded-xl border border-slate-200 bg-white"
                />
              )}
            </div>

            {/* Rejection Note if Rejected */}
            {documentPreviewTenant.legalDocument.status === 'rejected' && documentPreviewTenant.legalDocument.rejectionReason && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">ملاحظة الرفض المسجلة: </span>
                  <span>{documentPreviewTenant.legalDocument.rejectionReason}</span>
                </div>
              </div>
            )}

            {/* Footer Action Bar */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <a
                  href={documentPreviewTenant.legalDocument.fileUrl}
                  download={documentPreviewTenant.legalDocument.fileName}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل الملف</span>
                </a>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {documentPreviewTenant.legalDocument.status !== 'approved' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApproveDocument(documentPreviewTenant.id, false)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>قبول واعتماد الوثيقة</span>
                    </button>

                    {documentPreviewTenant.status !== 'active' && (
                      <button
                        type="button"
                        onClick={() => handleApproveDocument(documentPreviewTenant.id, true)}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        title="قبول الوثيقة واعتمادها وتفعيل منصة الجمعية فوراً"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>قبول + تفعيل الجمعية</span>
                      </button>
                    )}
                  </>
                )}

                {documentPreviewTenant.legalDocument.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => handleOpenRejectModal(documentPreviewTenant)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>رفض الوثيقة</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDocumentPreviewTenant(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 7: REJECT DOCUMENT REASON MODAL ================= */}
      {rejectModalTenant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <XCircle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-slate-900 mb-1">
              رفض وثيقة ترخيص الجمعية
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              يرجى تحديد سبب رفض وثيقة الجمعية <strong>«{rejectModalTenant.name}»</strong> لمساعدة الجمعية في تصحيح الوضع:
            </p>

            {/* Quick Reason Presets */}
            <div className="space-y-1.5 mb-3">
              <span className="text-[11px] font-bold text-slate-600 block">أسباب شائعة للاختيار السريع:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'الوثيقة غير واضحة أو غير مقروءة بدقة',
                  'الوثيقة منتهية الصلاحية',
                  'الوصل غير مطابق للاسم الرسمي للجمعية',
                  'مستند الترخيص ناقص أو تنقصه الأختام الرسمية'
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectionReasonText(preset)}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 transition-colors border border-slate-200 cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نص سبب الرفض:
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                placeholder="اكتب سبب الرفض هنا بالتفصيل..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-rose-500 leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectModalTenant(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectDocument}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
              >
                تأكيد تسجيل الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Platform Support Preview Modal */}
      <PlatformSupportModal
        isOpen={previewSupportModalOpen}
        onClose={() => setPreviewSupportModalOpen(false)}
      />
    </div>
  );
};
