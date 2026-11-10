import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Award, 
  Crown, 
  Briefcase, 
  Phone, 
  Mail, 
  Calendar, 
  Search, 
  ShieldCheck, 
  User, 
  CheckCircle2, 
  MessageCircle,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Users,
  Sparkles
} from 'lucide-react';
import { BoardMember, Member, AssociationSettings, Language, UserRole } from '../types';
import { translations } from '../translations';
import { BackToHomeButton } from './BackToHomeButton';

interface BoardMembersPageProps {
  boardMembers: BoardMember[];
  members: Member[];
  settings: AssociationSettings;
  lang: Language;
  role?: UserRole;
  onBack: () => void;
}

export const BoardMembersPage: React.FC<BoardMembersPageProps> = ({
  boardMembers = [],
  members = [],
  settings,
  lang,
  role = 'user',
  onBack,
}) => {
  const t = translations[lang] as any;
  const [searchQuery, setSearchQuery] = useState('');

  // Sorted by order (1, 2, 3...)
  const sortedBoardMembers = [...(boardMembers || [])]
    .sort((a, b) => a.order - b.order)
    .filter((bm) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const linked = (members || []).find((m) => m.id === bm.memberId);
      const name = linked?.fullName.toLowerCase() || '';
      const code = linked?.memberCode.toLowerCase() || '';
      const roleName = bm.roleAr.toLowerCase();
      return name.includes(q) || (role === 'admin' && code.includes(q)) || roleName.includes(q);
    });

  const isRtl = lang === 'ar';
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Back Navigation Bar */}
      <BackToHomeButton
        onBack={onBack}
        lang={lang}
        currentPageTitle="أعضاء مكتب الجمعية"
        id="back-to-home-from-board-btn"
      />

      {/* Hero / Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-6 sm:p-8 lg:p-10 shadow-xl">
        {/* Subtle background glow decorative elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              <Award className="w-4 h-4" />
              <span>الهيئة التنفيذية والتدبيرية</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex flex-wrap items-center gap-3">
              <span>{t.boardMembersTitle || 'أعضاء مكتب الجمعية'}</span>
              <span className="text-xs sm:text-sm font-bold px-3 py-1 rounded-xl bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-mono">
                {boardMembers.length} أعضاء مسيرين
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t.boardMembersDesc || 'تشكيلة المكتب المسير للجمعية وتوزيع المهام والمسؤوليات الإدارية والتنفيذية وفق مقتضيات القانون الأساسي ومحاضر الجموع العامة.'}
            </p>
          </div>

          {/* Quick Search */}
          <div className="w-full md:w-80">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 rtl:left-auto rtl:right-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم أو المنصب..."
                className="w-full bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder-slate-400 rounded-2xl py-2.5 px-10 text-xs sm:text-sm border border-white/20 focus:border-emerald-500 outline-hidden transition-all backdrop-blur-xs"
              />
            </div>
            {searchQuery && (
              <p className="text-[11px] text-slate-300 mt-1.5 px-1">
                نتائج البحث: {sortedBoardMembers.length} من أصل {boardMembers.length}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Board Members Cards */}
      {sortedBoardMembers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {sortedBoardMembers.map((bm, index) => {
            const linkedMember = (members || []).find((m) => m.id === bm.memberId);
            const isPresident = bm.roleAr.includes('رئيس الجمعية') && !bm.roleAr.includes('نائب');
            const isVicePresident = bm.roleAr.includes('نائب الرئيس');
            const isGeneralSecretary = bm.roleAr.includes('الكاتب العام');
            const isTreasurer = bm.roleAr.includes('أمين المال');

            // Format Role text according to lang
            const roleTitle = lang === 'fr' 
              ? (bm.roleFr || bm.roleAr) 
              : lang === 'en' 
              ? (bm.roleEn || bm.roleAr) 
              : bm.roleAr;

            return (
              <motion.div
                key={bm.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.05 }}
                className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden bg-white shadow-xs hover:shadow-md ${
                  isPresident
                    ? 'border-amber-300 ring-2 ring-amber-400/20'
                    : isVicePresident || isGeneralSecretary || isTreasurer
                    ? 'border-emerald-200 hover:border-emerald-400'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Card Top Header / Badge */}
                <div
                  className={`px-4 py-2.5 flex items-center justify-between text-xs font-bold ${
                    isPresident
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
                      : isTreasurer || isGeneralSecretary || isVicePresident
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white'
                      : 'bg-slate-100 text-slate-700 border-b border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isPresident ? (
                      <Crown className="w-4 h-4 text-amber-100 animate-pulse" />
                    ) : (
                      <Award className="w-3.5 h-3.5 opacity-90" />
                    )}
                    <span className="tracking-wide">{roleTitle}</span>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs font-mono">
                    الترتيب #{bm.order}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4 flex-1">
                  {/* Avatar & Name Info */}
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      {linkedMember?.avatarUrl ? (
                        <img
                          src={linkedMember.avatarUrl}
                          alt={linkedMember.fullName}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/30 shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-900 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                          {linkedMember?.fullName ? linkedMember.fullName.charAt(0).toUpperCase() : <User className="w-7 h-7" />}
                        </div>
                      )}

                      {/* Online/Active status dot */}
                      {linkedMember?.status === 'active' && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                          <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-900 text-base leading-tight truncate">
                        {linkedMember?.fullName || 'عضو المكتب'}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        {/* Member code shown ONLY for admin */}
                        {role === 'admin' && linkedMember?.memberCode && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono text-[11px] font-bold border border-emerald-200">
                            {linkedMember.memberCode}
                          </span>
                        )}
                        {linkedMember?.status === 'active' && (
                          <span className="text-[10px] text-emerald-600 font-bold">
                            • منخرط نشط
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Role in other languages if exists */}
                  {lang === 'ar' && (bm.roleFr || bm.roleEn) && (
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">الصفة باللاتينية:</span>
                      <span className="font-medium text-slate-600">{bm.roleFr || bm.roleEn}</span>
                    </div>
                  )}

                  {/* Joined Date */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>تاريخ التعيين / الانضمام:</span>
                    <span className="font-semibold text-slate-700">{bm.appointedDate || (bm as any).appointedAt || linkedMember?.joinDate || '---'}</span>
                  </div>
                </div>

                {/* Card Footer (Direct contact buttons and icons hidden from public interface) */}
                <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px] text-slate-500 font-medium">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>عضو معتمد بالمكتب المسير</span>
                  </span>
                  <span>الهيئة التنفيذية</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">
            {searchQuery ? 'لم يتم العثور على نتائج للبحث' : 'لا يوجد أعضاء مضافون في المكتب المسير حالياً'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? 'يرجى تجربة البحث بكلمات أخرى أو التحقق من صحة الاسم والمنصب.'
              : 'يمكن للأدمن تعيين أعضاء المكتب وتوزيع المهام من خلال لوحة التحكم الإدارية.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              مسح البحث
            </button>
          )}
        </div>
      )}

      {/* Bottom Back Button */}
      <div className="pt-4 flex justify-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
        >
          <BackArrow className="w-4 h-4" />
          <span>الرجوع إلى واجهة المتجر الرئيسية</span>
        </button>
      </div>
    </div>
  );
};
