import React, { useState, useMemo } from 'react';
import {
  FinancialOperation,
  Member,
  CurrentAdminSession,
  SubAdmin,
  ExpenseCategory,
  PaymentMethodType,
} from '../types';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Edit3,
  Trash2,
  History,
  Copy,
  Check,
  Calendar,
  Lock,
  Plus,
  FileSpreadsheet,
  Download,
  Eye,
  CreditCard,
  Banknote,
  FileText,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { EditOperationModal } from './EditOperationModal';
import { OperationRevisionsModal } from './OperationRevisionsModal';

interface ManageOperationsProps {
  operations: FinancialOperation[];
  members?: Member[];
  currentAdminSession: CurrentAdminSession | null;
  subAdmins?: SubAdmin[];
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onOpenAddOperation: () => void;
  onSaveOperation: (updatedFields: Partial<FinancialOperation>, editId?: string) => Promise<any>;
  onDeleteOperation: (id: string) => void;
  totalIncomes: number;
  totalExpenses: number;
  currentBalance: number;
  lang?: 'ar' | 'fr' | 'en';
}

export const ManageOperations: React.FC<ManageOperationsProps> = ({
  operations,
  members = [],
  currentAdminSession,
  subAdmins = [],
  canView,
  canAdd,
  canEdit,
  canDelete,
  onOpenAddOperation,
  onSaveOperation,
  onDeleteOperation,
  totalIncomes,
  totalExpenses,
  currentBalance,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // UI Modals State
  const [editingOperation, setEditingOperation] = useState<FinancialOperation | null>(null);
  const [revisingOperation, setRevisingOperation] = useState<FinancialOperation | null>(null);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedDescId, setExpandedDescId] = useState<string | null>(null);

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Human-readable labels
  const getCategoryLabel = (cat?: string, type?: 'income' | 'expense') => {
    switch (cat) {
      case 'tree_planting':
        return 'تشجير ومساحات خضراء';
      case 'social_aid':
        return 'مساعدات اجتماعية';
      case 'equipment':
        return 'معدات وتجهيزات';
      case 'education':
        return 'دعم تعليمي ومدرسي';
      case 'health_caravan':
        return 'قوافل صحية';
      case 'maintenance':
        return 'صيانة وبنية تحتية';
      case 'ramadan_aid':
        return 'قفة رمضان';
      case 'membership_fee':
        return 'واجبات انخراط';
      case 'donation':
        return 'تبرعات ومحسنون';
      case 'sponsor':
        return 'رعاية مشاريع';
      default:
        return cat || (type === 'income' ? 'مدخول' : 'مصروف');
    }
  };

  const getMethodLabel = (method?: PaymentMethodType | string) => {
    switch (method) {
      case 'cash':
        return 'نقداً';
      case 'bank_transfer':
        return 'تحويل بنكي';
      case 'check':
        return 'شيك بنكي';
      case 'online':
        return 'دفع إلكتروني';
      case 'other':
        return 'أخرى';
      default:
        return method || 'نقداً';
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setPaymentMethodFilter('all');
    setDateFrom('');
    setDateTo('');
    setMinAmount('');
    setMaxAmount('');
  };

  const isFiltered =
    searchQuery.trim() !== '' ||
    typeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    paymentMethodFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    minAmount !== '' ||
    maxAmount !== '';

  // Filtered operations
  const filteredOperations = useMemo(() => {
    return operations.filter((op) => {
      // 1. Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesCode = op.code?.toLowerCase().includes(query);
        const matchesTitle = op.title?.toLowerCase().includes(query);
        const matchesDesc = op.description?.toLowerCase().includes(query);
        const matchesMember = op.memberName?.toLowerCase().includes(query);
        const matchesAddedBy = op.addedBy?.toLowerCase().includes(query);
        if (!matchesCode && !matchesTitle && !matchesDesc && !matchesMember && !matchesAddedBy) {
          return false;
        }
      }

      // 2. Type filter
      if (typeFilter !== 'all' && op.type !== typeFilter) {
        return false;
      }

      // 3. Category filter
      if (categoryFilter !== 'all' && op.category !== categoryFilter) {
        return false;
      }

      // 4. Payment method filter
      if (paymentMethodFilter !== 'all') {
        const actualMethod = op.paymentMethod || (op.type === 'income' ? 'bank_transfer' : 'cash');
        if (actualMethod !== paymentMethodFilter) {
          return false;
        }
      }

      // 5. Date range
      if (dateFrom && op.date < dateFrom) {
        return false;
      }
      if (dateTo && op.date > dateTo) {
        return false;
      }

      // 6. Amount range
      if (minAmount !== '' && Number(op.amount) < Number(minAmount)) {
        return false;
      }
      if (maxAmount !== '' && Number(op.amount) > Number(maxAmount)) {
        return false;
      }

      return true;
    });
  }, [
    operations,
    searchQuery,
    typeFilter,
    categoryFilter,
    paymentMethodFilter,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
  ]);

  // Aggregate stats of filtered operations
  const filteredStats = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredOperations.forEach((op) => {
      const amt = Number(op.amount) || 0;
      if (op.type === 'income') inc += amt;
      else exp += amt;
    });
    return {
      incomes: inc,
      expenses: exp,
      balance: inc - exp,
    };
  }, [filteredOperations]);

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = [
      'رقم العملية',
      'النوع',
      'البيان',
      'المبلغ (د.م)',
      'التاريخ',
      'التصنيف',
      'طريقة الدفع',
      'الرصيد بعدها',
      'المسؤول',
      'الوصف',
    ];

    const rows = filteredOperations.map((op) => [
      op.code,
      op.type === 'income' ? 'مدخول' : 'مصروف',
      `"${op.title.replace(/"/g, '""')}"`,
      op.amount,
      op.date,
      getCategoryLabel(op.category, op.type),
      getMethodLabel(op.paymentMethod),
      op.balanceAfter ?? '',
      `"${(op.addedBy || '').replace(/"/g, '""')}"`,
      `"${(op.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `chayef-operations-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Permission Gate: if user cannot view operations section
  if (!canView) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs" dir="rtl">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">غير مصرح لك بعرض العمليات المالية</h3>
        <p className="text-xs text-slate-500 mt-1">
          حسابك الإداري لا يملك صلاحية الاطلاع على سجل العمليات المالية والمداخيل والمصاريف.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner & Metrics */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                جميع العمليات المالية (المداخيل والمصاريف)
              </h2>
              {/* Permission Badge */}
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                  canEdit
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {canEdit ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>صلاحية عرض وتعديل</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>صلاحية عرض فقط</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              جدول مالي منظم ومباشر لجميع المداخيل ومصاريف الأنشطة، مع إمكانية البحث والتصفية والتعديل في نفس السجل الأصلي.
            </p>
          </div>

          {/* Quick Top Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
              title="تصدير السجل إلى ملف Excel/CSV"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>تصدير CSV</span>
            </button>

            {canAdd && (
              <button
                onClick={onOpenAddOperation}
                id="admin-add-operation-main-btn"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>تسجيل عملية جديدة</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Key Real-time Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Total Incomes */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800">إجمالي المداخيل</span>
              <span className="p-1 rounded-lg bg-emerald-200/60 text-emerald-800">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800 font-mono mt-2">
              +{totalIncomes.toLocaleString()}
              <span className="text-xs font-normal text-emerald-700 mr-1">د.م</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-medium block mt-1">
              {operations.filter((o) => o.type === 'income').length} عمليات مدخول مسجلة
            </span>
          </div>

          {/* Total Expenses */}
          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-800">إجمالي المصاريف</span>
              <span className="p-1 rounded-lg bg-rose-200/60 text-rose-800">
                <TrendingDown className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-800 font-mono mt-2">
              -{totalExpenses.toLocaleString()}
              <span className="text-xs font-normal text-rose-700 mr-1">د.م</span>
            </div>
            <span className="text-[10px] text-rose-600 font-medium block mt-1">
              {operations.filter((o) => o.type === 'expense').length} عمليات مصروف خيري
            </span>
          </div>

          {/* Real-time Balance */}
          <div className="p-4 rounded-xl bg-slate-900 text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">الرصيد الفعلي الحي</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                مباشر
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono mt-2 text-emerald-400">
              {currentBalance.toLocaleString()}
              <span className="text-xs font-normal text-slate-300 mr-1">د.م</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              يُعاد احتسابه آليًا بعد أي تعديل
            </span>
          </div>

          {/* Total Operations Count */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">إجمالي السجلات</span>
              <span className="p-1 rounded-lg bg-slate-200 text-slate-700">
                <FileText className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-2">
              {operations.length}
              <span className="text-xs font-normal text-slate-500 mr-1">عملية</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {operations.filter((o) => (o.revisions?.length || 0) > 0).length} خضعت للمراجعة والتعديل
            </span>
          </div>
        </div>
      </div>

      {/* Advanced Search & Filtering Section */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Row 1: Search Query Input + Type Pills */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم العملية، البيان، الوصف، اسم المنخرط، أو المسؤول..."
              className="w-full pl-3 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({operations.length})
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                typeFilter === 'income'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>مداخيل ({operations.filter((o) => o.type === 'income').length})</span>
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                typeFilter === 'expense'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>مصاريف ({operations.filter((o) => o.type === 'expense').length})</span>
            </button>
          </div>
        </div>

        {/* Row 2: Category, Payment Method, Date Range, Amount Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 text-xs">
          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              التصنيف:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="all">جميع التصنيفات</option>
              <optgroup label="المداخيل">
                <option value="membership_fee">واجبات الانخراط</option>
                <option value="donation">تبرعات ومحسنون</option>
                <option value="sponsor">رعاية مشاريع</option>
              </optgroup>
              <optgroup label="المصاريف الخيرية">
                <option value="tree_planting">تشجير ومساحات خضراء</option>
                <option value="social_aid">مساعدات اجتماعية</option>
                <option value="equipment">معدات وتجهيزات</option>
                <option value="education">دعم تعليمي ومدرسي</option>
                <option value="health_caravan">قوافل صحية</option>
                <option value="maintenance">صيانة وبنية تحتية</option>
                <option value="ramadan_aid">قفة رمضان</option>
                <option value="other">مصاريف أخرى</option>
              </optgroup>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              طريقة الدفع:
            </label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="all">جميع طرق الدفع</option>
              <option value="cash">نقداً</option>
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="check">شيك بنكي</option>
              <option value="online">دفع إلكتروني</option>
              <option value="other">طريقة أخرى</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              نطاق التاريخ (من - إلى):
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                placeholder="من"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                placeholder="إلى"
              />
            </div>
          </div>

          {/* Amount Range */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              المبلغ (الحد الأدنى - الأقصى):
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="أدنى د.م"
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="أقصى د.م"
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Filter Summary & Reset Bar */}
        {isFiltered && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-emerald-900">
              <span className="font-bold">
                نتائج التصفية: {filteredOperations.length} من أصل {operations.length} عملية
              </span>
              <span className="text-slate-400">|</span>
              <span>المداخيل المفلترة: <strong>+{filteredStats.incomes.toLocaleString()} د.م</strong></span>
              <span className="text-slate-400">|</span>
              <span>المصاريف المفلترة: <strong>-{filteredStats.expenses.toLocaleString()} د.م</strong></span>
              <span className="text-slate-400">|</span>
              <span>
                الصافي المفلتر:{' '}
                <strong className={filteredStats.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {filteredStats.balance.toLocaleString()} د.م
                </strong>
              </span>
            </div>

            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Operations Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredOperations.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">لا توجد عمليات مالية مطابقة للبحث والتصفية</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {isFiltered
                ? 'جرب تعديل خيارات التصفية أو مسح كلمات البحث لعرض مزيد من العمليات المالية.'
                : 'لم يتم تسجيل أي عملية مالية حتى الآن. انقر على «تسجيل عملية جديدة» للبدء.'}
            </p>
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
              >
                إلغاء جميع الفلاتر
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                    <th className="py-3 px-4 whitespace-nowrap">رقم العملية</th>
                    <th className="py-3 px-4 whitespace-nowrap">النوع</th>
                    <th className="py-3 px-4 whitespace-nowrap">المبلغ</th>
                    <th className="py-3 px-4 whitespace-nowrap">التاريخ</th>
                    <th className="py-3 px-4 whitespace-nowrap">التصنيف</th>
                    <th className="py-3 px-4">البيان والوصف</th>
                    <th className="py-3 px-4 whitespace-nowrap">طريقة الدفع</th>
                    <th className="py-3 px-4 whitespace-nowrap">الرصيد بعدها</th>
                    <th className="py-3 px-4 whitespace-nowrap">المسؤول / الوصل</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredOperations.map((op) => {
                    const isIncome = op.type === 'income';
                    const hasRevisions = (op.revisions?.length || 0) > 0;
                    const isDescExpanded = expandedDescId === op.id;

                    return (
                      <tr
                        key={op.id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        {/* 1. Operation Code */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px]">
                              {op.code}
                            </span>
                            <button
                              onClick={() => handleCopyCode(op.code)}
                              title="نسخ رقم العملية"
                              className="text-slate-400 hover:text-slate-700 transition-colors"
                            >
                              {copiedCode === op.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 2. Type */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isIncome
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isIncome ? (
                              <>
                                <TrendingUp className="w-3 h-3" />
                                <span>مدخول (+)</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-3 h-3" />
                                <span>مصروف (-)</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* 3. Amount */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-sm">
                          <span className={isIncome ? 'text-emerald-700' : 'text-rose-700'}>
                            {isIncome ? '+' : '-'}
                            {Number(op.amount).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal mr-1">د.م</span>
                        </td>

                        {/* 4. Date */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                          {op.date}
                        </td>

                        {/* 5. Category */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                            {getCategoryLabel(op.category, op.type)}
                          </span>
                        </td>

                        {/* 6. Title & Description */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-bold text-slate-900">{op.title}</div>
                          {op.description && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {isDescExpanded ? (
                                <span>{op.description}</span>
                              ) : (
                                <span>{op.description.slice(0, 55)}{op.description.length > 55 ? '...' : ''}</span>
                              )}
                              {op.description.length > 55 && (
                                <button
                                  onClick={() => setExpandedDescId(isDescExpanded ? null : op.id)}
                                  className="text-emerald-700 font-bold hover:underline mr-1 text-[10px]"
                                >
                                  {isDescExpanded ? 'إخفاء' : 'المزيد'}
                                </button>
                              )}
                            </div>
                          )}
                          {hasRevisions && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                <History className="w-3 h-3" />
                                <span>تم تعديلها {op.revisions?.length} مرة</span>
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 7. Payment Method */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-slate-400" />
                            <span>{getMethodLabel(op.paymentMethod)}</span>
                          </span>
                        </td>

                        {/* 8. Running Balance */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-slate-900">
                          {op.balanceAfter !== undefined ? (
                            <span>{Number(op.balanceAfter).toLocaleString()} د.م</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* 9. Added By / Proof */}
                        <td className="py-3 px-4 whitespace-nowrap text-[11px]">
                          <div className="text-slate-700 font-medium">{op.addedBy || 'إدارة الجمعية'}</div>
                          {op.proofUrls && op.proofUrls.length > 0 && (
                            <button
                              onClick={() => setPreviewProofUrl(op.proofUrls![0])}
                              className="text-emerald-700 font-bold hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <Eye className="w-3 h-3" />
                              <span>معاينة الوصل</span>
                            </button>
                          )}
                        </td>

                        {/* 10. Actions (Edit in place, Revisions, Delete) */}
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Edit Button: Strictly checks canEdit */}
                            <button
                              onClick={() => {
                                if (canEdit) {
                                  setEditingOperation(op);
                                }
                              }}
                              disabled={!canEdit}
                              title={canEdit ? 'تعديل بيانات العملية في نفس السجل الأصلي' : 'صلاحية العرض فقط - التعديل غير مصرح به'}
                              className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${
                                canEdit
                                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:scale-105 active:scale-95'
                                  : 'text-slate-400 bg-slate-100 cursor-not-allowed opacity-60'
                              }`}
                            >
                              {canEdit ? (
                                <>
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>تعديل</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-[10px]">مغلق</span>
                                </>
                              )}
                            </button>

                            {/* Revisions History Button */}
                            {hasRevisions && (
                              <button
                                onClick={() => setRevisingOperation(op)}
                                title="عرض سجل مراجعات وتعديلات هذه العملية"
                                className="p-1.5 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete Button (canDelete permission) */}
                            {canDelete && (
                              <button
                                onClick={() => onDeleteOperation(op.id)}
                                title="حذف العملية المالية"
                                className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredOperations.map((op) => {
                const isIncome = op.type === 'income';
                const hasRevisions = (op.revisions?.length || 0) > 0;

                return (
                  <div key={op.id} className="p-4 space-y-3">
                    {/* Header: Code & Type & Amount */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                            {op.code}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isIncome ? 'مدخول (+)' : 'مصروف (-)'}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-1.5">{op.title}</h4>
                      </div>

                      <div className="text-left font-mono shrink-0">
                        <div
                          className={`text-base font-black ${
                            isIncome ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {Number(op.amount).toLocaleString()} د.م
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{op.date}</div>
                      </div>
                    </div>

                    {/* Metadata chips */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                        {getCategoryLabel(op.category, op.type)}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-slate-400" />
                        <span>{getMethodLabel(op.paymentMethod)}</span>
                      </span>
                      {op.balanceAfter !== undefined && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded font-mono font-bold">
                          الرصيد: {Number(op.balanceAfter).toLocaleString()} د.م
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {op.description && (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl">
                        {op.description}
                      </p>
                    )}

                    {/* Revision Notice on mobile */}
                    {hasRevisions && (
                      <div className="flex items-center justify-between text-[11px] bg-amber-50 p-2 rounded-lg border border-amber-200/60 text-amber-900">
                        <span className="flex items-center gap-1 font-semibold">
                          <History className="w-3 h-3 text-amber-700" />
                          <span>تم تعديل هذه العملية ({op.revisions?.length} مرات)</span>
                        </span>
                        <button
                          onClick={() => setRevisingOperation(op)}
                          className="text-amber-800 font-bold underline text-[10px]"
                        >
                          معاينة الفروقات
                        </button>
                      </div>
                    )}

                    {/* Mobile Actions Toolbar */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {op.proofUrls && op.proofUrls.length > 0 && (
                          <button
                            onClick={() => setPreviewProofUrl(op.proofUrls![0])}
                            className="text-emerald-700 font-bold text-xs hover:underline flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>معاينة الوصل</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Edit button */}
                        <button
                          onClick={() => {
                            if (canEdit) setEditingOperation(op);
                          }}
                          disabled={!canEdit}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            canEdit
                              ? 'bg-emerald-600 text-white active:scale-95 shadow-2xs'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {canEdit ? (
                            <>
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>تعديل</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>عرض فقط</span>
                            </>
                          )}
                        </button>

                        {/* Delete button */}
                        {canDelete && (
                          <button
                            onClick={() => onDeleteOperation(op.id)}
                            className="p-1.5 bg-rose-50 text-rose-700 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Edit Operation Modal */}
      <EditOperationModal
        operation={editingOperation}
        members={members}
        isOpen={!!editingOperation}
        onClose={() => setEditingOperation(null)}
        onSave={async (updatedFields) => {
          if (!editingOperation) return;
          return await onSaveOperation(updatedFields, editingOperation.id);
        }}
        canEdit={canEdit}
      />

      {/* Operation Revisions Modal */}
      {revisingOperation && (
        <OperationRevisionsModal
          operation={revisingOperation}
          isOpen={!!revisingOperation}
          onClose={() => setRevisingOperation(null)}
        />
      )}

      {/* Proof Lightbox Modal */}
      {previewProofUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          onClick={() => setPreviewProofUrl(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">معاينة الوصل / الفاتورة الثبوتية</h4>
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ×
              </button>
            </div>
            <div className="rounded-xl overflow-hidden max-h-[70vh] flex items-center justify-center bg-slate-100 p-1">
              {previewProofUrl.startsWith('data:application/pdf') || previewProofUrl.toLowerCase().includes('.pdf') ? (
                <iframe
                  src={previewProofUrl}
                  title="وثيقة الإثبات الرسمية"
                  className="w-full h-[65vh] rounded-lg border-0 bg-white"
                />
              ) : (
                <img
                  src={previewProofUrl}
                  alt="وصل أو فاتورة العملية"
                  className="max-h-[65vh] w-auto object-contain rounded-lg shadow-xs"
                />
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <a
                href={previewProofUrl}
                target="_blank"
                rel="noreferrer"
                download="document_recu"
                className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح الوثيقة بالحجم الكامل في نافذة جديدة</span>
              </a>
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="px-3 py-1 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
