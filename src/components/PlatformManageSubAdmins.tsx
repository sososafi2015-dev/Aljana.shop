import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  Lock, 
  Unlock, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  Plus, 
  Phone, 
  User, 
  Check, 
  X, 
  Activity, 
  Search, 
  History,
  Building2,
  Megaphone,
  Calendar,
  DollarSign,
  HeartHandshake,
  Users,
  FileText,
  Image as ImageIcon,
  BarChart3,
  Sliders,
  CreditCard,
  RefreshCw,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  PlatformSubAdmin, 
  PlatformPermissionKey, 
  PlatformAdminAuditLog, 
  MasterAdminSession 
} from '../types';
import { 
  apiFetchPlatformSubAdmins, 
  apiCreatePlatformSubAdmin, 
  apiUpdatePlatformSubAdmin, 
  apiTogglePlatformSubAdminStatus, 
  apiUpdatePlatformSubAdminPermissions, 
  apiDeletePlatformSubAdmin, 
  apiFetchPlatformAuditLogs, 
  apiLogPlatformAdminActivity 
} from '../api/platformSubAdminsApi';

interface PlatformManageSubAdminsProps {
  currentSession: MasterAdminSession | null;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

// 8 Distinct Permission Groups matching user prompt exactly
export interface PermissionGroupConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  items: {
    key: PlatformPermissionKey;
    label: string;
    description: string;
  }[];
}

export const PLATFORM_PERMISSION_GROUPS: PermissionGroupConfig[] = [
  {
    id: 'associations',
    title: 'الجمعيات',
    description: 'التحكم في ملفات الجمعيات، مراجعة الوثائق وتفعيل وتعطيل المنصات',
    icon: Building2,
    colorClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    items: [
      {
        key: 'associations_manage',
        label: 'إدارة الجمعيات',
        description: 'تعديل بيانات الجمعيات، الإعدادات، والبيانات القانونية ومسؤولي الجمعية.',
      },
      {
        key: 'associations_view',
        label: 'مشاهدة الجمعيات',
        description: 'الاطلاع على قائمة الجمعيات وتفاصيل ملفاتها ووثائقها فقط دون تعديل.',
      },
      {
        key: 'associations_toggle_status',
        label: 'تفعيل وتعطيل الجمعيات',
        description: 'تغيير حالة المنصة بين نشطة ومعطلة مؤقتاً.',
      },
      {
        key: 'association_sections_manage',
        label: 'إدارة أقسام الجمعيات',
        description: 'التحكم المركزي في إظهار أو إخفاء أقسام لوحة تحكم الجمعيات لجميع المنصات.',
      },
      {
        key: 'association_sections_view',
        label: 'عرض إعدادات أقسام الجمعيات',
        description: 'الاطلاع على حالة إظهار وإخفاء أقسام الجمعيات المركزية دون تعديلها.',
      },
      {
        key: 'tenants_requests_manage',
        label: 'إدارة طلبات إنشاء المنصات',
        description: 'مراجعة طلبات الجمعيات الجديدة والتحقق من الوثائق القانونية.',
      },
    ],
  },
  {
    id: 'campaigns_ads',
    title: 'الحملات والإعلانات',
    description: 'إدارة الحملات الترويجية المدفوعة وترتيب ظهور الجمعيات بالصفحة الأولى',
    icon: Megaphone,
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    items: [
      {
        key: 'ad_campaign_requests_manage',
        label: 'إدارة طلبات تدشين الحملات الإعلانية',
        description: 'استقبال وفحص طلبات الحملات الترويجية الواردة من الجمعيات.',
      },
      {
        key: 'ad_campaign_approve',
        label: 'الموافقة على الحملات الإعلانية',
        description: 'اعتماد ونشر الحملات الإعلانية وتفعيل ظهورها في البوابة العامة.',
      },
      {
        key: 'ad_campaigns_manage',
        label: 'إدارة الإعلانات والترويج',
        description: 'ترتيب الأولويات، ترتيب الظهور، وإعدادات الباقات الإعلانية.',
      },
    ],
  },
  {
    id: 'subscriptions',
    title: 'الاشتراكات',
    description: 'متابعة مدد الاشتراكات وباقات الجمعيات وفترات التجديد',
    icon: Calendar,
    colorClass: 'text-blue-700',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    items: [
      {
        key: 'subscriptions_renewals_manage',
        label: 'إدارة طلبات تجديد الاشتراك',
        description: 'متابعة الجمعيات التي أوشك اشتراكها على الانتهاء وتجديد باقاتها.',
      },
    ],
  },
  {
    id: 'users',
    title: 'المستخدمون',
    description: 'إدارة مسؤولي الجمعيات وبيانات الدخول',
    icon: Users,
    colorClass: 'text-indigo-700',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    items: [
      {
        key: 'users_manage',
        label: 'إدارة المستخدمين',
        description: 'الاطلاع على أصحاب الجمعيات والمسؤولين وإعادة تعيين كلمات المرور.',
      },
    ],
  },
  {
    id: 'donations',
    title: 'التبرعات',
    description: 'التحكم في قنوات التبرع المركزية ومبالغ المساهمات',
    icon: HeartHandshake,
    colorClass: 'text-rose-700',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
    items: [
      {
        key: 'donations_manage',
        label: 'إدارة التبرعات والمساهمات',
        description: 'متابعة حركة التبرعات العامة والشفافية في توزيع المساهمات.',
      },
      {
        key: 'contribution_types_manage',
        label: 'إدارة أنواع المساهمات',
        description: 'تحديد وتخصيص مبالغ التبرع المقترحة وقنوات الدعم العامة.',
      },
      {
        key: 'platform_support_manage',
        label: 'إدارة دعم المنصة',
        description: 'التحكم في مبالغ دعم المنصة، خيار مبلغ آخر، وتخصيص وتفعيل طرق الدفع.',
      },
    ],
  },
  {
    id: 'content_media',
    title: 'المحتوى والوسائط',
    description: 'إدارة المقالات، الإعلانات، والشعارات والوسائط',
    icon: ImageIcon,
    colorClass: 'text-teal-700',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-200',
    items: [
      {
        key: 'content_manage',
        label: 'إدارة المحتوى',
        description: 'إدارة وتعديل المقالات والمحتوى التعريفي بالبوابة العامة.',
      },
      {
        key: 'media_manage',
        label: 'إدارة الصور والوسائط',
        description: 'مراجعة وتنظيم وحذف الصور والملفات المرفوعة على المنصة.',
      },
    ],
  },
  {
    id: 'reports',
    title: 'التقارير',
    description: 'متابعة الأداء العام ومؤشرات النمو وسجلات النظام',
    icon: BarChart3,
    colorClass: 'text-purple-700',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    items: [
      {
        key: 'reports_view',
        label: 'مشاهدة التقارير والإحصائيات',
        description: 'الاطلاع على التقارير التحليلية والمؤشرات المالية والبيانية.',
      },
      {
        key: 'audit_logs_view',
        label: 'مشاهدة سجلات العمليات',
        description: 'الاطلاع على السجلات الإدارية الشاملة وحركات الأدمن المساعدين.',
      },
    ],
  },
  {
    id: 'settings_payments',
    title: 'الإعدادات والمدفوعات',
    description: 'التحكم في الرسوم البنكية وتخصيص واجهة المنصة العامة',
    icon: Sliders,
    colorClass: 'text-slate-700',
    bgClass: 'bg-slate-100',
    borderClass: 'border-slate-200',
    items: [
      {
        key: 'payments_manage',
        label: 'إدارة المدفوعات',
        description: 'مراجعة إيصالات التحويل البنكي وتأكيد مدفوعات التفعيل.',
      },
      {
        key: 'portal_settings_manage',
        label: 'إدارة إعدادات واجهة المنصة',
        description: 'تخصيص الواجهة الرئيسية، ألوان البوابة، والنصوص الترويجية.',
      },
    ],
  },
];

export const PlatformManageSubAdmins: React.FC<PlatformManageSubAdminsProps> = ({
  currentSession,
  onShowToast,
}) => {
  // Data state
  const [subAdmins, setSubAdmins] = useState<PlatformSubAdmin[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active view: 'list' | 'audit_logs'
  const [activeView, setActiveView] = useState<'list' | 'audit_logs'>('list');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<PlatformSubAdmin | null>(null);
  const [permissionsAdmin, setPermissionsAdmin] = useState<PlatformSubAdmin | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<PlatformSubAdmin | null>(null);

  // Form states for Add / Edit
  const [formFullName, setFormFullName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formNotes, setFormNotes] = useState('');
  const [formPermissions, setFormPermissions] = useState<Record<PlatformPermissionKey, boolean>>(() => {
    const initial: any = {};
    PLATFORM_PERMISSION_GROUPS.forEach((g) => g.items.forEach((i) => (initial[i.key] = false)));
    return initial;
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Temporary permissions state inside Permissions Modal
  const [tempPermissions, setTempPermissions] = useState<Record<PlatformPermissionKey, boolean>>({} as any);

  // Load sub-admins and audit logs on mount
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [adminsRes, logsRes] = await Promise.all([
        apiFetchPlatformSubAdmins(currentSession),
        apiFetchPlatformAuditLogs(),
      ]);

      if (adminsRes.success && adminsRes.subAdmins) {
        setSubAdmins(adminsRes.subAdmins);
      }
      if (logsRes.success && logsRes.logs) {
        setAuditLogs(logsRes.logs);
      }
    } catch (err) {
      console.warn('Error loading platform subadmins:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered sub-admins
  const filteredSubAdmins = useMemo(() => {
    return subAdmins.filter((admin) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        admin.fullName.toLowerCase().includes(q) ||
        admin.phone.includes(q) ||
        (admin.notes && admin.notes.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'all' || admin.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [subAdmins, searchQuery, statusFilter]);

  // Statistics
  const totalCount = subAdmins.length;
  const activeCount = subAdmins.filter((a) => a.status === 'active').length;
  const inactiveCount = subAdmins.filter((a) => a.status === 'inactive').length;

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormFullName('');
    setFormPhone('');
    setFormPassword('');
    setFormConfirmPassword('');
    setFormStatus('active');
    setFormNotes('');
    const resetPerms: any = {};
    PLATFORM_PERMISSION_GROUPS.forEach((g) => g.items.forEach((i) => (resetPerms[i.key] = false)));
    setFormPermissions(resetPerms);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Submit Add
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formFullName.trim()) {
      setFormError('يرجى كتابة الاسم الكامل للأدمن المساعد.');
      return;
    }
    if (!formPhone.trim() || formPhone.trim().length < 8) {
      setFormError('يرجى إدخال رقم هاتف صحيح ومكتمل.');
      return;
    }
    if (!formPassword || formPassword.length < 4) {
      setFormError('كلمة المرور يجب أن لا تقل عن 4 خانات.');
      return;
    }
    if (formPassword !== formConfirmPassword) {
      setFormError('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiCreatePlatformSubAdmin(
        {
          fullName: formFullName.trim(),
          phone: formPhone.trim(),
          password: formPassword,
          status: formStatus,
          notes: formNotes.trim(),
          permissions: formPermissions,
        },
        currentSession
      );

      if (res.success && res.subAdmins) {
        setSubAdmins(res.subAdmins);
        setIsAddModalOpen(false);
        onShowToast(`تم إنشاء حساب الأدمن «${formFullName}» بنجاح!`, 'success');
        // Refresh audit logs
        apiFetchPlatformAuditLogs().then((r) => r.logs && setAuditLogs(r.logs));
      } else {
        setFormError(res.error || 'فشل إنشاء حساب الأدمن');
      }
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ في الاتصال');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (admin: PlatformSubAdmin) => {
    setEditingAdmin(admin);
    setFormFullName(admin.fullName);
    setFormPhone(admin.phone);
    setFormPassword('');
    setFormConfirmPassword('');
    setFormStatus(admin.status);
    setFormNotes(admin.notes || '');
    setFormError(null);
  };

  // Submit Edit
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setFormError(null);

    if (!formFullName.trim()) {
      setFormError('الاسم الكامل مطلوب.');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('رقم الهاتف مطلوب.');
      return;
    }
    if (formPassword && formPassword !== formConfirmPassword) {
      setFormError('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatePayload: any = {
        fullName: formFullName.trim(),
        phone: formPhone.trim(),
        status: formStatus,
        notes: formNotes.trim(),
      };
      if (formPassword) {
        updatePayload.password = formPassword;
      }

      const res = await apiUpdatePlatformSubAdmin(editingAdmin.id, updatePayload, currentSession);
      if (res.success && res.subAdmins) {
        setSubAdmins(res.subAdmins);
        setEditingAdmin(null);
        onShowToast(`تم تحديث بيانات الأدمن «${formFullName}» بنجاح`, 'success');
        apiFetchPlatformAuditLogs().then((r) => r.logs && setAuditLogs(r.logs));
      } else {
        setFormError(res.error || 'فشل تحديث البيانات');
      }
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ في الاتصال');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Permissions Modal
  const handleOpenPermissionsModal = (admin: PlatformSubAdmin) => {
    setPermissionsAdmin(admin);
    const currentPerms: any = {};
    PLATFORM_PERMISSION_GROUPS.forEach((g) => {
      g.items.forEach((i) => {
        currentPerms[i.key] = admin.permissions?.[i.key] === true;
      });
    });
    setTempPermissions(currentPerms);
  };

  // Toggle single permission
  const handleToggleSinglePermission = (key: PlatformPermissionKey) => {
    setTempPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Select all in a group
  const handleSelectGroup = (group: PermissionGroupConfig, enable: boolean) => {
    setTempPermissions((prev) => {
      const next = { ...prev };
      group.items.forEach((i) => {
        next[i.key] = enable;
      });
      return next;
    });
  };

  // Select all everywhere
  const handleSelectAllEverywhere = (enable: boolean) => {
    setTempPermissions((prev) => {
      const next: any = {};
      PLATFORM_PERMISSION_GROUPS.forEach((g) => {
        g.items.forEach((i) => {
          next[i.key] = enable;
        });
      });
      return next;
    });
  };

  // Save Permissions
  const handleSavePermissions = async () => {
    if (!permissionsAdmin) return;
    setIsSubmitting(true);
    try {
      const res = await apiUpdatePlatformSubAdminPermissions(
        permissionsAdmin.id,
        tempPermissions,
        currentSession
      );
      if (res.success && res.subAdmins) {
        setSubAdmins(res.subAdmins);
        setPermissionsAdmin(null);
        onShowToast(`تم حفظ وتحديث صلاحيات الأدمن «${permissionsAdmin.fullName}» بنجاح!`, 'success');
        apiFetchPlatformAuditLogs().then((r) => r.logs && setAuditLogs(r.logs));
      } else {
        onShowToast(res.error || 'فشل تحديث الصلاحيات', 'error');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'حدث خطأ في حفظ الصلاحيات', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active/Inactive status
  const handleToggleStatus = async (admin: PlatformSubAdmin) => {
    const nextStatus = admin.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await apiTogglePlatformSubAdminStatus(admin.id, nextStatus, currentSession);
      if (res.success && res.subAdmins) {
        setSubAdmins(res.subAdmins);
        onShowToast(
          nextStatus === 'active'
            ? `تم تفعيل حساب الأدمن «${admin.fullName}» بنجاح.`
            : `تم تعطيل حساب الأدمن «${admin.fullName}» ومنع دخوله.`,
          'info'
        );
        apiFetchPlatformAuditLogs().then((r) => r.logs && setAuditLogs(r.logs));
      } else {
        onShowToast(res.error || 'فشل تغيير حالة الحساب', 'error');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'حدث خطأ في الاتصال', 'error');
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingAdmin) return;
    setIsSubmitting(true);
    try {
      const res = await apiDeletePlatformSubAdmin(deletingAdmin.id, currentSession);
      if (res.success && res.subAdmins) {
        setSubAdmins(res.subAdmins);
        setDeletingAdmin(null);
        onShowToast(`تم حذف حساب الأدمن «${deletingAdmin.fullName}» نهائياً من قاعدة البيانات.`, 'success');
        apiFetchPlatformAuditLogs().then((r) => r.logs && setAuditLogs(r.logs));
      } else {
        onShowToast(res.error || 'فشل حذف الحساب', 'error');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'حدث خطأ في الاتصال', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner & Security Statement */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                إدارة الصلاحيات والتحكم المركزي (RBAC)
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              إضافة أدمين وتعيين الصلاحيات
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              تمكين <strong>الأدمين الرئيسي (Super Admin)</strong> من إنشاء حسابات أدمين مساعدة من الدرجة الثانية، وتحديد صلاحيات دقيقة ومستقلة لكل حساب وفق المهام الموكلة إليه، مع عزل بيانات الجمعيات ومنع الصلاحيات الحساسة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleOpenAddModal}
              className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-black rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer transform active:scale-95"
            >
              <UserPlus className="w-5 h-5" />
              <span>+ إضافة أدمين جديد</span>
            </button>

            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all border border-white/10 flex items-center justify-center cursor-pointer"
              title="تحديث البيانات من السيرفر"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Security Rules Capsule */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-xl border border-white/5">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>حظر تلقائي لحذف أو تعديل حساب Super Admin</span>
          </div>
          <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-xl border border-white/5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>صلاحيات مستقلة ومحفوظة دائماً بقاعدة البيانات</span>
          </div>
          <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-xl border border-white/5">
            <Activity className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span>توثيق كافة العمليات في سجل النشاط الإداري</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold">إجمالي الأدمن المساعدين</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">حسابات من الدرجة الثانية</div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 mb-1.5">
            <span className="text-xs font-bold">الحسابات النشطة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{activeCount}</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">يملكون صلاحية الدخول</div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-rose-700 mb-1.5">
            <span className="text-xs font-bold">الحسابات المعطلة</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700">{inactiveCount}</div>
          <div className="text-[11px] text-rose-600/80 mt-1">معطلة مع حفظ الصلاحيات</div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-indigo-700 mb-1.5">
            <span className="text-xs font-bold">سجل العمليات الموثقة</span>
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">{auditLogs.length}</div>
          <div className="text-[11px] text-indigo-600/80 mt-1">عملية إدارية مسجلة</div>
        </div>
      </div>

      {/* Tabs Switcher: Sub-Admins List vs Activity Logs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('list')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeView === 'list'
                ? 'bg-slate-900 text-white shadow'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>قائمة الأدمن المساعدين ({filteredSubAdmins.length})</span>
          </button>

          <button
            onClick={() => setActiveView('audit_logs')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeView === 'audit_logs'
                ? 'bg-slate-900 text-white shadow'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل العمليات الإدارية ({auditLogs.length})</span>
          </button>
        </div>

        {activeView === 'list' && (
          <div className="flex items-center gap-2.5 flex-1 max-w-md justify-end">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث بالاسم، رقم الهاتف..."
                className="w-full pl-3 pr-9 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
            >
              <option value="all">كل الحالات</option>
              <option value="active">النشطة فقط 🟢</option>
              <option value="inactive">المعطلة فقط 🔴</option>
            </select>
          </div>
        )}
      </div>

      {/* ==================== VIEW 1: SUB-ADMINS LIST ==================== */}
      {activeView === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
              <p className="text-xs font-bold">جاري تحميل حسابات الأدمن المساعدين من قاعدة البيانات...</p>
            </div>
          ) : filteredSubAdmins.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-700">لا يوجد أدمن مساعد مطابق للبحث</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {searchQuery ? 'لم يتم العثور على نتائج تطابق معايير البحث الحالية.' : 'لم تقم بعد بإنشاء أي أدمن مساعد من الدرجة الثانية. اضغط على الزر أدناه لإضافة أول أدمن وتحديد صلاحياته.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة أدمين جديد</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] font-black border-b border-slate-200">
                    <th className="py-3.5 px-4">الأدمن المساعد</th>
                    <th className="py-3.5 px-4">رقم الهاتف</th>
                    <th className="py-3.5 px-4">تاريخ الإنشاء</th>
                    <th className="py-3.5 px-4">حالة الحساب</th>
                    <th className="py-3.5 px-4">الصلاحيات الممنوحة</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {filteredSubAdmins.map((admin) => {
                    const activePermsCount = Object.values(admin.permissions || {}).filter(Boolean).length;
                    const isFullyActive = admin.status === 'active';

                    return (
                      <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Name & Role */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                              isFullyActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                                <span>{admin.fullName}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  درجة ثانية
                                </span>
                              </div>
                              {admin.notes && (
                                <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xs mt-0.5">
                                  {admin.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-4 px-4 font-mono font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span dir="ltr">{admin.phone}</span>
                          </div>
                        </td>

                        {/* Created At */}
                        <td className="py-4 px-4 text-slate-500 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(admin.createdAt).toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          {isFullyActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              <span>نشط</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                              <span>معطل</span>
                            </span>
                          )}
                        </td>

                        {/* Permissions Pill */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 text-xs">
                                {activePermsCount} من أصل 17 صلاحية
                              </span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${(activePermsCount / 17) * 100}%` }}
                                />
                              </div>
                            </div>

                            {/* Badges of enabled groups */}
                            <div className="flex flex-wrap gap-1">
                              {PLATFORM_PERMISSION_GROUPS.filter((g) =>
                                g.items.some((i) => admin.permissions?.[i.key])
                              ).slice(0, 3).map((g) => (
                                <span
                                  key={g.id}
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${g.bgClass} ${g.colorClass}`}
                                >
                                  {g.title}
                                </span>
                              ))}
                              {PLATFORM_PERMISSION_GROUPS.filter((g) =>
                                g.items.some((i) => admin.permissions?.[i.key])
                              ).length > 3 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                  +{PLATFORM_PERMISSION_GROUPS.filter((g) =>
                                    g.items.some((i) => admin.permissions?.[i.key])
                                  ).length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Actions Buttons */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Edit Details */}
                            <button
                              onClick={() => handleOpenEditModal(admin)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="تعديل البيانات"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                              <span>تعديل</span>
                            </button>

                            {/* Permissions Key */}
                            <button
                              onClick={() => handleOpenPermissionsModal(admin)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200 flex items-center gap-1 cursor-pointer"
                              title="تخصيص الصلاحيات"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                              <span>الصلاحيات</span>
                            </button>

                            {/* Toggle Status */}
                            <button
                              onClick={() => handleToggleStatus(admin)}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                isFullyActive
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                              title={isFullyActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                            >
                              {isFullyActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              <span>{isFullyActive ? 'تعطيل' : 'تفعيل'}</span>
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setDeletingAdmin(admin)}
                              className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-700 rounded-xl transition-all cursor-pointer"
                              title="حذف الحساب نهائياً"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== VIEW 2: AUDIT LOGS ==================== */}
      {activeView === 'audit_logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800">سجل العمليات الإدارية (Admin Activity Log)</h3>
              <p className="text-[11px] text-slate-400">توثيق العمليات المهمة وتحديثات الصلاحيات من طرف الإدارة</p>
            </div>
            <button
              onClick={loadData}
              className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث السجل</span>
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              لا توجد عمليات مسجلة حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-600 text-[11px] font-black border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-3 px-4">الأدمن</th>
                    <th className="py-3 px-4">العملية</th>
                    <th className="py-3 px-4">العنصر المعدل</th>
                    <th className="py-3 px-4">التاريخ والوقت</th>
                    <th className="py-3 px-4">النتيجة</th>
                    <th className="py-3 px-4">تفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            log.adminRole === 'super_admin' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          <span>{log.adminName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({log.adminRole === 'super_admin' ? 'Super Admin' : 'درجة ثانية'})
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-black text-slate-800">{log.action}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{log.targetItem}</td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]" dir="ltr">
                        {new Date(log.timestamp).toLocaleString('ar-MA')}
                      </td>
                      <td className="py-3 px-4">
                        {log.result === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ناجحة</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>مرفوضة</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 max-w-xs truncate">
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL 1: ADD NEW SUB-ADMIN ==================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-l from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">إضافة أدمين مساعد جديد</h3>
                  <p className="text-xs text-slate-300">إنشاء حساب إداري من الدرجة الثانية مع تحديد الصلاحيات المخصصة</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitAdd} className="p-6 space-y-6 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Basic Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الاسم الكامل <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="مثال: محمد العمري (مشرف المنصات)"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    رقم الهاتف (اسم المستخدم لتسجيل الدخول) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="0612345678"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تأكيد كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formConfirmPassword}
                    onChange={(e) => setFormConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    حالة الحساب
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e: any) => setFormStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                  >
                    <option value="active">نشط 🟢 (يستطيع تسجيل الدخول فوراً)</option>
                    <option value="inactive">غير نشط 🔴 (معطل مؤقتاً)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    وصف أو ملاحظات عن مهمة الأدمين (اختياري)
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="مثال: مسؤول مراجعة حملات رمضان الإعلانية"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Initial Permissions Selection */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-800">صلاحيات الأدمين المبدئية</h4>
                    <p className="text-[11px] text-slate-400">يمكنك تعديل هذه الصلاحيات في أي وقت بعد الإنشاء</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allTrue: any = {};
                        PLATFORM_PERMISSION_GROUPS.forEach((g) => g.items.forEach((i) => (allTrue[i.key] = true)));
                        setFormPermissions(allTrue);
                      }}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      ☑ تحديد الكل
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allFalse: any = {};
                        PLATFORM_PERMISSION_GROUPS.forEach((g) => g.items.forEach((i) => (allFalse[i.key] = false)));
                        setFormPermissions(allFalse);
                      }}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      ☐ إلغاء تحديد الكل
                    </button>
                  </div>
                </div>

                {/* Groups Accordion / Cards */}
                <div className="space-y-3">
                  {PLATFORM_PERMISSION_GROUPS.map((group) => {
                    const GroupIcon = group.icon;
                    const groupAllChecked = group.items.every((i) => formPermissions[i.key]);

                    return (
                      <div key={group.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`p-1.5 rounded-lg ${group.bgClass} ${group.colorClass}`}>
                              <GroupIcon className="w-4 h-4" />
                            </span>
                            <span className="text-xs font-black text-slate-800">{group.title}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setFormPermissions((prev) => {
                                const next = { ...prev };
                                group.items.forEach((i) => (next[i.key] = !groupAllChecked));
                                return next;
                              });
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 cursor-pointer"
                          >
                            {groupAllChecked ? '☐ إلغاء تحديد المجموعة' : '☑ تحديد المجموعة'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.items.map((item) => (
                            <label
                              key={item.key}
                              className={`flex items-start gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                                formPermissions[item.key]
                                  ? 'bg-white border-emerald-300 shadow-xs'
                                  : 'bg-white/50 border-slate-200 text-slate-500'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={!!formPermissions[item.key]}
                                onChange={() =>
                                  setFormPermissions((prev) => ({
                                    ...prev,
                                    [item.key]: !prev[item.key],
                                  }))
                                }
                                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <div className="leading-tight">
                                <div className="font-bold text-slate-800 text-[11px]">{item.label}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{item.description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>إنشاء الحساب وتفعيل الصلاحيات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: EDIT SUB-ADMIN DETAILS ==================== */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black">تعديل بيانات الأدمن «{editingAdmin.fullName}»</h3>
              </div>
              <button
                onClick={() => setEditingAdmin(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (اسم المستخدم)</label>
                <input
                  type="tel"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none font-mono"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    كلمة مرور جديدة (اختياري)
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="اترك فارغاً للإبقاء عليها"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <input
                    type="password"
                    value={formConfirmPassword}
                    onChange={(e) => setFormConfirmPassword(e.target.value)}
                    placeholder="تأكيد الكلمة"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حالة الحساب</label>
                <select
                  value={formStatus}
                  onChange={(e: any) => setFormStatus(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                >
                  <option value="active">نشط 🟢</option>
                  <option value="inactive">معطل 🔴</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الوصف والملاحظات</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: PERMISSIONS MANAGER ==================== */}
      {permissionsAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-l from-indigo-950 via-slate-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold border border-indigo-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black">صلاحيات الأدمين</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {permissionsAdmin.fullName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    تفعيل وتعطيل الصلاحيات بشكل مستقل. تحفظ الصلاحيات في قاعدة البيانات ولا تتأثر بإعادة تشغيل النظام.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPermissionsAdmin(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-3.5 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between flex-wrap gap-2 text-xs font-bold">
              <div className="flex items-center gap-2 text-indigo-900">
                <span>الصلاحيات المحددة:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-mono text-[11px]">
                  {Object.values(tempPermissions).filter(Boolean).length} من 17
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectAllEverywhere(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>تحديد كافة الصلاحيات بالكامل</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAllEverywhere(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer"
                >
                  <span>إلغاء تحديد الكل</span>
                </button>
              </div>
            </div>

            {/* Groups Grid */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {PLATFORM_PERMISSION_GROUPS.map((group) => {
                const GroupIcon = group.icon;
                const groupAllChecked = group.items.every((i) => tempPermissions[i.key]);
                const groupCount = group.items.filter((i) => tempPermissions[i.key]).length;

                return (
                  <div
                    key={group.id}
                    className={`rounded-2xl border p-4.5 transition-all ${
                      groupCount > 0
                        ? `${group.bgClass} ${group.borderClass}`
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    {/* Group Header */}
                    <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-200/60">
                      <div className="flex items-center gap-2.5">
                        <span className={`p-2 rounded-xl bg-white shadow-xs ${group.colorClass}`}>
                          <GroupIcon className="w-5 h-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900">{group.title}</h4>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                              {groupCount} / {group.items.length}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{group.description}</p>
                        </div>
                      </div>

                      {/* Group toggle buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectGroup(group, true)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-50 text-emerald-700 rounded-lg border border-slate-200 transition-all cursor-pointer"
                        >
                          ☑ تحديد الكل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectGroup(group, false)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-50 text-slate-500 rounded-lg border border-slate-200 transition-all cursor-pointer"
                        >
                          ☐ إلغاء تحديد الكل
                        </button>
                      </div>
                    </div>

                    {/* Permissions list inside group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {group.items.map((item) => {
                        const isChecked = !!tempPermissions[item.key];

                        return (
                          <div
                            key={item.key}
                            onClick={() => handleToggleSinglePermission(item.key)}
                            className={`p-3 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/10'
                                : 'bg-white/60 border-slate-200 text-slate-500 hover:bg-white'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-black ${isChecked ? 'text-slate-900' : 'text-slate-700'}`}>
                                  {item.label}
                                </span>
                                {isChecked && (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800">
                                    مفعلة
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed">
                                {item.description}
                              </p>
                            </div>

                            {/* Toggle switch visual */}
                            <div
                              className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 mt-0.5 ${
                                isChecked ? 'bg-emerald-600' : 'bg-slate-300'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 bg-white rounded-full transition-transform absolute top-0.75 ${
                                  isChecked ? 'left-1' : 'right-1'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                تطبق هذه الصلاحيات فوراً في الواجهة والـ API والخادم وقاعدة البيانات.
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPermissionsAdmin(null)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>حفظ الصلاحيات في قاعدة البيانات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 4: DELETE CONFIRMATION ==================== */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900">تأكيد حذف حساب الأدمن</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف حساب الأدمن المساعد:{' '}
                <strong className="text-slate-900 font-bold">«{deletingAdmin.fullName}»</strong>؟
              </p>
              <p className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                سيتم إزالة الحساب نهائياً من قاعدة بيانات المنصة ولن يتمكن من تسجيل الدخول بعد الآن.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingAdmin(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                {isSubmitting ? 'جاري الحذف...' : 'نعم، حذف الحساب نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
