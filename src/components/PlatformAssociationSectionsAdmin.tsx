import React, { useState, useMemo, useEffect } from 'react';
import { 
  Layers, 
  TrendingUp, 
  Coins, 
  HeartHandshake, 
  Heart, 
  Users, 
  Award, 
  SlidersHorizontal, 
  ImageIcon, 
  CreditCard, 
  Eye, 
  EyeOff, 
  Megaphone, 
  Vote, 
  ShieldCheck, 
  Settings, 
  UserPlus, 
  History, 
  Database, 
  RefreshCw, 
  LayoutDashboard,
  Search,
  CheckCircle2,
  XCircle,
  Save,
  RotateCcw,
  Sliders,
  Sparkles,
  Info,
  Check,
  Filter,
  ArrowRight,
  Shield,
  Building2,
  Lock,
  GraduationCap,
  PlayCircle,
  Video,
  Edit3
} from 'lucide-react';
import { 
  AdminSectionKey, 
  AssociationSectionCategory, 
  AssociationSectionDefinition, 
  AssociationSectionsConfig, 
  AssociationSectionsVisibilityMap,
  MemberRegistrationField
} from '../types';
import { 
  ALL_ASSOCIATION_SECTIONS, 
  getAssociationSectionsConfig, 
  saveAssociationSectionsConfig, 
  resetAssociationSectionsConfig,
  syncAssociationSectionsFromServer,
  ASSOCIATION_SECTIONS_CHANGED_EVENT
} from '../associationSectionsStorage';
import {
  getGlobalRegistrationFields,
  saveGlobalRegistrationFieldsForAllTenants,
  syncTenantRecordsFromBackend,
  addAuditLog,
  GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT,
} from '../storage';
import { PlatformTutorialsSection } from './PlatformTutorialsSection';
import { PlatformSetupServiceSection } from './PlatformSetupServiceSection';
import { ManageRegistrationFields } from './ManageRegistrationFields';
import { ManageDonationsBenefit } from './ManageDonationsBenefit';

interface PlatformAssociationSectionsAdminProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
  adminName?: string;
  onBackToAssociations?: () => void;
  isSuperAdmin?: boolean;
  currentAdminSession?: any;
}

// Icon mapper for dynamic section rendering
const getSectionIcon = (iconName: string, className: string = 'w-5 h-5') => {
  switch (iconName) {
    case 'LayoutDashboard':
      return <LayoutDashboard className={className} />;
    case 'TrendingUp':
      return <TrendingUp className={className} />;
    case 'Coins':
      return <Coins className={className} />;
    case 'HeartHandshake':
      return <HeartHandshake className={className} />;
    case 'Heart':
      return <Heart className={className} />;
    case 'Users':
      return <Users className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'SlidersHorizontal':
      return <SlidersHorizontal className={className} />;
    case 'ImageIcon':
      return <ImageIcon className={className} />;
    case 'CreditCard':
      return <CreditCard className={className} />;
    case 'Eye':
      return <Eye className={className} />;
    case 'EyeOff':
      return <EyeOff className={className} />;
    case 'Megaphone':
      return <Megaphone className={className} />;
    case 'Vote':
      return <Vote className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'Settings':
      return <Settings className={className} />;
    case 'UserPlus':
      return <UserPlus className={className} />;
    case 'History':
      return <History className={className} />;
    case 'Database':
      return <Database className={className} />;
    case 'RefreshCw':
      return <RefreshCw className={className} />;
    case 'GraduationCap':
      return <GraduationCap className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    default:
      return <Layers className={className} />;
  }
};

// Category styling helpers
const getCategoryBadge = (category: AssociationSectionCategory) => {
  switch (category) {
    case 'financial':
      return {
        label: 'المالية والمحاسبة',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconBg: 'bg-emerald-100 text-emerald-700',
      };
    case 'activities':
      return {
        label: 'الأنشطة والمشاريع',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        iconBg: 'bg-rose-100 text-rose-700',
      };
    case 'members':
      return {
        label: 'المنخرطون والمكتب',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        iconBg: 'bg-blue-100 text-blue-700',
      };
    case 'branding':
      return {
        label: 'الهوية والتخصيص',
        bg: 'bg-purple-50 text-purple-700 border-purple-200',
        iconBg: 'bg-purple-100 text-purple-700',
      };
    case 'marketing':
      return {
        label: 'التسويق والإعلام',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        iconBg: 'bg-amber-100 text-amber-700',
      };
    case 'governance':
      return {
        label: 'الحكامة والقرارات',
        bg: 'bg-teal-50 text-teal-700 border-teal-200',
        iconBg: 'bg-teal-100 text-teal-700',
      };
    case 'security':
      return {
        label: 'الأمان والإدارة',
        bg: 'bg-slate-100 text-slate-800 border-slate-300',
        iconBg: 'bg-slate-200 text-slate-800',
      };
    case 'overview':
    default:
      return {
        label: 'الإحصائيات والتقارير',
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        iconBg: 'bg-indigo-100 text-indigo-700',
      };
  }
};

export const PlatformAssociationSectionsAdmin: React.FC<PlatformAssociationSectionsAdminProps> = ({
  onShowToast,
  adminName = 'الإدارة العامة للمنصة',
  onBackToAssociations,
  isSuperAdmin = true,
  currentAdminSession,
}) => {
  // Load initial settings
  const initialConfig = useMemo(() => getAssociationSectionsConfig(), []);
  const [config, setConfig] = useState<AssociationSectionsConfig>(initialConfig);
  const [visibilityMap, setVisibilityMap] = useState<AssociationSectionsVisibilityMap>(
    initialConfig.sectionsVisibility
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [activeSubSectionView, setActiveSubSectionView] = useState<
    'platformTutorials' | 'platformSetupService' | 'registrationFields' | 'donationsBenefit' | null
  >(null);
  const [globalRegistrationFields, setGlobalRegistrationFields] = useState<MemberRegistrationField[]>(() =>
    getGlobalRegistrationFields()
  );

  useEffect(() => {
    let isMounted = true;
    syncAssociationSectionsFromServer(true)
      .then((fresh) => {
        if (isMounted && fresh && fresh.sectionsVisibility) {
          setConfig(fresh);
          setVisibilityMap(fresh.sectionsVisibility);
        }
      })
      .catch(() => {});

    const handleSectionsChanged = (e: any) => {
      if (!isMounted) return;
      const updated = e?.detail || getAssociationSectionsConfig();
      if (updated && updated.sectionsVisibility) {
        setConfig(updated);
        setVisibilityMap(updated.sectionsVisibility);
      }
    };

    window.addEventListener(ASSOCIATION_SECTIONS_CHANGED_EVENT, handleSectionsChanged);
    window.addEventListener('storage', handleSectionsChanged);
    return () => {
      isMounted = false;
      window.removeEventListener(ASSOCIATION_SECTIONS_CHANGED_EVENT, handleSectionsChanged);
      window.removeEventListener('storage', handleSectionsChanged);
    };
  }, []);

  useEffect(() => {
    syncTenantRecordsFromBackend('tenant_nour')
      .then((res) => {
        if (res?.registrationFields && Array.isArray(res.registrationFields) && res.registrationFields.length > 0) {
          setGlobalRegistrationFields(res.registrationFields);
        }
      })
      .catch(() => {});

    const handleFieldsUpdated = (e: any) => {
      if (e?.detail?.fields && Array.isArray(e.detail.fields)) {
        setGlobalRegistrationFields(e.detail.fields);
      } else {
        setGlobalRegistrationFields(getGlobalRegistrationFields());
      }
    };
    window.addEventListener(GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT, handleFieldsUpdated);
    return () => {
      window.removeEventListener(GLOBAL_REGISTRATION_FIELDS_UPDATED_EVENT, handleFieldsUpdated);
    };
  }, []);

  const handleUpdateGlobalRegistrationFields = (updatedFields: MemberRegistrationField[]) => {
    if (!isSuperAdmin) {
      onShowToast('صلاحية تعديل إعدادات هذا القسم متاحة حصريًا للمدير العام للمنصة.', 'error');
      return;
    }
    setGlobalRegistrationFields(updatedFields);
    saveGlobalRegistrationFieldsForAllTenants(updatedFields)
      .then((ok) => {
        if (ok) {
          onShowToast('تم حفظ تعديلات حقول تسجيل المنخرطين في قاعدة بيانات Firebase وتعميمها على جميع الجمعيات بنجاح', 'success');
        }
      })
      .catch(() => {});
  };

  // Search and Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Toggle single section with instant persistence to DB and live event broadcast
  const handleToggleSection = async (key: AdminSectionKey) => {
    const currentVal = visibilityMap[key] !== false;
    const nextVal = !currentVal;
    const updatedMap: AssociationSectionsVisibilityMap = {
      ...visibilityMap,
      [key]: nextVal,
    };
    setVisibilityMap(updatedMap);
    const updatedConfig: AssociationSectionsConfig = {
      ...config,
      sectionsVisibility: updatedMap,
    };
    setConfig(updatedConfig);
    setHasUnsavedChanges(false);

    try {
      await saveAssociationSectionsConfig(updatedConfig, adminName);
      const sectionName = ALL_ASSOCIATION_SECTIONS.find((s) => s.key === key)?.nameAr || key;
      if (nextVal) {
        onShowToast(`تم تفعيل وإظهار قسم «${sectionName}» في لوحات تحكم جميع الجمعيات فوراً`, 'success');
      } else {
        onShowToast(`تم تعطيل وإخفاء قسم «${sectionName}» من لوحات تحكم جميع الجمعيات فوراً`, 'info');
      }
    } catch {
      onShowToast('تم الحفظ محلياً وجارٍ المزامنة الدائمة مع قاعدة البيانات السحابية', 'info');
    }
  };

  // Bulk: Enable All
  const handleEnableAll = async () => {
    const updated: AssociationSectionsVisibilityMap = { ...visibilityMap };
    ALL_ASSOCIATION_SECTIONS.forEach((s) => {
      updated[s.key] = true;
    });
    setVisibilityMap(updated);
    const updatedConfig: AssociationSectionsConfig = {
      ...config,
      sectionsVisibility: updated,
    };
    setConfig(updatedConfig);
    setHasUnsavedChanges(false);
    await saveAssociationSectionsConfig(updatedConfig, adminName);
    onShowToast('تم تفعيل جميع أقسام لوحات التحكم وتطبيقها فوراً على جميع الجمعيات.', 'success');
  };

  // Bulk: Disable Optional (keeps only isCore = true)
  const handleDisableOptional = async () => {
    const updated: AssociationSectionsVisibilityMap = { ...visibilityMap };
    ALL_ASSOCIATION_SECTIONS.forEach((s) => {
      if (!s.isCore) {
        updated[s.key] = false;
      }
    });
    setVisibilityMap(updated);
    const updatedConfig: AssociationSectionsConfig = {
      ...config,
      sectionsVisibility: updated,
    };
    setConfig(updatedConfig);
    setHasUnsavedChanges(false);
    await saveAssociationSectionsConfig(updatedConfig, adminName);
    onShowToast('تم تعطيل الأقسام الاختيارية وتطبيقها فوراً على جميع الجمعيات.', 'info');
  };

  // Reset to Defaults (all enabled)
  const handleResetDefaults = async () => {
    if (window.confirm('هل أنت متأكد من رغبتك في استعادة الضبط الافتراضي وإعادة إظهار جميع الأقسام؟')) {
      const resetRes = await resetAssociationSectionsConfig(adminName);
      setConfig(resetRes);
      setVisibilityMap(resetRes.sectionsVisibility);
      setHasUnsavedChanges(false);
      setSaveSuccessMessage('تمت استعادة الضبط الافتراضي لجميع أقسام الجمعيات بنجاح!');
      onShowToast('تمت استعادة الضبط الافتراضي لجميع الأقسام بنجاح!', 'success');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    }
  };

  // Save All Changes
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const newConfig: AssociationSectionsConfig = {
        ...config,
        sectionsVisibility: visibilityMap,
      };
      await saveAssociationSectionsConfig(newConfig, adminName);
      setConfig(newConfig);
      setHasUnsavedChanges(false);
      setSaveSuccessMessage('تم حفظ كافة إعدادات ظهور أقسام لوحات تحكم الجمعيات وتطبيقها بنجاح!');
      onShowToast('تم حفظ التعديلات وتطبيقها فورياً على جميع الجمعيات بنجاح!', 'success');
      setTimeout(() => {
        setSaveSuccessMessage(null);
      }, 4000);
    } catch {
      onShowToast('حدث خطأ أثناء حفظ الإعدادات، يرجى المحاولة ثانية', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate dynamic stats
  const totalCount = ALL_ASSOCIATION_SECTIONS.length;
  const enabledCount = ALL_ASSOCIATION_SECTIONS.filter((s) => visibilityMap[s.key] !== false).length;
  const disabledCount = totalCount - enabledCount;
  const percentageEnabled = Math.round((enabledCount / totalCount) * 100);

  // Filtered sections list
  const filteredSections = useMemo(() => {
    return ALL_ASSOCIATION_SECTIONS.filter((item) => {
      // Search match
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        item.nameAr.toLowerCase().includes(q) ||
        (item.nameFr && item.nameFr.toLowerCase().includes(q)) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(q)) ||
        item.descriptionAr.toLowerCase().includes(q) ||
        item.categoryLabelAr.toLowerCase().includes(q);

      // Status match
      const isEnabled = visibilityMap[item.key] !== false;
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'enabled' && isEnabled) ||
        (statusFilter === 'disabled' && !isEnabled);

      // Category match
      const matchesCategory = 
        categoryFilter === 'all' || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [searchQuery, statusFilter, categoryFilter, visibilityMap]);

  if (activeSubSectionView === 'platformTutorials') {
    return (
      <div className="space-y-6 animate-fade-in text-slate-800" dir="rtl">
        {/* Navigation Bar inside Association Sections */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="back-to-sections-list-btn"
              onClick={() => setActiveSubSectionView(null)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-all flex items-center gap-2 text-xs sm:text-sm font-bold cursor-pointer border border-slate-200 hover:border-indigo-200 shadow-xs"
            >
              <ArrowRight className="w-4 h-4 text-indigo-600" />
              <span>العودة لقائمة أقسام الجمعيات</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">الإدارة العامة للمنصة</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 font-semibold">أقسام الجمعيات</span>
              <span className="text-slate-300">/</span>
              <span className="text-indigo-700 font-bold flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>تعلم كيفية استخدام المنصة</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>صلاحية حصرية: الأدمن الرئيسي للمنصة</span>
            </span>

            <button
              type="button"
              id="top-nav-save-tutorials-modifications-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('trigger-save-all-tutorials'))}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </div>

        {/* Embedded Platform Tutorials Section */}
        <PlatformTutorialsSection
          activeTenantId="tenant_nour"
          customTitle="تعلم كيفية استخدام المنصة"
          lang="ar"
          addToast={(type, message) => onShowToast(message, type === 'warning' ? 'info' : type)}
          isSuperAdmin={true}
          isMasterPlatformAdmin={true}
          currentAdminSession={currentAdminSession}
        />
      </div>
    );
  }

  if (activeSubSectionView === 'platformSetupService') {
    return (
      <div className="space-y-6 animate-fade-in text-slate-800" dir="rtl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="back-to-sections-list-from-setup-btn"
              onClick={() => setActiveSubSectionView(null)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-all flex items-center gap-2 text-xs sm:text-sm font-bold cursor-pointer border border-slate-200 hover:border-emerald-200 shadow-xs"
            >
              <ArrowRight className="w-4 h-4 text-emerald-600" />
              <span>العودة لقائمة أقسام الجمعيات</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">الإدارة العامة للمنصة</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 font-semibold">أقسام الجمعيات</span>
              <span className="text-slate-300">/</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>سنقوم بإعداد منصة جمعيتك نيابة عنك</span>
              </span>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>إدارة القسم وتخصيص السعر والمحتوى والطلبات</span>
          </span>
        </div>

        <PlatformSetupServiceSection
          isMasterAdminView={true}
          adminSession={currentAdminSession}
          onSaveSuccess={() => onShowToast('تم حفظ التعديلات بنجاح', 'success')}
        />
      </div>
    );
  }

  if (activeSubSectionView === 'donationsBenefit') {
    return (
      <div className="space-y-6 animate-fade-in text-slate-800" dir="rtl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="back-to-sections-list-from-donations-benefit-btn"
              onClick={() => setActiveSubSectionView(null)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-all flex items-center gap-2 text-xs sm:text-sm font-bold cursor-pointer border border-slate-200 hover:border-emerald-200 shadow-xs"
            >
              <ArrowRight className="w-4 h-4 text-emerald-600" />
              <span>العودة لقائمة أقسام الجمعيات</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">الإدارة العامة للمنصة</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 font-semibold">أقسام الجمعيات</span>
              <span className="text-slate-300">/</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية (syoumax)</span>
              </span>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>واجهة syoumax المعتمدة للحصول على التبرعات المالية</span>
          </span>
        </div>

        <ManageDonationsBenefit
          activeTenantId="tenant_nour"
          lang="ar"
          addToast={(type, message) => onShowToast(message, type)}
          onLogAudit={(action, description) =>
            addAuditLog(action, 'settings', `[الإدارة العامة - syoumax] ${description}`, adminName, 'super_admin')
          }
          currentAdminSession={currentAdminSession}
        />
      </div>
    );
  }

  if (activeSubSectionView === 'registrationFields') {
    if (!isSuperAdmin) {
      return (
        <div className="p-8 bg-white rounded-2xl border border-rose-200 text-center space-y-4" dir="rtl">
          <Lock className="w-10 h-10 text-rose-600 mx-auto" />
          <h3 className="text-lg font-black text-slate-900">صلاحية حصرية للمدير العام للمنصة</h3>
          <p className="text-sm text-slate-600">
            عذراً، تعديل إعدادات قسم «إدارة حقول تسجيل المنخرطين» المركزي متاح فقط للمدير العام للمنصة.
          </p>
          <button
            type="button"
            onClick={() => setActiveSubSectionView(null)}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
          >
            العودة لقائمة أقسام الجمعيات
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in text-slate-800" dir="rtl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="back-to-sections-list-from-fields-btn"
              onClick={() => setActiveSubSectionView(null)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-all flex items-center gap-2 text-xs sm:text-sm font-bold cursor-pointer border border-slate-200 hover:border-emerald-200 shadow-xs"
            >
              <ArrowRight className="w-4 h-4 text-emerald-600" />
              <span>العودة لقائمة أقسام الجمعيات</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">الإدارة العامة للمنصة</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 font-semibold">أقسام الجمعيات</span>
              <span className="text-slate-300">/</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>إدارة حقول تسجيل المنخرطين (تعديل إعدادات القسم)</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>صلاحية حصرية: المدير العام للمنصة</span>
            </span>

            <button
              type="button"
              id="top-nav-save-registration-fields-btn"
              onClick={() => {
                saveGlobalRegistrationFieldsForAllTenants(globalRegistrationFields).then((ok) => {
                  if (ok) {
                    onShowToast(
                      'تم حفظ جميع إعدادات حقول تسجيل المنخرطين في Firebase وتعميمها على جميع الجمعيات بنجاح!',
                      'success'
                    );
                  } else {
                    onShowToast('تم حفظ الإعدادات محلياً وجاري المزامنة السحابية.', 'info');
                  }
                });
              }}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </div>

        <ManageRegistrationFields
          fields={globalRegistrationFields}
          onUpdateFields={handleUpdateGlobalRegistrationFields}
          lang="ar"
          onLogAudit={(action, description) =>
            addAuditLog(action, 'settings', `[الإدارة العامة] ${description}`, adminName, 'super_admin')
          }
          canAdd={isSuperAdmin}
          canEdit={isSuperAdmin}
          canDelete={isSuperAdmin}
          isGlobalMasterAdmin={true}
          onSaveAllGlobal={saveGlobalRegistrationFieldsForAllTenants}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-800" dir="rtl">
      {/* Top Banner & Header */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>الإدارة العامة للمنصة</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white/90">
                تحكم مركزي شامل
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                جمعية النور وجميع الجمعيات
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
              <Layers className="w-7 h-7 text-emerald-400" />
              <span>أقسام الجمعيات</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              التحكم المركزي في إظهار أو إخفاء أقسام لوحة التحكم الإدارية للنموذج المعتمد لجمعية النور للتنمية والتضامن وجميع الجمعيات الحالية والجديدة على المنصة.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onBackToAssociations && (
              <button
                onClick={onBackToAssociations}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة لقائمة الجمعيات</span>
              </button>
            )}

            <button
              type="button"
              id="header-open-setup-service-section-btn"
              onClick={() => setActiveSubSectionView('platformSetupService')}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>سنقوم بإعداد منصة جمعيتك نيابة عنك ✨</span>
            </button>

            <button
              type="button"
              id="header-open-tutorials-section-btn"
              onClick={() => setActiveSubSectionView('platformTutorials')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-lg border border-indigo-400/40 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span>تعلم كيفية استخدام المنصة 🎬</span>
            </button>

            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/30 ring-2 ring-emerald-300 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جارٍ الحفظ والتطبيق...' : 'حفظ التعديلات'}</span>
              {hasUnsavedChanges && (
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              )}
            </button>
          </div>
        </div>

        {/* Info Note Banner */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-emerald-200/90 leading-relaxed">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>تأكيد الأمان:</strong> تعطيل أي قسم يعني <strong>إخفاءه فقط</strong> من لوحة تحكم الجمعية؛ ولا يتم حذف أو تعديل أي سجلات أو بيانات مالية أو منخرطين، ويمكن إعادة التفعيل في أي وقت لتظهر كافة البيانات السابقة كما كانت فوراً.
          </span>
        </div>
      </div>

      {/* Save Success Alert */}
      {saveSuccessMessage && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{saveSuccessMessage}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Unsaved Changes Floating Notice */}
      {hasUnsavedChanges && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
            <span className="text-xs sm:text-sm font-bold">
              توجد تعديلات جديدة لم يتم حفظها بعد. انقر على «حفظ التعديلات» لتطبيقها فورياً على جميع لوحات التحكم.
            </span>
          </div>
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>حفظ التعديلات الآن</span>
          </button>
        </div>
      )}

      {/* Metrics & Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold">إجمالي أقسام اللوحة</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">تغطي كامل وظائف الجمعية</div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-xs font-bold">الأقسام المفعلة 🟢</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">{enabledCount}</div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">
            {percentageEnabled}% من إجمالي الأقسام
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-1.5">
            <span className="text-xs font-bold">الأقسام المعطلة 🔴</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">{disabledCount}</div>
          <div className="text-[11px] text-rose-600/80 mt-1">مخفية مع حفظ بياناتها</div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-1.5">
            <span className="text-xs font-bold">نطاق التطبيق</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-sm font-black text-slate-900 mt-1">تطبيق مركزي موحد</div>
          <div className="text-[11px] text-indigo-600 font-bold mt-1">
            النموذج المعتمد + كل الجمعيات
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category Filters, and Bulk Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن قسم معين (مثال: العمليات المالية، المنخرطين، الأنشطة، التبرعات...)"
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-400 hover:text-slate-600"
              >
                مسح
              </button>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('enabled')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'enabled'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              المفعلة ({enabledCount})
            </button>
            <button
              onClick={() => setStatusFilter('disabled')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'disabled'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              المعطلة ({disabledCount})
            </button>
          </div>

          {/* Bulk Actions Menu */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleEnableAll}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="تفعيل ظهور جميع الأقسام"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>تفعيل الكل</span>
            </button>

            <button
              onClick={handleDisableOptional}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="تعطيل الأقسام غير الأساسية فقط"
            >
              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
              <span>تعطيل الاختيارية</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="px-3 py-2 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="إعادة تعيين إلى الضبط الافتراضي للمنصة"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
          <span className="text-slate-400 flex items-center gap-1 shrink-0 ml-1">
            <Filter className="w-3.5 h-3.5" />
            <span>التصنيف:</span>
          </span>

          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            جميع التصنيفات ({totalCount})
          </button>

          <button
            onClick={() => setCategoryFilter('financial')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'financial'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            المالية والمحاسبة (3)
          </button>

          <button
            onClick={() => setCategoryFilter('activities')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'activities'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-rose-50/70 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            الأنشطة والمشاريع (2)
          </button>

          <button
            onClick={() => setCategoryFilter('members')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'members'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-blue-50/70 text-blue-800 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            المنخرطون والمكتب (3)
          </button>

          <button
            onClick={() => setCategoryFilter('branding')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'branding'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-purple-50/70 text-purple-800 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            الهوية والتخصيص (3)
          </button>

          <button
            onClick={() => setCategoryFilter('governance')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'governance'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-teal-50/70 text-teal-800 hover:bg-teal-100 border border-teal-200'
            }`}
          >
            الحكامة والقرارات (2)
          </button>

          <button
            onClick={() => setCategoryFilter('marketing')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'marketing'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-amber-50/70 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            التسويق والإعلام (1)
          </button>

          <button
            onClick={() => setCategoryFilter('security')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'security'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            الأمان والإدارة (6)
          </button>

          <button
            onClick={() => setCategoryFilter('overview')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'overview'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'bg-indigo-50/70 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            الإحصائيات (1)
          </button>
        </div>
      </div>

      {/* Sections List Grid */}
      {filteredSections.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 space-y-3">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">لم يتم العثور على أي قسم يطابق معايير البحث</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            جرب كتابة اسم مختلف للقسم أو قم بإلغاء التصفية لإظهار كافة الأقسام الإدارية.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setCategoryFilter('all');
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إعادة تعيين البحث والتصفية
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSections.map((section, idx) => {
            const isEnabled = visibilityMap[section.key] !== false;
            const categoryBadge = getCategoryBadge(section.category);

            return (
              <div
                key={section.key}
                id={`assoc-section-card-${section.key}`}
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden group ${
                  isEnabled
                    ? 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs hover:shadow-md'
                    : 'bg-slate-50/80 border-slate-200/80 opacity-80'
                }`}
              >
                {/* Status Indicator Bar on Right */}
                <div
                  className={`absolute top-0 right-0 bottom-0 w-1.5 transition-colors ${
                    isEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />

                <div className="pr-3">
                  {/* Top Bar: Icon, Name & Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-3 rounded-2xl ${categoryBadge.iconBg} shrink-0 shadow-xs`}>
                        {getSectionIcon(section.iconName, 'w-6 h-6')}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-emerald-800 transition-colors">
                            {section.nameAr}
                          </h4>
                          {section.isCore && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800">
                              قسم رئيسي
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${categoryBadge.bg}`}>
                            {section.categoryLabelAr}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {section.key}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                    {section.descriptionAr}
                  </p>
                </div>

                {/* Bottom Control & Toggle */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 pr-3">
                  {/* Safe Notice */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {isEnabled ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>ظاهر ومفعل في لوحة التحكم</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>مخفي مع حفظ كافة البيانات 🔒</span>
                      </span>
                    )}
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    id={`toggle-section-${section.key}`}
                    onClick={() => handleToggleSection(section.key)}
                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                      isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-0' : '-translate-x-7'
                      }`}
                    />
                  </button>
                </div>

                {/* Direct Action for Donations Benefit Section Management */}
                {section.key === 'donationsBenefit' && (
                  <div className="mt-4 pt-3 border-t border-emerald-200 bg-emerald-50/80 -mx-5 -mb-5 p-4 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border-b-2 border-b-emerald-600/30">
                    <div className="flex items-center gap-2 text-xs text-emerald-950 font-bold">
                      <HeartHandshake className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>إدارة إعدادات الظهور بواجهة syoumax للحصول على التبرعات المالية</span>
                    </div>

                    <button
                      type="button"
                      id="manage-donations-benefit-section-btn"
                      onClick={() => setActiveSubSectionView('donationsBenefit')}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>فتح وإدارة القسم (syoumax)</span>
                    </button>
                  </div>
                )}

                {/* Direct Action for Registration Fields Management by Master Super Admin */}
                {section.key === 'fields' && isSuperAdmin && (
                  <div className="mt-4 pt-3 border-t border-emerald-200 bg-emerald-50/80 -mx-5 -mb-5 p-4 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border-b-2 border-b-emerald-600/30">
                    <div className="flex items-center gap-2 text-xs text-emerald-950 font-bold">
                      <SlidersHorizontal className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>تعديل إعدادات حقول تسجيل المنخرطين وتعميمها ({globalRegistrationFields.length} حقل)</span>
                    </div>

                    <button
                      type="button"
                      id="edit-registration-fields-section-btn"
                      onClick={() => setActiveSubSectionView('registrationFields')}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>تعديل القسم</span>
                    </button>
                  </div>
                )}

                {/* Direct Action for Tutorials Management by Master Super Admin */}
                {section.key === 'platformTutorials' && (
                  <div className="mt-4 pt-3 border-t border-indigo-100 bg-indigo-50/70 -mx-5 -mb-5 p-4 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border-b-2 border-b-indigo-500/30">
                    <div className="flex items-center gap-2 text-xs text-indigo-950 font-bold">
                      <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>إدارة شروحات وفيديوهات المنصة</span>
                    </div>

                    <button
                      type="button"
                      id="manage-tutorials-videos-btn"
                      onClick={() => setActiveSubSectionView('platformTutorials')}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>إدارة وتخصيص الفيديوهات 🎬</span>
                    </button>
                  </div>
                )}

                {/* Direct Action for Setup Service Management by Master Super Admin */}
                {section.key === 'platformSetupService' && (
                  <div className="mt-4 pt-3 border-t border-emerald-200 bg-emerald-50/80 -mx-5 -mb-5 p-4 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border-b-2 border-b-emerald-600/30">
                    <div className="flex items-center gap-2 text-xs text-emerald-950 font-bold">
                      <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>فتح القسم وتخصيص سعر الخدمة والمحتوى والطلبات</span>
                    </div>

                    <button
                      type="button"
                      id="manage-setup-service-section-btn"
                      onClick={() => setActiveSubSectionView('platformSetupService')}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>فتح وإدارة قسم إعداد المنصة ✨</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Save Actions Bar */}
      <div className="sticky bottom-4 z-30 p-4 bg-white/95 backdrop-blur-md rounded-2xl border-2 border-emerald-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs sm:text-sm">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900">
              إعدادات الأقسام المركزية للمنصة
            </div>
            <div className="text-slate-500 text-xs">
              {hasUnsavedChanges
                ? '⚠️ لديك تعديلات غير محفوظة، اضغط حفظ لتطبيقها على جميع الجمعيات.'
                : '✅ كافة إعدادات الأقسام محفوظة ومطبقة على جمعية النور وجميع الجمعيات.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>

          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
              hasUnsavedChanges
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'جارٍ الحفظ والتطبيق...' : 'حفظ التعديلات'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
