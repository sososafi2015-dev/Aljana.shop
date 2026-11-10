import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Eye, 
  EyeOff, 
  Layout, 
  Sparkles, 
  Award, 
  HeartHandshake, 
  ShieldCheck, 
  Layers, 
  FileSpreadsheet, 
  TrendingUp, 
  Users, 
  FileCheck, 
  Globe, 
  CreditCard, 
  Smartphone, 
  Building,
  Plus, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  SlidersHorizontal,
  Edit2,
  Lock,
  ArrowUp,
  ArrowDown,
  Info,
  Palette,
  Link as LinkIcon,
  Database,
  ExternalLink,
  Bell,
  Heart
} from 'lucide-react';
import { UIElementConfig, UIElementCategory, Language, AssociationSettings } from '../types';
import { translations } from '../translations';
import { initialUIElements } from '../initialData';
import { ManageStoreColors } from './ManageStoreColors';
import { AVAILABLE_PLATFORM_TARGETS, findPlatformTargetById, resolvePlatformTargetId } from '../utils/platformElementsRegistry';
import { 
  saveUIElementsListApi, 
  createUIElementApi, 
  updateUIElementApi,
  toggleUIElementApi, 
  toggleUIElementVisibilityApi, 
  deleteUIElementApi, 
  resetUIElementsApi 
} from '../api/uiElementsApi';

interface ManageUIElementsProps {
  elements: UIElementConfig[];
  onUpdateElements: (elements: UIElementConfig[]) => void;
  lang: Language;
  onLogAudit: (action: 'create' | 'update' | 'delete', description: string) => void;
  settings?: AssociationSettings;
  onUpdateSettings?: (newSettings: AssociationSettings) => void;
  initialSubTab?: 'elements' | 'colors';
  activeTenantId?: string;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ManageUIElements: React.FC<ManageUIElementsProps> = ({
  elements,
  onUpdateElements,
  lang,
  onLogAudit,
  settings,
  onUpdateSettings,
  initialSubTab = 'elements',
  activeTenantId,
  addToast,
}) => {
  const t = translations[lang] as any;

  const [activeSubTab, setActiveSubTab] = useState<'elements' | 'colors'>(initialSubTab);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingElement, setEditingElement] = useState<UIElementConfig | null>(null);
  const [isSavingDb, setIsSavingDb] = useState(false);

  // Modal mode: 'target_platform' (bind to existing platform section) vs 'custom_block' (create new custom UI block)
  const [modalMode, setModalMode] = useState<'target_platform' | 'custom_block'>('target_platform');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('announcements_banner');

  // Form State for Adding / Editing
  const [formData, setFormData] = useState<Partial<UIElementConfig>>({
    id: '',
    nameAr: '',
    nameFr: '',
    nameEn: '',
    descriptionAr: '',
    descriptionFr: '',
    descriptionEn: '',
    category: 'home_sections',
    page: 'home',
    enabled: true,
    visibleToNonMembers: true,
    order: elements.length + 1,
    iconName: 'Layout',
    targetComponent: '',
    isCustom: false,
    customContent: {
      type: 'card',
      titleAr: '',
      bodyAr: '',
      badgeTextAr: '',
      buttonTextAr: '',
      buttonAction: 'tab',
      buttonLink: '',
      targetTab: 'activities',
      themeStyle: 'emerald',
    },
  });

  const showToast = (type: 'success' | 'error' | 'info', msg: string) => {
    if (addToast) {
      addToast(type, msg);
    }
  };

  const getElementIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Sparkles': return <Sparkles className="w-5 h-5" />;
      case 'Award': return <Award className="w-5 h-5" />;
      case 'HeartHandshake': return <HeartHandshake className="w-5 h-5" />;
      case 'ShieldCheck': return <ShieldCheck className="w-5 h-5" />;
      case 'Layers': return <Layers className="w-5 h-5" />;
      case 'FileSpreadsheet': return <FileSpreadsheet className="w-5 h-5" />;
      case 'TrendingUp': return <TrendingUp className="w-5 h-5" />;
      case 'Users': return <Users className="w-5 h-5" />;
      case 'FileCheck': return <FileCheck className="w-5 h-5" />;
      case 'Globe': return <Globe className="w-5 h-5" />;
      case 'CreditCard': return <CreditCard className="w-5 h-5" />;
      case 'Smartphone': return <Smartphone className="w-5 h-5" />;
      case 'Building': return <Building className="w-5 h-5" />;
      case 'Bell': return <Bell className="w-5 h-5" />;
      case 'Heart': return <Heart className="w-5 h-5" />;
      default: return <Layout className="w-5 h-5" />;
    }
  };

  const getCategoryBadge = (cat: UIElementCategory) => {
    switch (cat) {
      case 'home_sections':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{t.category_home_sections}</span>;
      case 'records_and_ledgers':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{t.category_records_and_ledgers}</span>;
      case 'navigation':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">{t.category_navigation}</span>;
      case 'banners_and_media':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{t.category_banners_and_media}</span>;
      case 'footer_and_contact':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">{t.category_footer_and_contact}</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">{t.category_custom}</span>;
    }
  };

  // Toggle Visibility
  const handleToggleElement = async (id: string) => {
    const cleanId = id.split('?')[0].trim();
    const target = elements.find((e) => e.id === id || e.id.split('?')[0] === cleanId);
    if (!target) return;
    const newState = !target.enabled;

    const updated = elements.map((el) => {
      if (el.id === id || el.id.split('?')[0] === cleanId) {
        return { ...el, enabled: newState };
      }
      return el;
    });

    onLogAudit(
      'update',
      `تغيير حالة ظهور عنصر الواجهة (${target.nameAr}): ${newState ? 'تفعيل وإظهار' : 'إخفاء من الواجهة'}`
    );
    onUpdateElements(updated);
    showToast('info', `جاري ${newState ? 'تفعيل' : 'تعطيل'} العنصر وحفظه في قاعدة البيانات...`);

    try {
      const res = await toggleUIElementApi(cleanId, newState, activeTenantId);
      if (res.success) {
        showToast('success', `تم ${newState ? 'تفعيل' : 'تعطيل'} عنصر (${target.nameAr}) وتطبيقه على الواجهة!`);
        if (res.elements && Array.isArray(res.elements)) {
          onUpdateElements(res.elements);
        }
      } else {
        await saveUIElementsListApi(updated, activeTenantId, 'الأدمن الرئيسي');
      }
    } catch (err) {
      console.error('Failed to sync toggle to backend:', err);
      await saveUIElementsListApi(updated, activeTenantId, 'الأدمن الرئيسي');
    }
  };

  // Toggle Non-Member Visibility
  const handleToggleNonMemberVisibility = async (id: string) => {
    const cleanId = id.split('?')[0].trim();
    const target = elements.find((e) => e.id === id || e.id.split('?')[0] === cleanId);
    if (!target) return;
    const newVis = target.visibleToNonMembers === false; // toggle

    const updated = elements.map((el) => {
      if (el.id === id || el.id.split('?')[0] === cleanId) {
        return { ...el, visibleToNonMembers: newVis };
      }
      return el;
    });

    onLogAudit(
      'update',
      `تغيير إذن الظهور لغير المنخرطين لعنصر (${target.nameAr}): ${newVis ? 'ظاهر للعموم' : 'محجوب عن غير المنخرطين'}`
    );
    onUpdateElements(updated);

    try {
      const res = await toggleUIElementVisibilityApi(cleanId, newVis, activeTenantId);
      if (res.success) {
        showToast('success', `تم تحديث صلاحية ظهور (${target.nameAr}) لزوار المتجر!`);
        if (res.elements && Array.isArray(res.elements)) {
          onUpdateElements(res.elements);
        }
      } else {
        await saveUIElementsListApi(updated, activeTenantId, 'الأدمن الرئيسي');
      }
    } catch (err) {
      console.error('Failed to sync non-member visibility to backend:', err);
      await saveUIElementsListApi(updated, activeTenantId, 'الأدمن الرئيسي');
    }
  };

  // Batch Toggle All in current view
  const handleBatchToggle = async (enable: boolean) => {
    const updated = elements.map((el) => {
      if (selectedCategory === 'all' || el.category === selectedCategory) {
        return { ...el, enabled: enable };
      }
      return el;
    });

    onLogAudit(
      'update',
      `${enable ? 'تفعيل وإظهار' : 'إخفاء'} جميع عناصر الواجهة ${selectedCategory !== 'all' ? `لقسم ${selectedCategory}` : ''}`
    );
    onUpdateElements(updated);

    try {
      await saveUIElementsListApi(updated, activeTenantId, 'الأدمن الرئيسي');
      showToast('success', `تم ${enable ? 'تفعيل' : 'تعطيل'} العناصر المحددة وحفظها في قاعدة البيانات!`);
    } catch (err) {
      console.error('Failed batch toggle to backend:', err);
    }
  };

  // Reorder
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= elements.length) return;

    const newElements = [...elements];
    const temp = newElements[index];
    newElements[index] = newElements[targetIndex];
    newElements[targetIndex] = temp;

    // update order property
    const reordered = newElements.map((el, idx) => ({ ...el, order: idx + 1 }));
    onLogAudit('update', `تغيير ترتيب عنصر الواجهة (${temp.nameAr})`);
    onUpdateElements(reordered);

    try {
      await saveUIElementsListApi(reordered, activeTenantId, 'الأدمن (تغيير الترتيب)');
    } catch (err) {
      console.error('Failed to save reordered elements to backend:', err);
    }
  };

  // Reset to initial UI Elements
  const handleResetDefaults = async () => {
    if (window.confirm(t.resetUIElementsConfirm || 'هل أنت متأكد من استعادة الإعدادات النموذجية المعتمدة لظهور عناصر الواجهة؟')) {
      onUpdateElements(initialUIElements);
      onLogAudit('update', 'استعادة الإعدادات الافتراضية لظهور عناصر واجهة التطبيق');
      showToast('info', 'جاري استعادة التهيئة النموذجية المعتمدة...');

      try {
        const res = await resetUIElementsApi(activeTenantId);
        if (res.success && res.elements) {
          onUpdateElements(res.elements);
          showToast('success', 'تمت استعادة الإعدادات النموذجية بنجاح وحفظها في قاعدة البيانات!');
        }
      } catch (err) {
        console.error('Failed to reset UI elements in backend:', err);
      }
    }
  };

  // Delete custom element
  const handleDeleteElement = async (id: string, name: string) => {
    if (window.confirm(`${t.confirmDeleteUIElement || 'هل أنت متأكد من حذف عنصر الواجهة'} (${name})؟`)) {
      const cleanId = id.split('?')[0].trim();
      const filtered = elements.filter((el) => el.id !== id && el.id.split('?')[0] !== cleanId);
      onLogAudit('delete', `حذف عنصر الواجهة المخصص (${name})`);
      onUpdateElements(filtered);

      try {
        const res = await deleteUIElementApi(cleanId, activeTenantId);
        if (res.success) {
          showToast('success', `تم حذف عنصر (${name}) نهائياً من قاعدة البيانات والواجهة!`);
        }
      } catch (err) {
        console.error('Failed to delete element in backend:', err);
      }
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (el: UIElementConfig) => {
    const cleanId = el.id.split('?')[0].trim();
    setEditingElement(el);
    setFormData({
      ...el,
      id: cleanId,
      customContent: {
        type: el.customContent?.type || 'card',
        titleAr: el.nameAr || el.customContent?.titleAr || '',
        bodyAr: el.descriptionAr || el.customContent?.bodyAr || '',
        badgeTextAr: el.customContent?.badgeTextAr || '',
        buttonTextAr: el.customContent?.buttonTextAr || '',
        buttonAction: el.customContent?.buttonAction || 'tab',
        buttonLink: el.customContent?.buttonLink || '',
        targetTab: el.customContent?.targetTab || 'activities',
        themeStyle: el.customContent?.themeStyle || 'emerald',
      },
    });

    const isExistingPlatform = AVAILABLE_PLATFORM_TARGETS.some((p) => p.id === cleanId);
    setModalMode(isExistingPlatform ? 'target_platform' : 'custom_block');
    setSelectedTargetId(cleanId);
    setIsAddModalOpen(true);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingElement(null);
    setModalMode('target_platform');
    
    // Pick the first available platform target not already in elements list, or fallback to announcements_banner
    const firstUnused = AVAILABLE_PLATFORM_TARGETS.find((p) => !elements.some((e) => e.id === p.id)) || AVAILABLE_PLATFORM_TARGETS[1];
    const initialTarget = firstUnused || AVAILABLE_PLATFORM_TARGETS[0];

    setSelectedTargetId(initialTarget.id);
    setFormData({
      id: initialTarget.id,
      nameAr: initialTarget.nameAr,
      nameFr: initialTarget.nameFr,
      nameEn: initialTarget.nameEn,
      descriptionAr: initialTarget.descriptionAr,
      descriptionFr: initialTarget.descriptionFr,
      descriptionEn: initialTarget.descriptionEn,
      category: initialTarget.category,
      page: initialTarget.page,
      enabled: true,
      visibleToNonMembers: true,
      order: elements.length + 1,
      iconName: initialTarget.iconName,
      isCustom: false,
      targetComponent: initialTarget.id,
      customContent: {
        type: 'card',
        titleAr: initialTarget.nameAr,
        bodyAr: initialTarget.descriptionAr,
        badgeTextAr: '',
        buttonTextAr: '',
        buttonAction: 'tab',
        buttonLink: '',
        targetTab: 'activities',
        themeStyle: 'emerald',
      },
    });
    setIsAddModalOpen(true);
  };

  // Handle selecting a platform target in dropdown
  const handleSelectPlatformTarget = (targetId: string) => {
    setSelectedTargetId(targetId);
    const targetDef = findPlatformTargetById(targetId);
    if (!targetDef) return;

    setFormData((prev) => ({
      ...prev,
      id: targetDef.id,
      targetComponent: targetDef.id,
      nameAr: targetDef.nameAr,
      nameFr: targetDef.nameFr,
      nameEn: targetDef.nameEn,
      descriptionAr: targetDef.descriptionAr,
      descriptionFr: targetDef.descriptionFr,
      descriptionEn: targetDef.descriptionEn,
      category: targetDef.category,
      page: targetDef.page,
      iconName: targetDef.iconName,
      isCustom: false,
      customContent: {
        ...(prev.customContent || {}),
        titleAr: targetDef.nameAr,
        bodyAr: targetDef.descriptionAr,
      },
    }));
  };

  // Save Modal (Create or Update)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr?.trim()) {
      alert('يرجى كتابة اسم العنصر بالعربية');
      return;
    }

    setIsSavingDb(true);

    let finalId = formData.id?.trim() || '';
    if (modalMode === 'target_platform' && selectedTargetId) {
      finalId = selectedTargetId;
    }
    if (!finalId) {
      const slug = formData.nameAr.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_').slice(0, 20);
      finalId = `custom_ui_${Date.now()}_${slug}`;
    }

    finalId = resolvePlatformTargetId(finalId).split('?')[0].trim();

    const isPlatformBound = AVAILABLE_PLATFORM_TARGETS.some((p) => p.id === finalId);

    const cleanName = formData.nameAr?.trim() || 'عنصر واجهة جديد';
    const cleanDesc = formData.descriptionAr !== undefined ? formData.descriptionAr.trim() : '';

    const elementPayload: UIElementConfig = {
      id: finalId,
      nameAr: cleanName,
      nameFr: formData.nameFr?.trim() || cleanName,
      nameEn: formData.nameEn?.trim() || cleanName,
      descriptionAr: cleanDesc,
      descriptionFr: formData.descriptionFr?.trim() || '',
      descriptionEn: formData.descriptionEn?.trim() || '',
      category: formData.category || 'home_sections',
      page: formData.page || 'home',
      enabled: typeof formData.enabled === 'boolean' ? formData.enabled : true,
      visibleToNonMembers: typeof formData.visibleToNonMembers === 'boolean' ? formData.visibleToNonMembers : true,
      order: typeof formData.order === 'number' ? formData.order : elements.length + 1,
      iconName: formData.iconName || 'Layout',
      isCustom: modalMode === 'custom_block' || !isPlatformBound,
      targetComponent: finalId,
      customContent: {
        type: formData.customContent?.type || 'card',
        titleAr: cleanName,
        bodyAr: cleanDesc,
        badgeTextAr: formData.customContent?.badgeTextAr || '',
        buttonTextAr: formData.customContent?.buttonTextAr || '',
        buttonAction: formData.customContent?.buttonAction || 'tab',
        buttonLink: formData.customContent?.buttonLink || '',
        targetTab: formData.customContent?.targetTab || 'activities',
        themeStyle: formData.customContent?.themeStyle || 'emerald',
      },
    };

    let updatedList: UIElementConfig[];
    if (editingElement) {
      const cleanEditId = editingElement.id.split('?')[0].trim();
      updatedList = elements.map((el) =>
        el.id === editingElement.id || el.id.split('?')[0].trim() === cleanEditId || el.id === elementPayload.id
          ? elementPayload
          : el
      );
      onLogAudit('update', `تعديل إعدادات عنصر الواجهة (${elementPayload.nameAr})`);
    } else {
      const existingIdx = elements.findIndex((e) => e.id === elementPayload.id || e.id.split('?')[0] === elementPayload.id);
      if (existingIdx >= 0) {
        updatedList = elements.map((e, idx) => (idx === existingIdx ? elementPayload : e));
      } else {
        updatedList = [...elements, elementPayload];
      }
      onLogAudit('create', `إضافة عنصر تحكم جديد للواجهة (${elementPayload.nameAr}) برمز [${elementPayload.id}]`);
    }

    // Apply immediate local update to UI
    onUpdateElements(updatedList);
    setIsAddModalOpen(false);

    try {
      let res;
      if (editingElement) {
        res = await updateUIElementApi(elementPayload.id, elementPayload, activeTenantId);
      } else {
        res = await createUIElementApi(elementPayload, activeTenantId);
      }

      if (res && res.success) {
        showToast('success', `تم حفظ وتحديث عنصر (${elementPayload.nameAr}) وربطه بالواجهة بنجاح في قاعدة البيانات!`);
        if (res.elements && Array.isArray(res.elements)) {
          onUpdateElements(res.elements);
        }
      } else {
        showToast('info', 'تم الحفظ في الواجهة، جاري المزامنة مع الخادم...');
        await saveUIElementsListApi(updatedList, activeTenantId, 'الأدمن الرئيسي');
      }
    } catch (err) {
      console.error('Failed to persist element to backend:', err);
      showToast('error', 'حدث خطأ في الاتصال بالخادم، تم الحفظ محلياً');
    } finally {
      setIsSavingDb(false);
    }
  };

  // Filter elements
  const filteredElements = elements.filter((el) => {
    if (el.id === 'gateway_financials' || el.id === 'pillars_section') {
      return false;
    }
    if (selectedCategory !== 'all' && el.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNameAr = el.nameAr?.toLowerCase().includes(q);
      const matchNameFr = el.nameFr?.toLowerCase().includes(q);
      const matchNameEn = el.nameEn?.toLowerCase().includes(q);
      const matchId = el.id?.toLowerCase().includes(q);
      const matchDesc = el.descriptionAr?.toLowerCase().includes(q);
      return matchNameAr || matchNameFr || matchNameEn || matchId || matchDesc;
    }
    return true;
  });

  const activeCount = elements.filter((e) => e.enabled).length;
  const hiddenCount = elements.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Top Banner with Database Persistence Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <Layout className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black text-slate-900">
              {t.uiElementsManagementTitle || 'إدارة واجهة التطبيق والتحكم في ظهور العناصر'}
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <Database className="w-3 h-3 text-emerald-600" />
              <span>مربوط بقاعدة البيانات الدائمة</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            تحكم فوري وديناميكي في إظهار أو إخفاء أي قسم أو زر أو بانر في واجهة منصة الجمعية مع ربط حقيقي بالمكونات وحفظ مباشر في قاعدة البيانات.
          </p>
        </div>

        {/* SubTab switcher: Elements vs Colors */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveSubTab('elements')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'elements'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layout className="w-4 h-4 text-emerald-600" />
            <span>{t.subTabElements || 'عناصر الواجهة'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
              {elements.length}
            </span>
          </button>

          {settings && onUpdateSettings && (
            <button
              onClick={() => setActiveSubTab('colors')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'colors'
                  ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Palette className="w-4 h-4 text-purple-600" />
              <span>{t.subTabColors || 'ألوان ومظهر المتجر'}</span>
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'colors' && settings && onUpdateSettings ? (
        <ManageStoreColors
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          lang={lang}
          onLogAudit={onLogAudit}
        />
      ) : (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t.totalUIElements}</span>
              <span className="text-2xl font-black text-slate-900">{elements.length}</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 shadow-xs">
              <span className="text-xs text-emerald-700 font-medium block mb-1">{t.activeElementsCount}</span>
              <span className="text-2xl font-black text-emerald-700">{activeCount}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block mb-1">{t.hiddenElementsCount}</span>
              <span className="text-2xl font-black text-slate-600">{hiddenCount}</span>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 shadow-xs">
              <span className="text-xs text-blue-700 font-medium block mb-1">الربط البرمجي الحقيقي</span>
              <span className="text-2xl font-black text-blue-700">100%</span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchUIElementsPlaceholder}
                className="w-full ps-9 pe-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Quick Actions Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleBatchToggle(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{t.showAllUIElements}</span>
              </button>

              <button
                onClick={() => handleBatchToggle(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>{t.hideAllUIElements}</span>
              </button>

              <button
                onClick={handleResetDefaults}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs flex items-center gap-1 transition-colors"
                title={t.resetToDefaults}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.resetToDefaults}</span>
              </button>

              <button
                onClick={handleOpenAdd}
                id="add-new-ui-element-btn"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addNewUIElement || 'إضافة عنصر تحكم جديد'}</span>
              </button>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.allCategories} ({elements.length})
            </button>

            <button
              onClick={() => setSelectedCategory('home_sections')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'home_sections'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.category_home_sections}
            </button>

            <button
              onClick={() => setSelectedCategory('records_and_ledgers')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'records_and_ledgers'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.category_records_and_ledgers}
            </button>

            <button
              onClick={() => setSelectedCategory('navigation')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'navigation'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.category_navigation}
            </button>

            <button
              onClick={() => setSelectedCategory('banners_and_media')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'banners_and_media'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.category_banners_and_media}
            </button>

            <button
              onClick={() => setSelectedCategory('footer_and_contact')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'footer_and_contact'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.category_footer_and_contact}
            </button>
          </div>

          {/* List of UI Elements */}
          <div className="space-y-3">
            {filteredElements.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 space-y-3">
                <AlertCircle className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-bold text-sm text-slate-600">{t.noUIElementsFound}</p>
                <p className="text-xs text-slate-400">
                  {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد عناصر في هذا القسم حالياً'}
                </p>
              </div>
            ) : (
              filteredElements.map((el, index) => {
                const displayName = lang === 'ar' ? el.nameAr : lang === 'fr' ? el.nameFr : el.nameEn;
                const displayDesc = lang === 'ar' ? el.descriptionAr : lang === 'fr' ? el.descriptionFr : el.descriptionEn;
                const isPlatformBound = AVAILABLE_PLATFORM_TARGETS.some((p) => p.id === el.id);

                return (
                  <motion.div
                    key={el.id}
                    layout
                    className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs ${
                      el.enabled
                        ? 'border-slate-200/90 hover:border-emerald-300'
                        : 'border-slate-200 bg-slate-50/70 opacity-75'
                    }`}
                  >
                    {/* Left: Icon & Details */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                          el.enabled
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {getElementIcon(el.iconName)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                            {displayName}
                          </h3>
                          {getCategoryBadge(el.category)}
                          <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-bold">
                            ID: {el.id}
                          </span>

                          {isPlatformBound ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                              <LinkIcon className="w-2.5 h-2.5" />
                              <span>مرتبط بواجهة المنصة</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>عنصر تفاعلي مخصص</span>
                            </span>
                          )}

                          <button
                            onClick={() => handleToggleNonMemberVisibility(el.id)}
                            title="انقر لتغيير إذن الظهور لزوار المتجر"
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                              el.visibleToNonMembers !== false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {el.visibleToNonMembers !== false ? '✓ ظاهر للزوار' : '🔒 مخفي عن الزوار'}
                          </button>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                          {displayDesc}
                        </p>
                      </div>
                    </div>

                    {/* Right / Controls: Toggle Switch & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Reorder buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveOrder(index, 'up')}
                          disabled={index === 0}
                          title="تقديم للأعلى"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveOrder(index, 'down')}
                          disabled={index === elements.length - 1}
                          title="تأخير للأسفل"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Edit button */}
                      <button
                        onClick={() => handleOpenEdit(el)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 transition-colors"
                        title="تعديل الإعدادات والربط"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete button (if custom) */}
                      {el.isCustom && (
                        <button
                          onClick={() => handleDeleteElement(el.id, el.nameAr)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 transition-colors"
                          title="حذف العنصر نهائياً"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* THE MAIN TOGGLE SWITCH */}
                      <button
                        onClick={() => handleToggleElement(el.id)}
                        className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          el.enabled
                            ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {el.enabled ? (
                          <>
                            <Eye className="w-4 h-4" />
                            <span>{t.elementEnabled || 'مفعّل بالواجهة'}</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4 text-slate-500" />
                            <span>{t.elementHidden || 'معطّل ومخفي'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Add / Edit UI Element Modal */}
          {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      <Layout className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">
                        {editingElement ? 'تعديل عنصر واجهة التطبيق' : 'إضافة عنصر تحكم جديد للواجهة'}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        إنشاء عنصر وربطه المباشر بواجهة المنصة وحفظه الفعلي بقاعدة البيانات
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Mode Selector (When adding new) */}
                {!editingElement && (
                  <div className="p-1.5 bg-slate-100 rounded-2xl grid grid-cols-2 gap-1.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setModalMode('target_platform');
                        handleSelectPlatformTarget(selectedTargetId || 'announcements_banner');
                      }}
                      className={`p-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
                        modalMode === 'target_platform'
                          ? 'bg-white text-emerald-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LinkIcon className="w-4 h-4 text-emerald-600" />
                      <span>ربط بقسم / عنصر موجود في المنصة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setModalMode('custom_block');
                        setFormData((prev) => ({
                          ...prev,
                          id: `custom_ui_${Date.now()}`,
                          isCustom: true,
                        }));
                      }}
                      className={`p-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
                        modalMode === 'custom_block'
                          ? 'bg-white text-purple-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>إنشاء عنصر واجهة تفاعلي مخصص</span>
                    </button>
                  </div>
                )}

                <form onSubmit={handleSaveModal} className="space-y-4 text-xs sm:text-sm">
                  {/* Platform Target Dropdown (In target_platform mode) */}
                  {modalMode === 'target_platform' && (
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
                      <label className="font-black text-emerald-950 block text-xs flex items-center justify-between">
                        <span>اختر العنصر المستهدف من عناصر واجهة المنصة المعتمدة:</span>
                        <span className="font-mono text-[11px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                          ID: {formData.id}
                        </span>
                      </label>
                      <select
                        value={selectedTargetId}
                        onChange={(e) => handleSelectPlatformTarget(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-emerald-300 bg-white font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <optgroup label="أقسام الصفحة الرئيسية العلوية">
                          <option value="hero_banner">البانر التعريفي الرئيسي وصورة الغلاف (hero_banner)</option>
                          <option value="announcements_banner">شريط التنبيهات والإعلانات العاجلة (announcements_banner)</option>
                          <option value="quick_actions">شريط التفاعل وأزرار الوصول السريع (quick_actions)</option>
                          <option value="featured_activities">أبرز الأعمال والأنشطة الخيرية المنجزة (featured_activities)</option>
                          <option value="campaigns_section">قسم حملات التبرع والمشاريع المستهدفة (campaigns_section)</option>
                          <option value="association_goals">أهداف الجمعية ومجالات العمل التنموي (association_goals)</option>
                          <option value="transparency_pledge">ميثاق الشفافية والمسؤولية المجتمعية (transparency_pledge)</option>
                          <option value="join_cta_banner">بطاقة الدعوة للانخراط والتسجيل بالجمعية (join_cta_banner)</option>
                        </optgroup>
                        <optgroup label="القسم السفلي للسجلات والحسابات">
                          <option value="bottom_records_section">القسم السفلي المخصص للسجلات والحسابات (bottom_records_section)</option>
                          <option value="gateway_ledger">بوابة سجل الشفافية المباشر (gateway_ledger)</option>
                          <option value="gateway_financials">بوابة حساب الرصيد ولوحة المؤشرات (gateway_financials)</option>
                          <option value="current_financial_balance">الرصيد المالي الحالي (current_financial_balance)</option>
                          <option value="gateway_members">بوابة سجل المنخرطين والمشتركين (gateway_members)</option>
                          <option value="board_members">أعضاء مكتب الجمعية - الهيئة التنفيذية (board_members)</option>
                          <option value="members_voting_section">حقل وقسم التصويت والقرارات (members_voting_section)</option>
                          <option value="recent_operations_preview">معاينة أحدث العمليات المالية المنجزة (recent_operations_preview)</option>
                          <option value="member_card">معاينة وتحميل بطاقة الانخراط (member_card)</option>
                        </optgroup>
                        <optgroup label="أشرطة التنقل والتنقل السريع">
                          <option value="nav_report_button">زر استخراج الكشف المالي الرسمي (nav_report_button)</option>
                          <option value="nav_bank_rib_btn">زر تفاصيل الحساب البنكي RIB (nav_bank_rib_btn)</option>
                          <option value="nav_balance_badge">شارة الرصيد المالي في شريط التنقل (nav_balance_badge)</option>
                          <option value="nav_language_switch">محول لغات التطبيق (nav_language_switch)</option>
                          <option value="mobile_bottom_nav">شريط التنقل السفلي للهواتف الذكية (mobile_bottom_nav)</option>
                        </optgroup>
                        <optgroup label="الفوتر ومعلومات الاتصال">
                          <option value="bank_rib_card">بطاقة الحساب البنكي للتبرع والمساهمات (bank_rib_card)</option>
                          <option value="contact_card">بطاقة المقر ومعلومات التواصل المباشر (contact_card)</option>
                          <option value="footer_quick_links">روابط السجلات والحسابات في الفوتر (footer_quick_links)</option>
                          <option value="footer_contact_info">بيانات الاتصال والعنوان في الفوتر (footer_contact_info)</option>
                          <option value="footer_social_links">منصات التواصل الاجتماعي والمشاركة (footer_social_links)</option>
                        </optgroup>
                      </select>
                      <p className="text-[11px] text-emerald-800 font-medium">
                        ✓ عند اختيار هذا العنصر يتم ربط التحكم به تلقائياً بالعنصر البرمجي الفعلي في واجهة المنصة.
                      </p>
                    </div>
                  )}

                  {/* Identifier (ID) input */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-xs">
                      المعرف الفريد للعنصر (Element ID Key) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.id || ''}
                      disabled={modalMode === 'target_platform' && !!selectedTargetId}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      placeholder="e.g. announcements_banner or custom_ramadan_campaign"
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 disabled:bg-slate-100 font-mono text-xs text-slate-800"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      المعرف البرمجي الذي يتم ربط كود الواجهة به للتحكم في ظهوره وإخفائه.
                    </span>
                  </div>

                  {/* Names in Languages */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        {t.elementNameAr || 'اسم العنصر بالعربية'} *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nameAr || ''}
                        onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                        placeholder="اسم العنصر بالعربية"
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        {t.elementNameFr || 'Nom en français'}
                      </label>
                      <input
                        type="text"
                        value={formData.nameFr || ''}
                        onChange={(e) => setFormData({ ...formData, nameFr: e.target.value })}
                        placeholder="Nom en français"
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        {t.elementNameEn || 'Name in English'}
                      </label>
                      <input
                        type="text"
                        value={formData.nameEn || ''}
                        onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                        placeholder="Name in English"
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-xs">
                      {t.elementDescAr || 'الوصف وشرح العنصر'}
                    </label>
                    <textarea
                      rows={2}
                      value={formData.descriptionAr || ''}
                      onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                      placeholder="شرح وظيفة هذا العنصر وموقعه في الصفحة للمستخدمين..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>

                  {/* Category, Page, Order & Icon */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        القسم التابع له
                      </label>
                      <select
                        value={formData.category || 'home_sections'}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as UIElementCategory })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        <option value="home_sections">الصفحة الرئيسية</option>
                        <option value="records_and_ledgers">السجلات والحسابات</option>
                        <option value="navigation">أشرطة التنقل</option>
                        <option value="banners_and_media">الإعلانات والوسائط</option>
                        <option value="footer_and_contact">الفوتر والتواصل</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        الصفحة المستهدفة
                      </label>
                      <select
                        value={formData.page || 'home'}
                        onChange={(e) => setFormData({ ...formData, page: e.target.value as any })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        <option value="home">الرئيسية (Home)</option>
                        <option value="activities">الأنشطة (Activities)</option>
                        <option value="members">المنخرطون (Members)</option>
                        <option value="ledger">سجل الشفافية (Ledger)</option>
                        <option value="campaigns">حملات التبرع (Campaigns)</option>
                        <option value="voting">التصويت والقرارات</option>
                        <option value="footer">الفوتر العام (Footer)</option>
                        <option value="all">كافة الصفحات (All)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        ترتيب الظهور
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.order || 1}
                        onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        الأيقونة الرمزية
                      </label>
                      <select
                        value={formData.iconName || 'Layout'}
                        onChange={(e) => setFormData({ ...formData, iconName: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        <option value="Layout">Layout (واجهة)</option>
                        <option value="Sparkles">Sparkles (تألق / بانر)</option>
                        <option value="Bell">Bell (تنبيه / إعلان)</option>
                        <option value="Heart">Heart (خير وتبرع)</option>
                        <option value="Award">Award (أهداف وشرف)</option>
                        <option value="HeartHandshake">HeartHandshake (أنشطة)</option>
                        <option value="ShieldCheck">ShieldCheck (شفافية)</option>
                        <option value="Layers">Layers (سجلات)</option>
                        <option value="FileSpreadsheet">FileSpreadsheet (العمليات)</option>
                        <option value="TrendingUp">TrendingUp (الرصيد)</option>
                        <option value="Users">Users (منخرطون)</option>
                        <option value="CreditCard">CreditCard (بنك وRIB)</option>
                        <option value="Building">Building (مقر ومعلومات)</option>
                      </select>
                    </div>
                  </div>

                  {/* Custom Block Interactive Content (If in custom mode) */}
                  {modalMode === 'custom_block' && (
                    <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-700" />
                        <h4 className="font-bold text-purple-950 text-xs">
                          إعدادات المحتوى التفاعلي للبطاقة / البانر المخصص:
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="font-bold text-purple-900 block mb-1 text-xs">
                            نص الشارة الترويجية (اختياري)
                          </label>
                          <input
                            type="text"
                            value={formData.customContent?.badgeTextAr || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              customContent: {
                                ...(formData.customContent || {}),
                                badgeTextAr: e.target.value,
                              }
                            })}
                            placeholder="مثال: إعلان عاجل أو مشروع جديد"
                            className="w-full p-2 rounded-xl border border-purple-200 bg-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-purple-900 block mb-1 text-xs">
                            نص زر التفاعل السريع
                          </label>
                          <input
                            type="text"
                            value={formData.customContent?.buttonTextAr || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              customContent: {
                                ...(formData.customContent || {}),
                                buttonTextAr: e.target.value,
                              }
                            })}
                            placeholder="مثال: تبرع الآن أو طلب انخراط"
                            className="w-full p-2 rounded-xl border border-purple-200 bg-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-purple-900 block mb-1 text-xs">
                            إجراء الزر التفاعلي
                          </label>
                          <select
                            value={formData.customContent?.buttonAction || 'tab'}
                            onChange={(e) => setFormData({
                              ...formData,
                              customContent: {
                                ...(formData.customContent || {}),
                                buttonAction: e.target.value as any,
                              }
                            })}
                            className="w-full p-2 rounded-xl border border-purple-200 bg-white text-xs"
                          >
                            <option value="donate">فتح نافذة التبرع والمساهمات</option>
                            <option value="join">فتح استمارة طلب الانخراط</option>
                            <option value="report">فتح الكشف المالي الرسمي</option>
                            <option value="tab">التوجيه لتبويب محدد بالمنصة</option>
                            <option value="link">فتح رابط إلكتروني خارجي</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Enabled State Checkbox */}
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      id="modalEnabledCheck"
                      checked={formData.enabled ?? true}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer"
                    />
                    <label htmlFor="modalEnabledCheck" className="font-bold text-slate-800 text-xs cursor-pointer">
                      تفعيل العنصر مباشرة في واجهة المنصة (حالة الظهور: مفعّل)
                    </label>
                  </div>

                  {/* Non-Member Visibility State */}
                  <div className="flex items-center gap-2 p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                    <input
                      type="checkbox"
                      id="modalVisibleToNonMembersCheck"
                      checked={formData.visibleToNonMembers ?? true}
                      onChange={(e) => setFormData({ ...formData, visibleToNonMembers: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer"
                    />
                    <label htmlFor="modalVisibleToNonMembersCheck" className="font-bold text-emerald-950 text-xs cursor-pointer">
                      إظهار هذا العنصر للزوار والعموم غير المنخرطين في واجهة المتجر (المنخرطون يرونه دائماً)
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingDb}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Database className="w-4 h-4" />
                      <span>{isSavingDb ? 'جاري الحفظ في قاعدة البيانات...' : 'حفظ العنصر وتطبيقه على الواجهة'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
