import React, { useState } from 'react';
import { 
  Vote, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Play, 
  Pause, 
  CheckCircle2, 
  XCircle, 
  Users, 
  ThumbsUp, 
  ThumbsDown, 
  BarChart3, 
  Clock, 
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Lock
} from 'lucide-react';
import { Poll, PollStatus, Language, Member, CurrentAdminSession } from '../types';
import { translations } from '../translations';
import {
  apiCreatePoll,
  apiUpdatePoll,
  apiTogglePollStatus,
  apiTogglePollVisibility,
  apiDeletePoll,
} from '../api/pollsApi';

interface ManagePollsProps {
  polls: Poll[];
  members: Member[];
  onUpdatePolls: (updatedPolls: Poll[]) => void;
  lang: Language;
  onAddAuditLog?: (action: 'create' | 'update' | 'delete', description: string) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  currentSession?: CurrentAdminSession | null;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ManagePolls: React.FC<ManagePollsProps> = ({
  polls,
  members,
  onUpdatePolls,
  lang,
  onAddAuditLog,
  canAdd,
  canEdit,
  canDelete,
  currentSession,
  addToast,
}) => {
  const t = translations[lang];

  // Authoritative permissions check
  const isSuperAdmin = currentSession?.type === 'super_admin' || currentSession?.role === 'main_admin' || currentSession?.isMasterPlatformAdmin === true;
  const effectiveCanAdd = canAdd !== undefined ? canAdd : (isSuperAdmin || currentSession?.subAdmin?.permissions?.polls?.canAdd !== false);
  const effectiveCanEdit = canEdit !== undefined ? canEdit : (isSuperAdmin || currentSession?.subAdmin?.permissions?.polls?.canEdit !== false);
  const effectiveCanDelete = canDelete !== undefined ? canDelete : (isSuperAdmin || currentSession?.subAdmin?.permissions?.polls?.canDelete !== false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [isSavingPoll, setIsSavingPoll] = useState(false);

  // Poll Deletion Modal State
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);
  const [isDeletingPoll, setIsDeletingPoll] = useState(false);

  const [expandedResultsId, setExpandedResultsId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PollStatus>('all');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<PollStatus>('active');
  const [isVisibleInApp, setIsVisibleInApp] = useState(true);
  const [allowVoteChange, setAllowVoteChange] = useState(true);
  const [createdBy, setCreatedBy] = useState('المكتب المسير');

  const openCreateModal = () => {
    setEditingPoll(null);
    setTitle('');
    setDescription('');
    setStatus('active');
    setIsVisibleInApp(true);
    setAllowVoteChange(true);
    setCreatedBy('المكتب المسير');
    setIsModalOpen(true);
  };

  const openEditModal = (poll: Poll) => {
    setEditingPoll(poll);
    setTitle(poll.title);
    setDescription(poll.description);
    setStatus(poll.status);
    setIsVisibleInApp(poll.isVisibleInApp);
    setAllowVoteChange(poll.allowVoteChange);
    setCreatedBy(poll.createdBy || 'المكتب المسير');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSavingPoll(true);
    try {
      if (editingPoll) {
        // Update
        const payload: Partial<Poll> = {
          title: title.trim(),
          description: description.trim(),
          status,
          isVisibleInApp,
          allowVoteChange,
          createdBy: createdBy.trim(),
        };
        const res = await apiUpdatePoll(editingPoll.id, payload, currentSession);
        const updatedPoll: Poll = res.poll || {
          ...editingPoll,
          ...payload,
        };
        const updated = polls.map((p) => (p.id === editingPoll.id ? updatedPoll : p));
        onUpdatePolls(updated);
        onAddAuditLog?.('update', `تم تعديل بيانات التصويت: "${title.trim()}"`);
        addToast?.('success', 'تم تحديث بيانات التصويت والقرار بنجاح.');
      } else {
        // Create new
        const newPollData: Partial<Poll> = {
          id: `poll-${Date.now()}`,
          title: title.trim(),
          description: description.trim(),
          createdAt: new Date().toISOString(),
          status,
          isVisibleInApp,
          allowVoteChange,
          createdBy: createdBy.trim(),
          votes: [],
        };
        const res = await apiCreatePoll(newPollData, currentSession);
        const createdPoll = res.poll || (newPollData as Poll);
        onUpdatePolls([createdPoll, ...polls]);
        onAddAuditLog?.('create', `تم إنشاء قرار وتصويت جديد: "${createdPoll.title}"`);
        addToast?.('success', 'تم إنشاء ونشر التصويت والقرار الجديد بنجاح.');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      addToast?.('error', 'حدث خطأ أثناء حفظ التصويت.');
    } finally {
      setIsSavingPoll(false);
    }
  };

  const handleDeletePoll = (poll: Poll) => {
    if (!effectiveCanDelete) {
      addToast?.('error', 'ليس لديك صلاحية أمنية لحذف التصويت والقرارات.');
      return;
    }
    setPollToDelete(poll);
  };

  const handleConfirmDeletePoll = async () => {
    if (!pollToDelete) return;
    if (!effectiveCanDelete) {
      addToast?.('error', 'ليس لديك صلاحية أمنية لحذف التصويت والقرارات.');
      return;
    }

    setIsDeletingPoll(true);
    try {
      const res = await apiDeletePoll(pollToDelete.id, currentSession);
      if (res.success) {
        const updated = polls.filter((p) => p.id !== pollToDelete.id);
        onUpdatePolls(updated);
        onAddAuditLog?.('delete', `تم حذف التصويت: "${pollToDelete.title}" بما فيه من أصوات مسجلة`);
        addToast?.('success', res.message || `تم حذف قرار وتصويت «${pollToDelete.title}» نهائياً بنجاح.`);
        setPollToDelete(null);
      } else {
        addToast?.('error', res.error || 'تعذر حذف التصويت والقرار.');
      }
    } catch (err: any) {
      addToast?.('error', 'حدث خطأ غير متوقع أثناء حذف التصويت.');
    } finally {
      setIsDeletingPoll(false);
    }
  };

  const handleToggleStatus = async (poll: Poll) => {
    const nextStatus: PollStatus = poll.status === 'active' ? 'paused' : 'active';
    try {
      await apiTogglePollStatus(poll.id, nextStatus, currentSession);
      const updated = polls.map((p) => (p.id === poll.id ? { ...p, status: nextStatus } : p));
      onUpdatePolls(updated);
      onAddAuditLog?.('update', `تم تغيير حالة التصويت "${poll.title}" إلى: ${nextStatus === 'active' ? 'نشط' : 'متوقف مؤقتا'}`);
      addToast?.('success', `تم تغيير حالة التصويت إلى: ${nextStatus === 'active' ? 'نشط' : 'متوقف مؤقتا'}`);
    } catch (err) {
      const updated = polls.map((p) => (p.id === poll.id ? { ...p, status: nextStatus } : p));
      onUpdatePolls(updated);
    }
  };

  const handleToggleVisibility = async (poll: Poll) => {
    const nextVis = !poll.isVisibleInApp;
    try {
      await apiTogglePollVisibility(poll.id, currentSession);
      const updated = polls.map((p) => (p.id === poll.id ? { ...p, isVisibleInApp: nextVis } : p));
      onUpdatePolls(updated);
      onAddAuditLog?.('update', `تم ${nextVis ? 'إظهار' : 'إخفاء'} التصويت "${poll.title}" في واجهة التطبيق`);
      addToast?.('success', nextVis ? 'تم تفعيل ظهور التصويت في واجهة الأعضاء' : 'تم إخفاء التصويت من واجهة الأعضاء');
    } catch (err) {
      const updated = polls.map((p) => (p.id === poll.id ? { ...p, isVisibleInApp: nextVis } : p));
      onUpdatePolls(updated);
    }
  };

  const handleToggleAllowChange = (poll: Poll) => {
    const updated = polls.map((p) => (p.id === poll.id ? { ...p, allowVoteChange: !p.allowVoteChange } : p));
    onUpdatePolls(updated);
    onAddAuditLog?.('update', `تم ${!poll.allowVoteChange ? 'تفعيل' : 'تعطيل'} إمكانية تغيير التصويت في "${poll.title}"`);
  };

  const filteredPolls = polls.filter((poll) => {
    const matchesSearch = 
      poll.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      poll.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || poll.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const totalPollsCount = polls.length;
  const activePollsCount = polls.filter((p) => p.status === 'active').length;
  const totalVotesAcrossAll = polls.reduce((sum, p) => sum + (p.votes?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold mb-2">
              <Vote className="w-3.5 h-3.5 text-indigo-300" />
              <span>{t.managePolls || 'إدارة التصويت والقرارات'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              {lang === 'ar' ? 'نظام القرارات وتصويت المنخرطين' : lang === 'fr' ? 'Système de vote et résolutions' : 'Resolutions & Members Voting Platform'}
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mt-1 leading-relaxed">
              {lang === 'ar' 
                ? 'إنشاء وإدارة المواضيع والقرارات المصيرية المعروضة للتصويت على المنخرطين مع تتبع فوري للأصوات المؤيدة والمعارضة والنسب المئوية.'
                : 'Créez et gérez les résolutions soumises au vote des adhérents avec suivi en direct des voix Pour / Contre et des pourcentages.'}
            </p>
          </div>

          {canAdd && (
            <div className="flex items-center gap-3">
              <button
                onClick={openCreateModal}
                id="admin-create-poll-btn"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.createNewPoll || 'إنشاء تصويت جديد'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Stats in Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-indigo-800/40">
          <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-800/50">
            <span className="text-[11px] text-indigo-300 block font-medium">إجمالي القرارات المطروحة</span>
            <span className="text-xl font-black text-white">{totalPollsCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/50">
            <span className="text-[11px] text-emerald-300 block font-medium">التصويتات النشطة حاليًا</span>
            <span className="text-xl font-black text-emerald-400">{activePollsCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-800/50 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-blue-300 block font-medium">إجمالي الأصوات المسجلة</span>
            <span className="text-xl font-black text-blue-400">{totalVotesAcrossAll} <span className="text-xs font-normal text-slate-300">صوت</span></span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchMember || 'البحث في القرارات...'}
            className="w-full ps-9 pe-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">الحالة:</span>
          {(['all', 'active', 'paused', 'closed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'الكل' : st === 'active' ? 'النشطة' : st === 'paused' ? 'المتوقفة' : 'المغلقة'}
            </button>
          ))}
        </div>
      </div>

      {/* Polls List */}
      <div className="space-y-4">
        {filteredPolls.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
            <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-base">{t.noPollsAvailable || 'لا توجد قرارات معروضة للتصويت حاليًا'}</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              يمكنك إنشاء تصويت جديد الآن لعرضه على المنخرطين وأخذ آرائهم بمصداقية وشفافية تامة.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{t.createNewPoll || 'إنشاء تصويت جديد'}</span>
            </button>
          </div>
        ) : (
          filteredPolls.map((poll) => {
            const votes = poll.votes || [];
            const totalVotes = votes.length;
            const forVotes = votes.filter((v) => v.choice === 'for').length;
            const againstVotes = votes.filter((v) => v.choice === 'against').length;
            const forPercent = totalVotes > 0 ? Math.round((forVotes / totalVotes) * 100) : 0;
            const againstPercent = totalVotes > 0 ? Math.round((againstVotes / totalVotes) * 100) : 0;
            const isExpanded = expandedResultsId === poll.id;

            return (
              <div 
                key={poll.id}
                id={`admin-poll-card-${poll.id}`}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden ${
                  poll.status === 'active' ? 'border-indigo-100 hover:border-indigo-200' : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                {/* Poll Card Header */}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Title & Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          poll.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : poll.status === 'paused'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {poll.status === 'active' ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                              <span>نشط ومفتوح للتصويت</span>
                            </>
                          ) : poll.status === 'paused' ? (
                            <>
                              <Pause className="w-3 h-3 text-amber-600" />
                              <span>متوقف مؤقتًا</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-500" />
                              <span>مغلق ومنتهي</span>
                            </>
                          )}
                        </span>

                        {/* Visibility badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          poll.isVisibleInApp 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {poll.isVisibleInApp ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          <span>{poll.isVisibleInApp ? 'ظاهر في واجهة التطبيق' : 'مخفي من الواجهة'}</span>
                        </span>

                        {/* Vote Change Permission badge */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">
                          <span>تعديل الصوت:</span>
                          <strong className={poll.allowVoteChange ? 'text-emerald-700' : 'text-slate-500'}>
                            {poll.allowVoteChange ? 'مسموح' : 'غير مسموح'}
                          </strong>
                        </span>

                        <span className="text-xs text-slate-400 flex items-center gap-1 me-auto">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(poll.createdAt).toLocaleDateString('ar-MA')}</span>
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                        {poll.title}
                      </h3>

                      {poll.description && (
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                          {poll.description}
                        </p>
                      )}
                    </div>

                    {/* Admin Actions buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0">
                      {canEdit && (
                        <>
                          <button
                            onClick={() => handleToggleStatus(poll)}
                            title={poll.status === 'active' ? 'إيقاف مؤقت للتصويت' : 'تفعيل وفتح التصويت'}
                            className={`p-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                              poll.status === 'active'
                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {poll.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            <span className="hidden sm:inline">{poll.status === 'active' ? 'إيقاف مؤقت' : 'تفعيل'}</span>
                          </button>

                          <button
                            onClick={() => handleToggleVisibility(poll)}
                            title={poll.isVisibleInApp ? 'إخفاء من التطبيق' : 'إظهار في التطبيق'}
                            className={`p-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                              poll.isVisibleInApp
                                ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            {poll.isVisibleInApp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            <span className="hidden sm:inline">{poll.isVisibleInApp ? 'إخفاء' : 'إظهار'}</span>
                          </button>

                          <button
                            onClick={() => openEditModal(poll)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="تعديل نص وبيانات التصويت"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span className="hidden sm:inline">تعديل</span>
                          </button>
                        </>
                      )}

                      {effectiveCanDelete && (
                        <button
                          id={`btn-delete-poll-${poll.id}`}
                          onClick={() => handleDeletePoll(poll)}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="حذف التصويت"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">حذف</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Results & Analytics Grid */}
                  <div className="mt-5 p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-xs sm:text-sm text-slate-800">
                          {lang === 'ar' ? 'نتائج وإحصائيات التصويت المباشرة' : 'Résultats du vote'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="text-slate-600 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>إجمالي المصوتين: <strong>{totalVotes}</strong> من أصل {members.length} منخرط</span>
                        </span>
                      </div>
                    </div>

                    {/* Percentage Progress Bar */}
                    <div className="space-y-1.5 mb-3">
                      <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                        <div 
                          style={{ width: `${forPercent}%` }} 
                          className="bg-emerald-500 h-full transition-all duration-500"
                          title={`مع: ${forVotes} (${forPercent}%)`}
                        ></div>
                        <div 
                          style={{ width: `${againstPercent}%` }} 
                          className="bg-rose-500 h-full transition-all duration-500"
                          title={`ضد: ${againstVotes} (${againstPercent}%)`}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold pt-1">
                        <div className="flex items-center gap-1.5 text-emerald-700">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>مع: {forVotes} صوت ({forPercent}%)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-rose-700">
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>ضد: {againstVotes} صوت ({againstPercent}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Voter Breakdown Toggle */}
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <button
                        onClick={() => setExpandedResultsId(isExpanded ? null : poll.id)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span>{isExpanded ? 'إخفاء لائحة المصوتين' : `عرض تفاصيل وسجل المصوتين (${totalVotes})`}</span>
                      </button>

                      <span className="text-[11px] text-slate-400">
                        {poll.allowVoteChange ? 'يمكن للمنخرط تعديل صوته' : 'التصويت نهائي ومقفل'}
                      </span>
                    </div>

                    {/* Detailed Voters Participation List (Preserves Individual Ballot Privacy) */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                        {votes.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-2">لم يقم أي عضو بالتصويت بعد على هذا القرار.</p>
                        ) : (
                          <div className="max-h-60 overflow-y-auto space-y-1.5 pe-1">
                            {votes.map((v, idx) => (
                              <div 
                                key={idx} 
                                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-600 text-[11px] px-1.5 py-0.5 bg-slate-100 rounded">
                                    {v.memberCode || 'عضو'}
                                  </span>
                                  <span className="font-bold text-slate-800">{v.memberName}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(v.votedAt).toLocaleString('ar-MA', { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <Lock className="w-3 h-3 text-emerald-600" />
                                    <span>صوت سري موثق</span>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create or Edit Poll */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                  <Vote className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {editingPoll ? (t.editPoll || 'تعديل بيانات التصويت') : (t.createNewPoll || 'إنشاء تصويت وقرار جديد')}
                  </h3>
                  <p className="text-xs text-indigo-200">
                    {editingPoll ? 'تحديث نص وموضوع القرار أو تغيير حالة الإتاحة' : 'طرح قرار جديد للتصويت الديمقراطي للمنخرطين'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Title / Topic */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.pollTitle || 'موضوع أو نص قرار التصويت'} <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.pollTitlePlaceholder || 'اكتب موضوع أو قرار التصويت بوضوح ودقة...'}
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Description / Context */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.pollDescription || 'تفاصيل ومبررات القرار'}
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.pollDescriptionPlaceholder || 'أدخل خلفية وسياق القرار ومبرراته وتكاليفه المقترحة للمنخرطين...'}
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Author / Originator */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الجهة المقترحة للقرار
                </label>
                <input
                  type="text"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  placeholder="مثال: المكتب التنفيذي، لجنة المالية، الجمع العام..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Status and Configuration Toggles */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs text-slate-800">خيارات وإعدادات التصويت</h4>

                {/* Status Selector */}
                <div className="grid grid-cols-3 gap-2">
                  {(['active', 'paused', 'closed'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`p-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                        status === st
                          ? st === 'active'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : st === 'paused'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-700 text-white border-slate-700'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st === 'active' ? 'نشط' : st === 'paused' ? 'متوقف' : 'مغلق'}
                    </button>
                  ))}
                </div>

                {/* Visibility Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {t.pollVisibility || 'إظهار التصويت في واجهة التطبيق'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      عند التفعيل، سيظهر هذا التصويت للمنخرطين أسفل سجل المنخرطين
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsVisibleInApp(!isVisibleInApp)}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                      isVisibleInApp ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        isVisibleInApp ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Allow Vote Change Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {t.pollAllowChange || 'السماح للمنخرط بتغيير صوته'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {t.pollAllowChangeDesc || 'تمكين المنخرط من تعديل موقفه (مع / ضد) في أي وقت قبل إغلاق التصويت'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowVoteChange(!allowVoteChange)}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                      allowVoteChange ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        allowVoteChange ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors"
                >
                  {t.cancel || 'إلغاء'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-900/30 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingPoll ? (t.save || 'حفظ التعديلات') : (t.createNewPoll || 'إنشاء ونشر التصويت')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POLL DELETION CONFIRMATION MODAL (حذف التصويت والقرار نهائياً)
          ========================================================================= */}
      {pollToDelete && (
        <div
          id="modal-delete-poll-confirm"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          dir="rtl"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
                  <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    تأكيد حذف القرار والتصويت
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    حذف نهائي من قاعدة بيانات الجمعية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingPoll) setPollToDelete(null);
                }}
                disabled={isDeletingPoll}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Target Poll Info */}
            <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-2">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300">عنوان القرار المستهدف:</span>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                «{pollToDelete.title}»
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-rose-200/50 dark:border-rose-900/40">
                <div>
                  عدد الأصوات المسجلة: <span className="font-bold text-indigo-600 dark:text-indigo-400">{pollToDelete.votes?.length || 0} صوت</span>
                </div>
                <div>
                  الحالة: <span className="font-bold text-slate-700 dark:text-slate-300">{pollToDelete.status === 'active' ? 'نشط' : pollToDelete.status === 'paused' ? 'متوقف مؤقتاً' : 'مغلق'}</span>
                </div>
              </div>
            </div>

            {/* Warning Note */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1.5 text-right">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>تحذير لا رجعة فيه</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                سيتم حذف هذا القرار والتصويت وكافة الأصوات والخيارات المسجلة فيه نهائياً من قاعدة بيانات الجمعية، ولن يظهر بعد الآن في تطبيق المنخرطين أو لوحة التحكم.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-poll"
                onClick={() => {
                  if (!isDeletingPoll) setPollToDelete(null);
                }}
                disabled={isDeletingPoll}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء التراجع
              </button>

              <button
                type="button"
                id="btn-confirm-delete-poll"
                onClick={handleConfirmDeletePoll}
                disabled={isDeletingPoll}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingPoll ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>نعم، حذف نهائي</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
