import React, { useState, useMemo } from 'react';
import { 
  Vote, 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Lock, 
  Unlock, 
  Check, 
  UserCheck, 
  Clock, 
  ChevronDown,
  ShieldAlert,
  LogIn,
  UserPlus,
  Award,
  ShieldCheck
} from 'lucide-react';
import { Poll, PollVote, VoteChoice, Member, BoardMember, Language, UserRole, CurrentAdminSession } from '../types';
import { translations } from '../translations';
import { VOTING_RESTRICTED_MESSAGE } from '../storage';

interface MemberVotingSectionProps {
  polls: Poll[];
  members: Member[];
  boardMembers?: BoardMember[];
  loggedInMember?: Member | null;
  role?: UserRole;
  currentAdminSession?: CurrentAdminSession | null;
  activeTenantId?: string;
  onVote: (pollId: string, vote: PollVote) => void;
  onRequestMemberLogin?: () => void;
  onRequestRegisterMember?: () => void;
  lang: Language;
  customTitle?: string;
  customDescription?: string;
}

export const MemberVotingSection: React.FC<MemberVotingSectionProps> = ({
  polls,
  members,
  boardMembers = [],
  loggedInMember = null,
  role = 'member',
  currentAdminSession = null,
  activeTenantId = 'tenant_nour',
  onVote,
  onRequestMemberLogin,
  onRequestRegisterMember,
  lang,
  customTitle,
  customDescription,
}) => {
  const t = translations[lang];

  // Resolve board members for this association (when logged in as association board / admin)
  const resolvedBoardVoters = useMemo(() => {
    const list = (boardMembers || []).map((bm) => {
      const linkedMember = (members || []).find((m) => m.id === bm.memberId);
      return {
        id: linkedMember?.id || bm.memberId || bm.id,
        memberCode: linkedMember?.memberCode || `BOARD-${bm.order || 1}`,
        fullName: linkedMember?.fullName || bm.roleAr,
        roleAr: bm.roleAr,
        status: linkedMember ? linkedMember.status : 'active',
      };
    }).filter((b) => b.status === 'active');

    if (list.length === 0 && role === 'admin' && currentAdminSession) {
      list.push({
        id: currentAdminSession.id || 'board_admin',
        memberCode: 'BOARD-EXEC',
        fullName: currentAdminSession.fullName || 'عضو مكتب الجمعية',
        roleAr: 'عضو مكتب الجمعية',
        status: 'active',
      });
    }
    return list;
  }, [boardMembers, members, role, currentAdminSession]);

  const [selectedBoardVoterId, setSelectedBoardVoterId] = useState<string>('');
  const [isBoardDropdownOpen, setIsBoardDropdownOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    pollId: string;
    text: string;
    type: 'success' | 'warning' | 'info';
  } | null>(null);

  // 1. Check if current user is an authenticated active Member of THIS association
  const verifiedLoggedInMember = useMemo(() => {
    if (!loggedInMember) return null;
    const match = (members || []).find(
      (m) =>
        (m.id === loggedInMember.id || (m.memberCode && m.memberCode === loggedInMember.memberCode)) &&
        m.status === 'active'
    );
    return match || null;
  }, [loggedInMember, members]);

  // Check if the logged-in member is also a Board Member of this association
  const loggedInMemberBoardEntry = useMemo(() => {
    if (!verifiedLoggedInMember) return null;
    return (boardMembers || []).find(
      (bm) => bm.memberId === verifiedLoggedInMember.id || bm.id === verifiedLoggedInMember.id
    ) || null;
  }, [verifiedLoggedInMember, boardMembers]);

  // 2. Check if current user is logged in as a Board Member / Association Admin for THIS association
  const isBoardAdminForThisAssociation = useMemo(() => {
    if (role !== 'admin' || !currentAdminSession) return false;
    const cleanActive = !activeTenantId || activeTenantId === 'portal' ? 'tenant_nour' : activeTenantId;
    const adminTenant = currentAdminSession.tenantId || (currentAdminSession.subAdmin as any)?.tenantId;
    if (!adminTenant || adminTenant === 'portal') {
      return cleanActive === 'tenant_nour' || currentAdminSession.isMasterPlatformAdmin === true;
    }
    return adminTenant === cleanActive || currentAdminSession.isMasterPlatformAdmin === true;
  }, [role, currentAdminSession, activeTenantId]);

  // Resolve the active voter identity (ONLY if authenticated as a registered member or board member of this association)
  const activeVoter = useMemo(() => {
    if (verifiedLoggedInMember) {
      return {
        id: verifiedLoggedInMember.id,
        memberCode: verifiedLoggedInMember.memberCode,
        fullName: verifiedLoggedInMember.fullName,
        voterRoleLabel: loggedInMemberBoardEntry
          ? `عضو مكتب الجمعية (${loggedInMemberBoardEntry.roleAr})`
          : 'منخرط مسجل بالجمعية',
        isBoardMember: !!loggedInMemberBoardEntry,
      };
    }

    if (isBoardAdminForThisAssociation && resolvedBoardVoters.length > 0) {
      const matchedByAdminName = currentAdminSession?.fullName
        ? resolvedBoardVoters.find((b) =>
            currentAdminSession.fullName.includes(b.fullName) || b.fullName.includes(currentAdminSession.fullName)
          )
        : undefined;
      const chosen =
        resolvedBoardVoters.find((b) => b.id === selectedBoardVoterId) ||
        matchedByAdminName ||
        resolvedBoardVoters[0];

      if (chosen) {
        return {
          id: chosen.id,
          memberCode: chosen.memberCode,
          fullName: chosen.fullName,
          voterRoleLabel: `عضو مكتب الجمعية (${chosen.roleAr})`,
          isBoardMember: true,
        };
      }
    }

    return null;
  }, [
    verifiedLoggedInMember,
    loggedInMemberBoardEntry,
    isBoardAdminForThisAssociation,
    resolvedBoardVoters,
    selectedBoardVoterId,
    currentAdminSession,
  ]);

  const isAuthorizedVoter = !!activeVoter;

  const handleCastVote = (poll: Poll, choice: VoteChoice) => {
    // Strict Front-End Authorization Check: Block visitors and non-members
    if (!isAuthorizedVoter || !activeVoter) {
      setFeedbackMessage({
        pollId: poll.id,
        text: VOTING_RESTRICTED_MESSAGE,
        type: 'warning',
      });
      return;
    }

    if (poll.status !== 'active') {
      setFeedbackMessage({
        pollId: poll.id,
        text: t.pollPausedNotice || 'هذا التصويت متوقف مؤقتًا حاليًا من قبل الإدارة.',
        type: 'warning',
      });
      return;
    }

    const existingVote = poll.votes?.find(
      (v) => v.memberId === activeVoter.id || (activeVoter.memberCode && v.memberCode === activeVoter.memberCode)
    );

    if (existingVote && !poll.allowVoteChange) {
      setFeedbackMessage({
        pollId: poll.id,
        text: t.voteCannotChangeNotice || 'تم تسجيل تصويتك مسبقًا، والإدارة لا تسمح بتغيير الصوت لهذا القرار.',
        type: 'warning',
      });
      return;
    }

    const newVote: PollVote = {
      memberId: activeVoter.id,
      memberCode: activeVoter.memberCode,
      memberName: activeVoter.fullName,
      choice,
      votedAt: new Date().toISOString(),
    };

    onVote(poll.id, newVote);

    setFeedbackMessage({
      pollId: poll.id,
      text: existingVote 
        ? (t.voteUpdatedSuccess || 'تم تعديل تصويتك بنجاح وبخصوصية تامة!') 
        : (t.voteSubmittedSuccess || 'تم تسجيل تصويتك بنجاح وبشكل سري وآمن!'),
      type: 'success',
    });

    // Auto-clear feedback after 4 seconds
    setTimeout(() => {
      setFeedbackMessage((prev) => (prev?.pollId === poll.id ? null : prev));
    }, 4000);
  };

  // Filter visible polls for public view
  const visiblePolls = polls.filter((p) => p.isVisibleInApp);

  if (visiblePolls.length === 0) {
    return (
      <div id="member-voting-section" className="mt-8 pt-6 border-t-2 border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-950 text-white shadow-sm border border-emerald-900/40">
          <div className="space-y-1 text-center sm:text-start rtl:sm:text-right">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-1">
              <Vote className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'التصويت على القرارات' : lang === 'fr' ? 'Votes & Résolutions' : 'Polls & Resolutions'}</span>
            </div>
            <h3 className="font-bold text-base text-white">
              {lang === 'ar' ? 'منصة تصويت أعضاء مكتب الجمعية والمنخرطين على القرارات' : lang === 'fr' ? 'Plateforme de vote des adhérents' : 'Member Resolutions Voting'}
            </h3>
            <p className="text-xs text-slate-300 max-w-xl">
              {lang === 'ar'
                ? 'لا توجد قرارات معروضة للتصويت حاليًا. سيتم إدراج القرارات والمشاريع الجديدة فور اعتمادها من قبل المكتب المسير للجمعية.'
                : 'Aucune résolution n\'est actuellement ouverte au vote. Les prochains projets y seront publiés.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="member-voting-section" className="mt-8 pt-6 border-t-2 border-slate-200/80 space-y-6">
      {/* Section Header & Voter Eligibility Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold mb-1">
            <Vote className="w-3.5 h-3.5" />
            <span>{t.polls || 'التصويت على القرارات'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>{customTitle || (lang === 'ar' ? 'التصويت على القرارات' : lang === 'fr' ? 'Décisions soumises au vote des adhérents' : 'Resolutions Open for Member Voting')}</span>
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
            {customDescription || (lang === 'ar'
              ? 'حق التصويت متاح حصريًا لأعضاء مكتب الجمعية والمنخرطين المسجلين فيها مع ضمان السرية التامة للأصوات وسلامة النتائج.'
              : 'Votre avis compte ! Exprimez votre vote (Pour ou Contre) sur les résolutions de l\'association.')}
          </p>
        </div>

        {/* Voter Identity & Authorization Card */}
        <div className="relative z-10 w-full lg:w-96 shrink-0">
          {isAuthorizedVoter && activeVoter ? (
            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-emerald-400/30 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-emerald-300 font-bold text-[11px] flex items-center gap-1.5">
                  {activeVoter.isBoardMember ? (
                    <Award className="w-4 h-4 text-amber-400" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>{activeVoter.voterRoleLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>عضوية موثقة</span>
                </span>
              </div>

              {/* If logged in via general board admin session and multiple board members exist, allow selecting which board member of the office is voting */}
              {!verifiedLoggedInMember && isBoardAdminForThisAssociation && resolvedBoardVoters.length > 1 ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsBoardDropdownOpen(!isBoardDropdownOpen)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white text-slate-900 font-bold text-xs shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 overflow-hidden text-start">
                      <span className="font-mono text-[11px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                        {activeVoter.memberCode}
                      </span>
                      <span className="truncate">{activeVoter.fullName}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ms-1" />
                  </button>

                  {isBoardDropdownOpen && (
                    <div className="absolute start-0 end-0 top-full mt-1.5 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 p-2 z-50 max-h-56 overflow-y-auto space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 px-2 py-1">
                        اختر عضو مكتب الجمعية المصوّت:
                      </p>
                      {resolvedBoardVoters.map((bv) => {
                        const isSelected = bv.id === activeVoter.id;
                        return (
                          <button
                            key={bv.id}
                            type="button"
                            onClick={() => {
                              setSelectedBoardVoterId(bv.id);
                              setIsBoardDropdownOpen(false);
                            }}
                            className={`w-full text-start p-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="font-mono text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                {bv.roleAr}
                              </span>
                              <span className="truncate">{bv.fullName}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/95 text-slate-900 font-bold text-xs shadow-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-mono text-[11px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                      {activeVoter.memberCode}
                    </span>
                    <span className="truncate">{activeVoter.fullName}</span>
                  </div>
                  <span title="صوتك سري ومرتبط بحسابك الموثق" className="shrink-0">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  </span>
                </div>
              )}

              <p className="text-[10px] text-emerald-200/90 flex items-center gap-1">
                <Lock className="w-3 h-3 shrink-0" />
                <span>يُسجَّل صوتك بشكل سري وموثق ولا يُسمح بالتصويت إلا لمرة واحدة لكل عضو.</span>
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/15 backdrop-blur-md border border-amber-400/40 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <p className="text-amber-100 font-bold leading-relaxed text-xs">
                  {VOTING_RESTRICTED_MESSAGE}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onRequestMemberLogin && (
                  <button
                    type="button"
                    onClick={onRequestMemberLogin}
                    className="flex-1 py-2 px-3 rounded-lg bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-[11px] flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-emerald-700" />
                    <span>تسجيل دخول الأعضاء</span>
                  </button>
                )}
                {onRequestRegisterMember && (
                  <button
                    type="button"
                    onClick={onRequestRegisterMember}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>الانخراط في الجمعية</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* List of Polls */}
      <div className="grid grid-cols-1 gap-6">
        {visiblePolls.map((poll) => {
          const votes = poll.votes || [];
          const totalVotes = votes.length;
          const forVotes = votes.filter((v) => v.choice === 'for').length;
          const againstVotes = votes.filter((v) => v.choice === 'against').length;
          const forPercent = totalVotes > 0 ? Math.round((forVotes / totalVotes) * 100) : 0;
          const againstPercent = totalVotes > 0 ? Math.round((againstVotes / totalVotes) * 100) : 0;

          // Check if current authenticated member/board member voted
          const memberVote =
            isAuthorizedVoter && activeVoter
              ? votes.find(
                  (v) =>
                    v.memberId === activeVoter.id ||
                    (activeVoter.memberCode && v.memberCode === activeVoter.memberCode)
                )
              : null;

          const isPaused = poll.status === 'paused';
          const isClosed = poll.status === 'closed';
          const canVote =
            isAuthorizedVoter &&
            poll.status === 'active' &&
            (!memberVote || poll.allowVoteChange);

          const currentFeedback = feedbackMessage?.pollId === poll.id ? feedbackMessage : null;

          return (
            <div
              key={poll.id}
              id={`member-poll-item-${poll.id}`}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden"
            >
              {/* Poll Header */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      poll.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : isPaused
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {poll.status === 'active' ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
                          <span>مفتوح للتصويت</span>
                        </>
                      ) : isPaused ? (
                        <span>تصويت متوقف مؤقتًا</span>
                      ) : (
                        <span>تصويت مغلق</span>
                      )}
                    </span>

                    {poll.createdBy && (
                      <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2.5 py-0.5 rounded-full">
                        مقترح من: {poll.createdBy}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>تاريخ الطرح: {new Date(poll.createdAt).toLocaleDateString('ar-MA')}</span>
                  </div>
                </div>

                {/* Poll Topic & Context */}
                <div className="space-y-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                    {poll.title}
                  </h3>
                  {poll.description && (
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {poll.description}
                    </p>
                  )}
                </div>

                {/* Live Voting Progress Bar (Aggregate Only - Preserves Individual Vote Privacy) */}
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-800">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>{t.totalVoters || 'إجمالي المصوتين'}: <strong className="font-black text-slate-950">{totalVotes}</strong> عضو</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>تصويت سري وموثق</span>
                    </span>
                  </div>

                  {/* Dual color progress bar */}
                  <div className="h-3.5 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                    <div
                      style={{ width: `${forPercent}%` }}
                      className="bg-emerald-500 h-full transition-all duration-500 relative"
                      title={`مع: ${forVotes} (${forPercent}%)`}
                    ></div>
                    <div
                      style={{ width: `${againstPercent}%` }}
                      className="bg-rose-500 h-full transition-all duration-500 relative"
                      title={`ضد: ${againstVotes} (${againstPercent}%)`}
                    ></div>
                  </div>

                  {/* Results labels */}
                  <div className="flex items-center justify-between text-xs font-bold pt-1">
                    <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>المؤيدون (مع): {forVotes} ({forPercent}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200/60">
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span>المعارضون (ضد): {againstVotes} ({againstPercent}%)</span>
                    </div>
                  </div>
                </div>

                {/* Feedback Toast if any */}
                {currentFeedback && (
                  <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in ${
                    currentFeedback.type === 'success' 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : 'bg-amber-50 text-amber-900 border border-amber-300'
                  }`}>
                    {currentFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{currentFeedback.text}</span>
                  </div>
                )}

                {/* Authenticated Member Vote Status Badge */}
                {isAuthorizedVoter && memberVote && (
                  <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <span className="text-slate-600">تصويتك المسجل باسم ({activeVoter?.fullName}): </span>
                        <strong className={`font-black ms-1 ${
                          memberVote.choice === 'for' ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {memberVote.choice === 'for' ? '«موافق ومؤيد (مع القرار)»' : '«غير موافق (ضد القرار)»'}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      {poll.allowVoteChange ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <Unlock className="w-3 h-3" />
                          <span>يمكنك تعديل صوتك أدناه</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Lock className="w-3 h-3" />
                          <span>التصويت معتمد ومقفل</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Interactive Voting Area */}
                <div className="pt-2">
                  {isClosed ? (
                    <div className="p-3 text-center bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
                      تم إغلاق هذا التصويت نهائيًا واعتماد النتائج المعلنة أعلاه.
                    </div>
                  ) : isPaused ? (
                    <div className="p-3 text-center bg-amber-50 rounded-xl text-xs font-bold text-amber-800 border border-amber-200">
                      التصويت متوقف مؤقتًا من قبل إدارة الجمعية.
                    </div>
                  ) : !isAuthorizedVoter ? (
                    /* Visitor & Non-Member Restriction Notice */
                    <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 space-y-3">
                      <div className="flex items-start gap-2.5 text-amber-900">
                        <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm font-bold leading-relaxed">
                            {VOTING_RESTRICTED_MESSAGE}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        {onRequestMemberLogin && (
                          <button
                            type="button"
                            onClick={onRequestMemberLogin}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>تسجيل دخول عضو المكتب / المنخرط</span>
                          </button>
                        )}
                        {onRequestRegisterMember && (
                          <button
                            type="button"
                            onClick={onRequestRegisterMember}
                            className="px-4 py-2 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>طلب الانخراط في الجمعية</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1">
                        <span>حدد موقفك وصوّت الآن:</span>
                        <span className="text-[11px] font-normal text-slate-400">
                          {memberVote && poll.allowVoteChange ? 'اختر للتبديل' : 'صوت واحد لكل عضو'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Vote FOR Button */}
                        <button
                          type="button"
                          onClick={() => handleCastVote(poll, 'for')}
                          disabled={!canVote}
                          className={`p-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm cursor-pointer ${
                            memberVote?.choice === 'for'
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-200 shadow-md scale-[1.01]'
                              : canVote
                              ? 'bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border-2 border-emerald-300 hover:border-emerald-600 active:scale-95'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <ThumbsUp className={`w-5 h-5 ${memberVote?.choice === 'for' ? 'text-white' : 'text-emerald-600'}`} />
                          <span>{t.voteFor || 'مع القرار'}</span>
                          {memberVote?.choice === 'for' && <Check className="w-4 h-4 ms-1" />}
                        </button>

                        {/* Vote AGAINST Button */}
                        <button
                          type="button"
                          onClick={() => handleCastVote(poll, 'against')}
                          disabled={!canVote}
                          className={`p-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm cursor-pointer ${
                            memberVote?.choice === 'against'
                              ? 'bg-rose-600 text-white ring-4 ring-rose-200 shadow-md scale-[1.01]'
                              : canVote
                              ? 'bg-rose-50 hover:bg-rose-600 text-rose-800 hover:text-white border-2 border-rose-300 hover:border-rose-600 active:scale-95'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <ThumbsDown className={`w-5 h-5 ${memberVote?.choice === 'against' ? 'text-white' : 'text-rose-600'}`} />
                          <span>{t.voteAgainst || 'ضد القرار'}</span>
                          {memberVote?.choice === 'against' && <Check className="w-4 h-4 ms-1" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
