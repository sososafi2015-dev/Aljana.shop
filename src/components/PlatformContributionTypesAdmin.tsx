import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HeartHandshake, 
  Coins, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Sparkles, 
  Info, 
  Check, 
  X, 
  DollarSign, 
  Tag, 
  Store,
  Layers,
  HelpCircle,
  Save,
  Database
} from 'lucide-react';
import { ContributionTypeConfig, DonationPresetConfig } from '../types';
import { 
  getGlobalContributionTypes, 
  saveGlobalContributionTypes, 
  getGlobalDonationPresets, 
  saveGlobalDonationPresets,
  DEFAULT_CONTRIBUTION_TYPE_CONFIGS,
  DEFAULT_PRESET_CONFIGS,
  fetchGlobalContributionTypesFromServer,
  saveGlobalContributionTypesToServer
} from '../contributionTypesStorage';

interface PlatformContributionTypesAdminProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const PlatformContributionTypesAdmin: React.FC<PlatformContributionTypesAdminProps> = ({
  onShowToast,
}) => {
  // Sub-tabs: 'types' | 'presets' (Defaulting to 'types' for direct access to Contribution Types)
  const [subTab, setSubTab] = useState<'types' | 'presets'>('types');

  // Local State
  const [presets, setPresets] = useState<DonationPresetConfig[]>(getGlobalDonationPresets);
  const [types, setTypes] = useState<ContributionTypeConfig[]>(getGlobalContributionTypes);

  // Persistence & Verification States
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [saveSuccessNotification, setSaveSuccessNotification] = useState<string | null>(null);
  const [isDatabaseVerified, setIsDatabaseVerified] = useState<boolean>(true);

  // Modal / Form States for Presets
  const [isAddPresetModalOpen, setIsAddPresetModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<DonationPresetConfig | null>(null);
  const [presetAmountInput, setPresetAmountInput] = useState<string>('');
  const [presetLabelInput, setPresetLabelInput] = useState<string>('');
  const [presetIsPopularInput, setPresetIsPopularInput] = useState<boolean>(false);
  const [presetDeletingItem, setPresetDeletingItem] = useState<DonationPresetConfig | null>(null);

  // Modal / Form States for Contribution Types
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ContributionTypeConfig | null>(null);
  const [typeNameAr, setTypeNameAr] = useState<string>('');
  const [typeNameFr, setTypeNameFr] = useState<string>('');
  const [typeDescriptionAr, setTypeDescriptionAr] = useState<string>('');
  const [typeIsFinancial, setTypeIsFinancial] = useState<boolean>(true);
  const [typeShowInStore, setTypeShowInStore] = useState<boolean>(true);
  const [typeIsDefault, setTypeIsDefault] = useState<boolean>(false);
  const [typeDeletingItem, setTypeDeletingItem] = useState<ContributionTypeConfig | null>(null);

  // Restore Template Confirmation Modal
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  // Sync state on load: Load from localStorage first, then live-fetch from server DB
  useEffect(() => {
    setPresets(getGlobalDonationPresets());
    setTypes(getGlobalContributionTypes());

    let isMounted = true;
    fetchGlobalContributionTypesFromServer(true).then((freshTypes) => {
      if (isMounted && freshTypes && freshTypes.length > 0) {
        setTypes(freshTypes);
        setIsDatabaseVerified(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // =========================================================================
  // 1. PRESETS HANDLERS
  // =========================================================================

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(presetAmountInput);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      onShowToast('يرجى إدخال مبلغ تبرع صحيح أكبر من الصفر', 'error');
      return;
    }

    // Check duplicates (excluding current item if editing)
    const duplicate = presets.find(
      (p) => p.amount === amountNum && (!editingPreset || p.id !== editingPreset.id)
    );
    if (duplicate) {
      onShowToast(`المبلغ (${amountNum} د.م) موجود بالفعل في القائمة!`, 'error');
      return;
    }

    if (editingPreset) {
      // Update
      const updated = presets.map((p) =>
        p.id === editingPreset.id
          ? {
              ...p,
              amount: amountNum,
              labelAr: presetLabelInput.trim() || `${amountNum.toLocaleString('ar-MA')} د.م`,
              isPopular: presetIsPopularInput,
            }
          : p
      );
      saveGlobalDonationPresets(updated);
      setPresets(updated);
      onShowToast(`تم تعديل مبلغ التبرع إلى ${amountNum} د.م بنجاح`, 'success');
    } else {
      // Add
      const newPreset: DonationPresetConfig = {
        id: `preset-${Date.now()}`,
        amount: amountNum,
        order: presets.length + 1,
        enabled: true,
        labelAr: presetLabelInput.trim() || `${amountNum.toLocaleString('ar-MA')} د.م`,
        isPopular: presetIsPopularInput,
        createdAt: new Date().toISOString(),
      };
      const updated = [...presets, newPreset];
      saveGlobalDonationPresets(updated);
      setPresets(updated);
      onShowToast(`تمت إضافة مبلغ التبرع الجديد (${amountNum} د.م) بنجاح`, 'success');
    }

    setIsAddPresetModalOpen(false);
    setEditingPreset(null);
    setPresetAmountInput('');
    setPresetLabelInput('');
    setPresetIsPopularInput(false);
  };

  const handleTogglePreset = (id: string) => {
    const updated = presets.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    saveGlobalDonationPresets(updated);
    setPresets(updated);
    const target = presets.find((p) => p.id === id);
    onShowToast(
      target?.enabled
        ? `تم تعطيل مبلغ ${target.amount} د.م مؤقتاً`
        : `تم تفعيل مبلغ ${target?.amount} د.م ليظهر في الواجهات`,
      'info'
    );
  };

  const handleDeletePreset = () => {
    if (!presetDeletingItem) return;
    const updated = presets
      .filter((p) => p.id !== presetDeletingItem.id)
      .map((p, idx) => ({ ...p, order: idx + 1 }));
    saveGlobalDonationPresets(updated);
    setPresets(updated);
    onShowToast(`تم حذف المبلغ (${presetDeletingItem.amount} د.م) من القائمة`, 'success');
    setPresetDeletingItem(null);
  };

  const handleMovePreset = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === presets.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newItems = [...presets];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Recalculate orders
    const reordered = newItems.map((item, idx) => ({ ...item, order: idx + 1 }));
    saveGlobalDonationPresets(reordered);
    setPresets(reordered);
  };

  // =========================================================================
  // 2. CONTRIBUTION TYPES HANDLERS
  // =========================================================================

  const handleSaveType = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = typeNameAr.trim();
    if (!cleanName) {
      onShowToast('يرجى إدخال اسم نوع المساهمة بالعربية', 'error');
      return;
    }

    if (editingType) {
      // Update
      const updated = types.map((t) => {
        if (t.id === editingType.id) {
          return {
            ...t,
            nameAr: cleanName,
            nameFr: typeNameFr.trim() || undefined,
            descriptionAr: typeDescriptionAr.trim() || undefined,
            isFinancial: typeIsFinancial,
            showInStore: typeShowInStore,
            isDefault: typeIsDefault,
          };
        }
        // If this one is set as default, unset others
        if (typeIsDefault) {
          return { ...t, isDefault: false };
        }
        return t;
      });
      saveGlobalContributionTypes(updated);
      setTypes(updated);
      setHasUnsavedChanges(true);

      // Save to server database immediately
      setIsSaving(true);
      saveGlobalContributionTypesToServer(updated).then((res) => {
        setIsSaving(false);
        if (res.success) {
          setHasUnsavedChanges(false);
          setIsDatabaseVerified(true);
          const now = new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSavedTime(now);
          setSaveSuccessNotification(`تم حفظ التعديل على «${cleanName}» بنجاح وتطبيقه على كافة الجمعيات والنموذج المعتمد.`);
          onShowToast(`تم حفظ التعديل على «${cleanName}» وتحديث قاعدة البيانات بنجاح`, 'success');
        }
      });
    } else {
      // Add
      const newType: ContributionTypeConfig = {
        id: `type-${Date.now()}`,
        nameAr: cleanName,
        nameFr: typeNameFr.trim() || undefined,
        descriptionAr: typeDescriptionAr.trim() || undefined,
        isFinancial: typeIsFinancial,
        enabled: true,
        order: types.length + 1,
        showInStore: typeShowInStore,
        isDefault: typeIsDefault,
      };

      let updated = [...types];
      if (typeIsDefault) {
        updated = updated.map((t) => ({ ...t, isDefault: false }));
      }
      updated.push(newType);

      saveGlobalContributionTypes(updated);
      setTypes(updated);
      setHasUnsavedChanges(true);

      // Save to server database immediately
      setIsSaving(true);
      saveGlobalContributionTypesToServer(updated).then((res) => {
        setIsSaving(false);
        if (res.success) {
          setHasUnsavedChanges(false);
          setIsDatabaseVerified(true);
          const now = new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSavedTime(now);
          setSaveSuccessNotification(`تمت إضافة نوع المساهمة «${cleanName}» بنجاح ونشره على كافة الجمعيات.`);
          onShowToast(`تمت إضافة نوع المساهمة «${cleanName}» ونشره في قاعدة البيانات بنجاح`, 'success');
        }
      });
    }

    setIsAddTypeModalOpen(false);
    setEditingType(null);
    setTypeNameAr('');
    setTypeNameFr('');
    setTypeDescriptionAr('');
    setTypeIsFinancial(true);
    setTypeShowInStore(true);
    setTypeIsDefault(false);
  };

  const handleToggleType = (id: string) => {
    const updated = types.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t));
    saveGlobalContributionTypes(updated);
    setTypes(updated);
    setHasUnsavedChanges(true);
    const target = types.find((t) => t.id === id);
    onShowToast(
      target?.enabled
        ? `تم تعطيل نوع «${target.nameAr}» مؤقتاً (اضغط «حفظ التعديلات» لتثبيته في قاعدة البيانات)`
        : `تم تفعيل نوع «${target?.nameAr}» (اضغط «حفظ التعديلات» لتثبيته في قاعدة البيانات)`,
      'info'
    );
    // Background sync to server
    saveGlobalContributionTypesToServer(updated).then((res) => {
      if (res.success) {
        setHasUnsavedChanges(false);
        setIsDatabaseVerified(true);
      }
    });
  };

  const handleToggleShowInStore = (id: string) => {
    const updated = types.map((t) =>
      t.id === id ? { ...t, showInStore: t.showInStore === false ? true : false } : t
    );
    saveGlobalContributionTypes(updated);
    setTypes(updated);
    setHasUnsavedChanges(true);
    const target = types.find((t) => t.id === id);
    onShowToast(
      target?.showInStore === false
        ? `تم إظهار «${target.nameAr}» في المتجر (اضغط «حفظ التعديلات» للتثبيت)`
        : `تم إخفاء «${target?.nameAr}» من المتجر (اضغط «حفظ التعديلات» للتثبيت)`,
      'info'
    );
    // Background sync to server
    saveGlobalContributionTypesToServer(updated).then((res) => {
      if (res.success) {
        setHasUnsavedChanges(false);
        setIsDatabaseVerified(true);
      }
    });
  };

  const handleDeleteType = () => {
    if (!typeDeletingItem) return;
    // Logical/Tombstone deletion: mark isDeleted: true to preserve historical financial integrity
    const updated = types.map((t) =>
      t.id === typeDeletingItem.id
        ? { ...t, isDeleted: true, enabled: false, deletedAt: new Date().toISOString() }
        : t
    );
    saveGlobalContributionTypes(updated);
    const filtered = updated.filter((t) => !t.isDeleted);
    setTypes(filtered);
    setHasUnsavedChanges(true);
    onShowToast(
      `تم حذف نوع المساهمة «${typeDeletingItem.nameAr}» وتحويل حالة العمليات المرتبطة به إلى «لم يتم الدفع» (-)`,
      'success'
    );
    setTypeDeletingItem(null);
    // Background sync to server and notify transparency portal
    saveGlobalContributionTypesToServer(updated).then((res) => {
      if (res.success) {
        setHasUnsavedChanges(false);
        setIsDatabaseVerified(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('transparency_records_updated'));
        }
      }
    });
  };

  const handleMoveType = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === types.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newItems = [...types];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    const reordered = newItems.map((item, idx) => ({ ...item, order: idx + 1 }));
    saveGlobalContributionTypes(reordered);
    setTypes(reordered);
    setHasUnsavedChanges(true);
    // Background sync to server
    saveGlobalContributionTypesToServer(reordered).then((res) => {
      if (res.success) {
        setHasUnsavedChanges(false);
        setIsDatabaseVerified(true);
      }
    });
  };

  // Explicit Save Changes Handler requested by user
  const handleSaveAllTypes = async () => {
    setIsSaving(true);
    setSaveSuccessNotification(null);
    try {
      const result = await saveGlobalContributionTypesToServer(types);
      if (result.success) {
        setHasUnsavedChanges(false);
        setIsDatabaseVerified(true);
        const now = new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSavedTime(now);
        setSaveSuccessNotification('تم حفظ جميع التعديلات بنجاح في قاعدة البيانات وتطبيقها تلقائياً على جمعية النور للتنمية والتضامن وكافة الجمعيات الحالية والجديدة.');
        onShowToast('تم حفظ التعديلات بنجاح', 'success');
      } else {
        throw new Error(result.message || 'فشل حفظ التعديلات');
      }
    } catch (err: any) {
      console.error('Error saving contribution types to server:', err);
      onShowToast('حدث خطأ أثناء حفظ التعديلات بالخادم. تم حفظها محلياً مؤقتاً.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Restore Approved Model of جمعية النور للتنمية والتضامن
  const handleRestoreApprovedModel = () => {
    saveGlobalContributionTypes(DEFAULT_CONTRIBUTION_TYPE_CONFIGS);
    saveGlobalDonationPresets(DEFAULT_PRESET_CONFIGS);
    setTypes(DEFAULT_CONTRIBUTION_TYPE_CONFIGS);
    setPresets(DEFAULT_PRESET_CONFIGS);
    setIsRestoreModalOpen(false);
    saveGlobalContributionTypesToServer(DEFAULT_CONTRIBUTION_TYPE_CONFIGS).then(() => {
      setHasUnsavedChanges(false);
      setIsDatabaseVerified(true);
    });
    onShowToast('تمت استعادة الإعدادات النموذجية المعتمدة لجمعية النور بنجاح!', 'success');
  };

  // Active counts for headers
  const activePresetsCount = presets.filter((p) => p.enabled).length;
  const activeTypesCount = types.filter((t) => t.enabled).length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-emerald-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                    قسم أنواع المساهمات والمبالغ الجاهزة
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    التحكم المركزي العام
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  المصدر المركزي لإدارة مبالغ التبرع السريعة وتصنيفات المساهمات الخيرية لجميع منصات الجمعيات
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsRestoreModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/15 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="استعادة الإعدادات النموذجية لجمعية النور"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>استعادة نموذج جمعية النور</span>
            </button>
          </div>
        </div>

        {/* Global Security / Integrity Notice */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center gap-3 text-xs text-emerald-200/90 bg-white/5 rounded-2xl p-3.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="leading-relaxed">
            <strong>قاعدة سلامة البيانات المالية:</strong> هذا القسم يتحكم في خيارات واجهات التبرع الحالية والمستقبلية. أي تعديل أو حذف يتم هنا لا يؤثر إطلاقاً على السجلات المالية والتبرعات السابقة للمنخرطين؛ تظل جميع المساهمات التاريخية محتفظة بنفس القيمة والتصنيف الذي نُفذت به.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Statistics Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('presets')}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'presets'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span>مبالغ التبرع السريعة الجاهزة</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              subTab === 'presets' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-200 text-slate-700'
            }`}>
              {activePresetsCount} / {presets.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('types')}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'types'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Tag className="w-4 h-4 text-emerald-400" />
            <span>تصنيفات وأنواع المساهمات الخيرية</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              subTab === 'types' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-200 text-slate-700'
            }`}>
              {activeTypesCount} / {types.length}
            </span>
          </button>
        </div>

        <div>
          {subTab === 'presets' ? (
            <button
              onClick={() => {
                setEditingPreset(null);
                setPresetAmountInput('');
                setPresetLabelInput('');
                setPresetIsPopularInput(false);
                setIsAddPresetModalOpen(true);
              }}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مبلغ جديد</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-save-contribution-types"
                type="button"
                onClick={handleSaveAllTypes}
                disabled={isSaving}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                  hasUnsavedChanges
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-400 ring-offset-2 animate-pulse shadow-amber-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25'
                } ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                title="حفظ جميع التعديلات في قاعدة البيانات وتطبيقها فوراً على جميع الجمعيات والنموذج المعتمد"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>حفظ التعديلات</span>
                {hasUnsavedChanges && (
                  <span className="bg-slate-950 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    تغييرات غير محفوظة
                  </span>
                )}
              </button>

              <button
                id="btn-add-contribution-type"
                type="button"
                onClick={() => {
                  setEditingType(null);
                  setTypeNameAr('');
                  setTypeNameFr('');
                  setTypeDescriptionAr('');
                  setTypeIsFinancial(true);
                  setTypeShowInStore(true);
                  setTypeIsDefault(false);
                  setIsAddTypeModalOpen(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>إضافة نوع مساهمة جديد</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TAB: PRESET AMOUNTS (مبالغ التبرع السريعة) */}
      {/* ========================================================================= */}
      {subTab === 'presets' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <span>قائمة المبالغ الجاهزة ({presets.length} مبلغ معتمد)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  هذه المبالغ تظهر كأزرار خيارات سريعة عند قيام المحسنين بالتبرع في واجهة المتجر والحملات الخيرية
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>مفعل: {activePresetsCount}</span>
                <span className="text-slate-300">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                <span>معطل: {presets.length - activePresetsCount}</span>
              </div>
            </div>

            {/* Presets Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {presets.map((preset, index) => (
                <div
                  key={preset.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                    preset.enabled
                      ? 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'
                      : 'bg-slate-50/70 border-slate-200/60 opacity-65'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-mono font-bold flex items-center justify-center">
                        #{index + 1}
                      </span>
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black font-mono text-emerald-700">
                            {preset.amount.toLocaleString('ar-MA')}
                          </span>
                          <span className="text-xs font-bold text-slate-500">د.م</span>
                        </div>
                        {preset.labelAr && preset.labelAr !== `${preset.amount} د.م` && (
                          <div className="text-[11px] text-slate-500 font-medium">{preset.labelAr}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {preset.isPopular && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                          شائع
                        </span>
                      )}
                      <button
                        onClick={() => handleTogglePreset(preset.id)}
                        className={`p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          preset.enabled
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                        title={preset.enabled ? 'تعطيل المبلغ' : 'تفعيل المبلغ'}
                      >
                        {preset.enabled ? (
                          <Eye className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Actions & Ordering Row */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMovePreset(index, 'up')}
                        disabled={index === 0}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 cursor-pointer"
                        title="تحريك للأعلى / تقديم الترتيب"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMovePreset(index, 'down')}
                        disabled={index === presets.length - 1}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 cursor-pointer"
                        title="تحريك للأسفل / تأخير الترتيب"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingPreset(preset);
                          setPresetAmountInput(String(preset.amount));
                          setPresetLabelInput(preset.labelAr || '');
                          setPresetIsPopularInput(Boolean(preset.isPopular));
                          setIsAddPresetModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="تعديل المبلغ"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPresetDeletingItem(preset)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="حذف المبلغ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: CONTRIBUTION TYPES (أنواع وتصنيفات المساهمات الخيرية) */}
      {/* ========================================================================= */}
      {subTab === 'types' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-600" />
                  <span>أنواع وتصنيفات المساهمات ({types.length} نوع معتمد)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تحديد أوجه المساهمة المتاحة (مالية، عينية، كفالة، تطوع ميداني) وظهورها في استمارات وواجهات الجمعيات
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>مفعل: {activeTypesCount}</span>
                <span className="text-slate-300">|</span>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                <span>معطل: {types.length - activeTypesCount}</span>
              </div>
            </div>

            {/* Database Sync & Save Changes Status Ribbon */}
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
              hasUnsavedChanges
                ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            }`}>
              <div className="flex items-start sm:items-center gap-3">
                {hasUnsavedChanges ? (
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="font-black text-sm flex flex-wrap items-center gap-2">
                    <span>
                      {hasUnsavedChanges
                        ? 'تنبيه: توجد تعديلات جديدة بانتظار الحفظ والتعميم'
                        : 'جميع أنواع وتصنيفات المساهمات محفوظة في قاعدة البيانات ومزامنة تلقائياً'}
                    </span>
                    {lastSavedTime && (
                      <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-black/5 text-slate-700">
                        آخر حفظ: {lastSavedTime}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {hasUnsavedChanges
                      ? 'اضغط على زر «حفظ التعديلات» لنشر التحديثات فوراً على قاعدة بيانات جمعية النور وكافة الجمعيات.'
                      : 'يتم تطبيق هذه الإعدادات فوراً على نموذج جمعية النور للتنمية والتضامن وجميع الجمعيات الحالية والجديدة.'}
                  </p>
                  {saveSuccessNotification && !hasUnsavedChanges && (
                    <p className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{saveSuccessNotification}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  id="btn-save-contribution-types-banner"
                  type="button"
                  onClick={handleSaveAllTypes}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                    hasUnsavedChanges
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-300 ring-offset-1 animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  } ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </div>

            {/* Types Table / List */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4 w-12 text-center">الترتيب</th>
                    <th className="py-3 px-4">نوع وتسمية المساهمة</th>
                    <th className="py-3 px-4 text-center">طبيعة المساهمة</th>
                    <th className="py-3 px-4 text-center">واجهة المتجر</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center w-36">الإجراءات والترتيب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {types.map((type, index) => (
                    <tr
                      key={type.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !type.enabled ? 'bg-slate-50/40 text-slate-400' : ''
                      }`}
                    >
                      {/* Order Index */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-500">
                        #{index + 1}
                      </td>

                      {/* Name & Description */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {type.nameAr}
                          </span>
                          {type.isDefault && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              الافتراضي
                            </span>
                          )}
                        </div>
                        {type.descriptionAr && (
                          <div className="text-xs text-slate-500 mt-0.5 leading-normal">
                            {type.descriptionAr}
                          </div>
                        )}
                        {type.nameFr && (
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                            {type.nameFr}
                          </div>
                        )}
                      </td>

                      {/* Nature: Financial / In-kind */}
                      <td className="py-3.5 px-4 text-center">
                        {type.isFinancial ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>مساهمة مالية</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Layers className="w-3.5 h-3.5" />
                            <span>عينية / تطوع</span>
                          </span>
                        )}
                      </td>

                      {/* Store Visibility */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleShowInStore(type.id)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                            type.showInStore !== false
                              ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                          title="تحديد ظهور هذا النوع في واجهة المتجر"
                        >
                          <Store className="w-3.5 h-3.5" />
                          <span>{type.showInStore !== false ? 'ظاهر بالمتجر' : 'مخفي بالمتجر'}</span>
                        </button>
                      </td>

                      {/* Enabled / Disabled Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleType(type.id)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                            type.enabled
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                          title={type.enabled ? 'تعطيل النوع' : 'تفعيل النوع'}
                        >
                          {type.enabled ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>مفعل</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-500" />
                              <span>معطل</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions & Ordering */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleMoveType(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 cursor-pointer"
                            title="تقديم الترتيب للأعلى"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveType(index, 'down')}
                            disabled={index === types.length - 1}
                            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 cursor-pointer"
                            title="تأخير الترتيب للأسفل"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingType(type);
                              setTypeNameAr(type.nameAr);
                              setTypeNameFr(type.nameFr || '');
                              setTypeDescriptionAr(type.descriptionAr || '');
                              setTypeIsFinancial(type.isFinancial);
                              setTypeShowInStore(type.showInStore !== false);
                              setTypeIsDefault(Boolean(type.isDefault));
                              setIsAddTypeModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="تعديل نوع المساهمة"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setTypeDeletingItem(type)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف نوع المساهمة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Bar with Save Changes & Add buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                <span>إجمالي الأنواع: <strong className="text-slate-900 font-bold">{types.length}</strong></span>
                <span className="text-slate-300">•</span>
                <span>المفعلة: <strong className="text-emerald-700 font-bold">{activeTypesCount}</strong></span>
                <span className="text-slate-300">•</span>
                <span>المعروضة بالمتجر: <strong className="text-slate-900 font-bold">{types.filter((t) => t.showInStore !== false).length}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-save-contribution-types-bottom"
                  type="button"
                  onClick={handleSaveAllTypes}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                    hasUnsavedChanges
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  } ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>حفظ التعديلات</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingType(null);
                    setTypeNameAr('');
                    setTypeNameFr('');
                    setTypeDescriptionAr('');
                    setTypeIsFinancial(true);
                    setTypeShowInStore(true);
                    setTypeIsDefault(false);
                    setIsAddTypeModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة نوع جديد</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PRESET AMOUNT */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddPresetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 bg-slate-900 text-white">
                <div className="flex items-center gap-2.5">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-base">
                    {editingPreset ? 'تعديل مبلغ التبرع الجاهز' : 'إضافة مبلغ تبرع سريع جديد'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddPresetModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePreset} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    قيمة المبلغ بالدرهم المغربي (د.م) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={presetAmountInput}
                      onChange={(e) => setPresetAmountInput(e.target.value)}
                      placeholder="مثال: 250"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono font-black text-slate-900 focus:border-emerald-600 focus:bg-white outline-hidden"
                    />
                    <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">
                      د.م
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تسمية مخصصة للمبلغ (اختياري)
                  </label>
                  <input
                    type="text"
                    value={presetLabelInput}
                    onChange={(e) => setPresetLabelInput(e.target.value)}
                    placeholder="مثال: 250 د.م - كسوة طفل"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    إذا تركتها فارغة، ستظهر القيمة بالدرهم تلقائياً
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-amber-900 block">تمييز كمبلغ شائع / موصى به</span>
                    <span className="text-[11px] text-amber-700 block">
                      سيظهر شارة «شائع» بجانب هذا المبلغ لتشجيع المحسنين
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={presetIsPopularInput}
                    onChange={(e) => setPresetIsPopularInput(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddPresetModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    {editingPreset ? 'حفظ التعديلات' : 'إضافة المبلغ'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CONTRIBUTION TYPE */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddTypeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 bg-slate-900 text-white">
                <div className="flex items-center gap-2.5">
                  <Tag className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-base">
                    {editingType ? 'تعديل نوع المساهمة الخيرية' : 'إضافة نوع مساهمة جديد'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddTypeModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveType} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم نوع المساهمة بالعربية <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={typeNameAr}
                    onChange={(e) => setTypeNameAr(e.target.value)}
                    placeholder="مثال: كفالة يتيم شهرية"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الاسم بالفرنسية (اختياري)
                  </label>
                  <input
                    type="text"
                    value={typeNameFr}
                    onChange={(e) => setTypeNameFr(e.target.value)}
                    placeholder="Ex: Parrainage mensuel d'un orphelin"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white outline-hidden font-sans"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    وصف توضيحي للمحسنين (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    value={typeDescriptionAr}
                    onChange={(e) => setTypeDescriptionAr(e.target.value)}
                    placeholder="توضيح مختصر لكيفية الاستفادة من هذه المساهمة..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>

                {/* Nature of Contribution: Financial / Non-Financial */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">طبيعة المساهمة</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTypeIsFinancial(true)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        typeIsFinancial
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs">مساهمة مالية</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTypeIsFinancial(false)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        !typeIsFinancial
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-800 font-bold ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs">عينية / تطوع ميداني</span>
                    </button>
                  </div>
                </div>

                {/* Storefront & Default Options */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        إظهار هذا النوع في واجهة المتجر
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        يسمح للمحسنين باختيار هذا النوع أثناء التبرع عبر المتجر
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={typeShowInStore}
                      onChange={(e) => setTypeShowInStore(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        تعيين كنوع افتراضي محدد تلقائياً
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        يكون هذا النوع هو المحدد مبدئياً عند فتح نافذة التبرع
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={typeIsDefault}
                      onChange={(e) => setTypeIsDefault(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddTypeModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    {editingType ? 'حفظ التعديلات' : 'إضافة نوع المساهمة'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM DELETE PRESET */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {presetDeletingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  تأكيد حذف مبلغ التبرع السريع
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  هل أنت متأكد من حذف المبلغ{' '}
                  <strong className="text-slate-900">({presetDeletingItem.amount} د.م)</strong> من قائمة المبالغ الجاهزة؟
                </p>
                <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-xl mt-2">
                  ✓ لن يؤثر هذا الحذف على التبرعات السابقة المسجلة بهذا المبلغ إطلاقاً.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPresetDeletingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleDeletePreset}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  تأكيد الحذف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM DELETE CONTRIBUTION TYPE */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {typeDeletingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  تأكيد حذف نوع المساهمة
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  هل أنت متأكد من حذف نوع المساهمة «
                  <strong className="text-slate-900">{typeDeletingItem.nameAr}</strong>»؟
                </p>
                <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded-xl mt-2 leading-relaxed">
                  ✓ <strong>حماية السجلات التاريخية:</strong> سيتم إخفاء هذا النوع من واجهات التبرع الجديدة، مع بقاء كافة المساهمات والتبرعات السابقة التي استخدمت هذا النوع سليمة وموثقة في الحسابات دون أي تغيير.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTypeDeletingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleDeleteType}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  تأكيد الحذف الآمن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: RESTORE APPROVED NOUR MODEL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isRestoreModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <RefreshCw className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  استعادة الإعدادات النموذجية لجمعية النور
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  سيتم إعادة ضبط مبالغ التبرع الـ 18 المعتمدة وأنواع المساهمات الـ 5 الأصلية لنموذج <strong>«جمعية النور للتنمية والتضامن»</strong> دون المساس بأي تبرعات أو حسابات مالية سابقة.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRestoreModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleRestoreApprovedModel}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  تأكيد الاستعادة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
