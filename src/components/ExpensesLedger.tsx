import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  PlusCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Filter, 
  FileText, 
  Eye, 
  Printer, 
  Download, 
  Image as ImageIcon, 
  Play, 
  Receipt,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Coins,
  CheckCircle2,
  Clock,
  TrendingUp,
  RefreshCw,
  Building2,
  Landmark,
  Scale,
  Sparkles,
  HeartHandshake
} from 'lucide-react';
import {
  FinancialOperation,
  Language,
  UserRole,
  MemberContribution,
  CampaignContribution,
  ContributionTypeConfig,
  DonationCampaign,
  Member,
} from '../types';
import { translations } from '../translations';
import { BackToHomeButton } from './BackToHomeButton';
import {
  unifyAndDeduplicateContributions,
  UnifiedTransparencyContribution,
} from '../utils/transparencyUtils';
import { TransparencyContributionsView } from './TransparencyContributionsView';

interface ExpensesLedgerProps {
  operations: FinancialOperation[];
  contributions?: MemberContribution[];
  campaignContributions?: CampaignContribution[];
  contributionTypes?: ContributionTypeConfig[];
  campaigns?: DonationCampaign[];
  role: UserRole;
  lang: Language;
  tenantId?: string;
  tenantName?: string;
  currency?: string;
  onOpenAddOperation: () => void;
  onOpenReceiptModal: (operation: FinancialOperation) => void;
  onOpenContributionReceipt?: (contribution: UnifiedTransparencyContribution) => void;
  onOpenMediaModal: (media: { title: string; url: string; type: 'image' | 'video' | 'document'; description?: string }) => void;
  onExportCSV: () => void;
  onPrintReport: () => void;
  onDeleteOperation?: (id: string) => void;
  onBackToHome?: () => void;
  onRefreshLiveRecords?: () => Promise<void> | void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  loggedInMember?: Member | null;
}

export const ExpensesLedger: React.FC<ExpensesLedgerProps> = ({
  operations,
  contributions = [],
  campaignContributions = [],
  contributionTypes = [],
  campaigns = [],
  role,
  lang,
  tenantId = 'tenant_nour',
  tenantName = 'جمعية النور للتنمية والتضامن',
  currency = 'د.م',
  onOpenAddOperation,
  onOpenReceiptModal,
  onOpenContributionReceipt,
  onOpenMediaModal,
  onExportCSV,
  onPrintReport,
  onDeleteOperation,
  onBackToHome,
  onRefreshLiveRecords,
  canAdd = true,
  canEdit = true,
  canDelete = false,
  loggedInMember = null,
}) => {
  const t = translations[lang] as any;
  const canViewBalance = role === 'admin' || Boolean(loggedInMember);

  // Active Tab inside Transparency Portal
  const [activeLedgerTab, setActiveLedgerTab] = useState<'contributions' | 'operations' | 'charter'>('contributions');

  // Operations Table State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Unify and deduplicate all financial contributions with strict multi-tenant validation
  const { contributions: unifiedContributions, metrics } = useMemo(() => {
    return unifyAndDeduplicateContributions(
      contributions,
      campaignContributions,
      contributionTypes,
      campaigns,
      tenantId
    );
  }, [contributions, campaignContributions, contributionTypes, campaigns, tenantId]);

  // Operational Balance Calculation
  const totalIncomes = useMemo(() => {
    return operations
      .filter((op) => op.type === 'income')
      .reduce((sum, op) => sum + Number(op.amount), 0);
  }, [operations]);

  const totalExpenses = useMemo(() => {
    return operations
      .filter((op) => op.type === 'expense')
      .reduce((sum, op) => sum + Number(op.amount), 0);
  }, [operations]);

  const currentOperationalBalance = totalIncomes - totalExpenses;

  // Filter operations for Tab 2
  const filteredOperations = operations.filter((op) => {
    const matchesType = filterType === 'all' || op.type === filterType;
    const matchesSearch =
      op.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (op.description && op.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (op.memberName && op.memberName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  // Handle Refresh Trigger
  const handleTriggerRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefreshLiveRecords) {
        await onRefreshLiveRecords();
      }
      // Also dispatch refresh event to sync listeners
      window.dispatchEvent(new CustomEvent('transparency_records_updated', { detail: { tenantId } }));
    } catch (e) {
      console.warn('Failed to refresh transparency records:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Convert contribution to an operation-like receipt for printable viewing
  const handleViewContributionReceipt = (c: UnifiedTransparencyContribution) => {
    if (onOpenContributionReceipt) {
      onOpenContributionReceipt(c);
      return;
    }
    const isUnpaid = c.status === 'unpaid' || c.isNegative || c.amountSign === '-';
    const syntheticOp: FinancialOperation = {
      id: c.financialOperationId || `op-${c.id}`,
      code: c.receiptNumber || `REC-${c.id.slice(-6).toUpperCase()}`,
      type: isUnpaid ? 'expense' : 'income',
      category: c.category as any,
      title: `${c.typeNameAr}: ${c.donorName}`,
      description: c.campaignTitle
        ? `مساهمة موجهة لصالح: ${c.campaignTitle}${c.notes ? ` • ${c.notes}` : ''}`
        : c.notes || (isUnpaid ? 'لم يتم الدفع' : 'مساهمة مالية معتمدة وموثقة بالجمعية'),
      amount: c.amount,
      date: c.date,
      memberId: c.id,
      memberName: c.donorName,
      addedBy: 'إدارة وأمانة مال الجمعية',
      createdAt: c.createdAt,
      tenantId: c.tenantId,
      associationId: c.tenantId,
    };
    onOpenReceiptModal(syntheticOp);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Return to Home Button */}
      {onBackToHome && (
        <BackToHomeButton
          onBack={onBackToHome}
          lang={lang}
          currentPageTitle="بوابة سجل الشفافية المباشر"
          id="back-to-home-from-ledger"
        />
      )}

      {/* Main Header Card with Live Status */}
      <div className="relative overflow-hidden bg-gradient-to-br from-white via-emerald-50/30 to-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25 flex-shrink-0">
              <Scale className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {tenantName}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <span>متصل لحظياً بقاعدة بيانات الشفافية (Firebase Live Sync)</span>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                بوابة سجل الشفافية والحكامة المالية المباشرة
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
                توثيق رقمي فوري لجميع المساهمات المالية، التبرعات، واجبات الانخراط، والمصاريف التشغيلية لضمان الحكامة والمصداقية المطلقة.
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleTriggerRefresh}
              disabled={isRefreshing}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all border border-slate-200 shadow-2xs cursor-pointer ${
                isRefreshing ? 'opacity-70 pointer-events-none' : ''
              }`}
              title="تحديث البيانات لحظياً من قاعدة البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'جارٍ التحديث...' : 'تحديث السجل'}</span>
            </button>

            <button
              onClick={onPrintReport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all border border-slate-200 shadow-2xs cursor-pointer"
              title="طباعة كشف الحساب والبيان المالي المعتمد"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>{t.printReport || 'طباعة البيان المالي'}</span>
            </button>

            {role === 'admin' && canAdd && (
              <button
                onClick={onOpenAddOperation}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all shadow-sm shadow-emerald-700/20 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>تسجيل عملية مالية</span>
              </button>
            )}
          </div>
        </div>

        {/* Financial Key Metric Cards Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${canViewBalance ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3.5 pt-3 border-t border-slate-200/80`}>
          {/* Card 1: Total Approved Contributions (CRITICAL: Completed & Approved ONLY!) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-100 font-medium">إجمالي المساهمات المعتمدة والمكتملة</span>
              <div className="p-1.5 rounded-lg bg-white/15 text-white">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono tracking-tight">
                {metrics.totalApprovedAmount.toLocaleString()}{' '}
                <span className="text-sm font-normal text-emerald-100">{currency}</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                <span>محصلة وموثقة ({metrics.approvedCount} عملية معتمدة)</span>
              </div>
            </div>
            <div className="pt-1 border-t border-white/20 text-[10px] text-emerald-100/90 font-medium flex items-center justify-between">
              <span>نسبة الاعتماد: 100%</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] font-bold">معتمدة رسمياً</span>
            </div>
          </div>

          {/* Card 2: Approved Transactions Count */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">العمليات المعتمدة والموثقة</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {metrics.approvedCount}{' '}
                <span className="text-xs font-normal text-slate-500">عملية مسجلة</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {metrics.campaignContributionsCount} من حملات التبرع • {metrics.generalContributionsCount} مساهمات عامة
              </p>
            </div>
            <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
              <span>إجمالي العمليات: {metrics.totalOperationsCount}</span>
              <span className="text-emerald-700 font-bold">موثقة بالسجلات</span>
            </div>
          </div>

          {/* Card 3: Pending Operations (Distinctly separate - NOT in total collected) */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-900 font-bold">مساهمات قيد التحقق والمراجعة</span>
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-amber-900 tracking-tight">
                {metrics.totalPendingAmount.toLocaleString()}{' '}
                <span className="text-xs font-normal text-amber-700">{currency}</span>
              </div>
              <p className="text-[11px] text-amber-800 mt-1 font-medium">
                {metrics.pendingCount} مساهمة بانتظار التأكيد البنكي والإداري
              </p>
            </div>
            <div className="pt-1 border-t border-amber-200/80 text-[10px] text-amber-800 font-medium flex items-center justify-between">
              <span>غير مضافة للإجمالي حتى اعتمادها</span>
              <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[9px] font-bold">
                قيد التدقيق
              </span>
            </div>
          </div>

          {/* Card 4: Current Association Operational Balance (Visible ONLY to logged-in members and admins) */}
          {canViewBalance && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">الرصيد المالي التشغيلي الحالي</span>
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                  {currentOperationalBalance.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-500">{currency}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  المداخيل التشغيلية (+{totalIncomes.toLocaleString()}) ناقص المصاريف (-{totalExpenses.toLocaleString()})
                </p>
              </div>
              <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                <span>{operations.length} عملية تشغيلية</span>
                <span className="text-slate-700 font-bold">ميزانية الجمعية</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs inside Transparency Portal */}
      <div className="flex items-center gap-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 max-w-2xl overflow-x-auto">
        <button
          onClick={() => setActiveLedgerTab('contributions')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeLedgerTab === 'contributions'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coins className="w-4 h-4 text-emerald-600" />
          <span>سجل المساهمات والتبرعات المباشر</span>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {unifiedContributions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveLedgerTab('operations')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeLedgerTab === 'operations'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-slate-600" />
          <span>سجل المصاريف والمداخيل التشغيلية</span>
          <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {operations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveLedgerTab('charter')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeLedgerTab === 'charter'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>ميثاق الشفافية والتدقيق</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: COMPREHENSIVE FINANCIAL CONTRIBUTIONS LEDGER (DEFAULT)
         ========================================================================= */}
      {activeLedgerTab === 'contributions' && (
        <TransparencyContributionsView
          contributions={unifiedContributions}
          lang={lang}
          onOpenReceipt={handleViewContributionReceipt}
          currency={currency}
        />
      )}

      {/* =========================================================================
          TAB 2: GENERAL FINANCIAL OPERATIONS & EXPENSES LEDGER
         ========================================================================= */}
      {activeLedgerTab === 'operations' && (
        <div className="space-y-4">
          {/* Operations Header & Search Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-400 absolute top-3.5 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث في سجل العمليات التشغيلية، رمز الوصل، أو البيان..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all text-slate-800"
                />
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl self-start md:self-auto">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.filterAll} ({operations.length})
                </button>
                <button
                  onClick={() => setFilterType('income')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    filterType === 'income'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.filterIncomes}</span>
                </button>
                <button
                  onClick={() => setFilterType('expense')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    filterType === 'expense'
                      ? 'bg-white text-rose-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                  <span>{t.filterExpenses}</span>
                </button>
              </div>

              {/* Export CSV for Operations */}
              <button
                onClick={onExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer self-start md:self-auto"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>{t.exportCSV}</span>
              </button>
            </div>
          </div>

          {/* Operations Ledger Table */}
          {filteredOperations.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-start rtl:text-right text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">{t.operationCode}</th>
                      <th className="py-3.5 px-4">{t.operationTitle}</th>
                      <th className="py-3.5 px-4">{t.operationType}</th>
                      <th className="py-3.5 px-4">{t.amount}</th>
                      <th className="py-3.5 px-4">{t.date}</th>
                      {canViewBalance && <th className="py-3.5 px-4">{t.balanceAfter}</th>}
                      <th className="py-3.5 px-4">{t.proofs}</th>
                      <th className="py-3.5 px-4 text-center">وصل / إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOperations.map((op) => (
                      <tr key={op.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Code */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {op.code}
                        </td>

                        {/* Title & Description */}
                        <td className="py-3.5 px-4">
                          <div>
                            <div className="font-bold text-slate-900 line-clamp-1">{op.title}</div>
                            {op.description && (
                              <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {op.description}
                              </div>
                            )}
                            {op.memberName && (
                              <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded mt-1 inline-block font-medium">
                                المنخرط: {op.memberName}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              op.type === 'income'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                : 'bg-rose-100 text-rose-900 border border-rose-200'
                            }`}
                          >
                            {op.type === 'income' ? (
                              <>
                                <ArrowUpRight className="w-3 h-3 text-emerald-700" />
                                <span>{t.incomeType}</span>
                              </>
                            ) : (
                              <>
                                <ArrowDownRight className="w-3 h-3 text-rose-700" />
                                <span>{t.expenseType}</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`font-black font-mono text-sm sm:text-base ${
                              op.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {op.type === 'income' ? '+' : '-'}{op.amount.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-slate-500">{t.currencyShort}</span>
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-mono">
                          {op.date}
                        </td>

                        {/* Balance After */}
                        {canViewBalance && (
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 font-mono text-xs sm:text-sm bg-slate-100 px-2 py-0.5 rounded-md">
                              {op.balanceAfter?.toLocaleString() || '---'} {t.currencyShort}
                            </span>
                          </td>
                        )}

                        {/* Proof Media Preview Link */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {op.proofUrls && op.proofUrls.length > 0 ? (
                            <button
                              onClick={() =>
                                onOpenMediaModal({
                                  title: `وثيقة إثبات: ${op.title}`,
                                  url: op.proofUrls![0],
                                  type: 'image',
                                  description: op.description,
                                })
                              }
                              className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200/60 transition-colors cursor-pointer"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>{t.viewProof}</span>
                            </button>
                          ) : op.videoUrl ? (
                            <button
                              onClick={() =>
                                onOpenMediaModal({
                                  title: op.title,
                                  url: op.videoUrl!,
                                  type: 'video',
                                  description: op.description,
                                })
                              }
                              className="flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg border border-rose-200/60 transition-colors cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>فيديو</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">{t.noProofAttached}</span>
                          )}
                        </td>

                        {/* Receipt & Action */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onOpenReceiptModal(op)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 transition-colors cursor-pointer"
                              title="معاينة وطباعة الوصل المعتمد"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>

                            {role === 'admin' && canDelete && onDeleteOperation && (
                              <button
                                onClick={() => onDeleteOperation(op.id)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                title={t.delete}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-800">لا توجد عمليات مسجلة مطابقة للبحث</h4>
              <p className="text-xs text-slate-500">
                يمكنك تسجيل عملية مالية جديدة أو تغيير معايير الفرز.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: GOVERNANCE CHARTER & AUDIT POLICIES
         ========================================================================= */}
      {activeLedgerTab === 'charter' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-3 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                ميثاق الشفافية الرقمية والحكامة المالية بالجمعية
              </h3>
              <p className="text-xs text-slate-500">
                المرجعيات والمعايير المعتمدة في توثيق ونشر المعاملات المالية المباشرة
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h4 className="text-sm font-bold text-slate-900">التوثيق اللحظي الإلزامي</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                يتم قيد وتسجيل كافة التبرعات والمساهمات وواجبات الانخراط مباشرة وبشكل آلي في قاعدة بيانات Firebase المشفرة بمجرد تنفيذها أو اعتمادها من أمانة المال.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h4 className="text-sm font-bold text-slate-900">احترام خصوصية المتبرعين</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                يُحترم خيار المتبرع في إخفاء هويته العلنية، حيث يُسجل كـ "فاعل خير (معفى من الظهور العلني)" مع حفظ كافة الإثباتات والوصولات البنكية القانونية للتدقيق الرسمي.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h4 className="text-sm font-bold text-slate-900">فصل المبالغ قيد التحقق</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                لا تُضاف أي مساهمة إلى الرصيد المالي المعتمد أو إجمالي الأموال المحصلة إلا بعد التحقق النهائي من وصول التحويل البنكي أو السند المالي، لتفادي أي تضخيم غير واقعي للأرصدة.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <p className="leading-relaxed">
              تضمن الجمعية مطابقة جميع الأرقام والوصولات المعروضة في هذه البوابة مع كشوفات الحساب البنكي الرسمي وسجلات المنخرطين السنوية المعتمدة لدى السلطات المختصة.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
