import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  Phone, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  User, 
  X, 
  Save, 
  Sparkles,
  Crown,
  Briefcase,
  Users,
  CreditCard
} from 'lucide-react';
import { BoardMember, Member, Language } from '../types';
import { translations } from '../translations';

interface ManageBoardMembersProps {
  boardMembers: BoardMember[];
  members: Member[];
  onUpdateBoardMembers: (boardMembers: BoardMember[]) => void;
  lang: Language;
  onLogAudit?: (action: 'create' | 'update' | 'delete', description: string) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ManageBoardMembers: React.FC<ManageBoardMembersProps> = ({
  boardMembers,
  members,
  onUpdateBoardMembers,
  lang,
  onLogAudit,
  canAdd = true,
  canEdit = true,
  canDelete = false,
}) => {
  const t = translations[lang] as any;

  // Search in existing board members list
  const [boardSearchTerm, setBoardSearchTerm] = useState('');

  // Add Member to Board Modal / Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedRole, setSelectedRole] = useState('رئيس الجمعية');
  const [customRoleText, setCustomRoleText] = useState('');
  const [orderNumber, setOrderNumber] = useState<number>(boardMembers.length + 1);
  const [appointedDate, setAppointedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Editing existing board member
  const [editingBoardMember, setEditingBoardMember] = useState<BoardMember | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editOrder, setEditOrder] = useState<number>(1);
  const [editAppointedDate, setEditAppointedDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Delete Confirmation Modal State
  const [memberToDelete, setMemberToDelete] = useState<BoardMember | null>(null);

  // Predefined role suggestions
  const presetRoles = [
    { title: 'رئيس الجمعية', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
    { title: 'نائب الرئيس', color: 'bg-teal-50 text-teal-800 border-teal-300' },
    { title: 'الكاتبة العامة', color: 'bg-blue-50 text-blue-800 border-blue-300' },
    { title: 'الكاتب العام', color: 'bg-blue-50 text-blue-800 border-blue-300' },
    { title: 'نائبة الكاتب العام', color: 'bg-sky-50 text-sky-800 border-sky-300' },
    { title: 'نائب الكاتب العام', color: 'bg-sky-50 text-sky-800 border-sky-300' },
    { title: 'أمين المال', color: 'bg-amber-50 text-amber-800 border-amber-300' },
    { title: 'نائب أمين المال', color: 'bg-yellow-50 text-yellow-800 border-yellow-300' },
    { title: 'مستشار مكلف بالمشاريع', color: 'bg-purple-50 text-purple-800 border-purple-300' },
    { title: 'مستشارة مكلفة بالشؤون الاجتماعية', color: 'bg-rose-50 text-rose-800 border-rose-300' },
    { title: 'منسق الأنشطة الميدانية', color: 'bg-indigo-50 text-indigo-800 border-indigo-300' },
  ];

  // IDs of members already in the board
  const boardMemberIds = new Set(boardMembers.map((bm) => bm.memberId));

  // Registered members filtered by search query for adding to board
  const searchedRegisteredMembers = members.filter((m) => {
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.memberCode.toLowerCase().includes(q) ||
      (m.cin && m.cin.toLowerCase().includes(q)) ||
      (m.phone && m.phone.includes(q))
    );
  });

  // Filtered and sorted board members for display
  const sortedBoardMembers = [...boardMembers]
    .sort((a, b) => a.order - b.order)
    .filter((bm) => {
      if (!boardSearchTerm.trim()) return true;
      const q = boardSearchTerm.toLowerCase();
      const linked = members.find((m) => m.id === bm.memberId);
      const name = linked?.fullName.toLowerCase() || '';
      const code = linked?.memberCode.toLowerCase() || '';
      const role = bm.roleAr.toLowerCase();
      return name.includes(q) || code.includes(q) || role.includes(q);
    });

  // Open add modal
  const handleOpenAddModal = () => {
    setSelectedMember(null);
    setMemberSearchQuery('');
    setSelectedRole('رئيس الجمعية');
    setCustomRoleText('');
    setOrderNumber(boardMembers.length + 1);
    setAppointedDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Submit add board member
  const handleAddBoardMember = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedMember) {
      setFormError('يرجى اختيار المنخرط من قائمة نتائج البحث أعلاه.');
      return;
    }

    // Prevent duplicate
    if (boardMemberIds.has(selectedMember.id)) {
      setFormError('هذا المنخرط مضاف مسبقًا في تشكيلة أعضاء المكتب.');
      return;
    }

    const finalRole = customRoleText.trim() || selectedRole.trim();
    if (!finalRole) {
      setFormError('يرجى تحديد أو كتابة منصب العضو في المكتب.');
      return;
    }

    const newBoardEntry: BoardMember = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      memberId: selectedMember.id,
      roleAr: finalRole,
      order: Number(orderNumber) || boardMembers.length + 1,
      appointedDate: appointedDate || new Date().toISOString().slice(0, 10),
      notes: notes.trim() || undefined,
    };

    const updated = [...boardMembers, newBoardEntry].sort((a, b) => a.order - b.order);
    onUpdateBoardMembers(updated);

    if (onLogAudit) {
      onLogAudit('create', `إضافة المنخرط (${selectedMember.fullName} - ${selectedMember.memberCode}) إلى أعضاء مكتب الجمعية بصفة: ${finalRole}`);
    }

    setIsAddModalOpen(false);
    setSuccessNotice(`تمت إضافة ${selectedMember.fullName} إلى أعضاء مكتب الجمعية بنجاح.`);
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  // Move member up in order
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const currentList = [...sortedBoardMembers];
    const prev = currentList[index - 1];
    const curr = currentList[index];

    const prevOrder = prev.order;
    const currOrder = curr.order;

    prev.order = currOrder === prevOrder ? prevOrder + 1 : currOrder;
    curr.order = prevOrder;

    // Normalize all orders to 1, 2, 3...
    const reordered = currentList
      .sort((a, b) => a.order - b.order)
      .map((item, idx) => ({ ...item, order: idx + 1 }));

    onUpdateBoardMembers(reordered);
    if (onLogAudit) {
      const mem = members.find((m) => m.id === curr.memberId);
      onLogAudit('update', `تقديم ترتيب عضو المكتب (${mem?.fullName || curr.roleAr}) للأعلى`);
    }
  };

  // Move member down in order
  const handleMoveDown = (index: number) => {
    if (index === sortedBoardMembers.length - 1) return;
    const currentList = [...sortedBoardMembers];
    const next = currentList[index + 1];
    const curr = currentList[index];

    const nextOrder = next.order;
    const currOrder = curr.order;

    next.order = currOrder === nextOrder ? nextOrder - 1 : currOrder;
    curr.order = nextOrder;

    // Normalize all orders
    const reordered = currentList
      .sort((a, b) => a.order - b.order)
      .map((item, idx) => ({ ...item, order: idx + 1 }));

    onUpdateBoardMembers(reordered);
    if (onLogAudit) {
      const mem = members.find((m) => m.id === curr.memberId);
      onLogAudit('update', `تأخير ترتيب عضو المكتب (${mem?.fullName || curr.roleAr}) للأسفل`);
    }
  };

  // Start editing board member
  const handleStartEdit = (bm: BoardMember) => {
    setEditingBoardMember(bm);
    setEditRole(bm.roleAr);
    setEditOrder(bm.order);
    setEditAppointedDate(bm.appointedDate || new Date().toISOString().slice(0, 10));
    setEditNotes(bm.notes || '');
  };

  // Save edited board member
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBoardMember) return;

    if (!editRole.trim()) {
      alert('يرجى تحديد صفة أو منصب العضو.');
      return;
    }

    const updated = boardMembers.map((item) => {
      if (item.id === editingBoardMember.id) {
        return {
          ...item,
          roleAr: editRole.trim(),
          order: Number(editOrder) || item.order,
          appointedDate: editAppointedDate,
          notes: editNotes.trim() || undefined,
        };
      }
      return item;
    }).sort((a, b) => a.order - b.order);

    onUpdateBoardMembers(updated);

    if (onLogAudit) {
      const mem = members.find((m) => m.id === editingBoardMember.memberId);
      onLogAudit('update', `تعديل بيانات ومنصب عضو المكتب (${mem?.fullName || editingBoardMember.roleAr}) إلى: ${editRole}`);
    }

    setEditingBoardMember(null);
    setSuccessNotice('تم حفظ تعديلات منصب العضو بنجاح.');
    setTimeout(() => setSuccessNotice(''), 3000);
  };

  // Confirm delete from board
  const handleConfirmDelete = () => {
    if (!canDelete || !memberToDelete) return;
    const updated = boardMembers
      .filter((bm) => bm.id !== memberToDelete.id)
      .map((item, idx) => ({ ...item, order: idx + 1 }));

    onUpdateBoardMembers(updated);

    if (onLogAudit) {
      const mem = members.find((m) => m.id === memberToDelete.memberId);
      onLogAudit('delete', `إزالة المنخرط (${mem?.fullName || memberToDelete.roleAr}) من أعضاء مكتب الجمعية`);
    }

    setMemberToDelete(null);
    setSuccessNotice('تمت إزالة العضو من تشكيلة مكتب الجمعية بنجاح.');
    setTimeout(() => setSuccessNotice(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-600/20">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">
                {t.manageBoardMembersTitle || 'أعضاء مكتب الجمعية'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {boardMembers.length} أعضاء بالمكتب
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {t.manageBoardMembersDesc || 'إدارة تشكيلة المكتب المسير، تعيين الأدوار والمناصب، والترتيب المعتمد للظهور في واجهة المتجر للمستخدمين'}
            </p>
          </div>
        </div>

        {/* Action Button */}
        {canAdd && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleOpenAddModal}
              id="admin-add-board-member-btn"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addBoardMember || 'إضافة عضو للمكتب'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Success Notification Alert */}
      {successNotice && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-xs"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successNotice}</span>
        </motion.div>
      )}

      {/* Info & Rules Callout */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>
            يتم اختيار أعضاء المكتب <strong>حصرًا من قاعدة بيانات المنخرطين المسجلين</strong>. أي تعديل في الصورة أو الاسم أو الهاتف ينعكس تلقائيًا على بيانات عضو المكتب.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
          <Users className="w-3.5 h-3.5 text-emerald-600" />
          <span>إجمالي المنخرطين في النظام: {members.length}</span>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
          <input
            type="text"
            value={boardSearchTerm}
            onChange={(e) => setBoardSearchTerm(e.target.value)}
            placeholder="بحث في قائمة أعضاء المكتب بالاسم أو المنصب أو رقم الانخراط..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
          />
          {boardSearchTerm && (
            <button
              onClick={() => setBoardSearchTerm('')}
              className="absolute top-2.5 right-3 rtl:right-auto rtl:left-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 self-end sm:self-auto">
          <span>الترتيب المعتمد:</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs">
            أعلى الهرم إلى أسفل الهرم
          </span>
        </div>
      </div>

      {/* Board Members Table / Grid View */}
      {sortedBoardMembers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {boardSearchTerm ? 'لا توجد نتائج مطابقة للبحث' : (t.noBoardMembersFound || 'لم يتم تعيين أي عضو في مكتب الجمعية بعد.')}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6 leading-relaxed">
            {boardSearchTerm 
              ? 'يرجى مراجعة عبارة البحث أو مسح الفلتر لعرض جميع أعضاء المكتب.'
              : 'قم بالضغط على زر "إضافة عضو للمكتب" لاختيار المنخرطين وتوزيع المناصب القيادية وفق القانون الأساسي.'}
          </p>
          {!boardSearchTerm && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addBoardMember || 'إضافة عضو للمكتب'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Header */}
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 text-[11px] font-extrabold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 text-center w-16">الترتيب</th>
                  <th className="py-3 px-4 text-start">عضو المكتب / المنخرط</th>
                  <th className="py-3 px-4 text-start">المنصب والصفة</th>
                  <th className="py-3 px-4 text-start hidden sm:table-cell">معلومات الاتصال</th>
                  <th className="py-3 px-4 text-start hidden md:table-cell">تاريخ التعيين</th>
                  <th className="py-3 px-4 text-center w-36">إجراءات والترتيب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sortedBoardMembers.map((bm, index) => {
                  const linkedMember = members.find((m) => m.id === bm.memberId);
                  const isPresident = bm.roleAr.includes('رئيس الجمعية') && !bm.roleAr.includes('نائب');

                  return (
                    <tr 
                      key={bm.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${isPresident ? 'bg-emerald-50/30' : ''}`}
                    >
                      {/* Order Index & Hierarchy Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-bold font-mono text-xs ${
                          index === 0 
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs' 
                            : index === 1 || index === 2
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {bm.order}
                        </span>
                      </td>

                      {/* Member Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {linkedMember?.avatarUrl ? (
                            <img
                              src={linkedMember.avatarUrl}
                              alt={linkedMember.fullName}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm border border-slate-200 flex-shrink-0">
                              {linkedMember?.fullName.slice(0, 2) || <User className="w-5 h-5 text-slate-400" />}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {linkedMember?.fullName || 'منخرط غير موجود'}
                              </span>
                              {isPresident && (
                                <Crown className="w-4 h-4 text-amber-500 inline-block" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                {linkedMember?.memberCode || '---'}
                              </span>
                              {linkedMember?.cin && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  CIN: {linkedMember.cin}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Board Role */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shadow-xs ${
                            isPresident
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : bm.roleAr.includes('أمين المال')
                              ? 'bg-teal-50 text-teal-900 border-teal-300'
                              : bm.roleAr.includes('الكاتب')
                              ? 'bg-blue-50 text-blue-900 border-blue-300'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}>
                            <Briefcase className="w-3.5 h-3.5 opacity-70" />
                            <span>{bm.roleAr}</span>
                          </span>
                          {bm.notes && (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 max-w-xs">
                              {bm.notes}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4 hidden sm:table-cell text-xs text-slate-600">
                        <div className="space-y-0.5">
                          {linkedMember?.phone && (
                            <div className="flex items-center gap-1.5 text-slate-700 font-mono text-xs">
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{linkedMember.phone}</span>
                            </div>
                          )}
                          {linkedMember?.email && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span className="truncate max-w-[150px]">{linkedMember.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Appointed Date */}
                      <td className="py-3.5 px-4 hidden md:table-cell text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 text-slate-600 font-mono text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{bm.appointedDate || linkedMember?.joinDate || '---'}</span>
                        </div>
                      </td>

                      {/* Actions & Reordering Buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit && (
                            <>
                              {/* Move Up */}
                              <button
                                onClick={() => handleMoveUp(index)}
                                disabled={index === 0}
                                title="تقديم الترتيب للأعلى"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>

                              {/* Move Down */}
                              <button
                                onClick={() => handleMoveDown(index)}
                                disabled={index === sortedBoardMembers.length - 1}
                                title="تأخير الترتيب للأسفل"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Role */}
                              <button
                                onClick={() => handleStartEdit(bm)}
                                title="تعديل المنصب والملاحظات"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Delete from Board */}
                          {canDelete && (
                            <button
                              onClick={() => {
                                if (!canDelete) return;
                                setMemberToDelete(bm);
                              }}
                              title="إزالة من أعضاء المكتب"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 transition-colors cursor-pointer"
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
        </div>
      )}

      {/* MODAL: ADD MEMBER TO BOARD */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">{t.addBoardMember || 'إضافة عضو جديد للمكتب المسير'}</h3>
                    <p className="text-xs text-slate-300">اختر المنخرط من قاعدة البيانات وحدد صفته والترتيب في تشكيلة المكتب</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleAddBoardMember} className="p-6 space-y-5">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Step 1: Search and Select Registered Member */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    1. ابحث عن المنخرط في قاعدة البيانات <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute top-3 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="اكتب اسم المنخرط، رقم العضوية، أو رقم البطاقة الوطنية (CIN)..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
                    />
                  </div>

                  {/* Search Matches Selection List */}
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white">
                    {searchedRegisteredMembers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        لا يوجد أي منخرط مسجل يطابق هذا البحث
                      </div>
                    ) : (
                      searchedRegisteredMembers.map((m) => {
                        const isAlreadyInBoard = boardMemberIds.has(m.id);
                        const isSelected = selectedMember?.id === m.id;

                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              if (!isAlreadyInBoard) {
                                setSelectedMember(m);
                                setFormError('');
                              }
                            }}
                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 border-r-4 rtl:border-r-4 border-emerald-600'
                                : isAlreadyInBoard
                                ? 'bg-slate-50/60 opacity-60 cursor-not-allowed'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {m.avatarUrl ? (
                                <img
                                  src={m.avatarUrl}
                                  alt={m.fullName}
                                  className="w-8 h-8 rounded-xl object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                                  {m.fullName.slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-slate-900 text-xs block">
                                  {m.fullName}
                                </span>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                  <span>{m.memberCode}</span>
                                  {m.phone && <span>• {m.phone}</span>}
                                </div>
                              </div>
                            </div>

                            <div>
                              {isAlreadyInBoard ? (
                                <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                  مضاف مسبقًا
                                </span>
                              ) : isSelected ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  تم الاختيار
                                </span>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-bold hover:underline">
                                  تحديد
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Selected Member Preview Card */}
                {selectedMember && (
                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-emerald-600 text-white">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] text-emerald-800 font-bold block">المنخرط المختار:</span>
                        <span className="text-sm font-black text-slate-900">{selectedMember.fullName}</span>
                        <span className="text-xs text-emerald-700 font-mono mr-2 rtl:mr-0 rtl:ml-2">({selectedMember.memberCode})</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMember(null)}
                      className="text-xs text-slate-500 hover:text-rose-600 underline font-medium"
                    >
                      تغيير
                    </button>
                  </div>
                )}

                {/* Step 2: Role / Position Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    2. حدد الصفة أو المنصب في المكتب المسير <span className="text-rose-500">*</span>
                  </label>
                  
                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {presetRoles.map((r) => (
                      <button
                        type="button"
                        key={r.title}
                        onClick={() => {
                          setSelectedRole(r.title);
                          setCustomRoleText('');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          selectedRole === r.title && !customRoleText
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {r.title}
                      </button>
                    ))}
                  </div>

                  {/* Custom Role Input */}
                  <div className="pt-2">
                    <span className="text-[11px] text-slate-500 block mb-1">أو أدخل منصبًا مخصصًا:</span>
                    <input
                      type="text"
                      value={customRoleText}
                      onChange={(e) => setCustomRoleText(e.target.value)}
                      placeholder="مثال: منسق العلاقات مع الجالية المغربية بالخارج..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
                    />
                  </div>
                </div>

                {/* Step 3: Order, Date & Notes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الترتيب والأولوية
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      تاريخ التعيين أو الجمع العام
                    </label>
                    <input
                      type="date"
                      value={appointedDate}
                      onChange={(e) => setAppointedDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات أو المهام المنوطة به (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثال: الإشراف على لجان التضامن والمشاريع التنموية..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    id="admin-submit-add-board-btn"
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{t.saveBoardMemberBtn || 'إضافة للمكتب المسير'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT BOARD MEMBER ROLE */}
      <AnimatePresence>
        {editingBoardMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">تعديل منصب عضو المكتب</h3>
                    <p className="text-xs text-slate-400">
                      {members.find((m) => m.id === editingBoardMember.memberId)?.fullName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingBoardMember(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المنصب أو الصفة بالمكتب <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden"
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {presetRoles.slice(0, 6).map((r) => (
                      <button
                        type="button"
                        key={r.title}
                        onClick={() => setEditRole(r.title)}
                        className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                      >
                        {r.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الترتيب
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editOrder}
                      onChange={(e) => setEditOrder(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs sm:text-sm font-mono outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      تاريخ التعيين
                    </label>
                    <input
                      type="date"
                      value={editAppointedDate}
                      onChange={(e) => setEditAppointedDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs sm:text-sm font-mono outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الملاحظات أو المهام
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs sm:text-sm outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingBoardMember(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: DELETE CONFIRMATION */}
      <AnimatePresence>
        {canDelete && memberToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                إزالة العضو من تشكيلة مكتب الجمعية؟
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                هل أنت متأكد من رغبتك في إزالة{' '}
                <strong className="text-slate-900">
                  {members.find((m) => m.id === memberToDelete.memberId)?.fullName || memberToDelete.roleAr}
                </strong>{' '}
                من قائمة أعضاء المكتب؟
                <br />
                <span className="text-emerald-700 font-semibold block mt-1">
                  (ملاحظة: سيبقى حسابه وسجله كمنخرط محفوظًا دون أي مساس)
                </span>
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20"
                >
                  تأكيد الإزالة من المكتب
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
