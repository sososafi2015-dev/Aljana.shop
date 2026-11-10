import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coins, 
  Search, 
  Filter, 
  PlusCircle, 
  Printer, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Trash2, 
  Edit3, 
  User, 
  Calendar, 
  CreditCard, 
  FileText, 
  TrendingUp, 
  ArrowUpDown, 
  X,
  Sparkles,
  ShieldCheck,
  Building2,
  Landmark,
  Banknote,
  Receipt,
  Eye,
  Image as ImageIcon,
} from 'lucide-react';
import { MemberContribution, Member, Language, FinancialOperation, ContributionStatus, ContributionCategory, PaymentMethodType } from '../types';
import { translations } from '../translations';
import { calculateFinancials, isUnpaidContributionStatus } from '../storage';

interface ManageContributionsProps {
  contributions: MemberContribution[];
  members: Member[];
  operations: FinancialOperation[];
  lang: Language;
  onAddContribution: (contribution: Omit<MemberContribution, 'id' | 'createdAt'>) => void;
  onUpdateContributionStatus: (id: string, status: ContributionStatus) => void;
  onDeleteContribution: (id: string) => void;
  onPrintReceipt: (contribution: MemberContribution) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ManageContributions: React.FC<ManageContributionsProps> = ({
  contributions,
  members,
  operations,
  lang,
  onAddContribution,
  onUpdateContributionStatus,
  onDeleteContribution,
  onPrintReceipt,
  canAdd = true,
  canEdit = true,
  canDelete = false,
}) => {
  const t = translations[lang] as any;

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContributionStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ContributionCategory>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | PaymentMethodType>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'member'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contributionToDelete, setContributionToDelete] = useState<MemberContribution | null>(null);
  const [previewProofContrib, setPreviewProofContrib] = useState<MemberContribution | null>(null);

  // Add Contribution Form State
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || '');
  const [formAmount, setFormAmount] = useState<number | ''>(1000);
  const [formCategory, setFormCategory] = useState<ContributionCategory>('membership_fee');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethodType>('bank_transfer');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<ContributionStatus>('pending');
  const [formError, setFormError] = useState<string | null>(null);

  // Statistics & Live Association Financial Balance
  const financials = calculateFinancials(operations);
  const currentAssociationBalance = financials.currentBalance;
  const totalAmount = contributions
    .filter((c) => !isUnpaidContributionStatus(c.status) && c.status !== 'rejected')
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalCount = contributions.length;
  const completedCount = contributions.filter((c) => c.status === 'completed').length;
  const unpaidCount = contributions.filter((c) => isUnpaidContributionStatus(c.status)).length;
  const pendingCount = contributions.filter((c) => c.status === 'pending').length;

  // Filter & Sort logic
  const filteredContributions = contributions.filter((item) => {
    const matchesSearch = 
      item.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.memberCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.campaignTitle && item.campaignTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      item.status === statusFilter ||
      ((statusFilter === 'approved' || statusFilter === 'unpaid') && isUnpaidContributionStatus(item.status));
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesPayment = paymentMethodFilter === 'all' || item.paymentMethod === paymentMethodFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesPayment;
  }).sort((a, b) => {
    if (sortBy === 'amount') {
      return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
    }
    if (sortBy === 'member') {
      return sortOrder === 'desc' 
        ? b.memberName.localeCompare(a.memberName)
        : a.memberName.localeCompare(b.memberName);
    }
    // Default: date
    const dateA = new Date(a.createdAt || a.date).getTime();
    const dateB = new Date(b.createdAt || b.date).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  // Handle Form Submit
  const handleCreateContribution = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const targetMember = members.find(m => m.id === selectedMemberId);
    if (!targetMember) {
      setFormError('يرجى اختيار المنخرط.');
      return;
    }

    const numAmount = Number(formAmount);
    if (!numAmount || numAmount <= 0) {
      setFormError(t.invalidAmountError || 'يرجى إدخال مبلغ صحيح ورقمي أكبر من 0.');
      return;
    }

    const now = new Date();
    const effectiveStatus: ContributionStatus = formCategory === 'membership_fee' ? 'pending' : formStatus;
    onAddContribution({
      memberId: targetMember.id,
      memberCode: targetMember.memberCode,
      memberName: targetMember.fullName,
      amount: numAmount,
      date: formDate || now.toISOString().slice(0, 10),
      time: now.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status: effectiveStatus,
      category: formCategory,
      paymentMethod: formPaymentMethod,
      notes: formNotes.trim() || undefined,
    });

    setIsAddModalOpen(false);
    setFormNotes('');
    setFormAmount(1000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['رقم المساهمة', 'رقم العضوية', 'اسم المنخرط', 'المبلغ (د.م)', 'نوع المساهمة', 'طريقة الدفع', 'الحالة', 'التاريخ', 'الوقت', 'ملاحظات'];
    const rows = filteredContributions.map(c => [
      `"${c.id}"`,
      `"${c.memberCode}"`,
      `"${c.memberName.replace(/"/g, '""')}"`,
      `"${c.amount}"`,
      `"${c.category === 'membership_fee' ? (t.catMembershipFee || 'واجب انخراط') : c.category === 'donation' ? (t.catDonation || 'تبرع ومساهمة') : (c.category === 'project_support' || (c.category as string) === 'initiative_proposal') ? (t.catProjectSupport || t.catInitiativeProposal || 'اقترح عمل مبادرة خاصة بمساهمتي') : (t.catOther || t.catCharityZakat || 'صدقة، زكاة')}"`,
      `"${c.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : c.paymentMethod === 'cash' ? 'نقدي' : c.paymentMethod === 'check' ? 'شيك' : 'إلكتروني'}"`,
      `"${c.status === 'completed' ? 'مكتملة وموثقة' : isUnpaidContributionStatus(c.status) ? 'لم يتم الدفع' : 'قيد المراجعة'}"`,
      `"${c.date}"`,
      `"${c.time || ''}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `سجل_مساهمات_المنخرطين_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Category translation helper
  const getCategoryLabel = (category: ContributionCategory) => {
    switch (category) {
      case 'membership_fee': return t.catMembershipFee || 'واجب الانخراط السنوي';
      case 'donation': return t.catDonation || 'تبرع ومساهمة خيرية';
      case 'project_support':
      case 'initiative_proposal' as any: 
        return t.catProjectSupport || t.catInitiativeProposal || 'اقترح عمل مبادرة خاصة بمساهمتي';
      case 'other':
      case 'charity_zakat' as any:
      default: 
        return t.catOther || t.catCharityZakat || 'صدقة، زكاة';
    }
  };

  // Payment method label helper
  const getPaymentMethodLabel = (method: PaymentMethodType) => {
    switch (method) {
      case 'bank_transfer': return 'الحساب البنكي (تحويل)';
      case 'cash': return 'نقدًا';
      case 'check': return 'شيك بنكي';
      case 'online': return t.methodOnline || 'تطبيق بنكي';
      default: return t.methodOther || 'أخرى';
    }
  };

  const renderPaymentMethodBadge = (method: PaymentMethodType) => {
    switch (method) {
      case 'bank_transfer':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold whitespace-nowrap">
            <Landmark className="w-3.5 h-3.5 text-blue-600" />
            <span>الحساب البنكي</span>
          </span>
        );
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold whitespace-nowrap">
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
            <span>نقدًا</span>
          </span>
        );
      case 'check':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold whitespace-nowrap">
            <Receipt className="w-3.5 h-3.5 text-purple-600" />
            <span>شيك بنكي</span>
          </span>
        );
      case 'online':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold whitespace-nowrap">
            <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
            <span>تطبيق بنكي</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold whitespace-nowrap">
            <span>{t.methodOther || 'أخرى'}</span>
          </span>
        );
    }
  };

  // Status badge helper
  const renderStatusBadge = (status: ContributionStatus, id: string) => {
    const isHistoricalUnpaid = isUnpaidContributionStatus(status) || status === 'rejected';
    const normalizedValue = isHistoricalUnpaid ? 'unpaid_historical' : status;
    return (
      <select
        value={normalizedValue}
        disabled={!canEdit}
        onChange={(e) => {
          if (!canEdit) return;
          onUpdateContributionStatus(id, e.target.value as ContributionStatus);
        }}
        className={`text-xs font-bold rounded-lg px-2.5 py-1 outline-none border transition ${
          !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
        } ${
          status === 'completed'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            : isHistoricalUnpaid
            ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
            : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
        }`}
      >
        {isHistoricalUnpaid && (
          <option value="unpaid_historical" disabled hidden>
            🔴 {t.contribStatusApproved || 'لم يتم الدفع'}
          </option>
        )}
        <option value="completed">🟢 {t.contribStatusCompleted || 'مكتملة وموثقة'}</option>
        <option value="pending">⏳ {t.contribStatusPending || 'قيد المراجعة'}</option>
      </select>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats Cards */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm">
                <Coins className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {t.manageContributionsTitle || 'سجل المساهمات والانخراطات'}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              {t.manageContributionsDesc || 'متابعة وإدارة جميع المساهمات والانخراطات المسجلة من طرف المنخرطين مع إمكانية الاعتماد وتعديل الحالة والطباعة'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>{t.exportContributionsCSV || 'تصدير (CSV)'}</span>
            </button>
          </div>
        </div>

        {/* 4 Overview Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/80">
            <span className="text-xs text-emerald-800 font-semibold block">
              {t.currentBalance || 'الرصيد المالي الحالي للجمعية'}
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-950 mt-1 font-mono">
              {currentAssociationBalance.toLocaleString()} <span className="text-xs font-normal text-emerald-700">{t.currencyShort || 'د.م'}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200">
            <span className="text-xs text-teal-800 font-semibold block">
              {t.totalContributionsCollected || 'إجمالي المساهمات المستخلصة'}
            </span>
            <div className="text-xl sm:text-2xl font-black text-teal-950 mt-1 font-mono">
              {totalAmount.toLocaleString()} <span className="text-xs font-normal text-teal-700">{t.currencyShort || 'د.م'}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-600 font-semibold block">
              {t.totalContributionsCount || 'عدد العمليات المسجلة'}
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
              {totalCount} <span className="text-xs font-normal text-slate-500">عملية</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <span className="text-xs text-emerald-800 font-semibold block">
              حالة المساهمات
            </span>
            <div className="text-xs sm:text-sm font-bold text-slate-800 mt-2 flex flex-wrap items-center gap-2 justify-between">
              <span className="text-emerald-700">🟢 مكتملة: {completedCount}</span>
              {pendingCount > 0 && <span className="text-amber-700 font-bold">⏳ {t.contribStatusPending || 'قيد المراجعة'}: {pendingCount}</span>}
              {unpaidCount > 0 && <span className="text-rose-700 text-xs">سجلات سابقة: {unpaidCount}</span>}
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchContributionsPlaceholder || 'بحث بالاسم، رقم العضوية...'}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm outline-none focus:border-emerald-500 focus:bg-white transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm outline-none focus:border-emerald-500 focus:bg-white transition"
            >
              <option value="all">{t.allStatuses || 'جميع الحالات'}</option>
              <option value="completed">{t.contribStatusCompleted || 'مكتملة وموثقة'}</option>
              <option value="pending">{t.contribStatusPending || 'قيد المراجعة'}</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm outline-none focus:border-emerald-500 focus:bg-white transition"
            >
              <option value="all">جميع أنواع المساهمات</option>
              <option value="membership_fee">{t.catMembershipFee || 'واجب الانخراط السنوي'}</option>
              <option value="donation">{t.catDonation || 'تبرع ومساهمة خيرية'}</option>
              <option value="project_support">{t.catProjectSupport || t.catInitiativeProposal || 'اقترح عمل مبادرة خاصة بمساهمتي'}</option>
              <option value="other">{t.catOther || t.catCharityZakat || 'صدقة، زكاة'}</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="relative">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb as any);
                setSortOrder(so as any);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm outline-none focus:border-emerald-500 focus:bg-white transition"
            >
              <option value="date-desc">الأحدث أولاً</option>
              <option value="date-asc">الأقدم أولاً</option>
              <option value="amount-desc">المبلغ: من الأعلى للأقل</option>
              <option value="amount-asc">المبلغ: من الأقل للأعلى</option>
              <option value="member-asc">اسم المنخرط أ-ي</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contributions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredContributions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Coins className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">لا توجد مساهمات مطابقة</h4>
            <p className="text-xs text-slate-500">جرب تعديل خيارات البحث أو تصفية الحالة.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-bold">
                  <th className="py-3.5 px-4">المنخرط / المتبرع</th>
                  <th className="py-3.5 px-4">المبلغ</th>
                  <th className="py-3.5 px-4">نوع المساهمة</th>
                  <th className="py-3.5 px-4">طريقة الدفع</th>
                  <th className="py-3.5 px-4">إثبات الدفع</th>
                  <th className="py-3.5 px-4">التاريخ والوقت</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredContributions.map((item) => {
                  const proofUrl = item.proofImageUrl || item.receiptUrl;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Member */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs flex-shrink-0">
                            {item.memberName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{item.memberName}</div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] text-emerald-700 font-mono font-semibold">{item.memberCode}</span>
                              {item.campaignTitle && (
                                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md font-medium">
                                  حملة: {item.campaignTitle}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700 text-sm whitespace-nowrap">
                        {item.amount.toLocaleString()} {t.currencyShort || 'د.م'}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          item.category === 'donation'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.contributionTypeName || getCategoryLabel(item.category)}
                        </span>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderPaymentMethodBadge(item.paymentMethod)}
                      </td>

                      {/* Payment Proof */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {proofUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewProofContrib(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition cursor-pointer"
                            title="عرض ومراجعة صورة إثبات التحويل البنكي"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>عرض إثبات الدفع</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">غير مرفق</span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{item.date}</div>
                        {item.time && <div className="text-[10px] text-slate-400 font-mono">{item.time}</div>}
                      </td>

                      {/* Status with Quick Select */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderStatusBadge(item.status, item.id)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {proofUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewProofContrib(item)}
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                              title="معاينة إثبات الدفع"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onPrintReceipt(item)}
                            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                            title="عرض وطباعة الوصل"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => {
                                if (!canDelete) return;
                                setContributionToDelete(item);
                              }}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="حذف من السجل"
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
        )}
      </div>

      {/* Add Contribution Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
                  <Coins className="w-5 h-5 text-emerald-600" />
                  <span>تسجيل مساهمة جديدة للمنخرط</span>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateContribution} className="space-y-4">
                {/* Select Member */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    المنخرط المعني <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition text-slate-900"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.memberCode}) - الهاتف: {m.phone}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    المبلغ (بالدرهم المغربي) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-emerald-500 font-mono font-bold bg-slate-50 focus:bg-white text-slate-900"
                      placeholder="1000"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {t.currencyShort || 'د.م'}
                    </span>
                  </div>
                </div>

                {/* Grid: Category & Payment Method */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      نوع المساهمة
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-500 bg-slate-50 text-slate-900"
                    >
                      <option value="membership_fee">{t.catMembershipFee || 'واجب الانخراط السنوي'}</option>
                      <option value="donation">{t.catDonation || 'تبرع ومساهمة خيرية'}</option>
                      <option value="project_support">{t.catProjectSupport || t.catInitiativeProposal || 'اقترح عمل مبادرة خاصة بمساهمتي'}</option>
                      <option value="other">{t.catOther || t.catCharityZakat || 'صدقة، زكاة'}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      طريقة الدفع
                    </label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-500 bg-slate-50 text-slate-900"
                    >
                      <option value="bank_transfer">{t.methodBankTransfer || 'تحويل بنكي (RIB)'}</option>
                      <option value="cash">{t.methodCash || 'دفع نقدي مباشر'}</option>
                      <option value="check">{t.methodCheck || 'شيك بنكي'}</option>
                      <option value="online">{t.methodOnline || 'تطبيق بنكي'}</option>
                    </select>
                  </div>
                </div>

                {/* Date & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      التاريخ
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-500 bg-slate-50 text-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      الحالة الأولية
                    </label>
                    {formCategory === 'membership_fee' ? (
                      <div className="p-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        <span>قيد المراجعة (تلقائياً لجميع واجبات الانخراط)</span>
                      </div>
                    ) : (
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-500 bg-slate-50 text-slate-900"
                      >
                        <option value="pending">{t.contribStatusPending || 'قيد المراجعة'}</option>
                        <option value="completed">{t.contribStatusCompleted || 'مكتملة وموثقة'}</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    ملاحظات أو بيان (اختياري)
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="بيان إضافي للعملية..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-emerald-500 bg-slate-50 text-slate-900"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>حفظ وتوثيق المساهمة</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {canDelete && contributionToDelete && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">تأكيد حذف المساهمة</h4>
                  <p className="text-xs text-slate-500">حذف هذه العملية من سجل مساهمات الجمعية</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                هل أنت متأكد من حذف مساهمة المنخرط <strong className="text-slate-900">{contributionToDelete.memberName}</strong> بقيمة <strong className="text-emerald-700 font-mono">{contributionToDelete.amount} د.م</strong> المسجلة بتاريخ {contributionToDelete.date}؟
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setContributionToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => {
                    onDeleteContribution(contributionToDelete.id);
                    setContributionToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تأكيد الحذف</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Proof Preview Modal */}
      <AnimatePresence>
        {previewProofContrib && (previewProofContrib.proofImageUrl || previewProofContrib.receiptUrl) && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setPreviewProofContrib(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="bg-gradient-to-l from-emerald-800 to-teal-800 text-white p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm sm:text-base">
                      مراجعة صورة إثبات الدفع (التحويل البنكي)
                    </h4>
                    <p className="text-xs text-emerald-100 mt-0.5">
                      المتبرع: {previewProofContrib.memberName} — المبلغ: {previewProofContrib.amount.toLocaleString()} {t.currencyShort || 'د.م'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewProofContrib(null)}
                  className="p-1.5 rounded-full hover:bg-white/15 text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 bg-slate-950 overflow-y-auto flex-1 flex items-center justify-center">
                <img
                  src={previewProofContrib.proofImageUrl || previewProofContrib.receiptUrl}
                  alt="صورة إثبات الدفع"
                  className="max-h-[60vh] w-auto object-contain rounded-2xl border border-slate-800 shadow-lg mx-auto"
                />
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-slate-600">
                  {previewProofContrib.campaignTitle && (
                    <span>
                      الحملة: <strong className="text-slate-900">{previewProofContrib.campaignTitle}</strong> •
                    </span>
                  )}
                  <span>
                    التاريخ: <strong className="font-mono text-slate-900">{previewProofContrib.date}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <a
                    href={previewProofContrib.proofImageUrl || previewProofContrib.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={`proof-${previewProofContrib.id}.jpg`}
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل الصورة</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewProofContrib(null)}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer"
                  >
                    إغلاق
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
