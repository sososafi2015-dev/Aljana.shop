import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  ShieldCheck, 
  Type, 
  Phone, 
  Mail, 
  Hash, 
  Calendar, 
  Save, 
  HelpCircle,
  FileCheck,
  Building2,
  Sparkles,
  QrCode,
  Image as ImageIcon,
  Printer,
  Sliders,
  Palette,
  Layers,
  UserCheck,
  User,
  X,
  Upload,
  RefreshCw,
  FileSignature,
  PenTool,
  AlertCircle
} from 'lucide-react';
import { 
  MemberCardSettings, 
  MemberCardField, 
  MemberCardFieldType, 
  CardFieldSection, 
  Member, 
  MemberContribution,
  AssociationSettings, 
  Language,
  MemberRegistrationField
} from '../types';
import { translations } from '../translations';
import { initialMemberCardSettings } from '../initialData';
import { ensurePermanentImageUrl } from '../api/imageApi';

interface ManageMemberCardProps {
  cardSettings: MemberCardSettings;
  onUpdateCardSettings: (settings: MemberCardSettings) => void;
  members: Member[];
  contributions?: MemberContribution[];
  associationSettings: AssociationSettings;
  registrationFields?: MemberRegistrationField[];
  lang: Language;
  onLogAudit: (action: 'create' | 'update' | 'delete', description: string) => void;
}

export const ManageMemberCard: React.FC<ManageMemberCardProps> = ({
  cardSettings = initialMemberCardSettings,
  onUpdateCardSettings,
  members = [],
  contributions = [],
  associationSettings,
  registrationFields = [],
  lang,
  onLogAudit,
}) => {
  const t = translations[lang] as any;

  const [activeTab, setActiveTab] = useState<'fields' | 'preview' | 'appearance'>('fields');
  const [sectionFilter, setSectionFilter] = useState<'all' | CardFieldSection>('all');
  const [selectedPreviewMemberId, setSelectedPreviewMemberId] = useState<string>(
    members && members.length > 0 ? members[0].id : 'sample'
  );

  // Local draft state for card settings
  const [draftSettings, setDraftSettings] = useState<MemberCardSettings>(() => ({
    ...(cardSettings || initialMemberCardSettings),
    fields: cardSettings?.fields && Array.isArray(cardSettings.fields)
      ? [...cardSettings.fields]
      : [...initialMemberCardSettings.fields],
  }));

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync draftSettings when incoming cardSettings changes
  useEffect(() => {
    if (cardSettings) {
      setDraftSettings({
        ...(cardSettings || initialMemberCardSettings),
        fields: cardSettings.fields && Array.isArray(cardSettings.fields)
          ? [...cardSettings.fields]
          : [...initialMemberCardSettings.fields],
      });
      setHasUnsavedChanges(false);
    }
  }, [cardSettings]);

  // Signature & Stamp Upload states & refs
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [isUploadingStamp, setIsUploadingStamp] = useState(false);
  const signatureFileInputRef = useRef<HTMLInputElement>(null);
  const stampFileInputRef = useRef<HTMLInputElement>(null);

  // Field Edit/Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<MemberCardField | null>(null);

  // Modal Form inputs
  const [fieldLabelAr, setFieldLabelAr] = useState('');
  const [fieldLabelFr, setFieldLabelFr] = useState('');
  const [fieldLabelEn, setFieldLabelEn] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState<MemberCardFieldType>('text');
  const [fieldSection, setFieldSection] = useState<CardFieldSection>('body_grid');
  const [fieldGridWidth, setFieldGridWidth] = useState<'half' | 'full' | 'third'>('half');
  const [fieldEnabled, setFieldEnabled] = useState(true);
  const [staticContentAr, setStaticContentAr] = useState('');
  const [staticContentFr, setStaticContentFr] = useState('');
  const [fieldHelpNote, setFieldHelpNote] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Target preview member
  const sampleMember: Member = {
    id: 'sample',
    memberCode: 'ACH-001',
    fullName: 'محمد بن عبد الله الشايفي',
    phone: '0661122334',
    email: 'mohamed.chayefi@gmail.com',
    cin: 'AB123456',
    joinDate: '2024-01-10',
    renewalDate: '2025-01-10',
    annualFee: 2000,
    status: 'active',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    notes: 'عضو نشط ومساهم في الأنشطة الاجتماعية',
  };

  const previewMember = selectedPreviewMemberId === 'sample' 
    ? sampleMember 
    : members.find((m) => m.id === selectedPreviewMemberId) || sampleMember;

  // Sorting fields
  const sortedFields = [...draftSettings.fields].sort((a, b) => a.order - b.order);
  const filteredFields = sectionFilter === 'all' 
    ? sortedFields 
    : sortedFields.filter((f) => f.section === sectionFilter);

  // Save changes permanently
  const handleSaveAllChanges = () => {
    onUpdateCardSettings(draftSettings);
    setHasUnsavedChanges(false);
    onLogAudit('update', 'حفظ وتحديث تخصيصات بطاقة ووصل المنخرط');
    showToast(t.cardSettingsSavedSuccess || 'تم حفظ وتطبيق إعدادات بطاقة المنخرط بنجاح!');
  };

  // Upload Official Signature handler
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('حجم ملف التوقيع كبير جداً. الحد الأقصى المسموح به هو 10 ميغابايت.');
      return;
    }

    setIsUploadingSignature(true);
    try {
      const finalUrl = await ensurePermanentImageUrl(file, {
        category: 'signatures',
        fileName: file.name || 'signature.png',
      });

      const newSettings: MemberCardSettings = {
        ...draftSettings,
        signatureImageUrl: finalUrl,
        showSignature: true,
      };
      setDraftSettings(newSettings);
      setHasUnsavedChanges(true);
      // Persist immediately
      onUpdateCardSettings(newSettings);
      onLogAudit('update', 'رفع وتحديث صورة التوقيع الرسمي للجمعية');
      showToast('تم رفع صورة التوقيع الرسمي وحفظها بشكل دائم بنجاح!');
    } catch (err: any) {
      console.error('Signature upload error:', err);
      showToast(err?.message || 'حدث خطأ أثناء رفع صورة التوقيع.');
    } finally {
      setIsUploadingSignature(false);
    }
  };

  // Delete Official Signature
  const handleDeleteSignature = () => {
    const newSettings: MemberCardSettings = {
      ...draftSettings,
      signatureImageUrl: undefined,
    };
    setDraftSettings(newSettings);
    setHasUnsavedChanges(true);
    onUpdateCardSettings(newSettings);
    onLogAudit('delete', 'حذف صورة التوقيع الرسمي للجمعية');
    showToast('تم حذف صورة التوقيع الرسمي بنجاح.');
  };

  // Upload Official Stamp handler
  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('حجم ملف صورة الخاتم كبير جداً. الحد الأقصى 10 ميغابايت.');
      return;
    }

    setIsUploadingStamp(true);
    try {
      const finalUrl = await ensurePermanentImageUrl(file, {
        category: 'stamps',
        fileName: file.name || 'stamp.png',
      });

      const newSettings: MemberCardSettings = {
        ...draftSettings,
        stampImageUrl: finalUrl,
        showStamp: true,
      };
      setDraftSettings(newSettings);
      setHasUnsavedChanges(true);
      // Persist immediately
      onUpdateCardSettings(newSettings);
      onLogAudit('update', 'رفع وتحديث صورة الخاتم الرسمي للجمعية');
      showToast('تم رفع صورة الخاتم الرسمي وحفظها بشكل دائم بنجاح!');
    } catch (err: any) {
      console.error('Stamp upload error:', err);
      showToast(err?.message || 'حدث خطأ أثناء رفع صورة الخاتم.');
    } finally {
      setIsUploadingStamp(false);
    }
  };

  // Delete Official Stamp
  const handleDeleteStamp = () => {
    const newSettings: MemberCardSettings = {
      ...draftSettings,
      stampImageUrl: undefined,
    };
    setDraftSettings(newSettings);
    setHasUnsavedChanges(true);
    onUpdateCardSettings(newSettings);
    onLogAudit('delete', 'حذف صورة الخاتم الرسمي');
    showToast('تم حذف صورة الخاتم الرسمي بنجاح.');
  };

  // Open modal for adding a new field
  const handleOpenAddModal = () => {
    const nextOrder = draftSettings.fields.length > 0 
      ? Math.max(...draftSettings.fields.map((f) => f.order)) + 1 
      : 1;

    setEditingField(null);
    setFieldLabelAr('');
    setFieldLabelFr('');
    setFieldLabelEn('');
    setFieldKey('');
    setFieldType('text');
    setFieldSection('body_grid');
    setFieldGridWidth('half');
    setFieldEnabled(true);
    setStaticContentAr('');
    setStaticContentFr('');
    setFieldHelpNote('');
    setIsModalOpen(true);
  };

  // Open modal for editing existing field
  const handleOpenEditModal = (field: MemberCardField) => {
    setEditingField(field);
    setFieldLabelAr(field.labelAr || '');
    setFieldLabelFr(field.labelFr || '');
    setFieldLabelEn(field.labelEn || '');
    setFieldKey(field.key || '');
    setFieldType(field.type);
    setFieldSection(field.section);
    setFieldGridWidth(field.gridWidth || 'half');
    setFieldEnabled(field.enabled);
    setStaticContentAr(field.staticContentAr || '');
    setStaticContentFr(field.staticContentFr || '');
    setFieldHelpNote(field.helpNoteAr || '');
    setIsModalOpen(true);
  };

  // Save field from modal
  const handleSaveFieldModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabelAr.trim()) return;

    if (editingField) {
      // Update existing
      const updatedFields = draftSettings.fields.map((f) => {
        if (f.id === editingField.id) {
          return {
            ...f,
            labelAr: fieldLabelAr.trim(),
            labelFr: fieldLabelFr.trim() || fieldLabelAr.trim(),
            labelEn: fieldLabelEn.trim() || fieldLabelAr.trim(),
            key: fieldKey.trim() || f.key,
            type: fieldType,
            section: fieldSection,
            gridWidth: fieldGridWidth,
            enabled: fieldEnabled,
            staticContentAr: staticContentAr.trim() || undefined,
            staticContentFr: staticContentFr.trim() || undefined,
            helpNoteAr: fieldHelpNote.trim() || undefined,
          };
        }
        return f;
      });

      const newSettings = { ...draftSettings, fields: updatedFields };
      setDraftSettings(newSettings);
      setHasUnsavedChanges(true);
      showToast(`تم تعديل بيانات الحقل "${fieldLabelAr.trim()}"`);
    } else {
      // Add new field
      const nextOrder = draftSettings.fields.length > 0 
        ? Math.max(...draftSettings.fields.map((f) => f.order)) + 1 
        : 1;

      const newField: MemberCardField = {
        id: `card_custom_${Date.now()}`,
        key: fieldKey.trim() || `custom_${Date.now()}`,
        labelAr: fieldLabelAr.trim(),
        labelFr: fieldLabelFr.trim() || fieldLabelAr.trim(),
        labelEn: fieldLabelEn.trim() || fieldLabelAr.trim(),
        type: fieldType,
        section: fieldSection,
        gridWidth: fieldGridWidth,
        enabled: fieldEnabled,
        order: nextOrder,
        isSystem: false,
        staticContentAr: staticContentAr.trim() || undefined,
        staticContentFr: staticContentFr.trim() || undefined,
        helpNoteAr: fieldHelpNote.trim() || undefined,
      };

      const newSettings = {
        ...draftSettings,
        fields: [...draftSettings.fields, newField],
      };
      setDraftSettings(newSettings);
      setHasUnsavedChanges(true);
      showToast(`تمت إضافة الحقل الجديد "${fieldLabelAr.trim()}" إلى البطاقة`);
    }

    setIsModalOpen(false);
  };

  // Toggle field visibility (Keep data intact, only toggle appearance)
  const handleToggleFieldEnabled = (fieldId: string) => {
    const updatedFields = draftSettings.fields.map((f) => {
      if (f.id === fieldId) {
        return { ...f, enabled: !f.enabled };
      }
      return f;
    });
    const newSettings = { ...draftSettings, fields: updatedFields };
    setDraftSettings(newSettings);
    setHasUnsavedChanges(true);
    const target = draftSettings.fields.find((f) => f.id === fieldId);
    showToast(
      target?.enabled 
        ? `تم إخفاء الحقل "${target.labelAr}" من البطاقة (بياناته محفوظة بأمان)` 
        : `تم إظهار الحقل "${target?.labelAr}" في البطاقة`
    );
  };

  // Reorder fields
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const newSorted = [...sortedFields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSorted.length) return;

    // Swap order
    const currentOrder = newSorted[index].order;
    const targetOrder = newSorted[targetIndex].order;

    newSorted[index].order = targetOrder;
    newSorted[targetIndex].order = currentOrder;

    const newSettings = { ...draftSettings, fields: newSorted };
    setDraftSettings(newSettings);
    setHasUnsavedChanges(true);
  };

  // Delete field
  const handleDeleteField = (field: MemberCardField) => {
    if (field.isSystem) {
      if (
        window.confirm(
          `الحقل "${field.labelAr}" هو حقل نظام أساسي. لحماية التوافق يمكنك إخفاؤه من البطاقة بنقرة واحدة دون حذفه نهائياً. هل تود إخفاؤه الآن؟`
        )
      ) {
        handleToggleFieldEnabled(field.id);
      }
      return;
    }

    if (window.confirm(t.confirmDeleteCardField || `هل أنت متأكد من حذف الحقل "${field.labelAr}" من البطاقة؟`)) {
      const updatedFields = draftSettings.fields.filter((f) => f.id !== field.id);
      const newSettings = { ...draftSettings, fields: updatedFields };
      setDraftSettings(newSettings);
      setHasUnsavedChanges(true);
      showToast(`تم حذف الحقل "${field.labelAr}"`);
    }
  };

  // Reset to initial default card layout
  const handleResetToDefaults = () => {
    if (window.confirm(t.confirmResetCardLayout || 'هل تود استعادة التنسيق الافتراضي لبطاقة الانخراط والوصل؟')) {
      setDraftSettings({
        ...initialMemberCardSettings,
        fields: initialMemberCardSettings.fields.map((f) => ({ ...f })),
      });
      setHasUnsavedChanges(true);
      showToast('تم استعادة التنسيق الافتراضي بنجاح.');
    }
  };

  // Theme styling helpers
  const getThemeClasses = (theme: string) => {
    switch (theme) {
      case 'navy':
        return {
          border: 'border-blue-900',
          accentBg: 'bg-blue-50/80',
          accentBorder: 'border-blue-200',
          badgeBg: 'bg-blue-200 text-blue-950',
          headerText: 'text-blue-900',
          primary: 'text-blue-800',
          boxShadow: 'shadow-blue-900/10',
          buttonColor: 'bg-blue-800 hover:bg-blue-700',
          avatarBg: 'bg-blue-800',
        };
      case 'slate':
        return {
          border: 'border-slate-800',
          accentBg: 'bg-slate-50',
          accentBorder: 'border-slate-300',
          badgeBg: 'bg-slate-200 text-slate-900',
          headerText: 'text-slate-900',
          primary: 'text-slate-800',
          boxShadow: 'shadow-slate-900/10',
          buttonColor: 'bg-slate-800 hover:bg-slate-700',
          avatarBg: 'bg-slate-800',
        };
      case 'gold':
        return {
          border: 'border-amber-700',
          accentBg: 'bg-amber-50/70',
          accentBorder: 'border-amber-200',
          badgeBg: 'bg-amber-200 text-amber-950',
          headerText: 'text-amber-900',
          primary: 'text-amber-800',
          boxShadow: 'shadow-amber-900/10',
          buttonColor: 'bg-amber-800 hover:bg-amber-700',
          avatarBg: 'bg-amber-800',
        };
      case 'rose':
        return {
          border: 'border-rose-700',
          accentBg: 'bg-rose-50/70',
          accentBorder: 'border-rose-200',
          badgeBg: 'bg-rose-200 text-rose-950',
          headerText: 'text-rose-900',
          primary: 'text-rose-800',
          boxShadow: 'shadow-rose-900/10',
          buttonColor: 'bg-rose-700 hover:bg-rose-600',
          avatarBg: 'bg-rose-700',
        };
      case 'indigo':
        return {
          border: 'border-indigo-800',
          accentBg: 'bg-indigo-50/70',
          accentBorder: 'border-indigo-200',
          badgeBg: 'bg-indigo-200 text-indigo-950',
          headerText: 'text-indigo-900',
          primary: 'text-indigo-800',
          boxShadow: 'shadow-indigo-900/10',
          buttonColor: 'bg-indigo-800 hover:bg-indigo-700',
          avatarBg: 'bg-indigo-800',
        };
      case 'emerald':
      default:
        return {
          border: 'border-emerald-700',
          accentBg: 'bg-emerald-50/70',
          accentBorder: 'border-emerald-200',
          badgeBg: 'bg-emerald-200 text-emerald-950',
          headerText: 'text-emerald-800',
          primary: 'text-emerald-800',
          boxShadow: 'shadow-emerald-900/10',
          buttonColor: 'bg-emerald-700 hover:bg-emerald-600',
          avatarBg: 'bg-emerald-700',
        };
    }
  };

  const currentTheme = getThemeClasses(draftSettings.cardTheme || 'emerald');

  // Helper to compute preview member's total completed contributions
  const getMemberTotalPaidContributions = (m: Member) => {
    const memberPaidContribs = (contributions || []).filter((c) => {
      const isMember =
        c.memberId === m.id ||
        (c.memberCode && c.memberCode === m.memberCode) ||
        (c.memberName && c.memberName.trim().toLowerCase() === m.fullName.trim().toLowerCase());
      const isPaid = c.status === 'completed' || c.status === 'approved' || !c.status;
      return isMember && isPaid;
    });

    if (memberPaidContribs.length > 0) {
      return memberPaidContribs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    }
    return Number(m.annualFee) || 0;
  };

  // Dynamic field value resolver
  const resolveFieldValue = (field: MemberCardField, member: Member) => {
    if (field.type === 'static_text' && field.staticContentAr) {
      return field.staticContentAr;
    }

    const key = field.key;
    if (key === 'fullName') return member.fullName;
    if (key === 'memberCode') return member.memberCode;
    if (key === 'phone') return member.phone;
    if (key === 'email') return member.email || 'غير مسجل';
    if (key === 'cin') return member.cin || '---';
    if (key === 'joinDate') return member.joinDate;
    if (key === 'renewalDate') return member.renewalDate;
    if (key === 'annualFee') {
      const totalPaid = getMemberTotalPaidContributions(member);
      return `${totalPaid.toLocaleString()} ${associationSettings.currency || 'د.م'}`;
    }
    if (key === 'status') return member.status === 'active' ? (t.statusActive || 'نشط ومؤدى') : (t.statusPending || 'قيد التجديد');
    if (key === 'transparencyPledge') {
      return field.staticContentAr || `تؤكد إدارة ${associationSettings.name || 'الجمعية'} أن جميع مساهمات واشتراكات المنخرطين مسجلة وموثقة في السجل المالي العام وموجهة بشفافية تامة لدعم الأعمال الخيرية والمشاريع التنموية.`;
    }

    // Check custom fields object in member
    if (member.customFields && member.customFields[key] !== undefined) {
      return String(member.customFields[key]);
    }

    return field.staticContentAr || '---';
  };

  const getFieldTypeIcon = (type: MemberCardFieldType) => {
    switch (type) {
      case 'text':
        return <Type className="w-4 h-4 text-sky-600" />;
      case 'phone':
        return <Phone className="w-4 h-4 text-emerald-600" />;
      case 'email':
        return <Mail className="w-4 h-4 text-amber-600" />;
      case 'date':
        return <Calendar className="w-4 h-4 text-indigo-600" />;
      case 'currency':
        return <CreditCard className="w-4 h-4 text-emerald-700" />;
      case 'status_badge':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-purple-600" />;
      case 'qr_code':
        return <QrCode className="w-4 h-4 text-slate-800" />;
      case 'static_text':
        return <FileCheck className="w-4 h-4 text-blue-600" />;
      case 'signature':
        return <UserCheck className="w-4 h-4 text-amber-700" />;
      default:
        return <Type className="w-4 h-4 text-slate-600" />;
    }
  };

  const getSectionTitle = (section: CardFieldSection) => {
    switch (section) {
      case 'hero':
        return t.sectionHero || 'الصدر الرئيسي (الاسم والصورة والمبلغ)';
      case 'body_grid':
        return t.sectionBodyGrid || 'شبكة البيانات والمعلومات';
      case 'notice':
        return t.sectionNotice || 'فقرة التعهد والملاحظات';
      case 'footer':
        return t.sectionFooter || 'التذييل (الخاتم والتحقق)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900 text-emerald-400 border border-emerald-500/40 shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-bold"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-lg text-slate-900">
                {t.manageMemberCardTitle || 'تعديل وصل / بطاقة المنخرط'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                ميزة الأدمن المخصصة
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              {t.manageMemberCardDesc || 'تحكم كامل في حقول وتصميم ومحتوى بطاقة الانخراط والوصل الرسمي مع إمكانية التعديل والإضافة والترتيب والمعاينة الحية.'}
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addNewCardField || 'إضافة حقل جديد'}</span>
          </button>

          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-colors border border-slate-300"
            title="استعادة التنسيق الافتراضي"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">{t.resetCardLayout || 'الافتراضي'}</span>
          </button>

          <button
            onClick={handleSaveAllChanges}
            disabled={!hasUnsavedChanges}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs ${
              hasUnsavedChanges
                ? 'bg-emerald-700 hover:bg-emerald-600 text-white animate-pulse'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{hasUnsavedChanges ? 'حفظ التغييرات الآن *' : 'تم الحفظ'}</span>
          </button>
        </div>
      </div>

      {/* Main Mode Switcher (Fields, Appearance & Branding, Live Preview) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('fields')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'fields'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>{t.cardFieldsList || 'حقول وعناصر البطاقة'} ({draftSettings.fields.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'preview'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>{t.cardLivePreview || 'المعاينة الحية والتجربة المباشرة'}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'appearance'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>{t.cardHeaderOptions || 'خيارات الترويسة والتنسيق العام'}</span>
        </button>
      </div>

      {/* ---------------- TAB 1: FIELDS LIST & MANAGEMENT ---------------- */}
      {activeTab === 'fields' && (
        <div className="space-y-4">
          {/* Section Filter Badges */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-bold px-1">تصفية حسب الموقع:</span>
            {[
              { id: 'all', label: 'جميع الحقول' },
              { id: 'hero', label: 'الصدر الرئيسي' },
              { id: 'body_grid', label: 'شبكة البيانات' },
              { id: 'notice', label: 'فقرة التعهد' },
              { id: 'footer', label: 'التذييل والخاتم' },
            ].map((sec) => (
              <button
                key={sec.id}
                onClick={() => setSectionFilter(sec.id as any)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  sectionFilter === sec.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* Notice info banner */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong className="text-emerald-950">ملاحظة أمان وتكامل:</strong> يمكنك تعطيل إظهار أي حقل بنقرة واحدة، وسيتم إخفاؤه فوراً من البطاقة والوصل دون حذف بياناته من قاعدة بيانات المنخرطين. عند إعادة التفعيل، سيعود للظهور بنفس البيانات السابقة.
            </p>
          </div>

          {/* Fields List */}
          <div className="space-y-2.5">
            {filteredFields.map((field, idx) => {
              const originalIndex = sortedFields.findIndex((f) => f.id === field.id);
              return (
                <motion.div
                  key={field.id}
                  layout
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white shadow-xs ${
                    field.enabled ? 'border-slate-200' : 'border-slate-200/60 bg-slate-50/70 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Order Controls */}
                    <div className="flex flex-col items-center gap-0.5 text-slate-400">
                      <button
                        onClick={() => handleMoveField(originalIndex, 'up')}
                        disabled={originalIndex === 0}
                        className="p-1 hover:text-emerald-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors"
                        title="تحريك لأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        #{field.order}
                      </span>
                      <button
                        onClick={() => handleMoveField(originalIndex, 'down')}
                        disabled={originalIndex === sortedFields.length - 1}
                        className="p-1 hover:text-emerald-600 disabled:opacity-20 hover:bg-slate-100 rounded transition-colors"
                        title="تحريك لأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Field Icon */}
                    <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                      {getFieldTypeIcon(field.type)}
                    </div>

                    {/* Field Details */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900">
                          {field.labelAr}
                        </h4>
                        {field.labelFr && field.labelFr !== field.labelAr && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            ({field.labelFr})
                          </span>
                        )}
                        {field.isSystem && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            أساسي
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {getSectionTitle(field.section)}
                        </span>
                        {field.gridWidth && field.section === 'body_grid' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            {field.gridWidth === 'full' ? 'عرض كامل' : 'نصف العرض'}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>مفتاح البيانات: <code className="font-mono text-emerald-800 bg-emerald-50 px-1 rounded">{field.key}</code></span>
                        <span>•</span>
                        <span>النوع: {field.type}</span>
                      </p>

                      {/* Official Signature and Stamp status indicators on the Stamp row */}
                      {field.key === 'stamp' && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          {draftSettings.signatureImageUrl ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              <FileSignature className="w-3.5 h-3.5 text-blue-600" />
                              <span>صورة التوقيع الرسمي: معتمد ومرفوع</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>صورة التوقيع: غير مرفوعة بعد</span>
                            </span>
                          )}

                          {draftSettings.stampImageUrl ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>الخاتم الرسمي: معتمد ومرفوع</span>
                            </span>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('appearance');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            <Upload className="w-3 h-3 text-emerald-700" />
                            <span>رفع / تعديل صورة التوقيع والخاتم</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Switch */}
                  <div className="flex items-center justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggleFieldEnabled(field.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        field.enabled
                          ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {field.enabled ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-700" />
                          <span>مُفعّل وظاهر</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                          <span>مخفي من البطاقة</span>
                        </>
                      )}
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => handleOpenEditModal(field)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      title="تعديل الحقل"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteField(field)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                      title="حذف الحقل"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: LIVE CARD PREVIEW ---------------- */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          {/* Member selector for test */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-xs font-bold text-emerald-300 block">{t.previewWithMember || 'معاينة ببيانات منخرط حقيقي:'}</span>
                <span className="text-[11px] text-slate-300">اختر منخرطاً لمعاينة البطاقة فوراً كيف ستظهر عند الطباعة</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedPreviewMemberId}
                onChange={(e) => setSelectedPreviewMemberId(e.target.value)}
                className="bg-slate-800 text-white text-xs font-bold border border-slate-700 rounded-xl p-2 focus:outline-hidden"
              >
                <option value="sample">★ {t.sampleMemberPreview || 'بيانات منخرط نموذجي للاختبار'}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.memberCode})
                  </option>
                ))}
              </select>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة تجريبية</span>
              </button>
            </div>
          </div>

          {/* Interactive Document Preview Box */}
          <div className="p-6 sm:p-8 bg-white text-slate-900 rounded-2xl border-2 border-slate-300 shadow-xl max-w-2xl mx-auto printable-area">
            {/* Header */}
            <div className={`border-b-2 ${currentTheme.border} pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
              <div className="flex items-center gap-3 text-center sm:text-start rtl:sm:text-right">
                {draftSettings.showLogo && associationSettings.logoUrl && (
                  <div className="w-14 h-14 rounded-xl border border-slate-200 p-1 flex items-center justify-center overflow-hidden flex-shrink-0 bg-white">
                    <img src={associationSettings.logoUrl} alt={associationSettings.name} className="w-full h-full object-contain" />
                  </div>
                )}
                <div>
                  {draftSettings.showHeaderKingdom && (
                    <span className={`text-xs font-bold uppercase tracking-widest ${currentTheme.headerText}`}>
                      {draftSettings.subtitleAr || 'المملكة المغربية • ROYAUME DU MAROC'}
                    </span>
                  )}
                  <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">{associationSettings.name}</h1>
                  <p className="text-xs text-slate-600">{associationSettings.nameFr} | {associationSettings.nameEn}</p>
                  <p className="text-xs font-medium text-emerald-700 mt-0.5">{associationSettings.tagline}</p>
                </div>
              </div>

              {draftSettings.showLicenseInfo && (
                <div className="text-center sm:text-end rtl:sm:text-left text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="font-semibold text-slate-800">وصل ترخيص: {associationSettings.licenseNumber}</p>
                  <p>سنة التأسيس: {associationSettings.foundingYear}</p>
                  <p>تاريخ الإصدار: {new Date().toLocaleDateString('ar-MA')}</p>
                </div>
              )}
            </div>

            {/* Hero Section */}
            {draftSettings.fields.some((f) => f.section === 'hero' && f.enabled) && (
              <div className={`${currentTheme.accentBg} border ${currentTheme.accentBorder} rounded-2xl p-5 mb-6 relative overflow-hidden`}>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  {/* Photo / Avatar */}
                  {draftSettings.fields.find((f) => f.key === 'avatarUrl' && f.enabled) && (
                    <div className={`w-20 h-20 rounded-2xl ${currentTheme.avatarBg} text-white flex items-center justify-center font-bold text-2xl shadow-md overflow-hidden flex-shrink-0`}>
                      {previewMember.avatarUrl ? (
                        <img src={previewMember.avatarUrl} alt={previewMember.fullName} className="w-full h-full object-cover" />
                      ) : (
                        previewMember.fullName.charAt(0)
                      )}
                    </div>
                  )}

                  <div className="flex-1 text-center sm:text-start rtl:sm:text-right">
                    {/* Status Badge */}
                    {draftSettings.fields.find((f) => f.key === 'status' && f.enabled) && (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${currentTheme.badgeBg} mb-1`}>
                        {resolveFieldValue(draftSettings.fields.find((f) => f.key === 'status')!, previewMember)}
                      </span>
                    )}

                    {/* Full Name */}
                    {draftSettings.fields.find((f) => f.key === 'fullName' && f.enabled) && (
                      <h2 className="text-xl font-black text-slate-900">{previewMember.fullName}</h2>
                    )}

                    {/* Member Code & CIN */}
                    <div className="text-xs font-mono text-slate-600 mt-0.5 flex flex-wrap items-center gap-2 justify-center sm:justify-start rtl:sm:justify-start">
                      {draftSettings.fields.find((f) => f.key === 'memberCode' && f.enabled) && (
                        <span>رقم العضوية: {previewMember.memberCode}</span>
                      )}
                      {draftSettings.fields.find((f) => f.key === 'cin' && f.enabled) && (
                        <span>| بطاقة الهوية: {previewMember.cin || '---'}</span>
                      )}
                    </div>
                  </div>

                  {/* Annual Fee Box */}
                  {draftSettings.fields.find((f) => f.key === 'annualFee' && f.enabled) && (
                    <div className="text-center sm:text-end rtl:sm:text-left bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-xs text-slate-500 block">
                        {draftSettings.fields.find((f) => f.key === 'annualFee')?.labelAr || 'مبلغ الإشتراك والمساهمات'}
                      </span>
                      <span className={`text-xl font-extrabold ${currentTheme.primary} font-mono`}>
                        {getMemberTotalPaidContributions(previewMember).toLocaleString()} {associationSettings.currency || 'د.م'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Grid Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm mb-6">
              {draftSettings.fields
                .filter((f) => f.section === 'body_grid' && f.enabled)
                .sort((a, b) => a.order - b.order)
                .map((field) => (
                  <div
                    key={field.id}
                    className={`p-3.5 bg-slate-50 rounded-xl border border-slate-200 ${
                      field.gridWidth === 'full' ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <span className="text-slate-500 block text-xs mb-1 font-medium flex items-center gap-1.5">
                      {getFieldTypeIcon(field.type)}
                      <span>{field.labelAr}:</span>
                    </span>
                    <span className="font-semibold text-slate-800">
                      {resolveFieldValue(field, previewMember)}
                    </span>
                  </div>
                ))}
            </div>

            {/* Notice / Transparency Section */}
            {draftSettings.fields
              .filter((f) => f.section === 'notice' && f.enabled)
              .map((field) => (
                <div
                  key={field.id}
                  className={`p-4 ${currentTheme.accentBg} rounded-xl border ${currentTheme.accentBorder} text-xs text-slate-700 mb-6`}
                >
                  <p className={`font-semibold ${currentTheme.headerText} mb-1 flex items-center gap-1.5`}>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{field.labelAr}:</span>
                  </p>
                  <p>{resolveFieldValue(field, previewMember)}</p>
                </div>
              ))}

            {/* Footer Signatures & Bank Section */}
            <div className="mt-8 pt-6 border-t border-slate-300 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-slate-600">
              {draftSettings.showFooterBank && (
                <div className="space-y-1 w-full sm:w-auto">
                  <p className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{associationSettings.address}</span>
                  </p>
                  <p className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>الهاتف / واتساب: {associationSettings.phone}</span>
                  </p>
                  <p className="font-mono text-slate-500">
                    RIB: {associationSettings.ribBank} ({associationSettings.bankName})
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                {/* QR Code */}
                {draftSettings.fields.find((f) => f.key === 'qrCode' && f.enabled) && (
                  <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs text-center flex flex-col items-center">
                    <div className="w-14 h-14 bg-slate-900 text-white rounded-lg flex items-center justify-center p-1 font-mono text-[9px] text-center">
                      <QrCode className="w-10 h-10 text-white" />
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 mt-1">
                      {previewMember.memberCode}
                    </span>
                  </div>
                )}

                {/* Stamp & Official Signature Section */}
                {draftSettings.fields.find((f) => f.key === 'stamp' && f.enabled) && (draftSettings.showStamp || draftSettings.showSignature) && (
                  <div className="relative border border-dashed border-slate-300 rounded-xl p-3 bg-white/80 min-w-[220px] max-w-[340px] text-center shadow-2xs">
                    <div className="flex items-center justify-center gap-4 min-h-[68px]">
                      {/* Official Stamp */}
                      {draftSettings.showStamp && (
                        <div className="flex flex-col items-center justify-center">
                          {draftSettings.stampImageUrl ? (
                            <img
                              src={draftSettings.stampImageUrl}
                              alt="الخاتم الرسمي"
                              className="w-16 h-16 object-contain drop-shadow-xs"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-blue-600/70 flex items-center justify-center text-[9px] font-bold text-blue-700 text-center p-1">
                              {draftSettings.stampTitleAr || 'الخاتم الرسمي'}
                            </div>
                          )}
                          <span className="text-[10px] font-bold text-slate-700 mt-1 block">
                            {draftSettings.stampTitleAr || 'خاتم إدارة الجمعية'}
                          </span>
                        </div>
                      )}

                      {/* Official Signature (المطلوب) */}
                      {draftSettings.showSignature && (
                        <div className="flex flex-col items-center justify-center">
                          {draftSettings.signatureImageUrl ? (
                            <img
                              src={draftSettings.signatureImageUrl}
                              alt="التوقيع الرسمي للجمعية"
                              className="h-14 max-w-[140px] object-contain drop-shadow-xs"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-14 w-28 border-b-2 border-dashed border-slate-400 flex items-end justify-center pb-1">
                              <span className="text-[9px] text-slate-400">مكان التوقيع</span>
                            </div>
                          )}
                          <span className="text-[10px] font-bold text-slate-700 mt-1 block">
                            {draftSettings.signatureTitleAr || 'توقيع رئيس الجمعية'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1 pt-1 border-t border-slate-200/60 font-medium">
                      وثيقة إلكترونية رسمية صادرة من المنصة
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: APPEARANCE & BRANDING ---------------- */}
      {activeTab === 'appearance' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h3 className="font-bold text-base text-slate-900">
            {t.cardHeaderOptions || 'خيارات الترويسة والتنسيق العام'}
          </h3>

          {/* Color Palette Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {t.cardThemeColor || 'سمة وتنسيق ألوان البطاقة:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { id: 'emerald', name: t.themeEmerald || 'زمردي أخضر', color: 'bg-emerald-600', ring: 'ring-emerald-600' },
                { id: 'navy', name: t.themeNavy || 'أزرق ملكي', color: 'bg-blue-800', ring: 'ring-blue-800' },
                { id: 'slate', name: t.themeSlate || 'رمادي حجري', color: 'bg-slate-800', ring: 'ring-slate-800' },
                { id: 'gold', name: t.themeGold || 'ذهبي راقي', color: 'bg-amber-700', ring: 'ring-amber-700' },
                { id: 'rose', name: t.themeRose || 'وردي دافئ', color: 'bg-rose-700', ring: 'ring-rose-700' },
                { id: 'indigo', name: t.themeIndigo || 'نيلي معاصر', color: 'bg-indigo-700', ring: 'ring-indigo-700' },
              ].map((th) => (
                <button
                  key={th.id}
                  onClick={() => {
                    setDraftSettings({ ...draftSettings, cardTheme: th.id as any });
                    setHasUnsavedChanges(true);
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    draftSettings.cardTheme === th.id
                      ? `border-slate-900 ring-2 ${th.ring} bg-slate-50 font-bold text-slate-900`
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full ${th.color} shadow-xs`}></div>
                  <span className="text-xs">{th.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
            <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
              <span className="text-xs font-bold text-slate-800">{t.showLogoOnCard || 'إظهار شعار الجمعية في البطاقة'}</span>
              <input
                type="checkbox"
                checked={draftSettings.showLogo}
                onChange={(e) => {
                  setDraftSettings({ ...draftSettings, showLogo: e.target.checked });
                  setHasUnsavedChanges(true);
                }}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
              <span className="text-xs font-bold text-slate-800">{t.showKingdomHeader || 'إظهار ترويسة المملكة المغربية'}</span>
              <input
                type="checkbox"
                checked={draftSettings.showHeaderKingdom}
                onChange={(e) => {
                  setDraftSettings({ ...draftSettings, showHeaderKingdom: e.target.checked });
                  setHasUnsavedChanges(true);
                }}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
              <span className="text-xs font-bold text-slate-800">{t.showLicenseInfoOnCard || 'إظهار رقم وصل الترخيص وسنة التأسيس'}</span>
              <input
                type="checkbox"
                checked={draftSettings.showLicenseInfo}
                onChange={(e) => {
                  setDraftSettings({ ...draftSettings, showLicenseInfo: e.target.checked });
                  setHasUnsavedChanges(true);
                }}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
              <span className="text-xs font-bold text-slate-800">{t.showFooterBankOnCard || 'إظهار الحساب البنكي والعنوان في الأسفل'}</span>
              <input
                type="checkbox"
                checked={draftSettings.showFooterBank}
                onChange={(e) => {
                  setDraftSettings({ ...draftSettings, showFooterBank: e.target.checked });
                  setHasUnsavedChanges(true);
                }}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
            </label>
          </div>

          {/* ================= DEDICATED OFFICIAL STAMP & SIGNATURE SECTION ================= */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-800 border border-blue-200">
                  <FileSignature className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                    <span>الخاتم الرسمي والتوقيع</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      إعدادات مستقلة ومعتمدة
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إدارة وتخصيص صورة التوقيع الرسمي لإدارة الجمعية وصورة الخاتم لوصل وبطاقة المنخرط مع حفظ دائم على الخادم.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* 1. Official Signature (التوقيع الرسمي للجمعية - المطلوب الأساسي) */}
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <FileSignature className="w-4 h-4 text-blue-700" />
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        التوقيع الرسمي للجمعية
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs font-bold text-slate-600">
                        {draftSettings.showSignature ? 'مُفعّل' : 'مُعطّل'}
                      </span>
                      <input
                        type="checkbox"
                        checked={draftSettings.showSignature ?? true}
                        onChange={(e) => {
                          const newSettings = { ...draftSettings, showSignature: e.target.checked };
                          setDraftSettings(newSettings);
                          setHasUnsavedChanges(true);
                          onUpdateCardSettings(newSettings);
                        }}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      صفة ومسمى صاحب التوقيع (يظهر أسفل أو بجانب التوقيع):
                    </label>
                    <input
                      type="text"
                      value={draftSettings.signatureTitleAr || ''}
                      onChange={(e) => {
                        const newSettings = { ...draftSettings, signatureTitleAr: e.target.value };
                        setDraftSettings(newSettings);
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="مثال: توقيع رئيس الجمعية / الرئيس وأمين المال"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  {/* Upload Signature Box */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      صورة التوقيع الرسمي المعتمد:
                    </label>
                    <input
                      ref={signatureFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />

                    {draftSettings.signatureImageUrl ? (
                      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
                        <div className="flex items-center justify-center p-3 rounded-lg bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 border border-slate-200 min-h-[90px]">
                          <img
                            src={draftSettings.signatureImageUrl}
                            alt="التوقيع الرسمي"
                            className="max-h-16 max-w-full object-contain drop-shadow-xs"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>التوقيع الرسمي محفوظ ومُعتمد</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => signatureFileInputRef.current?.click()}
                              disabled={isUploadingSignature}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isUploadingSignature ? 'animate-spin' : ''}`} />
                              <span>تغيير التوقيع</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteSignature}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => signatureFileInputRef.current?.click()}
                        className="bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                          {isUploadingSignature ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {isUploadingSignature ? 'جارٍ رفع وحفظ صورة التوقيع...' : 'انقر هنا لرفع صورة التوقيع الرسمي للجمعية'}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            يُفضل صورة بخلفية شفافة (PNG) واضحة أو صورة ممسوحة ضوئياً (JPG/WebP)
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 mt-1">
                          الحد الأقصى: 10 ميغابايت • يُدمج تلقائياً في الوصل والبطاقة
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100/80 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    يتم إدراج هذا التوقيع تلقائياً في خانة التوقيع داخل بطاقة المنخرط الرسمية ووصولات الأداء لتعزيز مصداقية الوثائق الصادرة.
                  </span>
                </div>
              </div>

              {/* 2. Official Stamp (الخاتم الرسمي للجمعية - إعداد مستقل) */}
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        الخاتم الرسمي للجمعية (إعداد مستقل)
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs font-bold text-slate-600">
                        {draftSettings.showStamp ? 'مُفعّل' : 'مُعطّل'}
                      </span>
                      <input
                        type="checkbox"
                        checked={draftSettings.showStamp}
                        onChange={(e) => {
                          const newSettings = { ...draftSettings, showStamp: e.target.checked };
                          setDraftSettings(newSettings);
                          setHasUnsavedChanges(true);
                          onUpdateCardSettings(newSettings);
                        }}
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      مسمى ونص الخاتم الرسمي:
                    </label>
                    <input
                      type="text"
                      value={draftSettings.stampTitleAr || ''}
                      onChange={(e) => {
                        const newSettings = { ...draftSettings, stampTitleAr: e.target.value };
                        setDraftSettings(newSettings);
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="مثال: خاتم إدارة الجمعية"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium focus:border-emerald-600 outline-hidden"
                    />
                  </div>

                  {/* Upload Stamp Box */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      صورة الخاتم الدائري أو المعتمد:
                    </label>
                    <input
                      ref={stampFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleStampUpload}
                      className="hidden"
                    />

                    {draftSettings.stampImageUrl ? (
                      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
                        <div className="flex items-center justify-center p-3 rounded-lg bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50 border border-slate-200 min-h-[90px]">
                          <img
                            src={draftSettings.stampImageUrl}
                            alt="الخاتم الرسمي"
                            className="w-16 h-16 object-contain drop-shadow-xs"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>الخاتم الرسمي معتمد ومفعل</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => stampFileInputRef.current?.click()}
                              disabled={isUploadingStamp}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isUploadingStamp ? 'animate-spin' : ''}`} />
                              <span>تغيير الخاتم</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteStamp}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => stampFileInputRef.current?.click()}
                        className="bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40 p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                          {isUploadingStamp ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {isUploadingStamp ? 'جارٍ رفع وحفظ صورة الخاتم...' : 'انقر هنا لرفع صورة الخاتم الرسمي للجمعية'}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            صورة دائرية أو مربعة بخلفية شفافة بدقة عالية
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100/80 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    الخاتم والتوقيع إعدادان مستقلان تماماً؛ يمكنك تفعيل أحدهما أو كليهما بحرية بحسب الإجراءات المعتمدة لجمعيتكم.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: ADD / EDIT CARD FIELD ---------------- */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-auto"
            >
              <div className="flex items-center justify-between p-4 bg-slate-900 text-white">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm sm:text-base">
                    {editingField ? (t.editCardField || 'تعديل حقل البطاقة') : (t.addNewCardField || 'إضافة حقل جديد للبطاقة')}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveFieldModal} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.fieldLabelAr || 'عنوان الحقل (بالعربية)'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={fieldLabelAr}
                    onChange={(e) => setFieldLabelAr(e.target.value)}
                    placeholder="مثال: فصيلة الدم، المهنة، هاتف الطوارئ..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.fieldLabelFr || 'العنوان بالفرنسية'}
                    </label>
                    <input
                      type="text"
                      value={fieldLabelFr}
                      onChange={(e) => setFieldLabelFr(e.target.value)}
                      placeholder="Ex: Profession, Groupe sanguin..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:border-emerald-600 focus:bg-white outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.fieldLabelEn || 'العنوان بالإنجليزية'}
                    </label>
                    <input
                      type="text"
                      value={fieldLabelEn}
                      onChange={(e) => setFieldLabelEn(e.target.value)}
                      placeholder="Ex: Profession, Blood Type..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:border-emerald-600 focus:bg-white outline-hidden"
                    />
                  </div>
                </div>

                {/* Field Source Key */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.fieldKeyOrSource || 'مصدر / مفتاح البيانات'}
                  </label>
                  <select
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono focus:border-emerald-600 focus:bg-white outline-hidden"
                  >
                    <option value="">-- اختر مفتاح الحقل أو مخصص --</option>
                    <optgroup label="بيانات المنخرط الأساسية">
                      <option value="fullName">الاسم الكامل (fullName)</option>
                      <option value="memberCode">رقم العضوية (memberCode)</option>
                      <option value="cin">بطاقة الهوية (cin)</option>
                      <option value="phone">الهاتف (phone)</option>
                      <option value="email">البريد الإلكتروني (email)</option>
                      <option value="joinDate">تاريخ الانخراط (joinDate)</option>
                      <option value="renewalDate">تاريخ التجديد (renewalDate)</option>
                      <option value="annualFee">واجب الانخراط (annualFee)</option>
                      <option value="status">حالة العضوية (status)</option>
                      <option value="avatarUrl">الصورة الشخصية (avatarUrl)</option>
                    </optgroup>
                    <optgroup label="عناصر التوثيق والتحقق">
                      <option value="transparencyPledge">ملاحظة تأكيد الشفافية (transparencyPledge)</option>
                      <option value="qrCode">رمز الاستجابة السريعة (qrCode)</option>
                      <option value="stamp">خانة الخاتم والتوقيع (stamp)</option>
                    </optgroup>
                    {registrationFields.length > 0 && (
                      <optgroup label="حقول استمارة التسجيل المخصصة">
                        {registrationFields.map((rf) => (
                          <option key={rf.id} value={rf.name || rf.id}>
                            {rf.labelAr} ({rf.name || rf.id})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="حقل مخصص / نص ثابت">
                      <option value="static">نص ثابت وملاحظة خاصة (static)</option>
                    </optgroup>
                  </select>
                </div>

                {/* Data Type & Placement Section */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.fieldType || 'نوع البيانات'}
                    </label>
                    <select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold focus:border-emerald-600 focus:bg-white outline-hidden"
                    >
                      <option value="text">نص عادي (Text)</option>
                      <option value="phone">رقم هاتف (Phone)</option>
                      <option value="email">بريد إلكتروني (Email)</option>
                      <option value="date">تاريخ (Date)</option>
                      <option value="currency">مبلغ مالي (Currency)</option>
                      <option value="status_badge">شارة الحالة (Status)</option>
                      <option value="static_text">نص ثابت (Static Notice)</option>
                      <option value="qr_code">رمز QR (QR Code)</option>
                      <option value="signature">خاتم وتوقيع (Signature)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.cardSectionPlacement || 'موقع الحقل في البطاقة'}
                    </label>
                    <select
                      value={fieldSection}
                      onChange={(e) => setFieldSection(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold focus:border-emerald-600 focus:bg-white outline-hidden"
                    >
                      <option value="hero">الصدر الرئيسي (Hero)</option>
                      <option value="body_grid">شبكة البيانات (Main Grid)</option>
                      <option value="notice">فقرة التعهد (Notice)</option>
                      <option value="footer">التذييل والخاتم (Footer)</option>
                    </select>
                  </div>
                </div>

                {/* Grid Width if in body_grid */}
                {fieldSection === 'body_grid' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.fieldWidth || 'عرض الحقل في الشبكة'}
                    </label>
                    <select
                      value={fieldGridWidth}
                      onChange={(e) => setFieldGridWidth(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold focus:border-emerald-600 focus:bg-white outline-hidden"
                    >
                      <option value="half">نصف العرض (عمودان في السطر)</option>
                      <option value="full">عرض كامل (سطر كامل مستقل)</option>
                    </select>
                  </div>
                )}

                {/* Static Content if static */}
                {(fieldType === 'static_text' || fieldKey === 'static') && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.staticContent || 'النص الثابت المخصص'}
                    </label>
                    <textarea
                      rows={3}
                      value={staticContentAr}
                      onChange={(e) => setStaticContentAr(e.target.value)}
                      placeholder="أدخل النص أو الملاحظة التي ستظهر دائماً في البطاقة..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:border-emerald-600 focus:bg-white outline-hidden"
                    />
                  </div>
                )}

                {/* Special Stamp & Signature Customization inside modal */}
                {(fieldKey === 'stamp' || editingField?.key === 'stamp') && (
                  <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileSignature className="w-4 h-4 text-blue-700" />
                      <h5 className="font-bold text-xs text-blue-950">
                        تخصيص صورة التوقيع الرسمي والخاتم
                      </h5>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      يمكنك رفع صورة التوقيع الرسمي للجمعية واعتمادها لتظهر تلقائياً في وصل وبطاقة المنخرط.
                    </p>

                    {/* Signature box */}
                    <div className="bg-white rounded-xl p-3 border border-blue-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                          {draftSettings.signatureImageUrl ? (
                            <img
                              src={draftSettings.signatureImageUrl}
                              alt="التوقيع"
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <PenTool className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            صورة التوقيع الرسمي
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {draftSettings.signatureImageUrl ? 'مرفوع ومحفوظ' : 'غير مرفوع'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => signatureFileInputRef.current?.click()}
                          disabled={isUploadingSignature}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{draftSettings.signatureImageUrl ? 'تغيير' : 'رفع صورة التوقيع'}</span>
                        </button>
                        {draftSettings.signatureImageUrl && (
                          <button
                            type="button"
                            onClick={handleDeleteSignature}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف التوقيع"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Enabled checkbox */}
                <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldEnabled}
                    onChange={(e) => setFieldEnabled(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    تفعيل إظهار هذا الحقل في بطاقة المنخرط والوصل فوراً
                  </span>
                </label>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ الحقل</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
