import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  SlidersHorizontal,
  Search,
  Sparkles,
  HeartHandshake,
  Users,
  Award,
  Coins,
  FileSpreadsheet,
  TrendingUp,
  Vote,
  CreditCard,
  Target,
  Layers,
  FileCheck,
  Globe,
  Smartphone,
  Info,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  FileText,
  Lock,
  Wallet,
} from 'lucide-react';
import { UIElementConfig, CurrentAdminSession } from '../types';
import {
  CANONICAL_SECTIONS,
  PRIMARY_TRANSPARENCY_SECTION_IDS,
  getNonMemberVisibilityMap,
} from '../utils/visibilityRules';

interface ManageNonMemberVisibilityProps {
  elements: UIElementConfig[];
  onUpdateElements: (updated: UIElementConfig[]) => void;
  currentSession: CurrentAdminSession | null;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ManageNonMemberVisibility: React.FC<ManageNonMemberVisibilityProps> = ({
  elements,
  onUpdateElements,
  currentSession,
  addToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'core' | 'visible' | 'hidden'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);
  const [showSimulator, setShowSimulator] = useState(false);

  // Map icon name to Lucide Icon component
  const renderIcon = (name?: string) => {
    const iconClass = 'w-5 h-5';
    switch (name) {
      case 'HeartHandshake':
        return <HeartHandshake className={iconClass} />;
      case 'Users':
        return <Users className={iconClass} />;
      case 'Award':
        return <Award className={iconClass} />;
      case 'Coins':
        return <Coins className={iconClass} />;
      case 'FileSpreadsheet':
        return <FileSpreadsheet className={iconClass} />;
      case 'TrendingUp':
        return <TrendingUp className={iconClass} />;
      case 'Vote':
        return <Vote className={iconClass} />;
      case 'CreditCard':
        return <CreditCard className={iconClass} />;
      case 'Sparkles':
        return <Sparkles className={iconClass} />;
      case 'Target':
        return <Target className={iconClass} />;
      case 'ShieldCheck':
        return <ShieldCheck className={iconClass} />;
      case 'Layers':
        return <Layers className={iconClass} />;
      case 'FileCheck':
        return <FileCheck className={iconClass} />;
      case 'FileText':
        return <FileText className={iconClass} />;
      case 'Wallet':
        return <Wallet className={iconClass} />;
      case 'Globe':
        return <Globe className={iconClass} />;
      case 'Smartphone':
        return <Smartphone className={iconClass} />;
      default:
        return <SlidersHorizontal className={iconClass} />;
    }
  };

  // Sync with Backend/API
  const syncWithServer = async (updatedElements: UIElementConfig[]) => {
    setIsSaving(true);
    try {
      const visibilityMap = getNonMemberVisibilityMap(updatedElements);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (currentSession) {
        headers['x-admin-session'] = encodeURIComponent(JSON.stringify(currentSession));
      }

      const res = await fetch('/api/visibility', {
        method: 'POST',
        headers,
        body: JSON.stringify({ visibility: visibilityMap }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[Visibility] Successfully synced with server:', data);
      } else {
        console.warn('[Visibility] Server sync status:', res.status);
      }
    } catch (err) {
      console.warn('[Visibility] Network error syncing with server:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle single element visibility for non-members
  const handleToggleNonMemberVisibility = async (id: string) => {
    const target = elements.find((e) => e.id === id);
    let updated: UIElementConfig[];
    let currentNameAr = '';
    let newVisibility = true;

    if (!target) {
      const canonical = CANONICAL_SECTIONS.find((c) => c.id === id);
      if (!canonical) return;
      currentNameAr = canonical.nameAr;
      newVisibility = false; // toggle from default true to false
      const newEl: UIElementConfig = {
        id: canonical.id,
        nameAr: canonical.nameAr,
        nameFr: canonical.nameFr,
        nameEn: canonical.nameEn,
        descriptionAr: canonical.descriptionAr,
        descriptionFr: '',
        descriptionEn: '',
        category: canonical.category as any,
        enabled: true,
        visibleToNonMembers: false,
        order: 99,
        iconName: canonical.iconName,
      };
      updated = [...elements, newEl];
    } else {
      currentNameAr = target.nameAr;
      newVisibility = target.visibleToNonMembers === false; // toggle
      updated = elements.map((e) => {
        if (e.id === id) {
          return {
            ...e,
            visibleToNonMembers: newVisibility,
          };
        }
        return e;
      });
    }

    onUpdateElements(updated);
    await syncWithServer(updated);

    if (newVisibility) {
      addToast(
        'success',
        `تم تفعيل إظهار «${currentNameAr}» للزوار والغير المنخرطين في واجهة المتجر.`
      );
    } else {
      addToast(
        'info',
        `تم إخفاء «${currentNameAr}» عن غير المنخرطين (أصبح متاحاً حصرياً للمنخرطين المسجلين).`
      );
    }
  };

  // Batch action: Show all to non-members
  const handleShowAllToNonMembers = async () => {
    // Ensure all canonical sections are included
    const allKnownIds = new Set(elements.map((e) => e.id));
    const merged = [...elements];
    CANONICAL_SECTIONS.forEach((canonical) => {
      if (!allKnownIds.has(canonical.id)) {
        allKnownIds.add(canonical.id);
        merged.push({
          id: canonical.id,
          nameAr: canonical.nameAr,
          nameFr: canonical.nameFr,
          nameEn: canonical.nameEn,
          descriptionAr: canonical.descriptionAr,
          descriptionFr: '',
          descriptionEn: '',
          category: canonical.category as any,
          enabled: true,
          visibleToNonMembers: true,
          order: 99,
          iconName: canonical.iconName,
        });
      }
    });

    const updated = merged.map((e) => ({
      ...e,
      visibleToNonMembers: true,
    }));
    onUpdateElements(updated);
    await syncWithServer(updated);
    addToast('success', 'تم تفعيل إظهار كافة الأقسام والتصنيفات لجميع الزوار والغير المنخرطين.');
  };

  // Batch action: Privacy / Safe Mode (Restricts sensitive ledgers, financial details, and voting to members only)
  const handleApplyPrivacySafeMode = async () => {
    const sensitiveSectionIds = [
      'gateway_ledger',
      'members_voting_section',
      'member_card',
      'gateway_members',
      'current_financial_balance',
      'proof_document_preview',
    ];

    // Ensure all canonical sections are included
    const allKnownIds = new Set(elements.map((e) => e.id));
    const merged = [...elements];
    CANONICAL_SECTIONS.forEach((canonical) => {
      if (!allKnownIds.has(canonical.id)) {
        allKnownIds.add(canonical.id);
        merged.push({
          id: canonical.id,
          nameAr: canonical.nameAr,
          nameFr: canonical.nameFr,
          nameEn: canonical.nameEn,
          descriptionAr: canonical.descriptionAr,
          descriptionFr: '',
          descriptionEn: '',
          category: canonical.category as any,
          enabled: true,
          visibleToNonMembers: !sensitiveSectionIds.includes(canonical.id),
          order: 99,
          iconName: canonical.iconName,
        });
      }
    });

    const updated = merged.map((e) => {
      if (sensitiveSectionIds.includes(e.id)) {
        return {
          ...e,
          visibleToNonMembers: false,
        };
      }
      return {
        ...e,
        visibleToNonMembers: true,
      };
    });

    onUpdateElements(updated);
    await syncWithServer(updated);
    addToast(
      'info',
      'تم تفعيل الوضع الآمن: حصر السجلات المالية والشفافية والتصويت للمنخرطين المسجلين فقط.'
    );
  };

  // Reconcile list: combine canonical sections and any custom elements
  const allKnownIds = new Set<string>();
  const displayList: Array<{
    id: string;
    nameAr: string;
    nameFr?: string;
    nameEn?: string;
    descriptionAr?: string;
    detailedDescription?: string;
    category?: string;
    canonicalCategory?: string;
    enabled: boolean;
    visibleToNonMembers: boolean;
    isCore: boolean;
    displayIcon: string;
  }> = [];

  CANONICAL_SECTIONS.forEach((canonical) => {
    allKnownIds.add(canonical.id);
    const el = elements.find((e) => e.id === canonical.id);
    displayList.push({
      id: canonical.id,
      nameAr: canonical.nameAr,
      nameFr: canonical.nameFr || el?.nameFr,
      nameEn: canonical.nameEn || el?.nameEn,
      descriptionAr: canonical.descriptionAr,
      detailedDescription: canonical.descriptionAr,
      category: el?.category || canonical.category,
      canonicalCategory: canonical.category,
      enabled: el?.enabled ?? true,
      visibleToNonMembers: el ? el.visibleToNonMembers !== false : true,
      isCore: canonical.isCoreRequirement,
      displayIcon: canonical.iconName || el?.iconName || 'SlidersHorizontal',
    });
  });

  elements.forEach((el) => {
    if (el.id === 'gateway_financials' || el.id === 'pillars_section') return;
    if (!allKnownIds.has(el.id)) {
      allKnownIds.add(el.id);
      displayList.push({
        id: el.id,
        nameAr: el.nameAr,
        nameFr: el.nameFr,
        nameEn: el.nameEn,
        descriptionAr: el.descriptionAr,
        detailedDescription: el.descriptionAr || '',
        category: el.category,
        canonicalCategory: el.category,
        enabled: el.enabled,
        visibleToNonMembers: el.visibleToNonMembers !== false,
        isCore: false,
        displayIcon: el.iconName || 'SlidersHorizontal',
      });
    }
  });

  // Calculate statistics
  const totalCount = displayList.length;
  const visibleCount = displayList.filter((e) => e.visibleToNonMembers !== false).length;
  const hiddenCount = totalCount - visibleCount;

  // Filter list
  const filteredList = displayList.filter((item) => {
    // Search query
    const matchesSearch =
      item.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.detailedDescription.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Filter tab
    if (selectedFilter === 'core') return item.isCore;
    if (selectedFilter === 'visible') return item.visibleToNonMembers !== false;
    if (selectedFilter === 'hidden') return item.visibleToNonMembers === false;
    return true;
  });

  return (
    <div className="space-y-6" dir="rtl" id="manage-non-member-visibility-container">
      {/* Header & Title Section */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                  تحكم في ظهور الأقسام للغير المنخرطين
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  إدارة شاملة وديناميكية للأقسام والتصنيفات التي يمكن للزوار والعموم رؤيتها في واجهة المتجر
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowSimulator(!showSimulator)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="معاينة الواجهة كما يراها الزائر غير المنخرط"
            >
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>{showSimulator ? 'إغلاق المعاينة' : 'معاينة تجربة الزائر'}</span>
            </button>

            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
              title="إرشادات وقواعد النظام"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* System Architecture Explanation Banner */}
        {showExplanation && (
          <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100/80">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>المنخرطون المسجلون بحساباتهم</span>
              </div>
              <p className="text-xs text-emerald-950/80 leading-relaxed">
                تظهر لهم <strong>جميع الأقسام والتصنيفات دائمًا دون أي قيود</strong>. واجهتهم لا تتأثر نهائيًا بهذه الإعدادات، ويستمرون في الوصول إلى كل الميزات المعتادة.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-100/80">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-1.5">
                <EyeOff className="w-4 h-4 text-amber-600" />
                <span>الزوار وغير المنخرطين</span>
              </div>
              <p className="text-xs text-amber-950/80 leading-relaxed">
                تظهر لهم <strong>فقط الأقسام والتصنيفات التي يتم تفعيلها هنا</strong>. الأقسام المعطلة تُحجب تمامًا من الواجهة، القوائم، والبحث وروابط التصفح.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100/80">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-sm mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>حماية وحفظ فوري (Backend + API)</span>
              </div>
              <p className="text-xs text-blue-950/80 leading-relaxed">
                يتم تطبيق قواعد الحجب على مستوى الواجهة والخادم (API). أي تعديل يتم حفظه في قاعدة البيانات ويسري فورًا على جميع الأجهزة.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Visitor Simulator Modal / Card */}
      {showSimulator && (
        <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
              <h3 className="font-bold text-base text-slate-100">
                محاكاة مباشرة: ما يشاهده الزائر غير المنخرط الآن في واجهة المتجر
              </h3>
            </div>
            <button
              onClick={() => setShowSimulator(false)}
              className="text-slate-400 hover:text-white text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 cursor-pointer"
            >
              إغلاق
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {displayList.map((item) => {
              const isVisible = item.visibleToNonMembers !== false;
              return (
                <div
                  key={`sim-${item.id}`}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
                    isVisible
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isVisible ? (
                      <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="truncate">{item.nameAr}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                      isVisible
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {isVisible ? 'ظاهر للزائر' : 'محجوب ومخفي'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">إجمالي الأقسام والتصنيفات</span>
            <div className="text-2xl font-black text-slate-800 mt-1">{totalCount}</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-600 font-semibold">متاحة للغير المنخرطين (ظاهرة)</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">{visibleCount}</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Eye className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-600 font-semibold">محجوبة عن الغير المنخرطين (حصرية)</span>
            <div className="text-2xl font-black text-amber-700 mt-1">{hiddenCount}</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <EyeOff className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action Bar: Search, Filters & Batch Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث عن قسم أو تصنيف بالاسم أو الوصف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Quick Batch Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleShowAllToNonMembers}
              disabled={isSaving}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>إظهار الكل لغير المنخرطين</span>
            </button>

            <button
              onClick={handleApplyPrivacySafeMode}
              disabled={isSaving}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>الوضع الآمن (حجب السجلات الحساسة)</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 text-xs font-semibold">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            جميع الأقسام ({totalCount})
          </button>
          <button
            onClick={() => setSelectedFilter('core')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedFilter === 'core'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الأقسام الأساسية المستهدفة
          </button>
          <button
            onClick={() => setSelectedFilter('visible')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedFilter === 'visible'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الظاهرة للعموم ({visibleCount})
          </button>
          <button
            onClick={() => setSelectedFilter('hidden')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedFilter === 'hidden'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            المحجوبة عن العموم ({hiddenCount})
          </button>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-3">
        {/* Unified group banner for the 7 primary transparency sections */}
        {selectedFilter === 'all' && !searchQuery && (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 rounded-2xl p-4 sm:p-5 border border-emerald-200/80 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">
                  أقسام الشفافية والخيارات الرئيسية للغير المنخرطين
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  الخيارات الموحدة للتحكم في ظهور الأنشطة الخيرية، السجلات، المجلس، حملات التبرع، بوابة الشفافية، معاينة وثائق الإثبات، والرصيد المالي الحالي
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>7 خيارات موحدة ومستقلة</span>
              </span>
            </div>
          </div>
        )}

        {filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700">لا توجد أقسام مطابقة للبحث أو الفلتر المحدد</p>
            <p className="text-xs text-slate-500 mt-1">يرجى تعديل معايير البحث أو اختيار فلتر آخر.</p>
          </div>
        ) : (
          filteredList.map((item, index) => {
            const isVisibleToNonMembers = item.visibleToNonMembers !== false;
            const primaryIndex = (PRIMARY_TRANSPARENCY_SECTION_IDS as readonly string[]).indexOf(item.id);
            const isPrimaryGroupItem = primaryIndex !== -1;
            const prevItem = index > 0 ? filteredList[index - 1] : null;
            const isFirstAdditional =
              !isPrimaryGroupItem &&
              prevItem &&
              (PRIMARY_TRANSPARENCY_SECTION_IDS as readonly string[]).includes(prevItem.id);

            return (
              <React.Fragment key={`visibility-row-fragment-${item.id}`}>
                {isFirstAdditional && selectedFilter === 'all' && !searchQuery && (
                  <div className="pt-4 pb-1">
                    <div className="flex items-center gap-3">
                      <div className="h-px bg-slate-200 flex-1"></div>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                        أقسام وعناصر إضافية لواجهة المتجر
                      </span>
                      <div className="h-px bg-slate-200 flex-1"></div>
                    </div>
                  </div>
                )}

                <div
                  id={`visibility-card-${item.id}`}
                  className={`bg-white rounded-2xl p-5 border transition-all duration-200 shadow-sm hover:shadow-md ${
                    isVisibleToNonMembers
                      ? 'border-slate-200 hover:border-emerald-300'
                      : 'border-amber-200/90 bg-amber-50/20 hover:border-amber-300'
                  }`}
                >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  {/* Item Details */}
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm transition-colors ${
                        isVisibleToNonMembers
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {renderIcon(item.displayIcon)}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isPrimaryGroupItem && (
                          <span
                            className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center border border-emerald-200 shrink-0 shadow-xs"
                            title={`الخيار رقم ${primaryIndex + 1} من مجموعة الشفافية الرئيسية`}
                          >
                            {primaryIndex + 1}
                          </span>
                        )}

                        <h4 className="text-base font-bold text-slate-800">
                          {item.nameAr}
                        </h4>

                        {isPrimaryGroupItem ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80">
                            قسم شفافية رئيسي
                          </span>
                        ) : item.isCore ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80">
                            قسم رسمي أساسي
                          </span>
                        ) : null}

                        {/* Member always-accessible badge */}
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>للمنخرطين: متاح دائماً</span>
                        </span>

                        {/* Non-member status badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                            isVisibleToNonMembers
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold'
                          }`}
                        >
                          {isVisibleToNonMembers ? (
                            <>
                              <Eye className="w-3 h-3 text-emerald-600" />
                              <span>ظاهر للغير المنخرطين</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-amber-700" />
                              <span>مخفي عن الغير المنخرطين</span>
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                        {item.detailedDescription}
                      </p>
                    </div>
                  </div>

                  {/* Switch Controls: إظهار للغير المنخرطين / إخفاء عن الغير المنخرطين */}
                  <div className="flex items-center gap-4 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 justify-between md:justify-end">
                    <div className="text-right">
                      <span className="block text-xs font-bold text-slate-700">
                        حالة الظهور للزوار
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          isVisibleToNonMembers ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {isVisibleToNonMembers ? 'متاح للعموم' : 'حصري للمنخرطين'}
                      </span>
                    </div>

                    <button
                      id={`btn-toggle-visibility-${item.id}`}
                      type="button"
                      role="switch"
                      aria-checked={isVisibleToNonMembers}
                      onClick={() => handleToggleNonMemberVisibility(item.id)}
                      disabled={isSaving}
                      className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 cursor-pointer ${
                        isVisibleToNonMembers ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                      title={`تغيير حالة ظهور ${item.nameAr} للغير المنخرطين`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md flex items-center justify-center ${
                          isVisibleToNonMembers ? '-translate-x-9' : '-translate-x-1'
                        }`}
                      >
                        {isVisibleToNonMembers ? (
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
          })
        )}
      </div>

      {/* Footer Info Notice */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            يتم تحديث واجهة المتجر وقواعد الخادم (Backend) بصورة فورية وتلقائية عند تحويل أي مفتاح بدون الحاجة لإعادة تشغيل أو إعادة بناء.
          </span>
        </div>
        {isSaving && (
          <div className="flex items-center gap-1.5 text-emerald-600 font-bold shrink-0">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>جارٍ الحفظ في الخادم...</span>
          </div>
        )}
      </div>
    </div>
  );
};
