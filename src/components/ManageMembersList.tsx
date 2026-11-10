import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Printer, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Award, 
  Phone, 
  Mail, 
  Calendar, 
  CreditCard, 
  Edit2, 
  Trash2, 
  Power, 
  ShieldCheck, 
  ShieldAlert, 
  LayoutGrid, 
  List, 
  ArrowUpDown, 
  IdCard, 
  Receipt, 
  Sparkles, 
  AlertTriangle,
  X,
  HelpCircle,
  TrendingUp,
  UserCheck,
  UserX,
  FolderOpen,
  Coins,
  Landmark,
  Banknote,
  Building2,
  Image as ImageIcon,
  Eye,
  Download,
  ExternalLink
} from 'lucide-react';
import { Member, MemberStatus, Language, FinancialOperation, MemberRegistrationField, MemberContribution, PaymentMethodType } from '../types';
import { translations } from '../translations';

interface ManageMembersListProps {
  members: Member[];
  operations: FinancialOperation[];
  contributions?: MemberContribution[];
  registrationFields: MemberRegistrationField[];
  lang: Language;
  onOpenAddMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onToggleMemberStatus: (id: string, targetStatus?: MemberStatus) => void;
  onPrintMemberCard: (member: Member) => void;
  onLogAudit: (action: 'create' | 'update' | 'delete', description: string) => void;
  canView?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ManageMembersList: React.FC<ManageMembersListProps> = ({
  members,
  operations,
  contributions = [],
  registrationFields,
  lang,
  onOpenAddMember,
  onEditMember,
  onDeleteMember,
  onToggleMemberStatus,
  onPrintMemberCard,
  onLogAudit,
  canView = true,
  canAdd = true,
  canEdit = true,
  canDelete = false,
}) => {
  const t = translations[lang];

  // Filters and Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending' | 'honorary'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'fee' | 'name' | 'code'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Confirmation Modals & Ledger Modal State
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [memberToDeactivate, setMemberToDeactivate] = useState<Member | null>(null);
  const [selectedMemberForLedger, setSelectedMemberForLedger] = useState<Member | null>(null);
  const [previewProof, setPreviewProof] = useState<{ url: string; title: string; memberName: string; date?: string } | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  // Statistics Calculation
  const totalCount = members.length;
  const activeCount = members.filter((m) => m.status === 'active').length;
  const inactiveCount = members.filter((m) => m.status === 'inactive').length;
  const pendingCount = members.filter((m) => m.status === 'pending').length;
  const honoraryCount = members.filter((m) => m.status === 'honorary').length;

  const totalAnnualExpectedFees = members.reduce((sum, m) => sum + (Number(m.annualFee) || 0), 0);

  // Helper to get member contributions list
  const getMemberContributions = (member: Member) => {
    return contributions.filter(
      (c) => c.memberId === member.id || (c.memberName && c.memberName.trim().toLowerCase() === member.fullName.trim().toLowerCase())
    );
  };

  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case 'membership_fee':
      case 'annual_renewal':
        return { label: t.catAnnualRenewal || 'تجديد الانخراط السنوي', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'donation':
      case 'donation_support':
        return { label: t.catDonationSupport || 'تبرع ومساهمة مالية', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'project_support':
      case 'initiative_proposal':
      case 'initiative_with_contribution':
        return { label: t.catInitiativeWithContribution || 'اقترح عمل مبادرة خاصة بمساهمتي', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'charity_zakat':
      case 'other':
        return { label: t.catCharityAndZakat || 'صدقة، زكاة', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'initiative_idea':
        return { label: t.catInitiativeIdea || 'اقتراح مبادرة', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
      default:
        return { label: cat || 'مساهمة أخرى', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  // Calculate member-specific financial payments
  const getMemberPaymentsSummary = (member: Member) => {
    const memberContribs = getMemberContributions(member);
    const memberOps = operations.filter(
      (op) =>
        (op.memberId && op.memberId === member.id) ||
        (op.memberName && op.memberName.trim().toLowerCase() === member.fullName.trim().toLowerCase())
    );
    
    // Total from contributions list if available, else from operations
    const totalFromContribs = memberContribs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const totalFromOps = memberOps.reduce((sum, op) => sum + (Number(op.amount) || 0), 0);
    const count = Math.max(memberContribs.length, memberOps.length);
    const totalPaid = Math.max(totalFromContribs, totalFromOps);

    return {
      count,
      totalPaid,
      contributionsCount: memberContribs.length
    };
  };

  // Filter & Sort Logic
  const filteredMembers = members
    .filter((member) => {
      // Status Filter
      if (statusFilter !== 'all' && member.status !== statusFilter) {
        return false;
      }

      // Search Query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = member.fullName.toLowerCase().includes(query);
        const matchesUsername = member.username ? member.username.toLowerCase().includes(query) : false;
        const matchesCode = member.memberCode.toLowerCase().includes(query);
        const matchesPhone = member.phone ? member.phone.includes(query) : false;
        const matchesEmail = member.email ? member.email.toLowerCase().includes(query) : false;
        const matchesCin = member.cin ? member.cin.toLowerCase().includes(query) : false;
        return matchesName || matchesUsername || matchesCode || matchesPhone || matchesEmail || matchesCin;
      }

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'fee') {
        comparison = (Number(b.annualFee) || 0) - (Number(a.annualFee) || 0);
      } else if (sortBy === 'name') {
        comparison = a.fullName.localeCompare(b.fullName);
      } else if (sortBy === 'code') {
        comparison = a.memberCode.localeCompare(b.memberCode);
      } else {
        // Date
        comparison = new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
      }
      return sortOrder === 'desc' ? comparison : -comparison;
    });

  // Handle Deactivation with Audit Log & Permission Guard
  const handleConfirmDeactivation = () => {
    if (!canEdit) {
      setMemberToDeactivate(null);
      return;
    }
    if (!memberToDeactivate) return;
    onToggleMemberStatus(memberToDeactivate.id, 'inactive');
    setMemberToDeactivate(null);
  };

  // Handle Permanent Delete with Strict Permission Guard
  const handleConfirmDelete = () => {
    if (!canDelete) {
      setMemberToDelete(null);
      return;
    }
    if (!memberToDelete) return;
    onDeleteMember(memberToDelete.id);
    setMemberToDelete(null);
  };

  // Status Badge Component
  const renderStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span>{t.memberStatusActive || 'نشط ومفعّل'}</span>
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
            <span>{t.memberStatusInactive || 'غير نشط'}</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            <span>{t.memberStatusPending || 'قيد التجديد'}</span>
          </span>
        );
      case 'honorary':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
            <Award className="w-3.5 h-3.5 text-purple-700" />
            <span>{t.memberStatusHonorary || 'عضو فخري'}</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Status Column Action Buttons (تفعيل المنخرط / إلغاء التفعيل)
  const renderStatusActionButtons = (member: Member) => {
    if (!canEdit) return null;
    const isActive = member.status === 'active';
    const isInactive = member.status === 'inactive';

    return (
      <div className="flex items-center justify-center gap-1.5 pt-1.5 flex-wrap">
        <button
          type="button"
          disabled={isActive}
          onClick={() => onToggleMemberStatus(member.id, 'active')}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
            isActive
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs opacity-95 cursor-default'
              : 'bg-white hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-300 hover:border-emerald-600 shadow-2xs cursor-pointer'
          }`}
          title="تفعيل حالة المنخرط ليصبح نشطًا ومفعّلًا"
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>{t.activateMemberBtn || 'تفعيل المنخرط'}</span>
        </button>

        <button
          type="button"
          disabled={isInactive}
          onClick={() => onToggleMemberStatus(member.id, 'inactive')}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
            isInactive
              ? 'bg-rose-600 text-white border-rose-600 shadow-2xs opacity-95 cursor-default'
              : 'bg-white hover:bg-rose-600 text-rose-700 hover:text-white border-rose-300 hover:border-rose-600 shadow-2xs cursor-pointer'
          }`}
          title="إلغاء تفعيل المنخرط دون حذف بياناته أو سجله من قاعدة البيانات"
        >
          <UserX className="w-3.5 h-3.5" />
          <span>{t.deactivateMemberBtn || 'إلغاء التفعيل'}</span>
        </button>
      </div>
    );
  };

  const renderPaymentMethodBadge = (method?: PaymentMethodType | string) => {
    const norm = method || 'bank_transfer';
    if (norm === 'bank_transfer') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold" title="طريقة أداء الانخراط: الحساب البنكي (تحويل)">
          <Landmark className="w-3.5 h-3.5 text-blue-600" />
          <span>الحساب البنكي</span>
        </span>
      );
    }
    if (norm === 'cash') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold" title="طريقة أداء الانخراط: نقدًا">
          <Banknote className="w-3.5 h-3.5 text-emerald-600" />
          <span>نقدًا</span>
        </span>
      );
    }
    if (norm === 'check') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-bold" title="طريقة أداء الانخراط: شيك بنكي">
          <Receipt className="w-3.5 h-3.5 text-purple-600" />
          <span>شيك بنكي</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-bold">
        <span>{norm}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Action */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>إدارة العضوية والاشتراكات</span>
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            {t.manageMembersListTitle || 'قائمة المنخرطين والاشتراكات'}
          </h3>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            {t.manageMembersListDesc || 'إدارة شاملة لبيانات المنخرطين، الاشتراكات السنوية، التفعيل، إلغاء التفعيل، والتعديل مع الحفاظ الكامل على السجلات.'}
          </p>
        </div>

        {/* Action Button: Add New Member (Protected by canAdd permission) */}
        {canAdd && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenAddMember}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-700/20 transition-all cursor-pointer hover:scale-102"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t.addMember || 'تسجيل منخرط جديد'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{t.allMembersCount || 'إجمالي المنخرطين'}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">{totalCount}</span>
            <span className="text-xs text-slate-500 font-medium">منخرط مسجل</span>
          </div>
        </div>

        {/* Active Members */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-2 bg-gradient-to-br from-emerald-50/50 to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">{t.activeMembersCount || 'منخرطون نشطون ومفعلون'}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">{activeCount}</span>
            <span className="text-xs text-emerald-700 font-medium">حساب نشط 🟢</span>
          </div>
        </div>

        {/* Inactive Members */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200 shadow-xs space-y-2 bg-gradient-to-br from-rose-50/50 to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800">{t.inactiveMembersCount || 'منخرطون غير مفعلين'}</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700 font-mono">{inactiveCount}</span>
            <span className="text-xs text-rose-700 font-medium">معطل / غير نشط 🔴</span>
          </div>
        </div>

        {/* Total Annual Fees Expected */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{t.totalAnnualSubscriptions || 'إجمالي الاشتراكات السنوية'}</span>
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {totalAnnualExpectedFees.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-bold">د.م</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter & View Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Bar */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 absolute top-3.5 right-3.5 rtl:right-3.5 rtl:left-auto text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchMembers || 'بحث بالاسم، رقم العضوية، الهاتف، أو رقم البطاقة الوطنية (CIN)...'}
              className="w-full pl-4 pr-10 rtl:pr-10 rtl:pl-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs sm:text-sm font-medium transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute top-3 left-3 rtl:left-3 rtl:right-auto text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="md:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs sm:text-sm font-bold text-slate-700"
            >
              <option value="date">{t.sortByDate || 'الأحدث تسجيلًا'}</option>
              <option value="fee">{t.sortByFee || 'قيمة الاشتراك السنوي'}</option>
              <option value="name">{t.sortByName || 'الاسم أبجديًا'}</option>
              <option value="code">{t.sortByCode || 'رقم العضوية'}</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="md:col-span-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs flex items-center gap-1 font-bold"
              title="تغيير اتجاه الترتيب"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">{sortOrder === 'desc' ? 'تنازلي' : 'تصاعدي'}</span>
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="عرض جدولي مفصل"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="عرض بطاقات شبكية"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">تصفية الحالة:</span>
          
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.filterStatusAll || 'الكل'} ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <span>🟢 {t.memberStatusActive || 'نشط / مفعل'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950/20">{activeCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'inactive'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <span>🔴 {t.memberStatusInactive || 'غير نشط / معطل'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950/20">{inactiveCount}</span>
          </button>

          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>⏳ {t.memberStatusPending || 'قيد التجديد'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950/20">{pendingCount}</span>
            </button>
          )}

          {honoraryCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('honorary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === 'honorary'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <span>⭐ {t.memberStatusHonorary || 'فخري'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-950/20">{honoraryCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Members List Rendering */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-slate-800 text-base">{t.noMembersMatchFilters || 'لم يتم العثور على أي منخرط بهذه المعطيات'}</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            يمكنك تجربة تغيير كلمات البحث أو إعادة ضبط فلتر الحالة لعرض المنخرطين الآخرين.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            إعادة ضبط خيارات البحث
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* ======================== TABLE VIEW ======================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-800">
                  <th className="py-3.5 px-4 font-bold text-start">المنخرط / العضوية</th>
                  <th className="py-3.5 px-4 font-bold text-start">معلومات الاتصال & الهوية</th>
                  <th className="py-3.5 px-4 font-bold text-center">الحالة</th>
                  <th className="py-3.5 px-4 font-bold text-start">قيمة الاشتراك & التواريخ</th>
                  <th className="py-3.5 px-4 font-bold text-start">المساهمات المالية المسجلة</th>
                  <th className="py-3.5 px-4 font-bold text-center">إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((member) => {
                  const payments = getMemberPaymentsSummary(member);
                  const isActive = member.status === 'active';

                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isActive ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Member Info & Code */}
                      <td className="py-4 px-4 align-middle">
                        <div className="flex items-center gap-3">
                          {member.avatarUrl ? (
                            <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden flex-shrink-0 bg-slate-100">
                              <img src={member.avatarUrl} alt={member.fullName} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs ${
                              isActive ? 'bg-emerald-700' : 'bg-slate-500'
                            }`}>
                              {member.fullName.charAt(0)}
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                              <span>{member.fullName}</span>
                              {member.isAnonymousInPublic && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  سري للعامة
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-800 font-bold">
                              <span>{member.memberCode}</span>
                              {member.username && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]" dir="ltr">
                                  @{member.username}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & CIN */}
                      <td className="py-4 px-4 align-middle space-y-1">
                        {member.cin && (
                          <div className="flex items-center gap-1.5 text-slate-700 font-mono text-xs font-semibold">
                            <IdCard className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>CIN: {member.cin}</span>
                          </div>
                        )}
                        {member.phone && (
                          <div className="flex items-center gap-1.5 text-slate-600 font-mono text-xs">
                            <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span dir="ltr">{member.phone}</span>
                          </div>
                        )}
                        {member.email && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] line-clamp-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{member.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Status (خانة الحالة) */}
                      <td className="py-4 px-4 align-middle text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {renderStatusBadge(member.status)}
                          {renderStatusActionButtons(member)}
                        </div>
                      </td>

                      {/* Subscription Fee & Dates */}
                      <td className="py-4 px-4 align-middle space-y-1">
                        <div className="font-bold text-slate-900 text-xs">
                          <span className="font-mono text-sm">{member.annualFee.toLocaleString()}</span> د.م / سنويًا
                        </div>
                        <div className="pt-0.5 flex flex-wrap items-center gap-1.5">
                          {renderPaymentMethodBadge(member.membershipPaymentMethod || 'bank_transfer')}
                          {(member.proofImageUrl || member.receiptUrl) && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewProof({
                                  url: (member.proofImageUrl || member.receiptUrl)!,
                                  title: `إثبات تحويل واجب الانخراط: ${member.fullName}`,
                                  memberName: member.fullName,
                                  date: member.joinDate,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 text-[10px] font-bold transition cursor-pointer shadow-2xs"
                              title="معاينة صورة إثبات التحويل البنكي"
                            >
                              <ImageIcon className="w-3 h-3 text-emerald-700" />
                              <span>إثبات الدفع</span>
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>انضمام: {member.joinDate}</span>
                        </div>
                        {member.renewalDate && (
                          <div className="text-[10px] text-slate-400">
                            تجديد: {member.renewalDate}
                          </div>
                        )}
                      </td>

                      {/* Recorded Payments */}
                      <td className="py-4 px-4 align-middle space-y-1">
                        {payments.count > 0 ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => setSelectedMemberForLedger(member)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition group"
                              title="عرض سجل جميع المساهمات"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-teal-600 group-hover:scale-110 transition-transform" />
                              <span className="font-mono font-black">{payments.totalPaid.toLocaleString()} د.م</span>
                              <span className="text-[10px] text-teal-600 font-normal">({payments.count})</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            لا توجد عمليات مقيدة
                          </span>
                        )}
                      </td>

                      {/* Admin Action Buttons */}
                      <td className="py-4 px-4 align-middle">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Ledger Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedMemberForLedger(member)}
                            className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold border border-teal-200 transition-colors"
                            title="سجل مساهمات المنخرط الكامل"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>

                          {/* Toggle Activation Button (Requires canEdit) */}
                          {canEdit && (
                            isActive ? (
                              <button
                                type="button"
                                onClick={() => onToggleMemberStatus(member.id, 'inactive')}
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition-colors shadow-2xs cursor-pointer"
                                title="إلغاء تفعيل المنخرط (تعطيل مؤقت دون حذف البيانات)"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onToggleMemberStatus(member.id, 'active')}
                                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-xs cursor-pointer"
                                title="تفعيل المنخرط واسترجاع حالته النشطة"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                            )
                          )}

                          {/* Print Member Card */}
                          <button
                            type="button"
                            onClick={() => onPrintMemberCard(member)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                            title="طباعة بطاقة ووصل المنخرط"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit Member Button (Requires canEdit) */}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onEditMember(member)}
                              className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition-colors cursor-pointer"
                              title="تعديل بيانات المنخرط"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete Member Button (STRICTLY HIDDEN IF NO canDelete) */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!canDelete) return;
                                setMemberToDelete(member);
                              }}
                              className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                              title="حذف المنخرط نهائيًا من النظام"
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
      ) : (
        /* ======================== GRID CARDS VIEW ======================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => {
            const payments = getMemberPaymentsSummary(member);
            const isActive = member.status === 'active';

            return (
              <div
                key={member.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs space-y-4 flex flex-col justify-between transition-all hover:shadow-md ${
                  !isActive ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Card Bar: Avatar, Name, Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {member.avatarUrl ? (
                        <div className="w-12 h-12 rounded-2xl border border-slate-200 overflow-hidden flex-shrink-0 bg-slate-100">
                          <img src={member.avatarUrl} alt={member.fullName} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-xs ${
                          isActive ? 'bg-emerald-700' : 'bg-slate-500'
                        }`}>
                          {member.fullName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-snug">{member.fullName}</h4>
                        <span className="text-xs font-mono text-emerald-800 font-bold block">{member.memberCode}</span>
                      </div>
                    </div>

                    <div>
                      {renderStatusBadge(member.status)}
                    </div>
                  </div>

                  {/* Details Block */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs text-slate-600">
                    {member.cin && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">رقم البطاقة (CIN):</span>
                        <span className="font-mono font-bold text-slate-800">{member.cin}</span>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">الهاتف:</span>
                        <span className="font-mono font-bold text-slate-800" dir="ltr">{member.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">الاشتراك السنوي:</span>
                      <span className="font-mono font-black text-emerald-700">{member.annualFee.toLocaleString()} د.م</span>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-slate-400 font-medium">طريقة أداء الانخراط:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {renderPaymentMethodBadge(member.membershipPaymentMethod || 'bank_transfer')}
                        {(member.proofImageUrl || member.receiptUrl) && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewProof({
                                url: (member.proofImageUrl || member.receiptUrl)!,
                                title: `إثبات تحويل واجب الانخراط: ${member.fullName}`,
                                memberName: member.fullName,
                                date: member.joinDate,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 text-[10px] font-bold transition cursor-pointer shadow-2xs"
                            title="معاينة صورة إثبات التحويل البنكي"
                          >
                            <ImageIcon className="w-3 h-3 text-emerald-700" />
                            <span>إثبات الدفع</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">إجمالي المساهمات:</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMemberForLedger(member)}
                        className="font-mono font-black text-teal-700 hover:underline flex items-center gap-1"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-teal-600" />
                        <span>{payments.totalPaid.toLocaleString()} د.م ({payments.count})</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">تاريخ الانضمام:</span>
                      <span className="text-slate-700">{member.joinDate}</span>
                    </div>

                    {/* خانة الحالة في عرض البطاقات */}
                    <div className="pt-2 mt-1 border-t border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold">الحالة:</span>
                        {renderStatusBadge(member.status)}
                      </div>
                      {renderStatusActionButtons(member)}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Activation Button (Requires canEdit) */}
                  {canEdit && (
                    isActive ? (
                      <button
                        type="button"
                        onClick={() => onToggleMemberStatus(member.id, 'inactive')}
                        className="flex-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>{t.deactivateMemberBtn || 'إلغاء التفعيل'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggleMemberStatus(member.id, 'active')}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{t.activateMemberBtn || 'تفعيل المنخرط'}</span>
                      </button>
                    )
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedMemberForLedger(member)}
                      className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-colors cursor-pointer"
                      title="سجل مساهمات المنخرط"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onPrintMemberCard(member)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title="طباعة بطاقة العضوية"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {/* Edit Member Button (Requires canEdit) */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onEditMember(member)}
                        className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                        title="تعديل بيانات المنخرط"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete Member Button (STRICTLY HIDDEN IF NO canDelete) */}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!canDelete) return;
                          setMemberToDelete(member);
                        }}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                        title="حذف المنخرط"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Safe Deactivation & Data Guarantee Notice */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
        <HelpCircle className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900">
            ضمان سلامة البيانات وسجل الاشتراكات (Safe Deactivation & Data Protection):
          </p>
          <p className="leading-relaxed">
            {t.safeDeactivationNote || 'ميزة الأمان: إلغاء التفعيل يغير حالة المنخرط فقط ويمنحه وسم «غير نشط» مع الاحتفاظ بجميع بياناته، وسجل مساهماته، ومعلوماته الشخصية كاملة، ويمكن للأدمن إعادة تفعيله في أي لحظة.'}
          </p>
        </div>
      </div>

      {/* =========================================================================
          MODAL 0: MEMBER CONTRIBUTIONS LEDGER MODAL (سجل مساهمات المنخرط الكامل)
         ========================================================================= */}
      <AnimatePresence>
        {selectedMemberForLedger && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-right"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between border-b border-emerald-900/50">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-lg text-white">
                        سجل مساهمات المنخرط
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                        {selectedMemberForLedger.memberCode}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-200/80 mt-0.5">
                      {selectedMemberForLedger.fullName} • انضم بتاريخ: {selectedMemberForLedger.joinDate}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMemberForLedger(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
                {(() => {
                  const mContribs = getMemberContributions(selectedMemberForLedger);
                  const mPayments = getMemberPaymentsSummary(selectedMemberForLedger);
                  const sorted = [...mContribs].sort(
                    (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
                  );
                  const filtered = sorted.filter((c) => {
                    if (!modalSearchQuery) return true;
                    const q = modalSearchQuery.toLowerCase();
                    return (
                      (c.notes && c.notes.toLowerCase().includes(q)) ||
                      (c.id && c.id.toLowerCase().includes(q)) ||
                      (c.date && c.date.toLowerCase().includes(q)) ||
                      (c.amount && c.amount.toString().includes(q))
                    );
                  });

                  return (
                    <>
                      {/* Summary Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                          <span className="text-[11px] text-emerald-700 font-bold block">إجمالي المساهمات</span>
                          <span className="text-base sm:text-lg font-black font-mono text-emerald-900 block mt-1">
                            {mPayments.totalPaid.toLocaleString()} {translations[lang]?.currencyShort || 'د.م'}
                          </span>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                          <span className="text-[11px] text-slate-600 font-bold block">عدد العمليات</span>
                          <span className="text-base sm:text-lg font-black font-mono text-slate-800 block mt-1">
                            {mPayments.count} مساهمات
                          </span>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
                          <span className="text-[11px] text-blue-700 font-bold block">آخر مساهمة</span>
                          <span className="text-xs sm:text-sm font-black font-mono text-blue-900 block mt-1">
                            {sorted[0]?.date || selectedMemberForLedger.joinDate || '—'}
                          </span>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
                          <span className="text-[11px] text-indigo-700 font-bold block">طريقة أداء الانخراط</span>
                          <div className="mt-1">
                            {renderPaymentMethodBadge(selectedMemberForLedger.membershipPaymentMethod || 'bank_transfer')}
                          </div>
                        </div>
                      </div>

                      {/* Bank Transfer Proof Banner if attached */}
                      {(selectedMemberForLedger.proofImageUrl || selectedMemberForLedger.receiptUrl) && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">
                                صورة إثبات التحويل البنكي لواجب الانخراط
                              </span>
                              <span className="text-[11px] text-emerald-700 font-medium">
                                تم إرفاق صورة توثيق الدفع عند تسجيل المنخرط
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewProof({
                                url: (selectedMemberForLedger.proofImageUrl || selectedMemberForLedger.receiptUrl)!,
                                title: `إثبات تحويل واجب الانخراط: ${selectedMemberForLedger.fullName}`,
                                memberName: selectedMemberForLedger.fullName,
                                date: selectedMemberForLedger.joinDate,
                              })
                            }
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>معاينة إثبات الدفع</span>
                          </button>
                        </div>
                      )}

                      {/* Search */}
                      <div className="relative">
                        <input
                          type="text"
                          value={modalSearchQuery}
                          onChange={(e) => setModalSearchQuery(e.target.value)}
                          placeholder="تصفية مساهمات المنخرط (تاريخ، مبلغ، ملاحظات)..."
                          className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs bg-slate-50 outline-none"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>

                      {/* Contributions Table */}
                      {filtered.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                          <Coins className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-xs text-slate-500">لا توجد مساهمات مسجلة تطابق البحث لهذا المنخرط.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">نوع المساهمة</th>
                                <th className="py-2.5 px-3">المبلغ</th>
                                <th className="py-2.5 px-3">طريقة الدفع</th>
                                <th className="py-2.5 px-3">التاريخ والوقت</th>
                                <th className="py-2.5 px-3">معرف العملية</th>
                                <th className="py-2.5 px-3">الحالة</th>
                                <th className="py-2.5 px-3">البيان</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filtered.map((c) => {
                                const catInfo = getCategoryDetails(c.category);
                                const isComp = c.status === 'completed' || c.status === 'approved';
                                return (
                                  <tr key={c.id} className="hover:bg-slate-50">
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${catInfo.badgeClass}`}>
                                        {catInfo.label}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 whitespace-nowrap font-mono font-black text-emerald-800">
                                      {Number(c.amount) > 0 ? `${c.amount.toLocaleString()} د.م` : 'مبادرة معنوية'}
                                    </td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      {renderPaymentMethodBadge(c.paymentMethod || 'bank_transfer')}
                                    </td>
                                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600">
                                      {c.date} {c.time && <span className="text-[10px] text-slate-400">({c.time})</span>}
                                    </td>
                                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                                      {c.financialOperationId || c.id}
                                    </td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        isComp ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {isComp ? '🟢 موثقة' : '⏳ قيد المعالجة'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate">{c.notes || '—'}</span>
                                        {(c.proofImageUrl || c.receiptUrl) && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPreviewProof({
                                                url: (c.proofImageUrl || c.receiptUrl)!,
                                                title: `إثبات مساهمة: ${c.memberName}`,
                                                memberName: c.memberName,
                                                date: c.date,
                                              })
                                            }
                                            className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0 flex items-center gap-1"
                                            title="عرض صورة الإثبات المرفقة"
                                          >
                                            <ImageIcon className="w-3 h-3 text-emerald-600" />
                                            <span>صورة الإثبات</span>
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
                    </>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const m = selectedMemberForLedger;
                    setSelectedMemberForLedger(null);
                    onPrintMemberCard(m);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة بطاقة الانخراط والوصل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMemberForLedger(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL 1: CONFIRM DEACTIVATION MODAL (آمن، يحفظ البيانات)
         ========================================================================= */}
      <AnimatePresence>
        {memberToDeactivate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                  <UserX className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    {t.confirmDeactivateTitle || 'تأكيد إلغاء تفعيل المنخرط'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    تعطيل الحساب مؤقتًا دون حذف أي بيانات
                  </p>
                </div>
              </div>

              {/* Member Summary Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="font-bold text-slate-900 text-sm">{memberToDeactivate.fullName}</div>
                <div className="font-mono text-emerald-800 font-semibold">{memberToDeactivate.memberCode}</div>
                <div className="text-slate-500">مبلغ الاشتراك: {memberToDeactivate.annualFee.toLocaleString()} د.م</div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs leading-relaxed">
                <p className="font-bold mb-1">طمأنة الأمان:</p>
                <p>{t.confirmDeactivateMessage || 'ستبقى جميع بيانات المنخرط ومساهماته وسجل اشتراكاته محفوظة بالكامل ويمكنك إعادة تفعيله في أي وقت بنقرة واحدة.'}</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberToDeactivate(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
                >
                  {t.cancel || 'إلغاء'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeactivation}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-700/20 transition-colors"
                >
                  {t.deactivateMemberBtn || 'تأكيد إلغاء التفعيل'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL 2: CONFIRM DELETE MODAL (مع التنبيه وخيار إلغاء التفعيل كبديل آمن)
          Strictly rendered ONLY when the user has explicit canDelete permission
         ========================================================================= */}
      <AnimatePresence>
        {canDelete && memberToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-200 space-y-5"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    {t.confirmDeleteMemberTitle || 'تأكيد حذف المنخرط نهائيًا'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    إزالة العضوية بشكل دائم من قاعدة البيانات
                  </p>
                </div>
              </div>

              {/* Target Member Box */}
              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-1 text-xs">
                <div className="font-bold text-slate-900 text-sm">{memberToDelete.fullName}</div>
                <div className="font-mono text-emerald-800 font-semibold">{memberToDelete.memberCode}</div>
                <div className="text-slate-600">تاريخ الانضمام: {memberToDelete.joinDate} | الاشتراك: {memberToDelete.annualFee.toLocaleString()} د.م</div>
              </div>

              {/* Security Warning & Better Alternative */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span>تنبيه هام ومقترح آمن:</span>
                </div>
                <p className="leading-relaxed">
                  {t.confirmDeleteMemberWarning || 'حذف المنخرط نهائيًا سيزيله من النظام بالكامل. إذا كنت ترغب فقط في إيقاف حسابه مؤقتًا مع الحفاظ على كافة بياناته وسجل مساهماته، يمكنك اختيار «إلغاء التفعيل» بدلاً من الحذف.'}
                </p>
              </div>

              {/* Action Buttons with 3 clear options */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
                >
                  {t.cancel || 'إلغاء'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const m = memberToDelete;
                    setMemberToDelete(null);
                    if (m && m.status !== 'inactive') {
                      onToggleMemberStatus(m.id, 'inactive');
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors"
                >
                  {t.deactivateInstead || 'إلغاء التفعيل بدلاً من الحذف (آمن)'}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-700/20 transition-colors"
                >
                  {t.deletePermanently || 'تأكيد الحذف النهائي'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL 3: PAYMENT PROOF IMAGE PREVIEW MODAL (معاينة صورة إثبات الدفع)
         ========================================================================= */}
      <AnimatePresence>
        {previewProof && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-right"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between border-b border-emerald-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">
                      {previewProof.title}
                    </h3>
                    <p className="text-xs text-emerald-200/80 mt-0.5">
                      المنخرط: {previewProof.memberName} {previewProof.date ? `• التاريخ: ${previewProof.date}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewProof(null)}
                  className="p-1.5 rounded-full hover:bg-white/15 text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image Container */}
              <div className="p-4 sm:p-6 bg-slate-950 overflow-y-auto flex-1 flex items-center justify-center min-h-[300px]">
                <img
                  src={previewProof.url}
                  alt={previewProof.title}
                  className="max-h-[60vh] w-auto object-contain rounded-2xl border border-slate-800 shadow-lg mx-auto"
                />
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-600 font-medium">
                  وثيقة إثبات الأداء الرسمية عبر التحويل البنكي
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <a
                    href={previewProof.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download="payment-proof.jpg"
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل الصورة</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewProof(null)}
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
