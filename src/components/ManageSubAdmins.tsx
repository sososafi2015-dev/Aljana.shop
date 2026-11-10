import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  Lock, 
  Unlock, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  Plus, 
  Pencil, 
  Trash, 
  Phone, 
  User, 
  Check, 
  X, 
  Activity, 
  Search, 
  History,
  Coins,
  Award,
  CreditCard,
  HeartHandshake,
  Image as ImageIcon,
  Vote,
  SlidersHorizontal,
  Settings,
  Database,
  Users,
  FileCheck,
  RefreshCw,
  Megaphone,
  GraduationCap,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { 
  SubAdmin, 
  AdminSectionKey, 
  SectionPermission, 
  PermissionLevel, 
  AuditLog, 
  Language,
  CurrentAdminSession
} from '../types';
import { 
  createDefaultPermissions, 
  applyPermissionLevel, 
  getPermissionLevel,
  generateSalt,
  hashPasswordWithSalt,
  validateMemberUsernameFormat,
  isSubAdminUsernameTaken,
  normalizeMemberUsername
} from '../security';
import {
  apiDeleteSubAdmin,
  apiToggleSubAdminStatus,
  apiCreateSubAdmin,
  apiUpdateSubAdmin
} from '../api/subAdminsApi';
import { recordDeletedSubAdminId } from '../storage';
import { useAssociationSectionsConfig } from '../associationSectionsStorage';

interface ManageSubAdminsProps {
  subAdmins: SubAdmin[];
  onUpdateSubAdmins: (subAdmins: SubAdmin[]) => void;
  auditLogs: AuditLog[];
  onLogAudit: (
    action: 'create' | 'update' | 'delete' | 'login' | 'export', 
    targetType: AuditLog['targetType'], 
    description: string,
    performedBy?: string,
    adminType?: 'super_admin' | 'sub_admin',
    adminPhone?: string
  ) => void;
  currentAdminSession?: CurrentAdminSession | null;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  lang: Language;
}

// Section definitions with human readable labels and icons
export const ADMIN_SECTIONS_CONFIG: {
  key: AdminSectionKey;
  labelAr: string;
  labelFr: string;
  labelEn: string;
  descAr: string;
  icon: React.ElementType;
}[] = [
  {
    key: 'createAd',
    labelAr: 'إنشاء إعلان وترويج الجمعية',
    labelFr: 'Créer une annonce & Promotion',
    labelEn: 'Create Ad & Feature Association',
    descAr: 'طلب وتدشين حملة إعلانية لإظهار الجمعية في الصفحة الأولى بواجهة المنصة في قسم تلقي التبرعات',
    icon: Megaphone,
  },
  {
    key: 'donationsBenefit',
    labelAr: 'اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية',
    labelFr: 'Rendre votre plateforme visible au public pour recevoir des dons financiers',
    labelEn: 'Make Your Platform Publicly Visible to Receive Financial Donations',
    descAr: 'التحكم في ظهور الجمعية في قسم تبرع وشارك بمشاريع التنمية وتلقي المساهمات',
    icon: HeartHandshake,
  },
  {
    key: 'subscriptionRenewal',
    labelAr: 'تجديد الاشتراك ومعلومات المنظومة',
    labelFr: 'Renouvellement d\'abonnement',
    labelEn: 'Subscription Renewal & Expiration',
    descAr: 'متابعة فترة الاشتراك السنوي، الأيام المتبقية، وسجل مدفوعات التجديد',
    icon: RefreshCw,
  },
  {
    key: 'platformTutorials',
    labelAr: 'تعلم كيفية استخدام المنصة',
    labelFr: 'Apprendre à utiliser la plateforme',
    labelEn: 'Learn Platform Usage & Tutorials',
    descAr: 'إدارة واستعراض فيديوهات وشروحات تعليم كيفية استخدام أقسام ووظائف المنصة',
    icon: GraduationCap,
  },
  {
    key: 'platformSetupService',
    labelAr: 'سنقوم بإعداد منصة جمعيتك نيابة عنك',
    labelFr: 'Configuration complète de votre plateforme',
    labelEn: 'We Will Set Up Your Association Platform For You',
    descAr: 'خدمة إعداد وتجهيز واجهة منصة الجمعية وإدخال معلوماتها وأقسامها ومنخرطيها نيابة عن الجمعية',
    icon: Sparkles,
  },
  {
    key: 'campaigns',
    labelAr: 'إدارة حملات التبرع والمشاريع التنموية',
    labelFr: 'Campagnes de dons et projets',
    labelEn: 'Donation Campaigns Management',
    descAr: 'إنشاء وإدارة حملات التبرع، وتتبع المبالغ المحصلة ونسب الإنجاز',
    icon: HeartHandshake,
  },
  {
    key: 'operations',
    labelAr: 'إدارة سجل الشفافية المباشر',
    labelFr: 'Gestion de la transparence financière',
    labelEn: 'Financial Transparency Management',
    descAr: 'تسجيل ومتابعة المداخيل والمصاريف الخيرية وتفاصيل الحساب البنكي',
    icon: Coins,
  },
  {
    key: 'official_registers',
    labelAr: 'إدارة بوابات والسجلات الرسمية',
    labelFr: 'Registres et procès-verbaux officiels',
    labelEn: 'Official Registers & Records',
    descAr: 'المحاضر والتقارير القانونية وملفات الجمعية الرسمية',
    icon: FileCheck,
  },
  {
    key: 'members',
    labelAr: 'إدارة المستخدمين والمنخرطين',
    labelFr: 'Gestion des adhérents et membres',
    labelEn: 'Members & Users Management',
    descAr: 'قائمة المنخرطين، تفعيل الحسابات، وتتبع اشتراكات العضوية',
    icon: Users,
  },
  {
    key: 'boardMembers',
    labelAr: 'إدارة أعضاء مكتب الجمعية',
    labelFr: 'Membres du bureau de l\'association',
    labelEn: 'Board Members Management',
    descAr: 'هيكل المكتب المسير، المهام، وأرقام التواصل والصفات',
    icon: Award,
  },
  {
    key: 'contributions',
    labelAr: 'إدارة سجل المساهمات والانخراطات',
    labelFr: 'Gestion des cotisations et dons',
    labelEn: 'Contributions & Subscriptions',
    descAr: 'متابعة مساهمات المنخرطين، وصولات الأداء والتحويلات',
    icon: Coins,
  },
  {
    key: 'memberCard',
    labelAr: 'إدارة وتعديل وصل / بطاقة المنخرط',
    labelFr: 'Modèle de carte d\'adhérent',
    labelEn: 'Member Card Customizer',
    descAr: 'تخصيص بيانات وتصميم بطاقة المنخرط ووصل الأداء الرسمي',
    icon: CreditCard,
  },
  {
    key: 'activities',
    labelAr: 'إدارة الأنشطة والأعمال الخيرية',
    labelFr: 'Activités et projets caritatifs',
    labelEn: 'Charity Activities & Projects',
    descAr: 'إضافة وتعديل الأنشطة الميدانية، الصور والتقارير المصورة',
    icon: HeartHandshake,
  },
  {
    key: 'branding',
    labelAr: 'إدارة الصور والشعارات وغلاف البانر',
    labelFr: 'Identité visuelle et bannières',
    labelEn: 'Branding & Banner Images',
    descAr: 'رفع شعار الجمعية، صورة البانر الرئيسية وأيقونات الهوية',
    icon: ImageIcon,
  },
  {
    key: 'polls',
    labelAr: 'إدارة التصويت والقرارات',
    labelFr: 'Sondages et votes des membres',
    labelEn: 'Polls & Resolutions Voting',
    descAr: 'طرح قرارات الجمعية للاستطلاع والتصويت وتتبع النتائج',
    icon: Vote,
  },
  {
    key: 'uiElements',
    labelAr: 'إدارة وتخصيص عناصر الواجهة',
    labelFr: 'Éléments de l\'interface',
    labelEn: 'UI Elements Visibility',
    descAr: 'التحكم في إظهار أو إخفاء أقسام وبطاقات الواجهة العامة',
    icon: Eye,
  },
  {
    key: 'fields',
    labelAr: 'إدارة حقول تسجيل المنخرطين',
    labelFr: 'Champs d\'inscription des membres',
    labelEn: 'Member Registration Fields',
    descAr: 'إضافة أو تعديل الحقول المطلوبة عند تسجيل المنخرطين الجدد',
    icon: SlidersHorizontal,
  },
  {
    key: 'accessControl',
    labelAr: 'تحكم في الدخول إلى لوحة التحكم',
    labelFr: 'Contrôle d\'accès à l\'administration',
    labelEn: 'Admin Access Control',
    descAr: 'التحكم في إظهار زر الدخول العام أو تفعيل الدخول المخفي عبر النقر 3 مرات على الشعار',
    icon: ShieldCheck,
  },
  {
    key: 'settings',
    labelAr: 'إدارة الإعدادات العامة للجمعية',
    labelFr: 'Paramètres généraux de l\'association',
    labelEn: 'General Association Settings',
    descAr: 'اسم الجمعية، بيانات الاتصال، الحساب البنكي والهوية الرسمية',
    icon: Settings,
  },
  {
    key: 'audit',
    labelAr: 'إدارة التقارير وسجل العمليات',
    labelFr: 'Journal d\'audit et rapports',
    labelEn: 'Audit Logs & Reports',
    descAr: 'سجل تدقيق شامل وتتبع كافة التغييرات والعمليات المنفذة',
    icon: History,
  },
  {
    key: 'backup',
    labelAr: 'إدارة النسخ الاحتياطي واستعادة البيانات',
    labelFr: 'Sauvegarde et restauration',
    labelEn: 'Backup & Restore Management',
    descAr: 'تصدير نسخة احتياطية مشفرة واستيراد واسترجاع البيانات',
    icon: Database,
  },
];

export const ManageSubAdmins: React.FC<ManageSubAdminsProps> = ({
  subAdmins,
  onUpdateSubAdmins,
  auditLogs,
  onLogAudit,
  currentAdminSession,
  addToast,
  lang,
}) => {
  const { isEnabled: isSectionGloballyEnabled } = useAssociationSectionsConfig();
  const enabledAdminSectionsConfig = ADMIN_SECTIONS_CONFIG.filter((sec) => isSectionGloballyEnabled(sec.key));

  const [activeSubTab, setActiveSubTab] = useState<'list' | 'create' | 'logs'>('list');

  // Delete Confirmation Modal State
  const [deletingAdmin, setDeletingAdmin] = useState<SubAdmin | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  // Status Toggling State (tracks admin id currently being toggled)
  const [togglingAdminId, setTogglingAdminId] = useState<string | null>(null);

  // Dynamic Feedback Banner
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error' | 'info', message: string) => {
    if (addToast) {
      addToast(type, message);
    }
    setFeedbackBanner({ type, message });
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // New Sub-Admin Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [notes, setNotes] = useState('');
  const [permissions, setPermissions] = useState<Record<AdminSectionKey, SectionPermission>>(createDefaultPermissions());
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals for Editing
  const [editingPermissionsAdmin, setEditingPermissionsAdmin] = useState<SubAdmin | null>(null);
  const [tempPermissions, setTempPermissions] = useState<Record<AdminSectionKey, SectionPermission>>(createDefaultPermissions());

  const [editingAccountAdmin, setEditingAccountAdmin] = useState<SubAdmin | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editNotes, setEditNotes] = useState('');
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Real-time username validation for new sub-admin form
  const cleanCreateUsername = username.trim();
  const createUsernameFormatCheck = cleanCreateUsername ? validateMemberUsernameFormat(cleanCreateUsername) : null;
  const isCreateUsernameDuplicate = cleanCreateUsername && createUsernameFormatCheck?.valid ? isSubAdminUsernameTaken(cleanCreateUsername, subAdmins) : false;
  const activeCreateUsernameErr =
    usernameError ||
    (cleanCreateUsername && createUsernameFormatCheck && !createUsernameFormatCheck.valid ? createUsernameFormatCheck.error : null) ||
    (isCreateUsernameDuplicate ? 'اسم المستخدم هذا مستخدم بالفعل من طرف حساب آخر ضمن النظام المعتمد.' : null);
  const isCreateUsernameValid = Boolean(cleanCreateUsername && createUsernameFormatCheck?.valid && !isCreateUsernameDuplicate && !usernameError);

  // Real-time username validation for edit account modal
  const cleanEditUsername = editUsername.trim();
  const editUsernameFormatCheck = cleanEditUsername ? validateMemberUsernameFormat(cleanEditUsername) : null;
  const isEditUsernameDuplicate = cleanEditUsername && editUsernameFormatCheck?.valid ? isSubAdminUsernameTaken(cleanEditUsername, subAdmins, editingAccountAdmin?.id) : false;
  const activeEditUsernameErr =
    (cleanEditUsername && editUsernameFormatCheck && !editUsernameFormatCheck.valid ? editUsernameFormatCheck.error : null) ||
    (isEditUsernameDuplicate ? 'اسم المستخدم هذا مستخدم بالفعل من طرف حساب آخر ضمن النظام المعتمد.' : null);
  const isEditUsernameValid = Boolean(cleanEditUsername && editUsernameFormatCheck?.valid && !isEditUsernameDuplicate);

  // Search in table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Logs Search / Filter
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Handle Level Change for a Section in Creation Form
  const handleSectionLevelChange = (sectionKey: AdminSectionKey, level: PermissionLevel) => {
    setPermissions((prev) => {
      const current = prev[sectionKey] || {
        sectionKey,
        canView: false,
        canAdd: false,
        canEdit: false,
        canDelete: false,
      };
      return {
        ...prev,
        [sectionKey]: applyPermissionLevel(current, level),
      };
    });
  };

  // Handle Granular Checkbox in Creation Form
  const handleToggleGranularAction = (
    sectionKey: AdminSectionKey, 
    action: 'canView' | 'canAdd' | 'canEdit' | 'canDelete'
  ) => {
    setPermissions((prev) => {
      const current = prev[sectionKey] || {
        sectionKey,
        canView: false,
        canAdd: false,
        canEdit: false,
        canDelete: false,
      };
      const updated = { ...current, [action]: !current[action] };
      // If view is unchecked, uncheck add, edit, delete
      if (action === 'canView' && !updated.canView) {
        updated.canAdd = false;
        updated.canEdit = false;
        updated.canDelete = false;
      }
      // If add/edit/delete checked, view must be checked
      if ((action === 'canAdd' || action === 'canEdit' || action === 'canDelete') && updated[action]) {
        updated.canView = true;
      }
      return {
        ...prev,
        [sectionKey]: updated,
      };
    });
  };

  // Batch Presets
  const handleSetAllSectionsLevel = (level: PermissionLevel) => {
    const updated: Record<AdminSectionKey, SectionPermission> = {} as any;
    ADMIN_SECTIONS_CONFIG.forEach((sec) => {
      const base: SectionPermission = {
        sectionKey: sec.key,
        canView: false,
        canAdd: false,
        canEdit: false,
        canDelete: false,
      };
      updated[sec.key] = applyPermissionLevel(base, level);
    });
    setPermissions(updated);
  };

  // Create Sub-Admin Submit
  const handleCreateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setUsernameError(null);

    const cleanName = fullName.trim();
    const cleanUsername = username.trim();
    const cleanPhone = phone.trim().replace(/[\s\-\.\(\)]/g, '');
    const cleanPass = password.trim();

    if (!cleanName || !cleanUsername || !cleanPhone || !cleanPass) {
      setFormError('يرجى ملء جميع الحقول الإلزامية (الاسم الكامل، اسم المستخدم، رقم الهاتف، وكلمة المرور).');
      return;
    }

    const usernameFormat = validateMemberUsernameFormat(cleanUsername);
    if (!usernameFormat.valid) {
      const err = usernameFormat.error || 'صيغة اسم المستخدم غير صالحة.';
      setUsernameError(err);
      setFormError(err);
      return;
    }

    if (isSubAdminUsernameTaken(cleanUsername, subAdmins)) {
      const err = 'اسم المستخدم هذا مستخدم بالفعل من طرف حساب آخر ضمن النظام المعتمد.';
      setUsernameError(err);
      setFormError(err);
      return;
    }

    if (cleanPhone.length < 8) {
      setFormError('يرجى إدخال رقم هاتف صحيح يتكون من 8 أرقام على الأقل.');
      return;
    }

    if (cleanPass.length < 6) {
      setFormError('يجب أن تتكون كلمة المرور من 6 أحرف أو أرقام على الأقل.');
      return;
    }

    if (cleanPass !== confirmPassword.trim()) {
      setFormError('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      return;
    }

    // Check duplicate phone
    const existingPhone = subAdmins.find((a) => a.phone.replace(/[\s\-\.\(\)]/g, '') === cleanPhone);
    if (existingPhone) {
      setFormError('يوجد بالفعل حساب أدمن مسجل برقم الهاتف هذا.');
      return;
    }

    setIsSubmitting(true);
    try {
      const salt = generateSalt();
      const hash = await hashPasswordWithSalt(cleanPass, salt);

      const newAdmin: SubAdmin = {
        id: `subadmin-${Date.now()}`,
        fullName: cleanName,
        username: cleanUsername,
        phone: cleanPhone,
        passwordHash: hash,
        passwordSalt: salt,
        plainPassword: cleanPass,
        status,
        createdAt: new Date().toISOString(),
        permissions,
        notes: notes.trim() || undefined,
        tenantId: currentAdminSession?.tenantId || 'tenant_nour',
      };

      const updated = [newAdmin, ...subAdmins];
      onUpdateSubAdmins(updated);

      // Persist directly to backend database on disk
      await apiCreateSubAdmin(newAdmin, currentAdminSession).catch((err) => {
        console.warn('Backend create sub-admin sync failed:', err);
      });

      onLogAudit(
        'create',
        'sub_admin',
        `إنشاء حساب أدمن من الدرجة الثانية جديد: ${cleanName} (اسم المستخدم: @${cleanUsername} - هاتف: ${cleanPhone})`,
        currentAdminSession?.fullName || 'الأدمن الرئيسي (Super Admin)',
        'super_admin',
        currentAdminSession?.phone
      );

      setFormSuccess(`تم إنشاء حساب الأدمن «${cleanName}» بنجاح وتعيين صلاحياته المخصصة.`);
      showFeedback('success', `تم إنشاء حساب الأدمن «${cleanName}» وحفظه في قاعدة البيانات بنجاح.`);
      // Reset form
      setFullName('');
      setUsername('');
      setUsernameError(null);
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setNotes('');
      setPermissions(createDefaultPermissions());
      setStatus('active');

      setTimeout(() => {
        setActiveSubTab('list');
        setFormSuccess(null);
      }, 1500);
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء تشفير كلمة المرور وحفظ الحساب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Sub-Admin Status (Active / Disabled)
  const handleToggleStatus = async (admin: SubAdmin) => {
    // Security check: Only Super Admin can toggle status
    const isSuper = !currentAdminSession || currentAdminSession.type === 'super_admin' || currentAdminSession.role === 'main_admin';
    if (!isSuper) {
      showFeedback('error', 'محظور أمنياً: تفعيل أو تعطيل حسابات الأدمن مخصص حصرياً للأدمن الرئيسي.');
      return;
    }

    const newStatus: 'active' | 'inactive' = admin.status === 'active' ? 'inactive' : 'active';
    setTogglingAdminId(admin.id);

    try {
      // 1. Update on server database first
      const res = await apiToggleSubAdminStatus(admin.id, newStatus, currentAdminSession);
      if (!res.success && res.error) {
        showFeedback('error', res.error);
        setTogglingAdminId(null);
        return;
      }

      // 2. Update locally while strictly preserving all permissions and existing data
      const updated = subAdmins.map((a) => (a.id === admin.id ? { ...a, status: newStatus, updatedAt: new Date().toISOString() } : a));
      onUpdateSubAdmins(updated);

      // 3. Log audit
      onLogAudit(
        'update',
        'sub_admin',
        `${newStatus === 'active' ? 'تفعيل' : 'تعطيل'} حساب الأدمن من الدرجة الثانية: ${admin.fullName}`,
        currentAdminSession?.fullName || 'الأدمن الرئيسي (Super Admin)',
        'super_admin',
        currentAdminSession?.phone
      );

      // 4. Show success message exactly as requested
      const msg = newStatus === 'active' ? 'تم تفعيل الأدمن بنجاح.' : 'تم تعطيل الأدمن بنجاح.';
      showFeedback('success', msg);
    } catch (err: any) {
      showFeedback('error', err?.message || 'حدث خطأ أثناء تعديل حالة الحساب.');
    } finally {
      setTogglingAdminId(null);
    }
  };

  // Confirm Permanent Deletion from Database
  const handleConfirmDelete = async () => {
    if (!deletingAdmin) return;
    setDeleteModalError(null);

    // Security check: Prevent deleting main admin / super admin
    if (deletingAdmin.id === 'main_admin' || deletingAdmin.id === 'super_admin' || deletingAdmin.id.startsWith('super-')) {
      setDeleteModalError('محظور أمنياً: لا يمكن حذف حساب الأدمن الرئيسي.');
      return;
    }

    const isSuper = !currentAdminSession || currentAdminSession.type === 'super_admin' || currentAdminSession.role === 'main_admin';
    if (!isSuper) {
      setDeleteModalError('محظور أمنياً: حذف حسابات الأدمن مخصص حصرياً للأدمن الرئيسي.');
      return;
    }

    setIsDeleting(true);
    try {
      const targetAdmin = deletingAdmin;
      // 1. Call server API to delete permanently from JSON database on disk
      const res = await apiDeleteSubAdmin(targetAdmin.id, currentAdminSession);
      if (!res.success && res.error) {
        setDeleteModalError(res.error);
        setIsDeleting(false);
        return;
      }

      // 2. Record deletion locally and remove immediately from React state without page reload
      recordDeletedSubAdminId(targetAdmin.id, currentAdminSession?.tenantId);
      const updated = subAdmins.filter((a) => a.id !== targetAdmin.id);
      onUpdateSubAdmins(updated);

      // 3. Log audit entry
      onLogAudit(
        'delete',
        'sub_admin',
        `حذف حساب الأدمن من الدرجة الثانية نهائياً من قاعدة البيانات: ${targetAdmin.fullName} (هاتف: ${targetAdmin.phone})`,
        currentAdminSession?.fullName || 'الأدمن الرئيسي (Super Admin)',
        'super_admin',
        currentAdminSession?.phone
      );

      // 4. Close modal and show success toast
      setDeletingAdmin(null);
      showFeedback('success', `تم حذف حساب الأدمن «${targetAdmin.fullName}» نهائياً من قاعدة البيانات بنجاح.`);
    } catch (err: any) {
      setDeleteModalError(err?.message || 'حدث خطأ أثناء محاولة حذف الحساب من قاعدة البيانات.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Edit Permissions Modal
  const handleOpenEditPermissions = (admin: SubAdmin) => {
    setEditingPermissionsAdmin(admin);
    setTempPermissions({ ...admin.permissions });
  };

  // Save Permissions Modal
  const handleSavePermissionsModal = async () => {
    if (!editingPermissionsAdmin) return;

    const targetAdmin = editingPermissionsAdmin;
    const updatedAdmin: SubAdmin = {
      ...targetAdmin,
      permissions: tempPermissions,
      updatedAt: new Date().toISOString(),
    };

    const updated = subAdmins.map((a) => (a.id === targetAdmin.id ? updatedAdmin : a));
    onUpdateSubAdmins(updated);

    // Sync with backend API
    apiUpdateSubAdmin(updatedAdmin, currentAdminSession).catch((err) => {
      console.warn('Update permissions on server failed:', err);
    });

    onLogAudit(
      'update',
      'sub_admin',
      `تحديث الصلاحيات المخصصة للأدمن من الدرجة الثانية: ${targetAdmin.fullName}`,
      currentAdminSession?.fullName || 'الأدمن الرئيسي (Super Admin)',
      'super_admin',
      currentAdminSession?.phone
    );

    showFeedback('success', `تم تحديث صلاحيات الأدمن «${targetAdmin.fullName}» بنجاح.`);
    setEditingPermissionsAdmin(null);
  };

  // Open Edit Account Modal
  const handleOpenEditAccount = (admin: SubAdmin) => {
    setEditingAccountAdmin(admin);
    setEditName(admin.fullName);
    setEditUsername(admin.username || '');
    setEditPhone(admin.phone);
    setEditNewPassword('');
    setEditStatus(admin.status);
    setEditNotes(admin.notes || '');
    setEditModalError(null);
  };

  // Save Edit Account Modal
  const handleSaveEditAccountModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccountAdmin) return;
    setEditModalError(null);

    const cleanName = editName.trim();
    const cleanUsername = editUsername.trim();
    const cleanPhone = editPhone.trim().replace(/[\s\-\.\(\)]/g, '');

    if (!cleanName || !cleanPhone) {
      setEditModalError('الاسم الكامل ورقم الهاتف حقول إلزامية.');
      return;
    }

    if (cleanUsername) {
      const formatCheck = validateMemberUsernameFormat(cleanUsername);
      if (!formatCheck.valid) {
        setEditModalError(formatCheck.error || 'صيغة اسم المستخدم غير صالحة.');
        return;
      }
      if (isSubAdminUsernameTaken(cleanUsername, subAdmins, editingAccountAdmin.id)) {
        setEditModalError('اسم المستخدم هذا مستخدم بالفعل من طرف حساب آخر ضمن النظام المعتمد.');
        return;
      }
    }

    // Check duplicate phone if changed
    if (cleanPhone !== editingAccountAdmin.phone.replace(/[\s\-\.\(\)]/g, '')) {
      const dup = subAdmins.find((a) => a.id !== editingAccountAdmin.id && a.phone.replace(/[\s\-\.\(\)]/g, '') === cleanPhone);
      if (dup) {
        setEditModalError('يوجد حساب أدمن آخر مسجل بهذا الرقم.');
        return;
      }
    }

    let newHash = editingAccountAdmin.passwordHash;
    let newSalt = editingAccountAdmin.passwordSalt;

    if (editNewPassword.trim()) {
      if (editNewPassword.trim().length < 6) {
        setEditModalError('يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.');
        return;
      }
      newSalt = generateSalt();
      newHash = await hashPasswordWithSalt(editNewPassword.trim(), newSalt);
    }

    const updatedAdmin: SubAdmin = {
      ...editingAccountAdmin,
      fullName: cleanName,
      username: cleanUsername || undefined,
      phone: cleanPhone,
      passwordHash: newHash,
      passwordSalt: newSalt,
      ...(editNewPassword.trim() ? { plainPassword: editNewPassword.trim() } : {}),
      status: editStatus,
      notes: editNotes.trim() || undefined,
      tenantId: editingAccountAdmin.tenantId || currentAdminSession?.tenantId || 'tenant_nour',
      updatedAt: new Date().toISOString(),
    };

    const updated = subAdmins.map((a) => (a.id === editingAccountAdmin.id ? updatedAdmin : a));
    onUpdateSubAdmins(updated);

    // Sync with backend API
    await apiUpdateSubAdmin(updatedAdmin, currentAdminSession).catch((err) => {
      console.warn('Update admin on server failed:', err);
    });

    onLogAudit(
      'update',
      'sub_admin',
      `تعديل بيانات الحساب للأدمن من الدرجة الثانية: ${cleanName} ${editNewPassword.trim() ? '(مع تحديث كلمة المرور)' : ''}`,
      currentAdminSession?.fullName || 'الأدمن الرئيسي (Super Admin)',
      'super_admin',
      currentAdminSession?.phone
    );

    showFeedback('success', `تم تحديث بيانات حساب الأدمن «${cleanName}» بنجاح.`);
    setEditingAccountAdmin(null);
  };

  // Filtered SubAdmins
  const filteredAdmins = subAdmins.filter((admin) => {
    const matchesSearch = 
      admin.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (admin.username && admin.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      admin.phone.includes(searchQuery) ||
      (admin.notes && admin.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || admin.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Filtered Activity Logs for SubAdmins
  const subAdminLogs = auditLogs.filter((log) => {
    const isSubAdminAction = 
      log.adminType === 'sub_admin' || 
      subAdmins.some((sa) => log.performedBy.includes(sa.fullName) || log.performedBy.includes(sa.phone));

    if (!isSubAdminAction) return false;

    if (!logSearchQuery) return true;

    return (
      log.performedBy.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.description.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(logSearchQuery.toLowerCase())
    );
  });

  // Count permitted sections for an admin (only counting globally enabled sections)
  const countPermittedSections = (perms: Record<AdminSectionKey, SectionPermission>) => {
    if (!perms) return 0;
    return Object.values(perms).filter((p) => p?.canView && isSectionGloballyEnabled(p.sectionKey)).length;
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Guarantee Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 text-white border border-emerald-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>صلاحيات خاصة بالأدمن الرئيسي فقط (Super Admin)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              إضافة وإدارة أدمن من الدرجة الثانية بصلاحيات مخصصة
            </h2>
            <p className="text-emerald-200/90 text-xs sm:text-sm max-w-2xl leading-relaxed">
              يمكنك من خلال هذا القسم إنشاء حسابات أدمن فرعية وتحديد أقسام ومستوى الصلاحيات (عرض، إضافة، تعديل، حذف، أو صلاحية كاملة) بدقة لكل أدمن بشكل مستقل ومعزول تماماً.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-white/15 text-center">
              <span className="text-[11px] text-emerald-200 block">إجمالي الأدمن</span>
              <span className="text-xl font-mono font-black text-white">{subAdmins.length}</span>
            </div>
            <div className="bg-emerald-500/20 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-emerald-400/30 text-center">
              <span className="text-[11px] text-emerald-300 block">نشط مفعّل</span>
              <span className="text-xl font-mono font-black text-emerald-300">
                {subAdmins.filter((a) => a.status === 'active').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Internal Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('list')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeSubTab === 'list'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>قائمة الأدمن من الدرجة الثانية ({subAdmins.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('create')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeSubTab === 'create'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>إنشاء أدمن جديد وتعيين الصلاحيات</span>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeSubTab === 'logs'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>سجل نشاط الأدمن ({subAdminLogs.length})</span>
        </button>
      </div>

      {/* Dynamic Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 border shadow-xs transition-all ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : feedbackBanner.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-300'
              : 'bg-blue-50 text-blue-900 border-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : feedbackBanner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. LIST OF SECONDARY ADMINS */}
      {activeSubTab === 'list' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم، الهاتف، أو الملاحظات..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-hidden"
              >
                <option value="all">جميع الحالات</option>
                <option value="active">الحسابات النشطة (Active) فقط</option>
                <option value="inactive">الحسابات المعطلة (Disabled) فقط</option>
              </select>

              <button
                onClick={() => setActiveSubTab('create')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors whitespace-nowrap shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة أدمن جديد</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right rtl:text-right ltr:text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">الأدمن</th>
                    <th className="py-3.5 px-4">رقم الهاتف</th>
                    <th className="py-3.5 px-4">الأقسام المصرح بها</th>
                    <th className="py-3.5 px-4">حالة الحساب</th>
                    <th className="py-3.5 px-4">تاريخ الإنشاء</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold">لا يوجد أدمن من الدرجة الثانية مسجل حتى الآن.</p>
                        <p className="text-xs text-slate-400 mt-1">انقر على زر «إضافة أدمن جديد» لإضافة أول حساب وتخصيص صلاحياته.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAdmins.map((admin) => {
                      const permittedCount = countPermittedSections(admin.permissions);
                      const permittedList = enabledAdminSectionsConfig.filter(
                        (sec) => admin.permissions?.[sec.key]?.canView
                      );

                      return (
                        <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold font-mono">
                                {admin.fullName.charAt(0)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">{admin.fullName}</span>
                                {admin.username && (
                                  <span className="text-[11px] text-emerald-700 font-mono font-semibold block">
                                    @{admin.username}
                                  </span>
                                )}
                                {admin.notes && (
                                  <span className="text-[11px] text-slate-500 block truncate max-w-xs">{admin.notes}</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                            {admin.phone}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                              {permittedList.length === 0 ? (
                                <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md text-[11px] font-bold">
                                  لا توجد أقسام مصرح بها
                                </span>
                              ) : (
                                <>
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    {permittedCount} قسم مصرح
                                  </span>
                                  {permittedList.slice(0, 3).map((p) => (
                                    <span key={p.key} className="px-1.5 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700">
                                      {p.labelAr}
                                    </span>
                                  ))}
                                  {permittedList.length > 3 && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      +{permittedList.length - 3} أخرى
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {admin.status === 'active' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>نشط / Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>معطل / Disabled</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-slate-500 text-xs font-mono">
                            {new Date(admin.createdAt).toLocaleDateString('ar-MA')}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-2">
                              {/* Edit Permissions Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditPermissions(admin)}
                                title="تعديل الصلاحيات المخصصة"
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors flex items-center gap-1 text-xs font-bold shadow-2xs"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>الصلاحيات</span>
                              </button>

                              {/* Edit Account Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditAccount(admin)}
                                title="تعديل بيانات الحساب وكلمة المرور"
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1 text-xs font-bold shadow-2xs"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>

                              {/* Toggle Status Button (تفعيل / تعطيل) */}
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(admin)}
                                disabled={togglingAdminId === admin.id}
                                title={admin.status === 'active' ? 'تعطيل الحساب الإداري' : 'تفعيل الحساب الإداري'}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs disabled:opacity-50 ${
                                  admin.status === 'active'
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                                }`}
                              >
                                {togglingAdminId === admin.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                ) : admin.status === 'active' ? (
                                  <>
                                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                                    <span>تعطيل</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>تفعيل</span>
                                  </>
                                )}
                              </button>

                              {/* Delete Button (حذف الأدمن مع نافذة تأكيد) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteModalError(null);
                                  setDeletingAdmin(admin);
                                }}
                                title="حذف الأدمن نهائياً من قاعدة البيانات"
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center gap-1 text-xs font-bold shadow-2xs"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>حذف</span>
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

      {/* 2. CREATE NEW SUB-ADMIN FORM */}
      {activeSubTab === 'create' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900">
              إنشاء حساب أدمن من الدرجة الثانية جديد
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              أدخل بيانات الأدمن، كلمة المرور، ثم قم بتحديد الصلاحيات الدقيقة لكل قسم من أقسام لوحة التحكم.
            </p>
          </div>

          {formError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateSubAdmin} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الاسم الكامل للأدمن <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: ذ. عبد الرحيم المرابط"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              {/* حقل اسم المستخدم (مطابق لصفحة تسجيل منخرط جديد) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المستخدم <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUsername(val);
                      setUsernameError(null);
                      if (formError) setFormError(null);
                    }}
                    placeholder="مثال: ahmed24"
                    autoComplete="username"
                    className={`w-full bg-slate-50 border ${
                      activeCreateUsernameErr
                        ? 'border-rose-400 focus:border-rose-600'
                        : isCreateUsernameValid
                        ? 'border-emerald-500 focus:border-emerald-600'
                        : 'border-slate-300 focus:border-emerald-600'
                    } rounded-xl py-2.5 px-9 text-xs sm:text-sm focus:bg-white outline-hidden transition-all`}
                  />
                  <User className="w-4 h-4 text-slate-400 absolute top-3.5 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
                </div>
                <p className="text-[11px] font-medium text-slate-500">
                  يجب أن يتكون اسم المستخدم من 4 حروف على الأقل ورقمين على الأقل، ويجب الجمع بين الحروف والأرقام.
                </p>
                {activeCreateUsernameErr && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{activeCreateUsernameErr}</span>
                  </p>
                )}
                {isCreateUsernameValid && (
                  <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>اسم المستخدم صالح ومتاح للاستخدام</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0612345678"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-9 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  حالة الحساب الأولية
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold text-slate-800 outline-hidden"
                >
                  <option value="active">مفعّل (يمكنه تسجيل الدخول فوراً)</option>
                  <option value="inactive">غير مفعّل (معطل مؤقتاً)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  كلمة المرور <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6 أحرف أو أرقام على الأقل"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تأكيد كلمة المرور <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات أو الصفة والمهام
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: منسق الأنشطة، نائب أمين المال..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                />
              </div>
            </div>

            {/* Granular Permissions Section */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>تحديد الصلاحيات الدقيقة لكل قسم</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    اختر الصلاحية المناسبة لكل قسم (عرض فقط، إضافة، تعديل، حذف، أو صلاحية كاملة).
                  </p>
                </div>

                {/* Quick Batch Presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSetAllSectionsLevel('full')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors"
                  >
                    صلاحية كاملة للكل
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllSectionsLevel('view')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 transition-colors"
                  >
                    عرض فقط للكل
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllSectionsLevel('none')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                  >
                    إلغاء تحديد الكل
                  </button>
                </div>
              </div>

              {/* Sections Matrix */}
              <div className="space-y-3">
                {enabledAdminSectionsConfig.map((sec) => {
                  const perm = permissions[sec.key] || {
                    sectionKey: sec.key,
                    canView: false,
                    canAdd: false,
                    canEdit: false,
                    canDelete: false,
                  };
                  const currentLevel = getPermissionLevel(perm);
                  const Icon = sec.icon;

                  return (
                    <div
                      key={sec.key}
                      className={`p-3.5 rounded-xl border transition-all ${
                        perm.canView
                          ? 'bg-white border-emerald-300 shadow-xs'
                          : 'bg-slate-100/70 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              perm.canView
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-bold text-xs sm:text-sm text-slate-900">
                              {sec.labelAr}
                            </h5>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {sec.descAr}
                            </p>
                          </div>
                        </div>

                        {/* Controls: Presets Dropdown & Checkboxes */}
                        <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
                          {/* Quick Preset Selector */}
                          <select
                            value={currentLevel}
                            onChange={(e) => handleSectionLevelChange(sec.key, e.target.value as any)}
                            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-hidden"
                          >
                            <option value="none">ممنوع الوصول</option>
                            <option value="view">عرض فقط</option>
                            <option value="add">إضافة فقط</option>
                            <option value="edit">تعديل فقط</option>
                            <option value="delete">حذف فقط</option>
                            <option value="view_add_edit">عرض + إضافة + تعديل</option>
                            <option value="full">صلاحية كاملة</option>
                          </select>

                          {/* Granular Toggles */}
                          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg text-[11px]">
                            <label className="flex items-center gap-1 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={perm.canView}
                                onChange={() => handleToggleGranularAction(sec.key, 'canView')}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-medium">عرض</span>
                            </label>

                            <label className="flex items-center gap-1 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={perm.canAdd}
                                onChange={() => handleToggleGranularAction(sec.key, 'canAdd')}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-medium">إضافة</span>
                            </label>

                            <label className="flex items-center gap-1 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={perm.canEdit}
                                onChange={() => handleToggleGranularAction(sec.key, 'canEdit')}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-medium">تعديل</span>
                            </label>

                            <label className="flex items-center gap-1 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={perm.canDelete}
                                onChange={() => handleToggleGranularAction(sec.key, 'canDelete')}
                                className="rounded text-rose-600 focus:ring-rose-500"
                              />
                              <span className="font-medium text-rose-700">حذف</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveSubTab('list')}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold text-xs sm:text-sm shadow-md transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري الحفظ والتشفير...' : 'إنشاء الأدمن وحفظ الصلاحيات'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. ACTIVITY LOGS OF SUB-ADMINS */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3" />
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="بحث في سجل نشاط الأدمن..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
              />
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {subAdminLogs.length} عملية مسجلة
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {subAdminLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <History className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold">لا توجد عمليات مسجلة للأدمن من الدرجة الثانية بعد.</p>
                  <p className="text-xs text-slate-400 mt-1">يتم توثيق كل تسجيل دخول أو تعديل أو إضافة تلقائياً هنا في سجل التدقيق.</p>
                </div>
              ) : (
                subAdminLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900">{log.performedBy}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {log.action}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{log.description}</p>
                      </div>
                    </div>

                    <div className="text-left rtl:text-left font-mono text-[11px] text-slate-400 flex-shrink-0">
                      <div>{new Date(log.timestamp).toLocaleDateString('ar-MA')}</div>
                      <div>{new Date(log.timestamp).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Permissions */}
      <AnimatePresence>
        {editingPermissionsAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col my-6"
            >
              <div className="bg-gradient-to-r from-emerald-900 to-teal-900 p-5 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">
                    تعديل الصلاحيات: {editingPermissionsAdmin.fullName}
                  </h3>
                  <p className="text-emerald-200 text-xs mt-0.5">
                    الهاتف: {editingPermissionsAdmin.phone}
                  </p>
                </div>
                <button
                  onClick={() => setEditingPermissionsAdmin(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-700">
                    حدد الصلاحيات المسموح بها للأدمن بدقة:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const allFull: any = {};
                        ADMIN_SECTIONS_CONFIG.forEach((s) => {
                          allFull[s.key] = applyPermissionLevel({ sectionKey: s.key, canView: false, canAdd: false, canEdit: false, canDelete: false }, 'full');
                        });
                        setTempPermissions(allFull);
                      }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800"
                    >
                      صلاحية كاملة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allNone: any = {};
                        ADMIN_SECTIONS_CONFIG.forEach((s) => {
                          allNone[s.key] = { sectionKey: s.key, canView: false, canAdd: false, canEdit: false, canDelete: false };
                        });
                        setTempPermissions(allNone);
                      }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {enabledAdminSectionsConfig.map((sec) => {
                    const perm = tempPermissions[sec.key] || {
                      sectionKey: sec.key,
                      canView: false,
                      canAdd: false,
                      canEdit: false,
                      canDelete: false,
                    };
                    const level = getPermissionLevel(perm);
                    const Icon = sec.icon;

                    return (
                      <div
                        key={sec.key}
                        className={`p-3 rounded-xl border transition-all ${
                          perm.canView
                            ? 'bg-white border-emerald-300'
                            : 'bg-slate-50 border-slate-200 opacity-80'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-xs sm:text-sm text-slate-900 block">
                                {sec.labelAr}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                {sec.descAr}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={level}
                              onChange={(e) => {
                                const newLevel = e.target.value as PermissionLevel;
                                setTempPermissions((prev) => ({
                                  ...prev,
                                  [sec.key]: applyPermissionLevel(perm, newLevel),
                                }));
                              }}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-hidden"
                            >
                              <option value="none">ممنوع الوصول</option>
                              <option value="view">عرض فقط</option>
                              <option value="add">إضافة فقط</option>
                              <option value="edit">تعديل فقط</option>
                              <option value="delete">حذف فقط</option>
                              <option value="view_add_edit">عرض + إضافة + تعديل</option>
                              <option value="full">صلاحية كاملة</option>
                            </select>

                            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-md text-[10px]">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={perm.canView}
                                  onChange={() => {
                                    setTempPermissions((prev) => {
                                      const u = { ...perm, canView: !perm.canView };
                                      if (!u.canView) {
                                        u.canAdd = false;
                                        u.canEdit = false;
                                        u.canDelete = false;
                                      }
                                      return { ...prev, [sec.key]: u };
                                    });
                                  }}
                                />
                                <span>عرض</span>
                              </label>

                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={perm.canAdd}
                                  onChange={() => {
                                    setTempPermissions((prev) => ({
                                      ...prev,
                                      [sec.key]: { ...perm, canAdd: !perm.canAdd, canView: true },
                                    }));
                                  }}
                                />
                                <span>إضافة</span>
                              </label>

                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={perm.canEdit}
                                  onChange={() => {
                                    setTempPermissions((prev) => ({
                                      ...prev,
                                      [sec.key]: { ...perm, canEdit: !perm.canEdit, canView: true },
                                    }));
                                  }}
                                />
                                <span>تعديل</span>
                              </label>

                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={perm.canDelete}
                                  onChange={() => {
                                    setTempPermissions((prev) => ({
                                      ...prev,
                                      [sec.key]: { ...perm, canDelete: !perm.canDelete, canView: true },
                                    }));
                                  }}
                                />
                                <span className="text-rose-700">حذف</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPermissionsAdmin(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissionsModal}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                >
                  تأكيد وتطبيق الصلاحيات فوراً
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Edit Account Info */}
      <AnimatePresence>
        {editingAccountAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-gradient-to-r from-emerald-900 to-teal-900 p-5 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">تعديل بيانات الحساب</h3>
                  <p className="text-emerald-200 text-xs mt-0.5">{editingAccountAdmin.fullName}</p>
                </div>
                <button
                  onClick={() => setEditingAccountAdmin(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditAccountModal} className="p-6 space-y-4">
                {editModalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{editModalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => {
                        setEditUsername(e.target.value);
                        if (editModalError) setEditModalError(null);
                      }}
                      placeholder="مثال: ahmed24"
                      className={`w-full bg-slate-50 border ${
                        activeEditUsernameErr
                          ? 'border-rose-400 focus:border-rose-600'
                          : isEditUsernameValid
                          ? 'border-emerald-500 focus:border-emerald-600'
                          : 'border-slate-300 focus:border-emerald-600'
                      } rounded-xl p-2.5 px-9 text-xs sm:text-sm focus:bg-white outline-hidden transition-all`}
                    />
                    <User className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
                  </div>
                  {activeEditUsernameErr && (
                    <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{activeEditUsernameErr}</span>
                    </p>
                  )}
                  {isEditUsernameValid && (
                    <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>اسم المستخدم صالح ومتاح للاستخدام</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-mono focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    كلمة مرور جديدة (اتركها فارغة إذا لم ترد التغيير)
                  </label>
                  <input
                    type="password"
                    value={editNewPassword}
                    onChange={(e) => setEditNewPassword(e.target.value)}
                    placeholder="اتركها فارغة للإبقاء على الحالية"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حالة الحساب</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-hidden"
                  >
                    <option value="active">مفعّل</option>
                    <option value="inactive">معطّل (غير مفعّل)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات أو الصفة</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingAccountAdmin(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 3. CONFIRM PERMANENT DELETE MODAL */}
        {deletingAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden"
              dir="rtl"
            >
              {/* Header */}
              <div className="bg-rose-600 px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white/10 text-white">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base">تأكيد حذف الأدمن نهائياً</h3>
                    <p className="text-rose-100 text-xs mt-0.5">عملية حذف لا رجعة فيها من قاعدة البيانات</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isDeleting) {
                      setDeletingAdmin(null);
                      setDeleteModalError(null);
                    }
                  }}
                  disabled={isDeleting}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {deleteModalError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{deleteModalError}</span>
                  </div>
                )}

                {/* Primary Warning Box */}
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
                    <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    <span>تنبيه أمني هام</span>
                  </div>
                  <p className="text-xs text-rose-950 font-black leading-relaxed">
                    هل أنت متأكد من حذف هذا الأدمن؟ لا يمكن التراجع عن هذا الإجراء.
                  </p>
                  <p className="text-[11px] text-rose-700 leading-relaxed font-medium">
                    سيتم مسح حساب هذا الأدمن نهائياً من قاعدة البيانات، ولن يتمكن من الدخول إلى لوحة التحكم الإدارية مستقبلاً.
                  </p>
                </div>

                {/* Account Details Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-semibold">اسم الأدمن:</span>
                    <span className="font-bold text-slate-900">{deletingAdmin.fullName}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-semibold">رقم الهاتف:</span>
                    <span className="font-bold font-mono text-slate-800">{deletingAdmin.phone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">حالة الحساب:</span>
                    {deletingAdmin.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>نشط / Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>معطل / Disabled</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Modal Buttons */}
                <div className="pt-3 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingAdmin(null);
                      setDeleteModalError(null);
                    }}
                    disabled={isDeleting}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>جارٍ الحذف من قاعدة البيانات...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>نعم، حذف الحساب نهائياً</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
