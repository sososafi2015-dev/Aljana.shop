import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  ShieldCheck, 
  Users, 
  TrendingUp, 
  HeartHandshake, 
  Database, 
  History, 
  Download, 
  Upload, 
  RotateCcw, 
  Save, 
  PlusCircle, 
  KeyRound, 
  Building, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard,
  CheckCircle2,
  FileCheck,
  SlidersHorizontal,
  Eye,
  Layout,
  Coins,
  UserPlus,
  ShieldAlert,
  Key,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  LayoutDashboard,
  Sparkles,
  LogOut,
  User
} from 'lucide-react';
import { 
  AssociationSettings, 
  AuditLog, 
  Language, 
  Member, 
  MemberStatus,
  FinancialOperation, 
  ActivityItem,
  MemberRegistrationField,
  UIElementConfig,
  Poll,
  MemberCardSettings,
  MemberContribution,
  ContributionStatus,
  BoardMember,
  SubAdmin,
  CurrentAdminSession,
  AdminSectionKey,
  DonationCampaign,
  CampaignContribution,
  ContributionTypeConfig
} from '../types';
import { translations } from '../translations';
import { ManageRegistrationFields } from './ManageRegistrationFields';
import { ManageUIElements } from './ManageUIElements';
import { ManageNonMemberVisibility } from './ManageNonMemberVisibility';
import { ManagePolls } from './ManagePolls';
import { ManageActivities } from './ManageActivities';
import { ManageBranding } from './ManageBranding';
import { ManageMembersList } from './ManageMembersList';
import { ManageMemberCard } from './ManageMemberCard';
import { ManageContributions } from './ManageContributions';
import { ManageBoardMembers } from './ManageBoardMembers';
import { ManageSubAdmins } from './ManageSubAdmins';
import { initialMemberCardSettings, defaultStoreThemeColors } from '../initialData';
import { Vote, Image as ImageIcon, Award, RefreshCw, Megaphone, GraduationCap, Menu, X, Layers, ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react';
import { ManageOperations } from './ManageOperations';
import { ManageAccessControl } from './ManageAccessControl';
import { CampaignsAdminManager } from './CampaignsAdminManager';
import { ManageDonationsBenefit } from './ManageDonationsBenefit';
import { SubscriptionRenewalSection } from './SubscriptionRenewalSection';
import { PlatformTutorialsSection } from './PlatformTutorialsSection';
import { PlatformSetupServiceSection } from './PlatformSetupServiceSection';
import { CreateAdSection } from './CreateAdSection';
import { ContactPlatformAdminButton } from './ContactPlatformAdminButton';
import { getTenantById, defaultTenants, getMasterAdminSession } from '../tenantStorage';
import { getTenantSubscriptionDetails } from '../paymentStorage';
import { useAssociationSectionsConfig } from '../associationSectionsStorage';
import { WhatsAppIcon, validateWhatsAppPhone, buildWhatsAppChatUrl } from '../utils/whatsappUtils';

interface AdminPanelProps {
  settings: AssociationSettings;
  onUpdateSettings: (settings: AssociationSettings) => Promise<boolean | void> | void;
  memberCardSettings: MemberCardSettings;
  onUpdateMemberCardSettings: (cardSettings: MemberCardSettings) => void;
  registrationFields: MemberRegistrationField[];
  onUpdateRegistrationFields: (fields: MemberRegistrationField[]) => void;
  uiElements: UIElementConfig[];
  onUpdateUIElements: (elements: UIElementConfig[]) => void;
  polls: Poll[];
  onUpdatePolls: (polls: Poll[]) => void;
  boardMembers?: BoardMember[];
  onUpdateBoardMembers?: (boardMembers: BoardMember[]) => void;
  contributions?: MemberContribution[];
  onAddContribution?: (contribution: Omit<MemberContribution, 'id' | 'createdAt'>) => void;
  onUpdateContributionStatus?: (id: string, status: ContributionStatus) => void;
  onDeleteContribution?: (id: string) => void;
  onPrintContributionReceipt?: (contribution: MemberContribution) => void;
  auditLogs: AuditLog[];
  members: Member[];
  operations: FinancialOperation[];
  activities: ActivityItem[];
  campaigns?: DonationCampaign[];
  onUpdateCampaigns?: (campaigns: DonationCampaign[]) => void;
  campaignContributions?: CampaignContribution[];
  onUpdateCampaignContributions?: (contributions: CampaignContribution[]) => void;
  contributionTypes?: ContributionTypeConfig[];
  onUpdateContributionTypes?: (types: ContributionTypeConfig[]) => void;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  lang: Language;
  onOpenAddMember: () => void;
  onEditMember?: (member: Member) => void;
  onDeleteMember?: (id: string) => void;
  onToggleMemberStatus?: (id: string, targetStatus?: MemberStatus) => void;
  onPrintMemberCard?: (member: Member) => void;
  onOpenAddOperation: () => void;
  onSaveOperation?: (updatedFields: Partial<FinancialOperation>, editId?: string) => Promise<any>;
  onDeleteOperation?: (id: string) => void;
  totalIncomes?: number;
  totalExpenses?: number;
  currentBalance?: number;
  onOpenAddActivity: () => void;
  onEditActivity: (activity: ActivityItem) => void;
  onDeleteActivity: (id: string) => Promise<boolean> | void;
  onToggleActivityStatus: (id: string) => void;
  onAddGalleryImages?: (activityId: string, newUrls: string[]) => Promise<boolean | void> | void;
  onDeleteGalleryImage?: (activityId: string, imageIndex: number, imageUrl?: string) => Promise<boolean> | void;
  onDeleteAllGalleryImages?: (activityId: string) => Promise<boolean> | void;
  onOpenMediaModal: (media: { title: string; url: string; type: 'image' | 'video' | 'document'; description?: string }) => void;
  onExportBackup: () => void;
  onResetDefaults: () => void;
  onImportBackup: (file: File) => void;
  onLogAudit: (action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'backup', description: string) => void;
  subAdmins?: SubAdmin[];
  onUpdateSubAdmins?: (subAdmins: SubAdmin[]) => void;
  currentAdminSession?: CurrentAdminSession | null;
  isMasterTemplate?: boolean;
  onPublishReferenceActivities?: () => Promise<void> | void;
  onSyncReferenceActivities?: () => Promise<void> | void;
  activeTenantId?: string;
  onBackToMasterAdmin?: () => void;
  onLogoutAdmin?: () => void;
}

export type AdminTabType = 
  | 'overview' 
  | 'createAd'
  | 'donationsBenefit'
  | 'subscriptionRenewal'
  | 'platformTutorials'
  | 'platformSetupService'
  | 'operations'
  | 'campaigns'
  | 'members' 
  | 'boardMembers' 
  | 'contributions' 
  | 'memberCard' 
  | 'activities' 
  | 'branding' 
  | 'polls' 
  | 'uiElements' 
  | 'nonMemberVisibility'
  | 'fields' 
  | 'accessControl'
  | 'settings' 
  | 'audit' 
  | 'backup'
  | 'subAdmins';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  settings,
  onUpdateSettings,
  memberCardSettings,
  onUpdateMemberCardSettings,
  registrationFields,
  onUpdateRegistrationFields,
  uiElements,
  onUpdateUIElements,
  polls,
  onUpdatePolls,
  boardMembers = [],
  onUpdateBoardMembers,
  contributions = [],
  onAddContribution,
  onUpdateContributionStatus,
  onDeleteContribution,
  onPrintContributionReceipt,
  auditLogs,
  members,
  operations,
  activities,
  campaigns = [],
  onUpdateCampaigns,
  campaignContributions = [],
  onUpdateCampaignContributions,
  contributionTypes = [],
  onUpdateContributionTypes,
  addToast,
  lang,
  onOpenAddMember,
  onEditMember,
  onDeleteMember,
  onToggleMemberStatus,
  onPrintMemberCard,
  onOpenAddOperation,
  onSaveOperation,
  onDeleteOperation,
  totalIncomes: propTotalIncomes,
  totalExpenses: propTotalExpenses,
  currentBalance: propCurrentBalance,
  onOpenAddActivity,
  onEditActivity,
  onDeleteActivity,
  onToggleActivityStatus,
  onAddGalleryImages,
  onDeleteGalleryImage,
  onDeleteAllGalleryImages,
  onOpenMediaModal,
  onExportBackup,
  onResetDefaults,
  onImportBackup,
  onLogAudit,
  subAdmins = [],
  onUpdateSubAdmins,
  currentAdminSession,
  isMasterTemplate = false,
  onPublishReferenceActivities,
  onSyncReferenceActivities,
  activeTenantId,
  onBackToMasterAdmin,
  onLogoutAdmin,
}) => {
  const t = translations[lang] as any;

  const masterAdminSession = getMasterAdminSession();
  const isPlatformSuperAdmin = masterAdminSession?.isMaster === true || masterAdminSession?.role === 'super_admin' || currentAdminSession?.isMasterPlatformAdmin === true;

  const isSuperAdmin = isPlatformSuperAdmin || (currentAdminSession
    ? (currentAdminSession.type === 'super_admin' || currentAdminSession.role === 'main_admin' || currentAdminSession.isMasterPlatformAdmin === true)
    : true);

  // Global Section Visibility from Master Platform Admin
  const { isEnabled: isSectionGloballyEnabled } = useAssociationSectionsConfig();

  // Resolve live sub-admin permissions directly from the subAdmins database/state
  const liveSubAdmin = (!isSuperAdmin && currentAdminSession)
    ? (subAdmins.find(
        (a) =>
          a.id === currentAdminSession.id ||
          (currentAdminSession.username &&
            a.username &&
            a.username.trim().toLowerCase() === currentAdminSession.username.trim().toLowerCase()) ||
          (currentAdminSession.phone &&
            a.phone &&
            a.phone.replace(/[\s\-\.\(\)]/g, '') === currentAdminSession.phone.replace(/[\s\-\.\(\)]/g, ''))
      ) || currentAdminSession.subAdmin)
    : null;
  const currentSubAdmin = liveSubAdmin;

  // Granular section check (respects central Master Admin configuration FIRST across all associations and roles, then Super Admin role, then Sub-Admin permissions)
  const canViewSection = (sectionKey: AdminSectionKey | 'subAdmins') => {
    // 1. Central Platform Master Admin setting check: if disabled centrally, it is hidden for ALL associations and ALL admins immediately
    if (!isSectionGloballyEnabled(sectionKey)) {
      return false;
    }
    // 2. Association Super Admin or Platform Super Admin sees all enabled sections
    if (isSuperAdmin || isPlatformSuperAdmin) return true;
    // 3. Secondary admins can NEVER view the subAdmins management section
    if (sectionKey === 'subAdmins') return false;
    // 4. Sub-admin permissions check
    if (!currentSubAdmin || currentSubAdmin.status !== 'active' || !currentSubAdmin.permissions) return false;
    return !!currentSubAdmin.permissions[sectionKey as AdminSectionKey]?.canView;
  };

  const hasPermission = (
    sectionKey: AdminSectionKey | 'subAdmins', 
    action: 'canView' | 'canAdd' | 'canEdit' | 'canDelete'
  ) => {
    // 1. Central Platform Master Admin setting check: if disabled centrally, block all actions
    if (!isSectionGloballyEnabled(sectionKey)) {
      return false;
    }
    if (isSuperAdmin || isPlatformSuperAdmin) return true;
    if (!currentSubAdmin || currentSubAdmin.status !== 'active' || !currentSubAdmin.permissions) return false;
    const p = currentSubAdmin.permissions[sectionKey as AdminSectionKey];
    return !!p?.[action];
  };

  // Resolve current active tenant object and subscription details
  const currentTenant = useMemo(() => {
    return getTenantById(activeTenantId || 'tenant_nour') || defaultTenants[0];
  }, [activeTenantId]);

  const tenantSubInfo = useMemo(() => {
    return getTenantSubscriptionDetails(currentTenant);
  }, [currentTenant]);

  const allSectionOrder: AdminTabType[] = [
    'overview', 'createAd', 'donationsBenefit', 'subscriptionRenewal', 'platformTutorials', 'platformSetupService', 'operations', 'campaigns', 'members', 'boardMembers', 'contributions', 'memberCard',
    'activities', 'branding', 'polls', 'uiElements', 'nonMemberVisibility', 'fields', 'accessControl', 'settings',
    'audit', 'backup', 'subAdmins'
  ];

  // Determine initial active tab (supports direct URL query/hash so direct links to disabled sections hit the Access Denied guard)
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTabType>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const requestedSection = (params.get('adminTab') || params.get('section') || '').trim() as AdminTabType;
        if (requestedSection && allSectionOrder.includes(requestedSection)) {
          return requestedSection;
        }
        const hashSection = window.location.hash.replace(/^#\/?(admin\/)?/, '').trim() as AdminTabType;
        if (hashSection && allSectionOrder.includes(hashSection)) {
          return hashSection;
        }
      } catch {}
    }

    for (const key of allSectionOrder) {
      if (!isSectionGloballyEnabled(key)) continue;
      if (isSuperAdmin || isPlatformSuperAdmin) {
        return key;
      }
      if (key !== 'subAdmins' && currentSubAdmin?.permissions?.[key as AdminSectionKey]?.canView) {
        return key;
      }
    }
    return 'overview';
  });

  // Listen to direct URL navigation (popstate / hashchange) to enforce guard on direct links
  useEffect(() => {
    const handleUrlChange = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const requestedSection = (params.get('adminTab') || params.get('section') || '').trim() as AdminTabType;
        if (requestedSection && allSectionOrder.includes(requestedSection)) {
          setActiveAdminTab(requestedSection);
          return;
        }
        const hashSection = window.location.hash.replace(/^#\/?(admin\/)?/, '').trim() as AdminTabType;
        if (hashSection && allSectionOrder.includes(hashSection)) {
          setActiveAdminTab(hashSection);
        }
      } catch {}
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Auto-fallback if currently active tab is not permitted for the logged-in Secondary Admin or gets disabled centrally
  useEffect(() => {
    if (!canViewSection(activeAdminTab)) {
      for (const key of allSectionOrder) {
        if (canViewSection(key)) {
          setActiveAdminTab(key);
          return;
        }
      }
    }
  }, [activeAdminTab, isSectionGloballyEnabled, currentAdminSession, currentSubAdmin, subAdmins]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Structured catalogue of all 23 association sections for the sidebar navigation
  const sidebarCategories = useMemo(() => {
    const rawCategories: {
      categoryKey: string;
      categoryTitle: string;
      items: { key: AdminTabType; title: string; icon: React.ReactNode; isCore?: boolean }[];
    }[] = [
      {
        categoryKey: 'overview',
        categoryTitle: 'الرئيسية والإحصائيات',
        items: [
          { key: 'overview', title: 'نظرة عامة والإحصائيات العامة', icon: <LayoutDashboard className="w-4 h-4 text-emerald-600" />, isCore: true },
        ],
      },
      {
        categoryKey: 'financial',
        categoryTitle: 'المالية والمحاسبة',
        items: [
          { key: 'operations', title: 'جميع العمليات المالية (مداخيل ومصاريف)', icon: <TrendingUp className="w-4 h-4 text-emerald-600" />, isCore: true },
          { key: 'contributions', title: 'سجل المساهمات والانخراطات', icon: <Coins className="w-4 h-4 text-emerald-600" />, isCore: true },
          { key: 'donationsBenefit', title: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية', icon: <Sparkles className="w-4 h-4 text-emerald-600" /> },
        ],
      },
      {
        categoryKey: 'activities',
        categoryTitle: 'الأنشطة والمشاريع',
        items: [
          { key: 'activities', title: 'أبرز الأعمال والأنشطة الخيرية', icon: <HeartHandshake className="w-4 h-4 text-emerald-600" />, isCore: true },
          { key: 'campaigns', title: 'حملة تبرع والمشاريع الخيرية', icon: <HeartHandshake className="w-4 h-4 text-amber-500" /> },
        ],
      },
      {
        categoryKey: 'members',
        categoryTitle: 'المنخرطون والمكتب المسير',
        items: [
          { key: 'members', title: 'إدارة وقائمة المنخرطين والاشتراكات', icon: <Users className="w-4 h-4 text-emerald-600" />, isCore: true },
          { key: 'boardMembers', title: 'أعضاء مكتب الجمعية', icon: <Award className="w-4 h-4 text-emerald-600" />, isCore: true },
          { key: 'fields', title: 'إدارة حقول تسجيل المنخرطين', icon: <SlidersHorizontal className="w-4 h-4 text-emerald-600" /> },
        ],
      },
      {
        categoryKey: 'branding',
        categoryTitle: 'الهوية والتخصيص',
        items: [
          { key: 'branding', title: 'شعار التطبيق وغلاف البانر وألوان الهوية', icon: <ImageIcon className="w-4 h-4 text-emerald-600" />, isCore: true },
          { key: 'memberCard', title: 'تعديل وصل / بطاقة المنخرط', icon: <CreditCard className="w-4 h-4 text-emerald-600" /> },
          { key: 'uiElements', title: 'إدارة ظهور أقسام الواجهة العامة', icon: <Eye className="w-4 h-4 text-emerald-600" /> },
        ],
      },
      {
        categoryKey: 'governance',
        categoryTitle: 'الحكامة والقرارات',
        items: [
          { key: 'polls', title: 'التصويت والقرارات التشاركية', icon: <Vote className="w-4 h-4 text-emerald-600" /> },
          { key: 'nonMemberVisibility', title: 'تحكم ظهور الأقسام لغير المنخرطين', icon: <EyeOff className="w-4 h-4 text-emerald-600" /> },
        ],
      },
      {
        categoryKey: 'marketing',
        categoryTitle: 'التسويق والإعلام',
        items: [
          { key: 'createAd', title: 'إنشاء إعلان وترويج الجمعية', icon: <Megaphone className="w-4 h-4 text-indigo-600" /> },
        ],
      },
      {
        categoryKey: 'security',
        categoryTitle: 'الأمان والإدارة',
        items: [
          { key: 'accessControl', title: 'تحكم في الدخول إلى لوحة التحكم', icon: <ShieldAlert className="w-4 h-4 text-emerald-600" />, isCore: true },
          { key: 'settings', title: 'بيانات الجمعية والإعدادات', icon: <Settings className="w-4 h-4 text-emerald-600" />, isCore: true },
          { key: 'subAdmins', title: 'إدارة أدمن من الدرجة الثانية', icon: <UserPlus className="w-4 h-4 text-emerald-600" /> },
          { key: 'audit', title: 'سجل التدقيق والرقابة الإدارية', icon: <History className="w-4 h-4 text-emerald-600" /> },
          { key: 'backup', title: 'النسخ الاحتياطي واسترجاع البيانات', icon: <Database className="w-4 h-4 text-emerald-600" /> },
          { key: 'subscriptionRenewal', title: 'تجديد الاشتراك ومعلومات المنظومة', icon: <RefreshCw className="w-4 h-4 text-indigo-600" /> },
          { key: 'platformTutorials', title: 'تعلم كيفية استخدام المنصة', icon: <GraduationCap className="w-4 h-4 text-indigo-600" /> },
          { key: 'platformSetupService', title: 'سنقوم بإعداد منصة جمعيتك نيابة عنك', icon: <Sparkles className="w-4 h-4 text-emerald-600" /> },
        ],
      },
    ];

    return rawCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => {
          // Strictly filtered: If Master Platform Admin centrally disabled this section, it is NEVER shown in the sidebar
          if (!isSectionGloballyEnabled(item.key)) return false;
          if (item.key === 'subAdmins' && !isSuperAdmin) return false;
          return canViewSection(item.key);
        }),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [isSectionGloballyEnabled, isSuperAdmin, currentSubAdmin]);

  const totalVisibleSectionsCount = useMemo(() => {
    return sidebarCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [sidebarCategories]);

  const isRtl = lang === 'ar';
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const getActiveSectionInfo = (tab: AdminTabType): { title: string; icon: React.ReactNode } => {
    switch (tab) {
      case 'createAd':
        return { title: 'إنشاء إعلان وترويج الجمعية', icon: <Megaphone className="w-4 h-4 text-indigo-600" /> };
      case 'donationsBenefit':
        return { title: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية', icon: <HeartHandshake className="w-4 h-4 text-emerald-600" /> };
      case 'subscriptionRenewal':
        return { title: 'تجديد الاشتراك ومعلومات المنظومة', icon: <RefreshCw className="w-4 h-4 text-indigo-600" /> };
      case 'platformTutorials':
        return { title: 'تعلم كيفية استخدام المنصة', icon: <GraduationCap className="w-4 h-4 text-indigo-600" /> };
      case 'subAdmins':
        return { title: 'إدارة أدمن من الدرجة الثانية', icon: <UserPlus className="w-4 h-4 text-emerald-600" /> };
      case 'operations':
        return { title: t.manageFinances || 'جميع العمليات المالية (مداخيل ومصاريف)', icon: <TrendingUp className="w-4 h-4 text-emerald-600" /> };
      case 'campaigns':
        return { title: t.campaignsSection || 'حملة تبرع', icon: <HeartHandshake className="w-4 h-4 text-amber-500" /> };
      case 'members':
        return { title: t.manageMembers || 'إدارة المنخرطين', icon: <Users className="w-4 h-4 text-emerald-600" /> };
      case 'boardMembers':
        return { title: t.boardMembers || 'أعضاء المكتب المسير', icon: <Award className="w-4 h-4 text-emerald-600" /> };
      case 'contributions':
        return { title: t.manageContributions || 'إدارة المساهمات', icon: <CreditCard className="w-4 h-4 text-emerald-600" /> };
      case 'memberCard':
        return { title: t.manageMemberCard || 'تخصيص بطاقة الانخراط', icon: <CreditCard className="w-4 h-4 text-emerald-600" /> };
      case 'activities':
        return { title: t.manageFeaturedActivitiesTitle || 'أبرز الأعمال والأنشطة الخيرية', icon: <HeartHandshake className="w-4 h-4 text-emerald-600" /> };
      case 'branding':
        return { title: t.manageBrandingTitle || 'شعار التطبيق وغلاف البانر', icon: <ImageIcon className="w-4 h-4 text-emerald-600" /> };
      case 'polls':
        return { title: t.polls || 'التصويت والقرارات', icon: <Vote className="w-4 h-4 text-emerald-600" /> };
      case 'uiElements':
        return { title: t.manageUIElements || 'إدارة ظهور أقسام الواجهة', icon: <Eye className="w-4 h-4 text-emerald-600" /> };
      case 'nonMemberVisibility':
        return { title: t.manageNonMemberVisibility || 'تحكم ظهور الأقسام لغير المنخرطين', icon: <EyeOff className="w-4 h-4 text-emerald-600" /> };
      case 'fields':
        return { title: t.manageRegistrationFields || 'حقول استمارة الانخراط', icon: <SlidersHorizontal className="w-4 h-4 text-emerald-600" /> };
      case 'accessControl':
        return { title: t.accessControlTitle || 'صلاحيات الأدمن ونظام التسجيل', icon: <ShieldAlert className="w-4 h-4 text-emerald-600" /> };
      case 'settings':
        return { title: t.associationSettings || 'إعدادات الجمعية والتواصل', icon: <Settings className="w-4 h-4 text-emerald-600" /> };
      case 'audit':
        return { title: t.auditTrailTitle || 'سجل العمليات والرقابة', icon: <History className="w-4 h-4 text-emerald-600" /> };
      case 'backup':
        return { title: t.backupAndRestore || 'النسخ الاحتياطي والاستعادة', icon: <Database className="w-4 h-4 text-emerald-600" /> };
      default:
        return { title: t.adminDashboard || 'لوحة التحكم الإدارية', icon: <LayoutDashboard className="w-4 h-4 text-emerald-600" /> };
    }
  };

  const [formData, setFormData] = useState<AssociationSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Keep formData in sync whenever external settings change (e.g. from Branding or Access Control updates)
  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mergedSettings: AssociationSettings = {
      ...settings,
      ...formData,
      // Preserve critical branding and access control settings so they are never erased
      logoUrl: formData.logoUrl !== undefined ? formData.logoUrl : settings.logoUrl,
      bannerImageUrl: formData.bannerImageUrl !== undefined ? formData.bannerImageUrl : settings.bannerImageUrl,
      bannerDarknessOverlay: settings.bannerDarknessOverlay !== undefined ? settings.bannerDarknessOverlay : 40,
      heroBadgeText: settings.heroBadgeText || '',
      heroBadgeTextFr: settings.heroBadgeTextFr,
      heroBadgeTextEn: settings.heroBadgeTextEn,
      showAdminLoginButton: settings.showAdminLoginButton ?? false,
      enableTripleClickLogoLogin: settings.enableTripleClickLogoLogin ?? true,
      themeColors: {
        ...defaultStoreThemeColors,
        ...(settings.themeColors || {}),
        ...(formData.themeColors || {}),
      },
    };
    const ok = await onUpdateSettings(mergedSettings);
    if (ok !== false) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
    }
  };

  const totalIncomes = propTotalIncomes !== undefined
    ? propTotalIncomes
    : operations
        .filter((op) => op.type === 'income')
        .reduce((sum, op) => sum + Number(op.amount), 0);
  const totalExpenses = propTotalExpenses !== undefined
    ? propTotalExpenses
    : operations
        .filter((op) => op.type === 'expense')
        .reduce((sum, op) => sum + Number(op.amount), 0);
  const balance = propCurrentBalance !== undefined
    ? propCurrentBalance
    : (totalIncomes - totalExpenses);

  return (
    <div className="space-y-6">
      {/* Super Admin Notice if Association is Suspended or Pending */}
      {currentAdminSession?.isMasterPlatformAdmin && currentTenant && (currentTenant.status === 'inactive' || currentTenant.status === 'pending_activation') && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold ${
          currentTenant.status === 'inactive'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <span>
              {currentTenant.status === 'inactive'
                ? `تنبيه إداري: جمعية «${currentTenant.name}» معطلة حالياً عن العرض العام للمستخدمين. أنت تتصفح لوحة التحكم وتدير بياناتها بصفتك الأدمن الرئيسي للمنصة.`
                : `تنبيه إداري: جمعية «${currentTenant.name}» في انتظار إتمام التفعيل. أنت تتصفح لوحة التحكم وتدير بياناتها بصفتك الأدمن الرئيسي للمنصة.`
              }
            </span>
          </div>
          {onBackToMasterAdmin && (
            <button
              type="button"
              onClick={onBackToMasterAdmin}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap text-xs shadow-xs self-end sm:self-auto"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>العودة للإدارة العامة للمنصة</span>
            </button>
          )}
        </div>
      )}

      {/* Admin Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-2xl border ${
            currentAdminSession?.isMasterPlatformAdmin
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : isSuperAdmin
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
          }`}>
            {currentAdminSession?.isMasterPlatformAdmin ? (
              <ShieldCheck className="w-7 h-7 text-amber-400" />
            ) : isSuperAdmin ? (
              <ShieldCheck className="w-7 h-7" />
            ) : (
              <Key className="w-7 h-7" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                currentAdminSession?.isMasterPlatformAdmin
                  ? 'text-amber-300 bg-amber-950/80 border-amber-500/40'
                  : isSuperAdmin 
                    ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40'
                    : 'text-blue-300 bg-blue-950/80 border-blue-500/40'
              }`}>
                {currentAdminSession?.isMasterPlatformAdmin
                  ? 'الأدمن الرئيسي للمنصة (Master Admin) - صلاحيات الإدارة العامة'
                  : isSuperAdmin
                    ? 'الأدمن الرئيسي (Super Admin) - صلاحيات كاملة'
                    : 'أدمن من الدرجة الثانية - صلاحيات مخصصة'}
              </span>
              {!isSuperAdmin && (currentSubAdmin || currentAdminSession) && (
                <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5 flex-wrap">
                  <span>{currentSubAdmin?.fullName || currentAdminSession?.fullName}</span>
                  {(currentSubAdmin?.username || currentAdminSession?.username) && (
                    <span className="font-mono text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-500/30 text-[11px]" dir="ltr">
                      @{currentSubAdmin?.username || currentAdminSession?.username}
                    </span>
                  )}
                  {(currentSubAdmin?.phone || currentAdminSession?.phone) && (
                    <span className="font-mono text-slate-400 text-[11px]" dir="ltr">
                      ({currentSubAdmin?.phone || currentAdminSession?.phone})
                    </span>
                  )}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold mt-1.5">{t.adminDashboard}</h2>
            <p className="text-xs text-slate-300">
              {currentAdminSession?.isMasterPlatformAdmin
                ? `مرحباً بك! أنت تدير هذه الجمعية بصلاحيات الأدمن الرئيسي الشاملة للإدارة العامة للمنصة.`
                : isSuperAdmin
                  ? t.adminWelcome
                  : `مرحباً بك! الأقسام والأزرار المتاحة مطابقة بدقة للصلاحيات الممنوحة لك من طرف الأدمن الرئيسي.`}
            </p>
          </div>
        </div>

        {/* Quick Add Buttons, Return to Overview & Logout Button */}
        <div className="flex flex-wrap items-center gap-2">
          {currentAdminSession?.isMasterPlatformAdmin && onBackToMasterAdmin && (
            <button
              type="button"
              onClick={onBackToMasterAdmin}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-xs cursor-pointer"
              title="الرجوع إلى لوحة الإدارة العامة للمنصة"
            >
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>العودة للإدارة العامة</span>
            </button>
          )}
          {activeAdminTab !== 'overview' && (
            <button
              type="button"
              id="admin-header-back-to-overview-btn"
              onClick={() => {
                setActiveAdminTab('overview');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer group"
              title={t.backToAdminDashboard || 'الرجوع إلى لوحة التحكم الإدارية'}
            >
              <BackArrow className="w-4 h-4 transition-transform group-hover:-translate-x-1 rtl:group-hover:translate-x-1" />
              <span>{t.backToAdminDashboardShort || 'الرجوع للوحة التحكم'}</span>
            </button>
          )}
          {hasPermission('members', 'canAdd') && (
            <button
              onClick={onOpenAddMember}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.addMember}</span>
            </button>
          )}

          {hasPermission('operations', 'canAdd') && (
            <button
              onClick={onOpenAddOperation}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>تسجيل عملية مالية</span>
            </button>
          )}

          {hasPermission('activities', 'canAdd') && (
            <button
              onClick={onOpenAddActivity}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>{t.addActivity}</span>
            </button>
          )}

          {onLogoutAdmin && (
            <button
              type="button"
              id="admin-header-logout-btn"
              onClick={onLogoutAdmin}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-black transition-all shadow-sm hover:shadow cursor-pointer border border-rose-400/30"
              title="تسجيل الخروج وإنهاء جلسة الدخول الحالية بشكل آمن"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          )}
        </div>
      </div>

      {/* Dedicated Secondary Admin Account Bar (صفحة حساب الأدمن من الدرجة الثانية) */}
      {!isSuperAdmin && (currentSubAdmin || currentAdminSession) && (
        <div
          id="secondary-admin-account-card"
          className="bg-white rounded-2xl border border-blue-200/80 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          dir="rtl"
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
              <User className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  حساب الأدمن من الدرجة الثانية: {currentSubAdmin?.fullName || currentAdminSession?.fullName}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>جلسة نشطة • صلاحيات مفعلة</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                {(currentSubAdmin?.username || currentAdminSession?.username) && (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400 font-semibold">اسم المستخدم:</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60" dir="ltr">
                      {currentSubAdmin?.username || currentAdminSession?.username}
                    </span>
                  </span>
                )}
                {(currentSubAdmin?.phone || currentAdminSession?.phone) && (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-400 font-semibold">رقم الهاتف:</span>
                    <span className="font-mono font-semibold text-slate-700" dir="ltr">
                      {currentSubAdmin?.phone || currentAdminSession?.phone}
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="text-slate-400 font-semibold">الأقسام المصرح بها:</span>
                  <span className="font-bold text-emerald-700">{totalVisibleSectionsCount} أقسام</span>
                </span>
              </div>
            </div>
          </div>

          {onLogoutAdmin && (
            <button
              type="button"
              id="secondary-admin-account-logout-btn"
              onClick={onLogoutAdmin}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-xs sm:text-sm shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
              title="إنهاء الجلسة الحالية وتسجيل الخروج إلى صفحة تسجيل الدخول"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          )}
        </div>
      )}

      {/* Admin Top Bar: Overview (Stats), Sidebar Drawer Trigger, Active Section Indicator, and Quick Logout */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          {/* Sidebar Toggle Button */}
          <button
            type="button"
            id="admin-toggle-sidebar-btn"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer group"
            title="فتح القائمة الجانبية لأقسام لوحة التحكم"
          >
            <Menu className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">القائمة الجانبية للأقسام</span>
            <span className="sm:hidden">الأقسام</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
              {totalVisibleSectionsCount}
            </span>
          </button>

          {canViewSection('overview') && (
            <button
              onClick={() => {
                setActiveAdminTab('overview');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeAdminTab === 'overview'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>{t.adminStats}</span>
            </button>
          )}

          {activeAdminTab !== 'overview' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              {getActiveSectionInfo(activeAdminTab).icon}
              <span>{getActiveSectionInfo(activeAdminTab).title}</span>
            </div>
          )}
        </div>

        {onLogoutAdmin && (
          <button
            type="button"
            id="admin-topbar-logout-btn"
            onClick={onLogoutAdmin}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0"
            title="تسجيل الخروج وإنهاء الجلسة الحالية"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        )}
      </div>

      {/* Comprehensive Sidebar Drawer for Association Sections */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in" dir="rtl">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
            <div className="w-screen max-w-sm sm:max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200 pointer-events-auto">
              {/* Sidebar Header */}
              <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white">القائمة الجانبية للأقسام</h3>
                    <p className="text-[11px] text-slate-300">
                      {totalVisibleSectionsCount} قسم متاح ومفعّل حالياً
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="إغلاق القائمة الجانبية"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search input in sidebar */}
              <div className="p-3 bg-slate-50 border-b border-slate-200">
                <div className="relative">
                  <input
                    type="text"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder="ابحث في الأقسام المتاحة..."
                    className="w-full bg-white border border-slate-300 rounded-xl py-2 px-3 pr-8 text-xs focus:border-emerald-600 focus:outline-hidden"
                  />
                  <Layers className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
                  {sidebarSearch && (
                    <button
                      type="button"
                      onClick={() => setSidebarSearch('')}
                      className="absolute left-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Sidebar Categories & Sections List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {sidebarCategories.map((category) => {
                  const filteredItems = category.items.filter((item) =>
                    !sidebarSearch.trim() ||
                    item.title.toLowerCase().includes(sidebarSearch.toLowerCase().trim())
                  );

                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={category.categoryKey} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-2 pb-1 border-b border-slate-100">
                        <span>{category.categoryTitle}</span>
                        <span className="text-[10px] font-mono text-slate-400">({filteredItems.length})</span>
                      </div>

                      <div className="space-y-1">
                        {filteredItems.map((item) => {
                          const isActive = activeAdminTab === item.key;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => {
                                setActiveAdminTab(item.key);
                                setIsSidebarOpen(false);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all text-right cursor-pointer ${
                                isActive
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-emerald-900 border border-slate-100 hover:border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={isActive ? 'text-white' : 'text-slate-500'}>
                                  {item.icon}
                                </span>
                                <span className="truncate">{item.title}</span>
                              </div>

                              {isActive && (
                                <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sidebar Footer info & Logout */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2.5">
                {onLogoutAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarOpen(false);
                      onLogoutAdmin();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج</span>
                  </button>
                )}
                <div className="text-center text-[11px] text-slate-500 leading-relaxed">
                  يتم التحكم في ظهور وإخفاء الأقسام مركزياً من طرف الإدارة العامة للمنصة.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Back Navigation Bar for all Admin Sub-sections and Sub-pages */}
      {activeAdminTab !== 'overview' && (
        <div
          id="admin-subpage-back-bar"
          className="sticky top-2 sm:top-4 z-30 mb-6 bg-white/95 backdrop-blur-md rounded-2xl border-2 border-emerald-500/30 p-3 sm:p-4 shadow-md flex flex-wrap items-center justify-between gap-3 transition-all"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              id="admin-back-to-dashboard-btn"
              onClick={() => {
                setActiveAdminTab('overview');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow transition-all duration-200 cursor-pointer group select-none min-h-[44px]"
              title={t.backToAdminDashboard || 'الرجوع إلى لوحة التحكم الإدارية'}
            >
              <span className="p-1 rounded-lg bg-emerald-700/80 text-white group-hover:bg-emerald-800 transition-colors">
                <BackArrow className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1 rtl:group-hover:translate-x-1" />
              </span>
              <span className="hidden sm:inline leading-none font-bold">
                {t.backToAdminDashboard || 'الرجوع إلى لوحة التحكم الإدارية'}
              </span>
              <span className="sm:hidden leading-none font-bold">
                {t.backToAdminDashboardShort || 'الرجوع للوحة التحكم'}
              </span>
            </button>

            {/* Breadcrumbs & Active Section Title */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 font-medium">
              <button
                type="button"
                onClick={() => {
                  setActiveAdminTab('overview');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hidden md:flex items-center gap-1.5 font-bold text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.adminDashboard}</span>
              </button>
              <span className="hidden md:inline text-slate-300">/</span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs max-w-[200px] sm:max-w-none truncate">
                {getActiveSectionInfo(activeAdminTab).icon}
                <span className="truncate">{getActiveSectionInfo(activeAdminTab).title}</span>
              </span>
            </div>
          </div>

          {/* Quick Return and Sidebar Shortcut Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="admin-subpage-sidebar-shortcut-btn"
              onClick={() => setIsSidebarOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer min-h-[40px] shadow-xs"
              title="فتح القائمة الجانبية للتنقل بين الأقسام"
            >
              <Menu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">القائمة الجانبية</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                {totalVisibleSectionsCount}
              </span>
            </button>

            <button
              type="button"
              id="admin-overview-shortcut-btn"
              onClick={() => {
                setActiveAdminTab('overview');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200 hover:border-emerald-200 text-xs font-bold transition-all cursor-pointer min-h-[40px]"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.adminStats || 'الإحصائيات العامة'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 1: Overview */}
      {activeAdminTab === 'overview' && canViewSection('overview') && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold block">{t.totalMembers}</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {members.length}
              </span>
              <span className="text-[11px] text-emerald-600 font-bold mt-1 block">
                {members.filter((m) => m.status === 'active').length} نشط مؤدى
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold block">{t.totalIncomes}</span>
              <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
                +{totalIncomes.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">{t.currencyShort}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold block">{t.totalExpenses}</span>
              <span className="text-2xl font-black text-rose-700 font-mono mt-1 block">
                -{totalExpenses.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">{t.currencyShort}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-semibold block">{t.currentBalance}</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {balance.toLocaleString()}
              </span>
              <span className="text-[11px] text-emerald-700 font-bold">رصيد حي مباشر</span>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              الإجراءات الإدارية المتاحة:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* إضافة أدمن من الدرجة الثانية (Super Admin only & Enabled by Platform Master Admin) */}
              {isSuperAdmin && canViewSection('subAdmins') && (
                <div
                  onClick={() => setActiveAdminTab('subAdmins')}
                  id="admin-action-subadmins-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <UserPlus className="w-6 h-6 text-emerald-700 group-hover:scale-110 transition-transform" />
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800 font-mono font-bold">
                      {subAdmins.length}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">إضافة أدمن من الدرجة الثانية</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    تعيين مسؤولي ومساعدي الإدارة وضبط صلاحيات الوصول لكل قسم ومهمة بدقة
                  </p>
                </div>
              )}

              {/* حملة تبرع */}
              {canViewSection('campaigns') && (
                <div
                  onClick={() => setActiveAdminTab('campaigns')}
                  id="admin-action-campaigns-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <HeartHandshake className="w-6 h-6 text-amber-600 group-hover:scale-110 transition-transform" />
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 font-mono font-bold">
                      {campaigns.length}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">حملة تبرع</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    إنشاء وإدارة حملات التبرع والمشاريع الخيرية، وتتبع التبرعات المجمعة والهدف المالي
                  </p>
                </div>
              )}

              {/* جميع العمليات المالية (مداخيل ومصاريف) */}
              {canViewSection('operations') && (
                <div
                  onClick={() => setActiveAdminTab('operations')}
                  id="admin-action-operations-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-6 h-6 text-emerald-700 group-hover:scale-110 transition-transform" />
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800 font-mono font-bold">
                      {operations.length}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">جميع العمليات المالية (مداخيل ومصاريف)</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    جدول جميع المداخيل والمصاريف، البحث والتصفية، تعديل السجلات وإعادة احتساب الرصيد
                  </p>
                </div>
              )}

              {/* سجل المساهمات والانخراطات */}
              {canViewSection('contributions') && (
                <div
                  onClick={() => setActiveAdminTab('contributions')}
                  id="admin-action-contributions-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Coins className="w-6 h-6 text-emerald-700 group-hover:scale-110 transition-transform" />
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800 font-mono font-bold">
                      {contributions ? contributions.length : 0}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{t.manageContributionsTitle || 'سجل المساهمات والانخراطات'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    سجل مدفوعات الانخراطات والمساهمات السنوية وإصدار الوصولات وإثباتات الأداء
                  </p>
                </div>
              )}

              {/* تحكم في الدخول إلى لوحة التحكم */}
              {canViewSection('accessControl') && (
                <div
                  onClick={() => setActiveAdminTab('accessControl')}
                  id="admin-action-access-control-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <ShieldCheck className="w-6 h-6 text-emerald-700 group-hover:scale-110 transition-transform" />
                    <span className={`w-2.5 h-2.5 rounded-full ${settings.enableTripleClickLogoLogin ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">تحكم في الدخول إلى لوحة التحكم</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    ضبط وتأمين طرق الدخول: إظهار أو إخفاء زر الإدارة، والدخول السري عبر النقر ثلاث مرات على الشعار
                  </p>
                </div>
              )}

              {/* بيانات الجمعية والإعدادات */}
              {canViewSection('settings') && (
                <div
                  onClick={() => setActiveAdminTab('settings')}
                  id="admin-action-settings-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <Settings className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">{t.associationSettings || 'بيانات الجمعية والإعدادات'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    تعديل البيانات الأساسية، الحساب البنكي RIB، رقم الترخيص، أرقام التواصل والعنوان
                  </p>
                </div>
              )}

              {/* تعديل وصل / بطاقة المنخرط */}
              {canViewSection('memberCard') && (
                <div
                  onClick={() => setActiveAdminTab('memberCard')}
                  id="admin-action-member-card-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <CreditCard className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">{t.manageMemberCardTitle || 'تعديل وصل / بطاقة المنخرط'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    تخصيص تصميم وهوية بطاقة الانخراط ووصل المساهمة وتحديد الحقول المطبوعة والباركود
                  </p>
                </div>
              )}

              {/* إدارة حقول تسجيل المنخرطين */}
              {canViewSection('fields') && (
                <div
                  onClick={() => setActiveAdminTab('fields')}
                  id="admin-action-fields-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <SlidersHorizontal className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">{t.manageRegistrationFields || 'إدارة حقول تسجيل المنخرطين'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    إضافة وتعديل وترتيب حقول استمارة المنخرطين وتفعيلها أو تعطيلها
                  </p>
                </div>
              )}

              {/* سجل التدقيق والرقابة الإدارية */}
              {canViewSection('audit') && (
                <div
                  onClick={() => setActiveAdminTab('audit')}
                  id="admin-action-audit-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <History className="w-6 h-6 text-emerald-700 group-hover:scale-110 transition-transform" />
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-200 text-slate-800 font-mono font-bold">
                      {auditLogs.length}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{t.auditTrailTitle || 'سجل التدقيق والرقابة الإدارية'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    تتبع كافة العمليات والتعديلات والإجراءات المتخذة بالمنصة مع هوية المسؤول وتوقيت الإجراء
                  </p>
                </div>
              )}

              {/* النسخ الاحتياطي واسترجاع البيانات */}
              {canViewSection('backup') && (
                <div
                  onClick={() => setActiveAdminTab('backup')}
                  id="admin-action-backup-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <Database className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">{t.backupAndRestore || 'النسخ الاحتياطي واسترجاع البيانات'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    تصدير نسخة احتياطية كاملة بصيغة JSON واسترجاع البيانات أو إعادة ضبط النظام
                  </p>
                </div>
              )}

              {/* قائمة المنخرطين والاشتراكات */}
              {canViewSection('members') && (
                <div
                  onClick={() => setActiveAdminTab('members')}
                  id="admin-action-members-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-6 h-6 text-emerald-700 group-hover:scale-110 transition-transform" />
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800 font-mono font-bold">
                      {members.filter((m) => m.status === 'active').length}/{members.length}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{t.manageMembersListTitle || 'قائمة المنخرطين والاشتراكات'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    عرض وتعديل وتفعيل وإلغاء تفعيل المنخرطين ومتابعة الاشتراكات السنوية
                  </p>
                </div>
              )}

              {/* أعضاء مكتب الجمعية */}
              {canViewSection('boardMembers') && (
                <div
                  onClick={() => setActiveAdminTab('boardMembers')}
                  id="admin-action-board-members-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Award className="w-6 h-6 text-emerald-700 group-hover:scale-110 transition-transform" />
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800 font-mono font-bold">
                      {boardMembers.length}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{t.manageBoardMembersTitle || 'أعضاء مكتب الجمعية'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    تعيين وتوزيع مناصب المكتب المسير وترتيب الهرم القيادي للظهور في واجهة المتجر
                  </p>
                </div>
              )}

              {/* تسجيل منخرط جديد */}
              {hasPermission('members', 'canAdd') && (
                <div
                  onClick={onOpenAddMember}
                  id="admin-action-add-member-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <PlusCircle className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">{t.addMember}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    تسجيل منخرط جديد وتحديد مبلغ الانخراط وتاريخ التجديد
                  </p>
                </div>
              )}

              {/* التصويت والقرارات */}
              {canViewSection('polls') && (
                <div
                  onClick={() => setActiveAdminTab('polls')}
                  id="admin-action-polls-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <Vote className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">{t.polls || 'التصويت والقرارات'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    طرح وتعديل قرارات التصويت، تتبع النتائج، وحصيلة أصوات المنخرطين مع/ضد
                  </p>
                </div>
              )}

              {/* أبرز الأعمال والأنشطة الخيرية */}
              {canViewSection('activities') && (
                <div
                  onClick={() => setActiveAdminTab('activities')}
                  id="admin-action-activities-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <HeartHandshake className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">{t.manageFeaturedActivitiesTitle || 'أبرز الأعمال والأنشطة الخيرية'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    إدارة وتفعيل وتعديل وحذف الأنشطة الخيرية والتحكم في ظهورها للمستخدمين
                  </p>
                </div>
              )}

              {/* شعار التطبيق وغلاف البانر */}
              {canViewSection('branding') && (
                <div
                  onClick={() => setActiveAdminTab('branding')}
                  id="admin-action-branding-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <ImageIcon className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">{t.manageBrandingTitle || 'شعار التطبيق وغلاف البانر'}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    رفع وتغيير شعار الجمعية وصورة غلاف الصفحة الرئيسية مباشرة من الهاتف
                  </p>
                </div>
              )}

              {/* إدارة عناصر الواجهة */}
              {canViewSection('uiElements') && (
                <div
                  onClick={() => setActiveAdminTab('uiElements')}
                  id="admin-action-ui-elements-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <Eye className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">{t.manageUIElements}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    التحكم في إظهار أو إخفاء أقسام وبانرات وأدوات وسجلات الواجهة
                  </p>
                </div>
              )}

              {/* تحكم في ظهور الأقسام للغير المنخرطين */}
              {canViewSection('nonMemberVisibility') && (
                <div
                  onClick={() => setActiveAdminTab('nonMemberVisibility')}
                  id="admin-action-nonmember-vis-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <EyeOff className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">تحكم في ظهور الأقسام للغير المنخرطين</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    تحديد الأقسام المسموح للزوار رؤيتها مع بقاء كافة الأقسام متاحة للمنخرطين
                  </p>
                </div>
              )}

              {/* إنشاء إعلان وترويج الجمعية */}
              {canViewSection('createAd') && (
                <div
                  onClick={() => setActiveAdminTab('createAd')}
                  id="admin-action-create-ad-card"
                  className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/90 to-amber-50/70 hover:from-indigo-100 hover:to-amber-100 border border-indigo-200 hover:border-indigo-400 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Megaphone className="w-6 h-6 text-indigo-700 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                      الصفحة الأولى ⭐
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">إنشاء إعلان وترويج الجمعية</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    سيتم إظهار جمعيتك في الصفحة الأولى بواجهة المنصة في قسم تلقي التبرعات
                  </p>
                </div>
              )}

              {/* اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية */}
              {canViewSection('donationsBenefit') && (
                <div
                  onClick={() => setActiveAdminTab('donationsBenefit')}
                  id="admin-action-donations-benefit-card"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group"
                >
                  <Sparkles className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-slate-900 text-sm">اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    التحكم في ظهور الجمعية بواجهة المنصة واستقبال مساهمات المحسنين والداعمين
                  </p>
                </div>
              )}

              {/* تجديد الاشتراك */}
              {canViewSection('subscriptionRenewal') && (
                <div
                  onClick={() => setActiveAdminTab('subscriptionRenewal')}
                  id="admin-action-renewal-card"
                  className="p-4 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 hover:border-indigo-400 transition-all cursor-pointer group"
                >
                  <RefreshCw className="w-6 h-6 text-indigo-700 mb-2 group-hover:rotate-180 transition-transform duration-500" />
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-indigo-950 text-sm">تجديد الاشتراك</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      tenantSubInfo.status === 'active' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : tenantSubInfo.status === 'expiring_soon'
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {tenantSubInfo.remainingDays > 0 ? `${tenantSubInfo.remainingDays} يوم متبقي` : 'منتهي'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    متابعة مدة الصلاحية، أداء واجب التجديد السنوي، وسجل المعاملات
                  </p>
                </div>
              )}

              {/* تعلم كيفية استخدام المنصة - مباشرة أسفل قسم تجديد الاشتراك */}
              {canViewSection('platformTutorials') && (
                <div
                  onClick={() => setActiveAdminTab('platformTutorials')}
                  id="admin-action-tutorials-card"
                  className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/90 to-blue-50/90 hover:from-indigo-100 hover:to-blue-100 border border-indigo-200 hover:border-indigo-400 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <GraduationCap className="w-6 h-6 text-indigo-700 group-hover:scale-110 transition-transform duration-300" />
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                      فيديوهات وشروحات 🎥
                    </span>
                  </div>
                  <h4 className="font-bold text-indigo-950 text-sm">تعلم كيفية استخدام المنصة</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    دليل شامل وفيديوهات مسجلة لشرح جميع وظائف المنصة خطوة بخطوة وإمكانية إضافة وإدارة الشروحات
                  </p>
                </div>
              )}

              {/* سنقوم بإعداد منصة جمعيتك نيابة عنك */}
              {canViewSection('platformSetupService') && (
                <div
                  onClick={() => setActiveAdminTab('platformSetupService')}
                  id="admin-action-setup-service-card"
                  className="p-4 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/90 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200 hover:border-emerald-400 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Sparkles className="w-6 h-6 text-emerald-700 group-hover:scale-110 transition-transform duration-300" />
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      خدمة الإعداد المتكامل ✨
                    </span>
                  </div>
                  <h4 className="font-bold text-emerald-950 text-sm">سنقوم بإعداد منصة جمعيتك نيابة عنك</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    سنتولى إعداد وتجهيز واجهة منصة جمعيتك بعناية واحترافية، مع إدخال جميع معلوماتها وبياناتها الأساسية لتكون جاهزة للانطلاق
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Create Ad (إنشاء إعلان) */}
      {activeAdminTab === 'createAd' && canViewSection('createAd') && (
        <CreateAdSection
          tenant={currentTenant}
          onRefreshTenant={() => {
            // Can reload or trigger tenant updates
          }}
          onNavigateToPublicDonations={() => {
            if (canViewSection('donationsBenefit')) {
              setActiveAdminTab('donationsBenefit');
            }
          }}
        />
      )}

      {/* Tab: Donations Benefit (الاستفادة من التبرعات) */}
      {activeAdminTab === 'donationsBenefit' && canViewSection('donationsBenefit') && (
        <ManageDonationsBenefit
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          activeTenantId={activeTenantId}
          addToast={addToast}
          lang={lang}
          onLogAudit={onLogAudit}
          currentAdminSession={currentAdminSession}
        />
      )}

      {/* Tab: Subscription Renewal (تجديد الاشتراك) */}
      {activeAdminTab === 'subscriptionRenewal' && canViewSection('subscriptionRenewal') && (
        <SubscriptionRenewalSection
          tenant={currentTenant}
          lang={lang}
          addToast={addToast}
        />
      )}

      {/* Tab: Platform Tutorials (تعلم كيفية استخدام المنصة) - مباشرة أسفل قسم تجديد الاشتراك */}
      {activeAdminTab === 'platformTutorials' && canViewSection('platformTutorials') && (
        <PlatformTutorialsSection
          activeTenantId={activeTenantId}
          tenant={currentTenant}
          lang={lang}
          addToast={addToast}
          isSuperAdmin={isSuperAdmin || currentAdminSession?.isMasterPlatformAdmin === true}
          isMasterPlatformAdmin={currentAdminSession?.isMasterPlatformAdmin === true}
          currentAdminSession={currentAdminSession}
        />
      )}

      {/* Tab: Platform Setup Service (سنقوم بإعداد منصة جمعيتك نيابة عنك) */}
      {activeAdminTab === 'platformSetupService' && canViewSection('platformSetupService') && (
        <PlatformSetupServiceSection
          tenant={currentTenant}
          adminSession={currentAdminSession}
          isMasterAdminView={currentAdminSession?.isMasterPlatformAdmin === true}
          onSaveSuccess={() => {
            if (addToast) addToast('success', 'تم حفظ التعديلات بنجاح');
          }}
        />
      )}

      {/* Tab: Operations Management (جميع العمليات المالية والمداخيل والمصاريف) */}
      {activeAdminTab === 'operations' && canViewSection('operations') && (
        <ManageOperations
          operations={operations}
          members={members}
          currentAdminSession={currentAdminSession || null}
          subAdmins={subAdmins}
          canView={hasPermission('operations', 'canView')}
          canAdd={hasPermission('operations', 'canAdd')}
          canEdit={hasPermission('operations', 'canEdit')}
          canDelete={hasPermission('operations', 'canDelete')}
          onOpenAddOperation={onOpenAddOperation}
          onSaveOperation={onSaveOperation || (async () => {})}
          onDeleteOperation={onDeleteOperation || (() => {})}
          totalIncomes={totalIncomes}
          totalExpenses={totalExpenses}
          currentBalance={balance}
          lang={lang}
        />
      )}

      {/* Tab: Campaigns Management (حملة تبرع) */}
      {activeAdminTab === 'campaigns' && canViewSection('campaigns') && (
        <CampaignsAdminManager
          campaigns={campaigns}
          contributions={campaignContributions}
          contributionTypes={contributionTypes}
          currentSession={currentAdminSession || null}
          settings={settings}
          canAdd={hasPermission('campaigns', 'canAdd')}
          canEdit={hasPermission('campaigns', 'canEdit')}
          canDelete={hasPermission('campaigns', 'canDelete')}
          onCampaignsUpdated={onUpdateCampaigns || (() => {})}
          onContributionsUpdated={onUpdateCampaignContributions || (() => {})}
          onContributionTypesUpdated={onUpdateContributionTypes || (() => {})}
          addToast={addToast || ((_, msg) => alert(msg))}
        />
      )}

      {/* Tab: Manage Members & Subscriptions (قائمة المنخرطين والاشتراكات) */}
      {activeAdminTab === 'members' && canViewSection('members') && (
        <ManageMembersList
          members={members}
          operations={operations}
          contributions={contributions || []}
          registrationFields={registrationFields}
          lang={lang}
          canAdd={hasPermission('members', 'canAdd')}
          canEdit={hasPermission('members', 'canEdit')}
          canDelete={hasPermission('members', 'canDelete')}
          onOpenAddMember={() => {
            if (!hasPermission('members', 'canAdd')) return;
            onOpenAddMember();
          }}
          onEditMember={(member) => {
            if (!hasPermission('members', 'canEdit')) return;
            if (onEditMember) {
              onEditMember(member);
            }
          }}
          onDeleteMember={(id) => {
            if (!hasPermission('members', 'canDelete')) return;
            if (onDeleteMember) {
              onDeleteMember(id);
            }
          }}
          onToggleMemberStatus={(id, targetStatus) => {
            if (!hasPermission('members', 'canEdit')) return;
            if (onToggleMemberStatus) {
              onToggleMemberStatus(id, targetStatus);
            }
          }}
          onPrintMemberCard={(member) => {
            if (onPrintMemberCard) {
              onPrintMemberCard(member);
            }
          }}
          onLogAudit={onLogAudit}
        />
      )}

      {/* Tab: Manage Board Members (أعضاء مكتب الجمعية) */}
      {activeAdminTab === 'boardMembers' && canViewSection('boardMembers') && (
        <ManageBoardMembers
          boardMembers={boardMembers}
          members={members}
          onUpdateBoardMembers={(updated) => {
            if (onUpdateBoardMembers) {
              onUpdateBoardMembers(updated);
            }
          }}
          lang={lang}
          onLogAudit={onLogAudit}
          canAdd={hasPermission('boardMembers', 'canAdd')}
          canEdit={hasPermission('boardMembers', 'canEdit')}
          canDelete={hasPermission('boardMembers', 'canDelete')}
        />
      )}

      {/* Tab: Manage Contributions & Subscriptions Ledger */}
      {activeAdminTab === 'contributions' && canViewSection('contributions') && (
        <ManageContributions
          contributions={contributions || []}
          members={members || []}
          operations={operations || []}
          lang={lang}
          canAdd={hasPermission('contributions', 'canAdd')}
          canEdit={hasPermission('contributions', 'canEdit')}
          canDelete={hasPermission('contributions', 'canDelete')}
          onAddContribution={(contribution) => {
            if (!hasPermission('contributions', 'canAdd')) return;
            if (onAddContribution) {
              onAddContribution(contribution);
            }
          }}
          onUpdateContributionStatus={(id, status) => {
            if (!hasPermission('contributions', 'canEdit')) return;
            if (onUpdateContributionStatus) {
              onUpdateContributionStatus(id, status);
            }
          }}
          onDeleteContribution={(id) => {
            if (!hasPermission('contributions', 'canDelete')) return;
            if (onDeleteContribution) {
              onDeleteContribution(id);
            }
          }}
          onPrintReceipt={(contribution) => {
            if (onPrintContributionReceipt) {
              onPrintContributionReceipt(contribution);
            } else if (onPrintMemberCard) {
              const targetMember = members.find(m => m.id === contribution.memberId);
              if (targetMember) onPrintMemberCard(targetMember);
            }
          }}
        />
      )}

      {/* Tab: Manage Featured Activities (أبرز الأعمال والأنشطة الخيرية المنجزة) */}
      {activeAdminTab === 'activities' && canViewSection('activities') && (
        <ManageActivities
          activities={activities}
          settings={settings}
          featuredActivityId={settings.featuredActivityId}
          canAdd={hasPermission('activities', 'canAdd')}
          canEdit={hasPermission('activities', 'canEdit')}
          canDelete={hasPermission('activities', 'canDelete')}
          isMasterTemplate={isMasterTemplate}
          onPublishReferenceActivities={onPublishReferenceActivities}
          onSyncReferenceActivities={onSyncReferenceActivities}
          onSetFeaturedActivity={(activityId) => {
            if (!hasPermission('activities', 'canEdit')) return;
            const updatedSettings = {
              ...settings,
              featuredActivityId: activityId || undefined,
            };
            onUpdateSettings(updatedSettings);
            if (onLogAudit) {
              const act = activities.find(a => a.id === activityId);
              onLogAudit(
                'update',
                activityId
                  ? `تحديد النشاط «${act?.title || activityId}» ليكون النشاط المعروض في واجهة المتجر الرئيسية`
                  : 'إلغاء تعيين النشاط المعروض في واجهة المتجر الرئيسية'
              );
            }
          }}
          onUpdateSettings={onUpdateSettings}
          onLogAudit={onLogAudit}
          onOpenAddActivity={() => {
            if (!hasPermission('activities', 'canAdd')) return;
            onOpenAddActivity();
          }}
          onEditActivity={(act) => {
            if (!hasPermission('activities', 'canEdit')) return;
            onEditActivity(act);
          }}
          onDeleteActivity={(id) => {
            if (!hasPermission('activities', 'canDelete')) return;
            return onDeleteActivity(id);
          }}
          onToggleActivityStatus={(id) => {
            if (!hasPermission('activities', 'canEdit')) return;
            onToggleActivityStatus(id);
          }}
          onAddGalleryImages={onAddGalleryImages}
          onDeleteGalleryImage={onDeleteGalleryImage}
          onDeleteAllGalleryImages={onDeleteAllGalleryImages}
          activeTenantId={activeTenantId}
          onOpenMediaModal={onOpenMediaModal}
          lang={lang}
        />
      )}

      {/* Tab: Manage App Branding & Banner (إدارة شعار التطبيق وصورة غلاف البانر الرئيسية) */}
      {activeAdminTab === 'branding' && canViewSection('branding') && (
        <ManageBranding
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          lang={lang}
          onLogAudit={onLogAudit}
          onOpenMediaModal={onOpenMediaModal}
        />
      )}

      {/* Tab: Manage Member Card & Receipt Customizer */}
      {activeAdminTab === 'memberCard' && canViewSection('memberCard') && (
        <ManageMemberCard
          cardSettings={memberCardSettings || initialMemberCardSettings}
          onUpdateCardSettings={onUpdateMemberCardSettings}
          members={members || []}
          contributions={contributions || []}
          associationSettings={settings}
          registrationFields={registrationFields || []}
          lang={lang}
          onLogAudit={onLogAudit}
        />
      )}

      {/* Tab: Manage Polls & Resolutions */}
      {activeAdminTab === 'polls' && canViewSection('polls') && (
        <ManagePolls
          polls={polls}
          members={members}
          onUpdatePolls={onUpdatePolls}
          lang={lang}
          onAddAuditLog={onLogAudit}
          currentSession={currentAdminSession || null}
          addToast={addToast}
          canAdd={hasPermission('polls', 'canAdd')}
          canEdit={hasPermission('polls', 'canEdit')}
          canDelete={hasPermission('polls', 'canDelete')}
        />
      )}

      {/* Tab: Manage App UI Elements */}
      {activeAdminTab === 'uiElements' && canViewSection('uiElements') && (
        <ManageUIElements
          elements={uiElements}
          onUpdateElements={onUpdateUIElements}
          lang={lang}
          onLogAudit={onLogAudit}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          activeTenantId={activeTenantId}
          addToast={addToast}
        />
      )}

      {/* Tab: Control Non-Member Visibility (تحكم في ظهور الأقسام للغير المنخرطين) */}
      {activeAdminTab === 'nonMemberVisibility' && canViewSection('nonMemberVisibility') && (
        <ManageNonMemberVisibility
          elements={uiElements}
          onUpdateElements={onUpdateUIElements}
          currentSession={currentAdminSession || null}
          addToast={addToast || ((type, msg) => alert(msg))}
        />
      )}

      {/* Tab: Manage Registration Fields */}
      {activeAdminTab === 'fields' && canViewSection('fields') && (
        <ManageRegistrationFields
          fields={registrationFields}
          onUpdateFields={onUpdateRegistrationFields}
          lang={lang}
          onLogAudit={onLogAudit}
          canAdd={hasPermission('fields', 'canAdd')}
          canEdit={hasPermission('fields', 'canEdit')}
          canDelete={hasPermission('fields', 'canDelete')}
        />
      )}

      {/* Tab: Control Admin Access (تحكم في الدخول إلى لوحة التحكم) */}
      {activeAdminTab === 'accessControl' && canViewSection('accessControl') && (
        <ManageAccessControl
          settings={settings}
          onUpdateSettings={(newSettings) => {
            onUpdateSettings(newSettings);
            setFormData({ ...formData, ...newSettings });
          }}
          onLogAudit={(action, targetType, description) => {
            onLogAudit(action, description);
          }}
          currentAdminSession={currentAdminSession}
        />
      )}

      {/* Tab: Association Settings */}
      {activeAdminTab === 'settings' && canViewSection('settings') && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          {/* Quick Access to Access Control */}
          {canViewSection('accessControl') && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <strong className="text-xs sm:text-sm font-bold text-slate-900 block">
                    تحكم في الدخول إلى لوحة التحكم (إخفاء الزر / الدخول عبر الشعار 3 مرات)
                  </strong>
                  <p className="text-[11px] text-slate-600">
                    الحالة الحالية: {settings.showAdminLoginButton ? 'زر الإدارة ظاهر للعموم' : 'زر الإدارة مخفي عن العموم'} • {settings.enableTripleClickLogoLogin ? 'الدخول عبر الشعار 3 مرات مفعل' : 'الدخول عبر الشعار معطل'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveAdminTab('accessControl')}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shrink-0"
              >
                ضبط طرق الدخول
              </button>
            </div>
          )}

          <form onSubmit={handleSettingsSubmit} className="space-y-4 max-w-3xl">
            <h3 className="font-bold text-base text-slate-900 mb-2">
              {`بيانات وهوية ${settings.name || 'الجمعية'}`}
            </h3>

            {savedSuccess && (
              <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                {t.successSaved}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الجمعية بالعربية</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الجمعية بالفرنسية</label>
                <input
                  type="text"
                  value={formData.nameFr}
                  onChange={(e) => setFormData({ ...formData, nameFr: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">شعار وأهداف الجمعية</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.ribBank}</label>
                <input
                  type="text"
                  required
                  value={formData.ribBank}
                  onChange={(e) => setFormData({ ...formData, ribBank: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.bankName}</label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الترخيص</label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.phone}</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0661000001"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:bg-white outline-hidden"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="admin-settings-whatsapp-input" className="block text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <WhatsAppIcon className="w-3.5 h-3.5 fill-[#25D366]" />
                    <span>رقم واتساب الجمعية</span>
                  </label>
                  {formData.whatsapp && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      validateWhatsAppPhone(formData.whatsapp).valid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {validateWhatsAppPhone(formData.whatsapp).valid ? '✓ رقم صحيح' : 'تنسيق غير مكتمل'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  id="admin-settings-whatsapp-input"
                  value={formData.whatsapp || ''}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="0661000001 أو 002126..."
                  className="w-full bg-slate-50 border border-emerald-300 rounded-xl p-2.5 text-xs sm:text-sm font-mono font-bold text-emerald-900 focus:border-emerald-600 focus:bg-white outline-hidden"
                  dir="ltr"
                />
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">يدعم أرقام المغرب (+212 / 06 / 07 / 05) والدولية</span>
                  {formData.whatsapp && validateWhatsAppPhone(formData.whatsapp).valid && (
                    <a
                      href={buildWhatsAppChatUrl(formData.whatsapp, `السلام عليكم، تجربة تواصل مع ${formData.name || 'الجمعية'}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline inline-flex items-center gap-1"
                      title="تجربة فتح محادثة واتساب للتأكد من صحة الرقم"
                    >
                      <span>تجربة الرابط</span>
                      <span>↗</span>
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الرمز السري للإدارة (PIN)</label>
                <input
                  type="text"
                  value={formData.adminPin}
                  onChange={(e) => setFormData({ ...formData, adminPin: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-mono font-bold focus:border-emerald-600 focus:bg-white outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.address}</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
              />
            </div>

            {/* Quick banner link to branding images */}
            {canViewSection('branding') && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900">{t.manageBrandingTitle || 'شعار التطبيق وصورة الغلاف'}</h4>
                    <p className="text-[11px] text-slate-500">رفع وإدارة الهوية البصرية وشعار الجمعية وصورة الغلاف مباشرة من الهاتف</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAdminTab('branding')}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs whitespace-nowrap transition-colors"
                >
                  فتح قسم إدارة الصور
                </button>
              </div>
            )}

            <div className="pt-3">
              <button
                type="submit"
                id="admin-settings-save-btn"
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Audit Trail (سجل الرقابة والتدقيق) */}
      {activeAdminTab === 'audit' && canViewSection('audit') && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900">{t.auditTrailTitle}</h3>
              <p className="text-xs text-slate-500">{t.auditTrailDesc}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start rtl:text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t.timestamp}</th>
                  <th className="p-3">{t.action}</th>
                  <th className="p-3">البيان والتفاصيل</th>
                  <th className="p-3">{t.user}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500 font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('ar-MA')}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-800">{log.description}</td>
                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">
                      {log.performedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Backup & Restore */}
      {activeAdminTab === 'backup' && canViewSection('backup') && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="font-bold text-base text-slate-900">{t.backupAndRestore}</h3>
            <p className="text-xs text-slate-500">
              حفظ نسخة احتياطية كاملة من قاعدة بيانات المنخرطين والعمليات المالية والأنشطة لضمان عدم ضياعها.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Export JSON */}
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col justify-between space-y-3">
              <div>
                <Download className="w-6 h-6 text-emerald-700 mb-2" />
                <h4 className="font-bold text-slate-900 text-sm">{t.exportBackup}</h4>
                <p className="text-xs text-slate-600 mt-1">
                  تنزيل ملف JSON يحتوي على كامل المنخرطين والعمليات المالية والصور وسجل التدقيق.
                </p>
              </div>
              <button
                onClick={onExportBackup}
                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-xs"
              >
                تنزيل النسخة الاحتياطية
              </button>
            </div>

            {/* Import JSON */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
              <div>
                <Upload className="w-6 h-6 text-slate-700 mb-2" />
                <h4 className="font-bold text-slate-900 text-sm">{t.importBackup}</h4>
                <p className="text-xs text-slate-600 mt-1">
                  رفع ملف JSON تم تصديره سابقًا لاسترجاع البيانات فورًا.
                </p>
              </div>
              <label className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors shadow-xs text-center cursor-pointer block">
                <span>اختيار ملف واستيراده</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Reset Factory Defaults */}
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col justify-between space-y-3">
              <div>
                <RotateCcw className="w-6 h-6 text-amber-700 mb-2" />
                <h4 className="font-bold text-slate-900 text-sm">{t.resetDefaults}</h4>
                <p className="text-xs text-slate-600 mt-1">
                  استعادة البيانات النموذجية الأولية للجمعية (الاشتراكات والمصاريف).
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('هل أنت متأكد من استعادة البيانات النموذجية الأولية؟')) {
                    onResetDefaults();
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                استعادة النموذج الأولي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Sub-Admins Management (Exclusive to Super Admin & Globally Enabled) */}
      {activeAdminTab === 'subAdmins' && isSuperAdmin && canViewSection('subAdmins') && (
        <ManageSubAdmins
          subAdmins={subAdmins}
          onUpdateSubAdmins={onUpdateSubAdmins || (() => {})}
          auditLogs={auditLogs}
          onLogAudit={(action, targetType, desc, performedBy, admType, admPhone) => {
            onLogAudit(action, desc);
          }}
          currentAdminSession={currentAdminSession}
          addToast={addToast}
          lang={lang}
        />
      )}

      {/* Access Denied Guard if a section is disabled globally by Master Admin, or access is restricted */}
      {(!canViewSection(activeAdminTab as any) || (activeAdminTab === 'subAdmins' && !isSuperAdmin)) && (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-xs text-center space-y-3">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {!isSectionGloballyEnabled(activeAdminTab)
              ? 'هذا القسم معطل حالياً من طرف الإدارة العامة'
              : 'غير مصرح لك بالوصول إلى هذا القسم'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {!isSectionGloballyEnabled(activeAdminTab)
              ? 'تم إخفاء هذا القسم مركزياً لجميع الجمعيات عبر لوحة الإدارة العامة للمنصة، وبياناته محفوظة بالكامل.'
              : 'حسابك كأدمن من الدرجة الثانية لا يملك صلاحية عرض هذا القسم. تم ضبط صلاحياتك من طرف الأدمن الرئيسي.'}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setActiveAdminTab('overview');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[44px]"
            >
              <BackArrow className="w-4 h-4 transition-transform group-hover:-translate-x-1 rtl:group-hover:translate-x-1" />
              <span>{t.backToAdminDashboard || 'الرجوع إلى لوحة التحكم الإدارية'}</span>
            </button>
          </div>
        </div>
      )}
      {/* Fixed bottom footer button for contacting platform administration across all tabs */}
      <div className="pt-4 mt-8 border-t border-slate-200/80">
        <ContactPlatformAdminButton
          tenantName={currentTenant?.name || settings.name}
          variant="banner"
        />
      </div>
    </div>
  );
};
