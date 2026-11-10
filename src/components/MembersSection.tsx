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
  EyeOff, 
  Edit2, 
  Trash2, 
  SlidersHorizontal, 
  LayoutGrid, 
  List, 
  Shield, 
  FileCheck,
  UserCheck,
  UserX,
  User,
  FolderOpen,
  X,
  Sparkles,
  Coins,
  Receipt,
  ChevronRight
} from 'lucide-react';
import { Member, MemberStatus, Language, UserRole, UIElementConfig, MemberContribution, BoardMember, AssociationSettings } from '../types';
import { translations } from '../translations';
import { BackToHomeButton } from './BackToHomeButton';

interface MembersSectionProps {
  members: Member[];
  boardMembers?: BoardMember[];
  settings?: AssociationSettings;
  contributions?: MemberContribution[];
  role: UserRole;
  lang: Language;
  uiElements?: UIElementConfig[];
  loggedInMember?: Member | null;
  onRequestMemberLogin?: () => void;
  onRequestRegisterMember?: () => void;
  onOpenAddMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onToggleMemberStatus?: (id: string, targetStatus?: MemberStatus) => void;
  onPrintMemberCard: (member: Member) => void;
  onNavigateToBoardMembers?: () => void;
  onBackToHome?: () => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const MembersSection: React.FC<MembersSectionProps> = ({
  members,
  boardMembers = [],
  settings,
  contributions = [],
  role,
  lang,
  uiElements = [],
  loggedInMember,
  onRequestMemberLogin,
  onRequestRegisterMember,
  onOpenAddMember,
  onEditMember,
  onDeleteMember,
  onToggleMemberStatus,
  onPrintMemberCard,
  onNavigateToBoardMembers,
  onBackToHome,
  canAdd = true,
  canEdit = true,
  canDelete = false,
}) => {
  const t = translations[lang] as any;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'fee' | 'name'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [selectedMemberForLedger, setSelectedMemberForLedger] = useState<Member | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  // Helper to get member contributions
  const getMemberContributions = (member: Member) => {
    return contributions.filter(
      (c) => c.memberId === member.id || (c.memberName && c.memberName.trim().toLowerCase() === member.fullName.trim().toLowerCase())
    );
  };

  const getMemberTotalContributions = (member: Member) => {
    const list = getMemberContributions(member);
    return list.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
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

  // Filter & Sort
  const filteredMembers = members
    .filter((m) => {
      const matchesStatus = selectedStatus === 'all' || m.status === selectedStatus;
      const matchesSearch =
        m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.memberCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.phone && m.phone.includes(searchTerm));
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'fee') return b.annualFee - a.annualFee;
      if (sortBy === 'name') return a.fullName.localeCompare(b.fullName);
      return new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
    });

  const totalCollectedFees = members.reduce((sum, m) => sum + Number(m.annualFee), 0);

  const getStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {t.statusActive || 'نشط ومفعّل'}
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            {t.statusPending || 'قيد التجديد'}
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            {t.statusInactive || 'غير نشط'}
          </span>
        );
      case 'honorary':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Award className="w-3 h-3 text-purple-600" />
            {t.statusHonorary || 'عضو فخري'}
          </span>
        );
    }
  };

  const renderAdminStatusButtons = (member: Member) => {
    if (role !== 'admin' || !canEdit || !onToggleMemberStatus) return null;
    const isActive = member.status === 'active';
    const isInactive = member.status === 'inactive';

    return (
      <div className="flex items-center justify-center gap-1.5 pt-1.5 flex-wrap">
        <button
          type="button"
          disabled={isActive}
          onClick={() => onToggleMemberStatus(member.id, 'active')}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border ${
            isActive
              ? 'bg-emerald-600 text-white border-emerald-600 opacity-95 cursor-default'
              : 'bg-white hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-300 hover:border-emerald-600 cursor-pointer'
          }`}
          title="تفعيل حالة المنخرط"
        >
          <UserCheck className="w-3 h-3" />
          <span>{t.activateMemberBtn || 'تفعيل المنخرط'}</span>
        </button>

        <button
          type="button"
          disabled={isInactive}
          onClick={() => onToggleMemberStatus(member.id, 'inactive')}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border ${
            isInactive
              ? 'bg-rose-600 text-white border-rose-600 opacity-95 cursor-default'
              : 'bg-white hover:bg-rose-600 text-rose-700 hover:text-white border-rose-300 hover:border-rose-600 cursor-pointer'
          }`}
          title="إلغاء التفعيل دون حذف البيانات"
        >
          <UserX className="w-3 h-3" />
          <span>{t.deactivateMemberBtn || 'إلغاء التفعيل'}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Return to Home Button */}
      {onBackToHome && (
        <BackToHomeButton
          onBack={onBackToHome}
          lang={lang}
          currentPageTitle={t.membersTitle || 'سجل المنخرطين'}
          id="back-to-home-from-members"
        />
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{t.membersTitle}</h2>
            <p className="text-xs text-slate-500">{t.membersDesc}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-end rtl:text-left bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-700 block font-semibold">مجموع واجبات الانخراط:</span>
            <span className="text-sm font-black text-emerald-950 font-mono">
              {totalCollectedFees.toLocaleString()} {t.currencyShort}
            </span>
          </div>

          {!loggedInMember && (
            <div className="flex items-center gap-2">
              {onRequestRegisterMember && (
                <button
                  onClick={onRequestRegisterMember}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer"
                  title="تسجيل منخرط جديد"
                >
                  <UserPlus className="w-4 h-4 text-emerald-100" />
                  <span>{t.registerNewMember || 'تسجيل منخرط جديد'}</span>
                </button>
              )}
              {onRequestMemberLogin && (
                <button
                  onClick={onRequestMemberLogin}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer"
                  title="تسجيل دخول المنخرطين"
                >
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>{t.memberLogin || 'تسجيل دخول المنخرطين'}</span>
                </button>
              )}
            </div>
          )}

          {role === 'admin' && canAdd && (
            <button
              onClick={onOpenAddMember}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-colors shadow-md shadow-emerald-700/20 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t.addMember}</span>
            </button>
          )}
        </div>
      </div>

      {/* Controls Bar: Search, Status Filter, Sort, View Toggle */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-3.5 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.searchMembers}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            >
              <option value="all">جميع الحالات ({members.length})</option>
              <option value="active">{t.statusActive}</option>
              <option value="pending">{t.statusPending}</option>
              <option value="inactive">{t.statusInactive}</option>
              <option value="honorary">{t.statusHonorary}</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            >
              <option value="date">الأحدث انخراطًا</option>
              <option value="fee">الأعلى مساهمة</option>
              <option value="name">أبجديًا بالاسم</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl self-end md:self-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500'
              }`}
              title="عرض جدول شفاف"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500'
              }`}
              title="عرض بطاقات"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {filteredMembers.length > 0 ? (
        viewMode === 'table' ? (
          /* Transparent Table View */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start rtl:text-right text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    {role === 'admin' && <th className="py-3.5 px-4">{t.memberCode}</th>}
                    <th className="py-3.5 px-4">{t.fullName}</th>
                    <th className="py-3.5 px-4">{t.annualFee}</th>
                    <th className="py-3.5 px-4">إجمالي المساهمات المسجلة</th>
                    <th className="py-3.5 px-4">{t.joinDate}</th>
                    <th className="py-3.5 px-4">{t.status}</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((member) => {
                    const memberContribs = getMemberContributions(member);
                    const totalContribAmount = getMemberTotalContributions(member);
                    return (
                    <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Code - Admin Only */}
                      {role === 'admin' && (
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {member.memberCode}
                        </td>
                      )}

                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt={member.fullName} className="w-full h-full object-cover" />
                            ) : (
                              member.fullName.charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {member.isAnonymousInPublic && role !== 'admin' ? (
                                <span className="flex items-center gap-1 text-slate-600 font-medium">
                                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                  فاعل خير (اسم محمي)
                                </span>
                              ) : (
                                member.fullName
                              )}
                            </div>
                            {member.notes && (
                              <span className="text-[11px] text-slate-400 line-clamp-1">{member.notes}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Annual Fee */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-emerald-800 font-mono text-xs bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                          {member.annualFee.toLocaleString()} {t.currencyShort}
                        </span>
                      </td>

                      {/* Total Contributions & Count */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedMemberForLedger(member)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition group"
                          title="عرض سجل جميع المساهمات"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-teal-600 group-hover:scale-110 transition-transform" />
                          <span className="font-mono font-black">{totalContribAmount.toLocaleString()} {t.currencyShort}</span>
                          <span className="text-[10px] text-teal-600 font-normal">({memberContribs.length})</span>
                        </button>
                      </td>

                      {/* Join Date */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-mono">
                        {member.joinDate}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {getStatusBadge(member.status)}
                          {renderAdminStatusButtons(member)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedMemberForLedger(member)}
                            className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors"
                            title="سجل مساهمات المنخرط"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>

                          {/* Print Member Card & Receipt - Admin Only */}
                          {role === 'admin' && (
                            <button
                              onClick={() => onPrintMemberCard(member)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 transition-colors"
                              title={t.printMemberCard}
                            >
                              <FileCheck className="w-4 h-4" />
                            </button>
                          )}

                          {role === 'admin' && (
                            <>
                              {canEdit && (
                                <button
                                  onClick={() => onEditMember(member)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                  title={t.edit}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => onDeleteMember(member.id)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                  title={t.delete}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
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
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMembers.map((member) => {
              const memberContribs = getMemberContributions(member);
              const totalContribAmount = getMemberTotalContributions(member);
              return (
              <div
                key={member.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-base overflow-hidden">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.fullName} className="w-full h-full object-cover" />
                      ) : (
                        member.fullName.charAt(0)
                      )}
                    </div>
                    <div>
                      {role === 'admin' && (
                        <span className="font-mono text-[11px] font-bold text-slate-500 block">
                          {member.memberCode}
                        </span>
                      )}
                      <h3 className="font-bold text-slate-900 text-base">
                        {member.isAnonymousInPublic && role !== 'admin'
                          ? 'فاعل خير (اسم محمي)'
                          : member.fullName}
                      </h3>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(member.status)}
                    {renderAdminStatusButtons(member)}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t.annualFee}:</span>
                    <span className="font-black text-emerald-800 font-mono text-sm">
                      {member.annualFee.toLocaleString()} {t.currencyShort}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">إجمالي المساهمات:</span>
                    <button
                      onClick={() => setSelectedMemberForLedger(member)}
                      className="font-mono font-black text-teal-700 hover:underline flex items-center gap-1"
                    >
                      <FolderOpen className="w-3 h-3 text-teal-600" />
                      <span>{totalContribAmount.toLocaleString()} {t.currencyShort} ({memberContribs.length})</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>تاريخ الانخراط:</span>
                    <span className="font-mono">{member.joinDate}</span>
                  </div>
                  {role === 'admin' && member.phone && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>الهاتف:</span>
                      <span className="font-mono">{member.phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    {role === 'admin' && (
                      <>
                        <button
                          onClick={() => onPrintMemberCard(member)}
                          className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{t.printMemberCard}</span>
                        </button>
                        <span className="text-slate-300">•</span>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedMemberForLedger(member)}
                      className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>سجل المساهمات</span>
                    </button>
                  </div>

                  {role === 'admin' && (
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          onClick={() => onEditMember(member)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                          title={t.edit}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => onDeleteMember(member.id)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-800">{t.noMembersFound}</h4>
          <p className="text-xs text-slate-500">
            تأكد من كتابة الاسم بشكل صحيح أو مسح معايير الفلترة.
          </p>
        </div>
      )}

      {/* Executive Body & Board Members Gateway Button */}
      {onNavigateToBoardMembers && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5 text-start rtl:text-right">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center flex-shrink-0 border border-emerald-400/30">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                الهيئة التنفيذية والتدبيرية – أعضاء مكتب الجمعية
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                الاطلاع على تشكيلة المكتب المسير وتوزيع المهام والمسؤوليات الإدارية المنوطة بكل عضو.
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToBoardMembers}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors flex-shrink-0 cursor-pointer shadow-xs"
          >
            <Award className="w-4 h-4 text-emerald-200" />
            <span>عرض أعضاء مكتب الجمعية</span>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MEMBER CONTRIBUTIONS LEDGER MODAL (نافذة سجل مساهمات المنخرط الكاملة) */}
      {/* ======================================================================= */}
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
                      {role === 'admin' && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                          {selectedMemberForLedger.memberCode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-emerald-200/80 mt-0.5">
                      {selectedMemberForLedger.fullName} • انضم بتاريخ: {selectedMemberForLedger.joinDate}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedMemberForLedger(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
                {/* 3 Stats Tiles */}
                {(() => {
                  const mContribs = getMemberContributions(selectedMemberForLedger);
                  const mTotal = getMemberTotalContributions(selectedMemberForLedger);
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
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                          <span className="text-[11px] text-emerald-700 font-bold block">إجمالي المساهمات</span>
                          <span className="text-lg sm:text-xl font-black font-mono text-emerald-900 block mt-1">
                            {mTotal.toLocaleString()} {t.currencyShort}
                          </span>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                          <span className="text-[11px] text-slate-600 font-bold block">عدد العمليات</span>
                          <span className="text-lg sm:text-xl font-black font-mono text-slate-800 block mt-1">
                            {mContribs.length} مساهمات
                          </span>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
                          <span className="text-[11px] text-blue-700 font-bold block">آخر مساهمة</span>
                          <span className="text-xs sm:text-sm font-black font-mono text-blue-900 block mt-1">
                            {sorted[0]?.date || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Search in Modal */}
                      <div className="relative">
                        <input
                          type="text"
                          value={modalSearchQuery}
                          onChange={(e) => setModalSearchQuery(e.target.value)}
                          placeholder="تصفية السجل (تاريخ، مبلغ، ملاحظات)..."
                          className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs bg-slate-50 outline-none"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>

                      {/* Table of Contributions */}
                      {filtered.length === 0 ? (
                        <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-xs text-slate-500">لا توجد مساهمات مسجلة تطابق البحث.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">نوع المساهمة</th>
                                <th className="py-2.5 px-3">المبلغ</th>
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
                                      {Number(c.amount) > 0 ? `${c.amount.toLocaleString()} ${t.currencyShort}` : 'مبادرة معنوية'}
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
                                      {c.notes || '—'}
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
                {role === 'admin' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const m = selectedMemberForLedger;
                      setSelectedMemberForLedger(null);
                      onPrintMemberCard(m);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة بطاقة الانخراط والوصل</span>
                  </button>
                ) : (
                  <div />
                )}

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
    </div>
  );
};
