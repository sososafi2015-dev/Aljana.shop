import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  Users, 
  PieChart, 
  Calendar, 
  Printer, 
  FileSpreadsheet, 
  PlusCircle, 
  ShieldCheck,
  CheckCircle2,
  TreePine,
  HeartHandshake,
  Wrench,
  GraduationCap,
  Sparkles,
  Info
} from 'lucide-react';
import { FinancialOperation, Language, UserRole, AssociationSettings, UIElementConfig, Member } from '../types';
import { translations } from '../translations';
import { BackToHomeButton } from './BackToHomeButton';
import { isCurrentBalanceVisibleForUser } from '../utils/visibilityRules';

interface FinancialDashboardProps {
  operations: FinancialOperation[];
  membersCount: number;
  role: UserRole;
  lang: Language;
  settings: AssociationSettings;
  onOpenAddOperation: () => void;
  onOpenReportModal: () => void;
  onExportCSV: () => void;
  onBackToHome?: () => void;
  uiElements?: UIElementConfig[];
  loggedInMember?: Member | null;
  canAdd?: boolean;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  operations,
  membersCount,
  role,
  lang,
  settings,
  onOpenAddOperation,
  onOpenReportModal,
  onExportCSV,
  onBackToHome,
  uiElements = [],
  loggedInMember = null,
  canAdd = true,
}) => {
  const t = translations[lang];

  const isBalanceVisible = isCurrentBalanceVisibleForUser({
    isAdmin: role === 'admin',
    isMember: !!loggedInMember,
    uiElements,
  });

  // Calculate numbers
  const totalIncomes = operations
    .filter((op) => op.type === 'income')
    .reduce((sum, op) => sum + Number(op.amount), 0);

  const totalExpenses = operations
    .filter((op) => op.type === 'expense')
    .reduce((sum, op) => sum + Number(op.amount), 0);

  const currentBalance = totalIncomes - totalExpenses;

  // Breakdown by category
  const categoryTotals: Record<string, number> = {};
  operations
    .filter((op) => op.type === 'expense')
    .forEach((op) => {
      const cat = op.category || 'other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(op.amount);
    });

  const getCategoryName = (key: string) => {
    const map: Record<string, string> = {
      tree_planting: t.cat_tree_planting,
      social_aid: t.cat_social_aid,
      equipment: t.cat_equipment,
      education: t.cat_education,
      health_caravan: t.cat_health_caravan,
      maintenance: t.cat_maintenance,
      ramadan_aid: t.cat_ramadan_aid,
      other: t.cat_other,
    };
    return map[key] || key;
  };

  const getCategoryColor = (key: string) => {
    const map: Record<string, string> = {
      tree_planting: 'bg-emerald-500',
      social_aid: 'bg-rose-500',
      equipment: 'bg-amber-500',
      education: 'bg-sky-500',
      health_caravan: 'bg-purple-500',
      maintenance: 'bg-teal-500',
      ramadan_aid: 'bg-indigo-500',
      other: 'bg-slate-500',
    };
    return map[key] || 'bg-slate-500';
  };

  return (
    <div className="space-y-6">
      {/* Return to Home Button */}
      {onBackToHome && (
        <BackToHomeButton
          onBack={onBackToHome}
          lang={lang}
          currentPageTitle={t.financialTransparencyTitle || 'حساب الرصيد المالي'}
          id="back-to-home-from-financials"
        />
      )}

      {/* Section Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{t.financialTransparencyTitle}</h2>
              <p className="text-xs text-slate-500">{t.financialTransparencyDesc}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>{t.exportCSV}</span>
          </button>

          <button
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>{t.printReport}</span>
          </button>

          {role === 'admin' && canAdd && (
            <button
              onClick={onOpenAddOperation}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm shadow-emerald-700/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.addExpense} / {t.addIncome}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Financial Metric Cards */}
      <div className={`grid grid-cols-1 ${isBalanceVisible ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-5`}>
        {/* Card 1: Incomes */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.totalIncomes}
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
              +{totalIncomes.toLocaleString()}
            </span>
            <span className="text-sm font-semibold text-emerald-700">{t.currencyShort}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>مجموع الاشتراكات والمساهمات</span>
            <span className="text-emerald-700 font-bold font-mono">{membersCount} منخرط</span>
          </div>
        </motion.div>

        {/* Card 2: Expenses */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.totalExpenses}
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
              -{totalExpenses.toLocaleString()}
            </span>
            <span className="text-sm font-semibold text-rose-700">{t.currencyShort}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>مصاريف مشاريع العمل الخيري</span>
            <span className="text-rose-700 font-bold font-mono">
              {operations.filter((op) => op.type === 'expense').length} عمليات
            </span>
          </div>
        </motion.div>

        {/* Card 3: Current Remaining Balance (Visible ONLY to logged-in members and admins) */}
        {isBalanceVisible && (
          <motion.div
            whileHover={{ y: -2 }}
            className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 rounded-2xl shadow-md shadow-emerald-900/20 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                {t.currentBalance}
              </span>
              <div className="w-10 h-10 rounded-xl bg-white/10 text-emerald-200 flex items-center justify-center backdrop-blur-xs">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                {currentBalance.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-emerald-300">{t.currencyShort}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-emerald-100">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                الرصيد الصافي بالخزينة
              </span>
              <span className="font-semibold text-emerald-200">محدث لحظيًا</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Concrete Transparency Equation Block (Matching User Requirement) */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-emerald-300">
            مثال توضيحي مباشر لشفافية الحسابات (معادلة الرصيد):
          </h3>
        </div>
        
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isBalanceVisible ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 text-xs`}>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
            <span className="text-slate-400 block mb-1">1. مجموع الاشتراكات:</span>
            <span className="text-base font-bold text-emerald-400 font-mono">
              +{totalIncomes.toLocaleString()} د.م
            </span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
            <span className="text-slate-400 block mb-1">2. عملية تشجير:</span>
            <span className="text-base font-bold text-rose-400 font-mono">-2,500 د.م</span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
            <span className="text-slate-400 block mb-1">3. شراء معدات:</span>
            <span className="text-base font-bold text-rose-400 font-mono">-1,000 د.م</span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
            <span className="text-slate-400 block mb-1">4. مساعدة اجتماعية:</span>
            <span className="text-base font-bold text-rose-400 font-mono">-1,500 د.م</span>
          </div>
          {isBalanceVisible && (
            <div className="p-3 bg-emerald-950/80 rounded-xl border border-emerald-600/50">
              <span className="text-emerald-300 block mb-1 font-bold">الرصيد الحالي المتبقي:</span>
              <span className="text-base font-black text-emerald-200 font-mono">
                = {currentBalance.toLocaleString()} د.م
              </span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span>
            يتم خصم أي عملية خيرية فور تسجيلها مع رفع الوصل والفاتورة لضمان إطلاع جميع المنخرطين.
          </span>
        </p>
      </div>

      {/* Expenses Breakdown by Category */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-base text-slate-900">
              توزيع المصاريف حسب مجالات العمل الخيري
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            المجموع: {totalExpenses.toLocaleString()} {t.currencyShort}
          </span>
        </div>

        {totalExpenses > 0 ? (
          <div className="space-y-4">
            {/* Visual multi-segment bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              {Object.entries(categoryTotals).map(([cat, amount]) => {
                const pct = (amount / totalExpenses) * 100;
                return (
                  <div
                    key={cat}
                    style={{ width: `${pct}%` }}
                    className={`${getCategoryColor(cat)} transition-all`}
                    title={`${getCategoryName(cat)}: ${amount} د.م (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>

            {/* Breakdown item chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {Object.entries(categoryTotals).map(([cat, amount]) => {
                const pct = (amount / totalExpenses) * 100;
                return (
                  <div key={cat} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${getCategoryColor(cat)}`}></span>
                        <span className="text-xs font-bold text-slate-800">{getCategoryName(cat)}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 font-semibold">{pct.toFixed(0)}%</span>
                    </div>
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {amount.toLocaleString()} {t.currencyShort}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 text-center py-4">لم يتم تسجيل أي مصاريف بعد</p>
        )}
      </div>
    </div>
  );
};
