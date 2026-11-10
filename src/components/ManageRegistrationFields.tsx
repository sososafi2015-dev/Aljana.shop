import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  SlidersHorizontal, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  ShieldCheck, 
  Type, 
  Phone, 
  Mail, 
  Hash, 
  Calendar, 
  ListFilter, 
  CheckSquare, 
  UploadCloud, 
  AlignLeft, 
  X, 
  Save, 
  HelpCircle,
  Layers,
  FileCheck,
  Lock
} from 'lucide-react';
import { MemberRegistrationField, FieldType, Language } from '../types';
import { translations } from '../translations';

import { initialRegistrationFields } from '../initialData';

interface ManageRegistrationFieldsProps {
  fields: MemberRegistrationField[];
  onUpdateFields: (fields: MemberRegistrationField[]) => void;
  lang: Language;
  onLogAudit: (action: 'create' | 'update' | 'delete', description: string) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  isGlobalMasterAdmin?: boolean;
  onSaveAllGlobal?: (fields: MemberRegistrationField[]) => Promise<boolean>;
}

const CORE_AUTH_FIELD_IDS = ['fullName', 'username', 'password', 'confirmPassword'];

export const ManageRegistrationFields: React.FC<ManageRegistrationFieldsProps> = ({
  fields,
  onUpdateFields,
  lang,
  onLogAudit,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  isGlobalMasterAdmin = false,
  onSaveAllGlobal,
}) => {
  const t = translations[lang];

  const [activeView, setActiveView] = useState<'list' | 'preview'>('list');
  const [editingField, setEditingField] = useState<MemberRegistrationField | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<MemberRegistrationField | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);

  // Form State for Adding / Editing a field
  const [fieldId, setFieldId] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [labelFr, setLabelFr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [placeholderAr, setPlaceholderAr] = useState('');
  const [placeholderFr, setPlaceholderFr] = useState('');
  const [placeholderEn, setPlaceholderEn] = useState('');
  const [helpTextAr, setHelpTextAr] = useState('');
  const [helpTextFr, setHelpTextFr] = useState('');
  const [helpTextEn, setHelpTextEn] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [isRequired, setIsRequired] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [optionsText, setOptionsText] = useState('');
  const [isSystemField, setIsSystemField] = useState(false);

  // Preview form test data state
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  const openAddModal = () => {
    const newId = `custom_${Date.now()}`;
    setFieldId(newId);
    setLabelAr('');
    setLabelFr('');
    setLabelEn('');
    setPlaceholderAr('');
    setPlaceholderFr('');
    setPlaceholderEn('');
    setHelpTextAr('');
    setHelpTextFr('');
    setHelpTextEn('');
    setFieldType('text');
    setIsRequired(false);
    setIsEnabled(true);
    setOptionsText('');
    setIsSystemField(false);
    setEditingField(null);
    setIsModalOpen(true);
  };

  const openEditModal = (field: MemberRegistrationField) => {
    setFieldId(field.id);
    setLabelAr(field.labelAr || '');
    setLabelFr(field.labelFr || '');
    setLabelEn(field.labelEn || '');
    setPlaceholderAr(field.placeholderAr || '');
    setPlaceholderFr(field.placeholderFr || '');
    setPlaceholderEn(field.placeholderEn || '');
    setHelpTextAr(field.helpTextAr || '');
    setHelpTextFr(field.helpTextFr || '');
    setHelpTextEn(field.helpTextEn || '');
    setFieldType(field.type);
    setIsRequired(field.required);
    setIsEnabled(field.enabled);
    setOptionsText(field.options ? field.options.join('\n') : '');
    setIsSystemField(CORE_AUTH_FIELD_IDS.includes(field.id));
    setEditingField(field);
    setIsModalOpen(true);
  };

  const handleSaveField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelAr.trim()) return;

    let parsedOptions: string[] | undefined = undefined;
    if (fieldType === 'select') {
      parsedOptions = optionsText
        .split(/[\n,]+/)
        .map((opt) => opt.trim())
        .filter((opt) => opt.length > 0);
      if (parsedOptions.length === 0) {
        parsedOptions = ['خيار 1', 'خيار 2'];
      }
    }

    if (editingField) {
      // Update existing field
      const updatedFields = fields.map((f) => {
        if (f.id === editingField.id) {
          return {
            ...f,
            labelAr: labelAr.trim(),
            labelFr: labelFr.trim() || labelAr.trim(),
            labelEn: labelEn.trim() || labelAr.trim(),
            placeholderAr: placeholderAr.trim() || undefined,
            placeholderFr: placeholderFr.trim() || undefined,
            placeholderEn: placeholderEn.trim() || undefined,
            helpTextAr: helpTextAr.trim() || undefined,
            helpTextFr: helpTextFr.trim() || undefined,
            helpTextEn: helpTextEn.trim() || undefined,
            type: fieldType,
            required: isRequired,
            enabled: isEnabled,
            options: parsedOptions,
          };
        }
        return f;
      });

      onUpdateFields(updatedFields);
      onLogAudit('update', `تعديل إعدادات حقل التسجيل: "${labelAr.trim()}"`);
      showToast('تم حفظ تعديلات الحقل وتطبيقها بنجاح');
    } else {
      // Add new field
      const nextOrder = fields.length > 0 ? Math.max(...fields.map((f) => f.order)) + 1 : 1;
      const newField: MemberRegistrationField = {
        id: fieldId || `custom_${Date.now()}`,
        name: fieldId || `custom_${Date.now()}`,
        labelAr: labelAr.trim(),
        labelFr: labelFr.trim() || labelAr.trim(),
        labelEn: labelEn.trim() || labelAr.trim(),
        placeholderAr: placeholderAr.trim() || undefined,
        placeholderFr: placeholderFr.trim() || undefined,
        placeholderEn: placeholderEn.trim() || undefined,
        helpTextAr: helpTextAr.trim() || undefined,
        helpTextFr: helpTextFr.trim() || undefined,
        helpTextEn: helpTextEn.trim() || undefined,
        type: fieldType,
        required: isRequired,
        enabled: isEnabled,
        order: nextOrder,
        options: parsedOptions,
        isSystem: false,
      };

      const updatedFields = [...fields, newField];
      onUpdateFields(updatedFields);
      onLogAudit('create', `إضافة حقل جديد إلى استمارة التسجيل: "${labelAr.trim()}"`);
      showToast('تمت إضافة الحقل الجديد وحفظه بنجاح');
    }

    setIsModalOpen(false);
  };

  // Toggle field enable/disable status
  const handleToggleEnabled = (id: string, currentStatus: boolean, fieldLabel: string) => {
    const isCurrentlyEnabled = currentStatus !== false && (currentStatus as any) !== 'false';
    const nextEnabled = !isCurrentlyEnabled;
    const updated = fields.map((f) => (f.id === id ? { ...f, enabled: nextEnabled } : f));
    onUpdateFields(updated);
    onLogAudit(
      'update',
      `${nextEnabled ? 'تفعيل' : 'تعطيل'} حقل التسجيل: "${fieldLabel}" مع الحفاظ على البيانات السابقة`
    );
    showToast(
      nextEnabled
        ? `تم تفعيل حقل "${fieldLabel}" وإظهاره في استمارة التسجيل بنجاح`
        : `تم تعطيل حقل "${fieldLabel}" وإخفاؤه من استمارة التسجيل فوراً بنجاح`
    );
  };

  // Toggle field required/optional status directly
  const handleToggleRequired = (id: string, currentRequired: boolean, fieldLabel: string) => {
    if (!canEdit) return;
    const isCurrentlyRequired = Boolean(currentRequired) && (currentRequired as any) !== 'false';
    const nextRequired = !isCurrentlyRequired;
    const updated = fields.map((f) => (f.id === id ? { ...f, required: nextRequired } : f));
    onUpdateFields(updated);
    onLogAudit(
      'update',
      `تغيير حالة إلزامية الحقل "${fieldLabel}" إلى ${nextRequired ? 'إلزامي' : 'اختياري'}`
    );
    showToast(`تم جعل حقل "${fieldLabel}" ${nextRequired ? 'إلزاميًا' : 'اختياريًا'} وحفظ التعديل`);
  };

  // Reordering fields
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newFields = [...sortedFields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;

    // Swap positions and assign clean sequential order numbers
    const temp = newFields[index];
    newFields[index] = newFields[targetIndex];
    newFields[targetIndex] = temp;

    const normalizedOrder = newFields.map((f, idx) => ({
      ...f,
      order: idx + 1,
    }));

    onUpdateFields(normalizedOrder);
    onLogAudit('update', `إعادة ترتيب حقول تسجيل المنخرطين`);
    showToast('تم تحديث ترتيب ظهور الحقول وحفظه بنجاح');
  };

  // Delete field trigger (opens custom in-app confirmation modal)
  const handleDeleteField = (field: MemberRegistrationField) => {
    if (!canDelete) return;
    setFieldToDelete(field);
  };

  // Confirm delete handler (called from custom in-app modal)
  const confirmDeleteField = () => {
    if (!fieldToDelete) return;
    const remaining = fields
      .filter((f) => f.id !== fieldToDelete.id)
      .sort((a, b) => a.order - b.order)
      .map((f, idx) => ({ ...f, order: idx + 1 }));
    onUpdateFields(remaining);
    onLogAudit('delete', `حذف حقل "${fieldToDelete.labelAr}" من استمارة التسجيل مع الحفاظ على بيانات المنخرطين السابقين`);
    showToast(`تم حذف حقل "${fieldToDelete.labelAr}" وحفظ التعديلات في قاعدة البيانات بنجاح`);
    setFieldToDelete(null);
  };

  const handleExplicitSaveAll = async () => {
    setIsSavingGlobal(true);
    try {
      if (onSaveAllGlobal) {
        await onSaveAllGlobal(sortedFields);
      } else {
        onUpdateFields(sortedFields);
      }
      onLogAudit('update', 'حفظ وتعميم إعدادات حقول تسجيل المنخرطين في قاعدة بيانات Firebase');
      showToast(
        isGlobalMasterAdmin
          ? 'تم حفظ جميع إعدادات حقول تسجيل المنخرطين في قاعدة بيانات Firebase وتعميمها على جميع الجمعيات بنجاح!'
          : 'تم حفظ جميع إعدادات حقول تسجيل المنخرطين في قاعدة البيانات بنجاح!'
      );
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const handleRestoreDefaultFields = () => {
    setIsRestoreModalOpen(true);
  };

  const confirmRestoreDefaultFields = () => {
    const defaults = initialRegistrationFields.map((f, idx) => ({ ...f, order: idx + 1 }));
    onUpdateFields(defaults);
    onLogAudit('update', 'استعادة الإعدادات الافتراضية لحقول تسجيل المنخرطين');
    showToast('تمت استعادة الحقول الافتراضية وحفظها بنجاح');
    setIsRestoreModalOpen(false);
  };

  const getFieldTypeIcon = (type: FieldType) => {
    switch (type) {
      case 'text':
        return <Type className="w-4 h-4 text-sky-600" />;
      case 'phone':
        return <Phone className="w-4 h-4 text-emerald-600" />;
      case 'email':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'number':
        return <Hash className="w-4 h-4 text-amber-600" />;
      case 'date':
        return <Calendar className="w-4 h-4 text-purple-600" />;
      case 'select':
        return <ListFilter className="w-4 h-4 text-indigo-600" />;
      case 'checkbox':
        return <CheckSquare className="w-4 h-4 text-emerald-600" />;
      case 'file':
        return <UploadCloud className="w-4 h-4 text-rose-600" />;
      case 'password':
        return <Lock className="w-4 h-4 text-emerald-700" />;
      case 'textarea':
        return <AlignLeft className="w-4 h-4 text-slate-600" />;
    }
  };

  const getFieldTypeLabel = (type: FieldType) => {
    if (type === 'password') {
      return lang === 'ar' ? 'كلمة مرور (مشفرة)' : lang === 'fr' ? 'Mot de passe (chiffré)' : 'Password (Encrypted)';
    }
    return t[`type_${type}` as keyof typeof t] || type;
  };

  const getLocalizedLabel = (field: MemberRegistrationField) => {
    if (lang === 'ar') return field.labelAr || field.name;
    if (lang === 'fr') return field.labelFr || field.labelAr || field.name;
    return field.labelEn || field.labelAr || field.name;
  };

  return (
    <div className="space-y-6">
      {/* Header & Assurance Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {isGlobalMasterAdmin ? 'تعديل إعدادات قسم: إدارة حقول تسجيل المنخرطين' : t.fieldsManagementTitle}
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
                {isGlobalMasterAdmin
                  ? 'تحكم كامل للمدير العام في أسماء الحقول، أنواعها، إضافة حقول جديدة، تعديل الحقول الحالية، حذف الحقول غير المطلوبة، تحديد الإلزامية، وترتيب الظهور في جميع الجمعيات.'
                  : t.fieldsManagementDesc}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canAdd && (
              <button
                type="button"
                onClick={openAddModal}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/40 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addNewField}</span>
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={handleExplicitSaveAll}
                disabled={isSavingGlobal}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-extrabold shadow-md transition-colors cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSavingGlobal
                    ? 'جاري الحفظ...'
                    : isGlobalMasterAdmin
                    ? 'حفظ التعديلات وتعميمها'
                    : 'حفظ التعديلات'}
                </span>
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={handleRestoreDefaultFields}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
                title="استعادة الحقول الافتراضية"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">استعادة الافتراضي</span>
              </button>
            )}
          </div>
        </div>

        {/* Safe Data Preservation Banner */}
        <div className="mt-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-200">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{t.dataSafetyGuarantee}</span>
        </div>
      </div>

      {/* Toast Notification */}
      {successToast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{successToast}</span>
        </motion.div>
      )}

      {/* Sub-navigation: List vs Live Form Preview */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeView === 'list'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>قائمة الحقول ({fields.length})</span>
          </button>

          <button
            onClick={() => setActiveView('preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeView === 'preview'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>{t.liveFormPreview}</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {sortedFields.filter((f) => f.enabled).length} حقل مفعل حاليًا
        </div>
      </div>

      {/* View 1: Fields Table & Management */}
      {activeView === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start rtl:text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 text-center w-16">{t.fieldOrder}</th>
                  <th className="p-3">اسم الحقل (عربي / فرنسي)</th>
                  <th className="p-3">{t.fieldType}</th>
                  <th className="p-3 text-center">الإلزامية</th>
                  <th className="p-3 text-center">حالة الظهور (مفعّل / غير مفعّل)</th>
                  <th className="p-3 text-center">الترتيب</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedFields.map((field, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === sortedFields.length - 1;

                  return (
                    <tr
                      key={field.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !field.enabled ? 'bg-slate-50/50 opacity-65' : ''
                      }`}
                    >
                      {/* Order Number Badge */}
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs font-mono">
                          {idx + 1}
                        </span>
                      </td>

                      {/* Field Label */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{field.labelAr}</span>
                          {field.labelFr && field.labelFr !== field.labelAr && (
                            <span className="text-xs text-slate-400 font-normal">
                              ({field.labelFr})
                            </span>
                          )}
                          {field.isSystem && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                              أساسي
                            </span>
                          )}
                        </div>
                        {field.helpTextAr && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{field.helpTextAr}</p>
                        )}
                      </td>

                      {/* Field Type Badge */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200">
                          {getFieldTypeIcon(field.type)}
                          <span>{getFieldTypeLabel(field.type)}</span>
                        </div>
                      </td>

                      {/* Required vs Optional */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleToggleRequired(field.id, field.required, field.labelAr)}
                          title="انقر لتبديل الحقل بين إلزامي واختياري"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                            !canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
                          } ${
                            field.required
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {field.required ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{t.fieldRequired}</span>
                            </>
                          ) : (
                            <span>{t.fieldOptional}</span>
                          )}
                        </button>
                      </td>

                      {/* Enabled / Disabled Toggle Switch with Clear «مفعّل» / «غير مفعّل» Status */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={field.enabled}
                            disabled={!canEdit}
                            onClick={() => {
                              if (!canEdit) return;
                              handleToggleEnabled(field.id, field.enabled, field.labelAr);
                            }}
                            title={field.enabled ? 'انقر لإخفاء الحقل وتعطيل ظهوره في الاستمارة' : 'انقر لتفعيل الحقل وإظهاره في الاستمارة'}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              !canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                            } ${
                              field.enabled ? 'bg-emerald-600 ring-2 ring-emerald-500/20' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                field.enabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                              field.enabled
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${field.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>{field.enabled ? 'مفعّل' : 'غير مفعّل'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Reorder Buttons */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {canEdit ? (
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              disabled={isFirst}
                              onClick={() => handleMove(idx, 'up')}
                              title={t.fieldMoveUp}
                              className={`p-1 rounded hover:bg-white text-slate-700 transition-colors cursor-pointer ${
                                isFirst ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isLast}
                              onClick={() => handleMove(idx, 'down')}
                              title={t.fieldMoveDown}
                              className={`p-1 rounded hover:bg-white text-slate-700 transition-colors cursor-pointer ${
                                isLast ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs font-mono">#{idx + 1}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(field)}
                              title={t.edit}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!canDelete) return;
                                handleDeleteField(field);
                              }}
                              title={CORE_AUTH_FIELD_IDS.includes(field.id) ? 'تعطيل الحقل' : t.delete}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* View 2: Live Interactive Form Preview */}
      {activeView === 'preview' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600" />
                <span>{t.liveFormPreview}</span>
              </h3>
              <p className="text-xs text-slate-500">
                هذه المعاينة توضح بدقة كيف ستظهر استمارة التسجيل الحالية بعد التعديلات وتفعيل/تعطيل الحقول.
              </p>
            </div>
            <button
              onClick={() => setPreviewValues({})}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold underline"
            >
              مسح حقول التجربة
            </button>
          </div>

          <div className="max-w-2xl mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            {sortedFields
              .filter((field) => field.enabled)
              .map((field) => {
                const label = getLocalizedLabel(field);
                const placeholder =
                  lang === 'ar'
                    ? field.placeholderAr
                    : lang === 'fr'
                    ? field.placeholderFr
                    : field.placeholderEn;
                const helpText =
                  lang === 'ar' ? field.helpTextAr : lang === 'fr' ? field.helpTextFr : field.helpTextEn;

                return (
                  <div key={field.id} className="space-y-1.5">
                    {field.type !== 'checkbox' && (
                      <label className="block text-xs sm:text-sm font-bold text-slate-700">
                        {label} {field.required && <span className="text-rose-500">*</span>}
                      </label>
                    )}

                    {/* Field type input rendering */}
                    {field.type === 'text' && (
                      <input
                        type="text"
                        required={field.required}
                        value={previewValues[field.id] || ''}
                        onChange={(e) =>
                          setPreviewValues({ ...previewValues, [field.id]: e.target.value })
                        }
                        placeholder={placeholder || `أدخل ${label}...`}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 outline-hidden"
                      />
                    )}

                    {field.type === 'phone' && (
                      <div className="relative">
                        <input
                          type="tel"
                          required={field.required}
                          value={previewValues[field.id] || ''}
                          onChange={(e) =>
                            setPreviewValues({ ...previewValues, [field.id]: e.target.value })
                          }
                          placeholder={placeholder || '0661234567'}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-mono focus:border-emerald-600 outline-hidden"
                        />
                        <Phone className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
                      </div>
                    )}

                    {field.type === 'email' && (
                      <div className="relative">
                        <input
                          type="email"
                          required={field.required}
                          value={previewValues[field.id] || ''}
                          onChange={(e) =>
                            setPreviewValues({ ...previewValues, [field.id]: e.target.value })
                          }
                          placeholder={placeholder || 'member@example.com'}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 outline-hidden"
                        />
                        <Mail className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
                      </div>
                    )}

                    {field.type === 'number' && (
                      <div className="relative">
                        <input
                          type="number"
                          required={field.required}
                          value={previewValues[field.id] || ''}
                          onChange={(e) =>
                            setPreviewValues({ ...previewValues, [field.id]: e.target.value })
                          }
                          placeholder={placeholder || '1000'}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-mono font-bold focus:border-emerald-600 outline-hidden"
                        />
                        <span className="absolute top-2.5 left-3 rtl:left-auto rtl:right-3 text-xs font-semibold text-slate-400 pointer-events-none">
                          {t.currencyShort}
                        </span>
                      </div>
                    )}

                    {field.type === 'date' && (
                      <input
                        type="date"
                        required={field.required}
                        value={previewValues[field.id] || new Date().toISOString().slice(0, 10)}
                        onChange={(e) =>
                          setPreviewValues({ ...previewValues, [field.id]: e.target.value })
                        }
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 outline-hidden"
                      />
                    )}

                    {field.type === 'select' && (
                      <select
                        required={field.required}
                        value={previewValues[field.id] || ''}
                        onChange={(e) =>
                          setPreviewValues({ ...previewValues, [field.id]: e.target.value })
                        }
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 outline-hidden"
                      >
                        <option value="">-- اختر {label} --</option>
                        {field.options?.map((opt, i) => (
                          <option key={i} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === 'checkbox' && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id={`preview_${field.id}`}
                          checked={!!previewValues[field.id]}
                          onChange={(e) =>
                            setPreviewValues({ ...previewValues, [field.id]: e.target.checked })
                          }
                          className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <label htmlFor={`preview_${field.id}`} className="text-xs text-slate-700">
                          <span className="font-bold block text-slate-900">{label}</span>
                          {helpText && <span className="text-slate-500">{helpText}</span>}
                        </label>
                      </div>
                    )}

                    {field.type === 'file' && (
                      <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl text-center">
                        <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                        <span className="text-xs text-slate-600 block font-medium">
                          اسحب الملف هنا أو اضغط للاختيار (صورة، بطاقة، وثيقة)
                        </span>
                      </div>
                    )}

                    {field.type === 'password' && (
                      <div className="relative">
                        <input
                          type="password"
                          required={field.required}
                          value={previewValues[field.id] || ''}
                          onChange={(e) =>
                            setPreviewValues({ ...previewValues, [field.id]: e.target.value })
                          }
                          placeholder={placeholder || `أدخل ${label}...`}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 outline-hidden"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
                      </div>
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        rows={2}
                        required={field.required}
                        value={previewValues[field.id] || ''}
                        onChange={(e) =>
                          setPreviewValues({ ...previewValues, [field.id]: e.target.value })
                        }
                        placeholder={placeholder || `اكتب ${label}...`}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm focus:border-emerald-600 outline-hidden"
                      />
                    )}

                    {helpText && field.type !== 'checkbox' && (
                      <p className="text-[11px] text-slate-400">{helpText}</p>
                    )}
                  </div>
                );
              })}

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-xs"
              >
                تسجيل المنخرط (زر تجريبي)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Field Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 bg-slate-900 text-white">
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-base sm:text-lg">
                    {editingField ? t.editField : t.addNewField}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveField} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Field Labels (Arabic, French, English) */}
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">
                    {t.fieldLabelAr} *
                  </label>
                  <input
                    type="text"
                    required
                    value={labelAr}
                    onChange={(e) => setLabelAr(e.target.value)}
                    placeholder="مثال: المهنة، المدينة، المؤهل..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">
                      {t.fieldLabelFr}
                    </label>
                    <input
                      type="text"
                      value={labelFr}
                      onChange={(e) => setLabelFr(e.target.value)}
                      placeholder="Ex: Profession, Ville..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">
                      {t.fieldLabelEn}
                    </label>
                    <input
                      type="text"
                      value={labelEn}
                      onChange={(e) => setLabelEn(e.target.value)}
                      placeholder="Ex: Occupation, City..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                    />
                  </div>
                </div>

                {/* Field Type Selection */}
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">
                    {t.fieldType} *
                  </label>
                  <select
                    value={fieldType}
                    disabled={['password', 'confirmPassword'].includes(editingField?.id || '')}
                    onChange={(e) => setFieldType(e.target.value as FieldType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                  >
                    <option value="text">{t.type_text}</option>
                    <option value="phone">{t.type_phone}</option>
                    <option value="email">{t.type_email}</option>
                    <option value="number">{t.type_number}</option>
                    <option value="date">{t.type_date}</option>
                    <option value="select">{t.type_select}</option>
                    <option value="checkbox">{t.type_checkbox}</option>
                    <option value="password">{lang === 'ar' ? 'كلمة مرور (مشفرة)' : 'Password'}</option>
                    <option value="file">{t.type_file}</option>
                    <option value="textarea">{t.type_textarea}</option>
                  </select>
                </div>

                {/* Options (If Select dropdown) */}
                {fieldType === 'select' && (
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">
                      {t.fieldOptions} *
                    </label>
                    <textarea
                      rows={3}
                      value={optionsText}
                      onChange={(e) => setOptionsText(e.target.value)}
                      placeholder="عضو عامل&#10;عضو شرفي&#10;متطوع"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                    />
                  </div>
                )}

                {/* Mandatory / Optional & Enabled Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-slate-800">
                      {t.fieldRequired}
                    </span>
                    <input
                      type="checkbox"
                      checked={isRequired}
                      onChange={(e) => setIsRequired(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-slate-800">
                      {t.fieldEnabled}
                    </span>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => setIsEnabled(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Placeholder & Help Text */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.fieldPlaceholder}
                    </label>
                    <input
                      type="text"
                      value={placeholderAr}
                      onChange={(e) => setPlaceholderAr(e.target.value)}
                      placeholder="النص الرمادي التوضيحي..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.fieldHelpText}
                    </label>
                    <input
                      type="text"
                      value={helpTextAr}
                      onChange={(e) => setHelpTextAr(e.target.value)}
                      placeholder="إرشادات إضافية..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                    />
                  </div>
                </div>

                {/* System Field notice */}
                {isSystemField && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>{t.systemFieldNotice}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-medium text-xs sm:text-sm hover:bg-slate-50 transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-colors flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>{t.save}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Delete Field Confirmation Modal (Custom In-App Modal - Replaces window.confirm) */}
        {fieldToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" dir="rtl">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {CORE_AUTH_FIELD_IDS.includes(fieldToDelete.id)
                      ? 'تنبيه أمان: حقل أساسي لنظام الحسابات'
                      : 'تأكيد حذف الحقل من استمارة التسجيل'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    الحقل: <span className="font-bold text-slate-800">«{fieldToDelete.labelAr}»</span>
                  </p>
                </div>
              </div>

              {CORE_AUTH_FIELD_IDS.includes(fieldToDelete.id) ? (
                <div className="space-y-4">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed">
                    حقل <strong>«{fieldToDelete.labelAr}»</strong> مرتبط بالمصادقة وتسجيل الدخول وأمان حسابات المنخرطين. لتفادي أي خلل في تسجيل الدخول، لا يُنصح بحذفه نهائيًا، ولكن يمكنك إخفاؤه وتعطيل ظهوره في الاستمارة فورياً بنقرة زر.
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setFieldToDelete(null)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleEnabled(fieldToDelete.id, true, fieldToDelete.labelAr);
                        setFieldToDelete(null);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors cursor-pointer"
                    >
                      إخفاء وتعطيل الحقل الآن
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    هل أنت متأكد من رغبتك في حذف حقل <strong>«{fieldToDelete.labelAr}»</strong> نهائيًا من نموذج تسجيل المنخرطين؟
                  </p>

                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong>ضمان سلامة البيانات:</strong> لن يتم حذف أي بيانات أو قيم سابقة للمنخرطين المسجلين في قاعدة البيانات؛ ستبقى كافة سجلاتهم ومعلوماتهم محفوظة بالكامل.
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setFieldToDelete(null)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      إلغاء التراجع
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteField}
                      className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>تأكيد الحذف نهائيًا</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Restore Defaults Confirmation Modal */}
        {isRestoreModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in" dir="rtl">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shrink-0">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">استعادة الحقول الافتراضية</h3>
                  <p className="text-xs text-slate-500 font-medium">نموذج تسجيل المنخرطين المركزي</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                هل تود استعادة القائمة والتنسيق الافتراضي لحقول استمارة تسجيل المنخرطين وتعميمها على جميع الجمعيات؟
              </p>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>ضمان الحماية:</strong> لن تتأثر بيانات أي منخرط مسجل مسبقًا في أي جمعية على المنصة.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRestoreModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmRestoreDefaultFields}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>تأكيد استعادة الحقول الافتراضية</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
