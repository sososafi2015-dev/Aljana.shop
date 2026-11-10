import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  Calendar, 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  Save, 
  Camera, 
  Trash2, 
  LogOut, 
  FileText, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Vote, 
  Clock, 
  Coins, 
  Receipt,
  Sparkles,
  Smartphone,
  FolderOpen,
  PlusCircle,
  PenTool,
  Check,
  ArrowRight,
  TrendingUp,
  Download,
  Printer
} from 'lucide-react';
import { Member, Language, FinancialOperation, Poll, PollVote, MemberContribution, ContributionCategory, PaymentMethodType, ContributionStatus } from '../types';
import { translations } from '../translations';
import { hashPasswordWithSalt, generateSalt, verifyMemberPassword } from '../security';
import { BackToHomeButton } from './BackToHomeButton';
import { getStoredDonationPresets } from '../storage';
import { ensurePermanentImageUrl } from '../api/imageApi';

interface MyAccountSectionProps {
  member: Member;
  allOperations: FinancialOperation[];
  contributions?: MemberContribution[];
  polls: Poll[];
  lang: Language;
  onUpdateProfile: (updatedData: Partial<Member>) => void;
  onChangePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  onAddContribution?: (contribution: Omit<MemberContribution, 'id' | 'createdAt'>) => Promise<{ success: boolean; message: string; contribution?: MemberContribution }>;
  onLogout: () => void;
  onPrintMemberCard: (member: Member) => void;
  onVote: (pollId: string, vote: PollVote) => void;
  onOpenReceiptModal?: (op: FinancialOperation) => void;
  setActiveTab: (tab: string) => void;
}

/**
 * Image compression utility for direct phone gallery upload
 */
const compressAvatar = (file: File, maxWidth = 400, maxHeight = 400, quality = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('الملف المختار ليس صورة صالحة'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('تعذر معالجة الصورة'));

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('تعذر قراءة الصورة'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
};

export const MyAccountSection: React.FC<MyAccountSectionProps> = ({
  member,
  allOperations,
  contributions = [],
  polls,
  lang,
  onUpdateProfile,
  onChangePassword,
  onAddContribution,
  onLogout,
  onPrintMemberCard,
  onVote,
  onOpenReceiptModal,
  setActiveTab,
}) => {
  const t = translations[lang] as any;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Contribution State
  const [selectedPreset, setSelectedPreset] = useState<number | 'other'>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [contributionCategory, setContributionCategory] = useState<ContributionCategory>('membership_fee');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('bank_transfer');
  const [notes, setNotes] = useState<string>('');
  const [contributionMessage, setContributionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);

  // All Contributions Ledger Controls
  const [showContributionsHistory, setShowContributionsHistory] = useState<boolean>(false);
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState<string>('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('all');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<string>('all');

  // Profile Form State
  const [fullName, setFullName] = useState(member.fullName || '');
  const [phone, setPhone] = useState(member.phone || '');
  const [email, setEmail] = useState(member.email || '');
  const [cin, setCin] = useState(member.cin || '');
  const [avatarUrl, setAvatarUrl] = useState(member.avatarUrl || '');
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Filter operations and contributions related to this member
  const memberOperations = allOperations.filter(
    (op) => op.memberId === member.id || (op.memberName && op.memberName.trim().toLowerCase() === member.fullName.trim().toLowerCase())
  );
  
  const memberContributionsList = contributions.filter(
    (c) => c.memberId === member.id || (c.memberName && c.memberName.trim().toLowerCase() === member.fullName.trim().toLowerCase())
  );

  // Sort contributions from newest to oldest automatically
  const sortedMemberContributions = [...memberContributionsList].sort(
    (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
  );

  // Filtered list for the ledger section
  const filteredMemberContributions = sortedMemberContributions.filter((c) => {
    const matchesCat = ledgerCategoryFilter === 'all' || 
      (ledgerCategoryFilter === 'membership_fee' && (c.category === 'membership_fee' || (c.category as string) === 'annual_renewal')) ||
      (ledgerCategoryFilter === 'donation' && (c.category === 'donation' || (c.category as string) === 'donation_support')) ||
      (ledgerCategoryFilter === 'project_support' && (c.category === 'project_support' || (c.category as string) === 'initiative_proposal' || (c.category as string) === 'initiative_with_contribution')) ||
      (ledgerCategoryFilter === 'charity_zakat' && (c.category === 'charity_zakat' || c.category === 'other')) ||
      (ledgerCategoryFilter === 'initiative_idea' && (c.category as string) === 'initiative_idea');

    const matchesStatus =
      ledgerStatusFilter === 'all' ||
      c.status === ledgerStatusFilter ||
      ((ledgerStatusFilter === 'approved' || ledgerStatusFilter === 'unpaid') &&
        (c.status === 'approved' || c.status === 'unpaid'));

    const query = ledgerSearchQuery.trim().toLowerCase();
    const matchesSearch = !query || 
      (c.notes && c.notes.toLowerCase().includes(query)) ||
      (c.id && c.id.toLowerCase().includes(query)) ||
      (c.date && c.date.toLowerCase().includes(query)) ||
      (c.amount && c.amount.toString().includes(query)) ||
      (c.financialOperationId && c.financialOperationId.toLowerCase().includes(query));

    return matchesCat && matchesStatus && matchesSearch;
  });

  const completedMemberContributions = memberContributionsList.filter(
    (c) => c.status === 'completed' || !c.status
  );
  const totalContributionsAmount = completedMemberContributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalMemberPayments = memberOperations.reduce((sum, op) => sum + (op.type === 'income' ? op.amount : -op.amount), 0) + (memberContributionsList.length > 0 ? 0 : 0);
  const effectivePaidFee = totalContributionsAmount > 0 ? totalContributionsAmount : (Number(member.annualFee) || 0);

  // Category resolver helper
  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case 'membership_fee':
      case 'annual_renewal':
        return { 
          label: t.catAnnualRenewal || 'تجديد الانخراط السنوي', 
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200', 
          dotClass: 'bg-blue-500' 
        };
      case 'donation':
      case 'donation_support':
        return { 
          label: t.catDonationSupport || 'تبرع ومساهمة مالية', 
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', 
          dotClass: 'bg-emerald-500' 
        };
      case 'project_support':
      case 'initiative_proposal':
      case 'initiative_with_contribution':
        return { 
          label: t.catInitiativeWithContribution || 'اقترح عمل مبادرة خاصة بمساهمتي', 
          badgeClass: 'bg-teal-50 text-teal-700 border-teal-200', 
          dotClass: 'bg-teal-500' 
        };
      case 'charity_zakat':
      case 'other':
        return { 
          label: t.catCharityAndZakat || 'صدقة، زكاة', 
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200', 
          dotClass: 'bg-purple-500' 
        };
      case 'initiative_idea':
        return { 
          label: t.catInitiativeIdea || 'اقتراح مبادرة', 
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200', 
          dotClass: 'bg-amber-500' 
        };
      default:
        return { 
          label: cat || 'مساهمة أخرى', 
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200', 
          dotClass: 'bg-slate-500' 
        };
    }
  };

  // Active Polls
  const activePolls = polls.filter((p) => p.status === 'active' && p.isVisibleInApp);

  // Effective selected amount calculation
  const effectiveAmount = selectedPreset === 'other' 
    ? (Number(customAmount) > 0 ? Number(customAmount) : 0)
    : selectedPreset;

  // Handle Add Contribution Submit
  const handleAddContributionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContributionMessage(null);

    const amount = selectedPreset === 'other' ? Number(customAmount) : selectedPreset;

    if (!amount || isNaN(amount) || amount <= 0) {
      setContributionMessage({
        type: 'error',
        text: t.invalidAmountError || 'يرجى إدخال مبلغ صحيح ورقمي أكبر من 0.'
      });
      return;
    }

    setIsSubmittingContribution(true);

    try {
      if (onAddContribution) {
        const now = new Date();
        const isMembershipFee = contributionCategory === 'membership_fee';
        const res = await onAddContribution({
          memberId: member.id,
          memberCode: member.memberCode,
          memberName: member.fullName,
          amount: Number(amount),
          date: now.toISOString().slice(0, 10),
          time: now.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: isMembershipFee ? 'pending' : 'completed',
          category: contributionCategory,
          paymentMethod: paymentMethod,
          notes: notes.trim() || undefined,
        });

        if (res.success) {
          try {
            confetti({
              particleCount: 85,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch (e) {}

          setContributionMessage({
            type: 'success',
            text: res.message || t.contributionSuccessMsg || 'تم تسجيل وتوثيق مساهمتك الجديدة بنجاح! شكراً لدعمك المتواصل للجمعية.'
          });

          if (selectedPreset === 'other') {
            setCustomAmount('');
          }
          setNotes('');
        } else {
          setContributionMessage({
            type: 'error',
            text: res.message || 'حدث خطأ أثناء حفظ المساهمة.'
          });
        }
      }
    } catch (err: any) {
      setContributionMessage({
        type: 'error',
        text: err?.message || 'تعذر تسجيل المساهمة حالياً.'
      });
    } finally {
      setIsSubmittingContribution(false);
    }
  };

  // Handle Photo Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressAvatar(file);
      const permanentAvatarUrl = await ensurePermanentImageUrl(compressed, `member_avatar_${member.id}`);
      setAvatarUrl(permanentAvatarUrl);
      onUpdateProfile({ avatarUrl: permanentAvatarUrl });
      setProfileMessage({ type: 'success', text: 'تم تحديث وحفظ الصورة الشخصية بشكل دائم بنجاح!' });
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'فشل تحميل الصورة' });
    }
  };

  // Handle Profile Update
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    if (!fullName.trim()) {
      setProfileMessage({ type: 'error', text: 'الاسم الكامل مطلوب ولا يمكن تركه فارغًا.' });
      return;
    }

    if (!phone.trim()) {
      setProfileMessage({ type: 'error', text: 'رقم الهاتف مطلوب.' });
      return;
    }

    setIsSavingProfile(true);

    try {
      onUpdateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        cin: cin.trim() || undefined,
        avatarUrl: avatarUrl || undefined,
      });

      setProfileMessage({ type: 'success', text: t.profileUpdatedSuccess || 'تم حفظ وتحديث بيانات حسابك بنجاح!' });
    } catch (err) {
      setProfileMessage({ type: 'error', text: 'حدث خطأ أثناء حفظ البيانات.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Password Change
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: 'يرجى إدخال كلمة المرور الحالية.' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: t.passwordTooShort || 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف أو أرقام على الأقل.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: t.passwordsDoNotMatch || 'كلمة المرور الجديدة وتأكيدها غير متطابقين.' });
      return;
    }

    setIsChangingPassword(true);

    try {
      const result = await onChangePassword(currentPassword, newPassword);
      if (result.success) {
        setPasswordMessage({ type: 'success', text: result.message });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err?.message || 'حدث خطأ أثناء تغيير كلمة المرور.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Return to Home Button */}
      <BackToHomeButton
        onBack={() => setActiveTab('home')}
        lang={lang}
        currentPageTitle={t.myAccount || 'حسابي'}
        id="back-to-home-from-my-account"
      />

      {/* Top Banner & Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-900/40 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-6">
            {/* Avatar with Camera button */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-1 shadow-lg ring-4 ring-white/10 overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={member.fullName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <div className="w-full h-full rounded-xl bg-slate-800 flex items-center justify-center text-2xl font-black text-emerald-400">
                    {member.fullName.charAt(0)}
                  </div>
                )}
              </div>

              {/* Photo change badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -left-2 rtl:-left-auto rtl:-right-2 bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-xl shadow-md border-2 border-slate-900 transition-transform active:scale-95"
                title="تغيير الصورة من الهاتف أو الجهاز"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            {/* Member Details */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  {member.memberCode}
                </span>
                <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t.accountActive || 'حساب مفعل ونشط 🟢'}</span>
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {member.fullName}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span dir="ltr">{member.phone}</span>
                </span>
                {member.cin && (
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-teal-400" />
                    <span>{member.cin}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-4 md:pt-0 border-t border-slate-800 md:border-0">
            <button
              onClick={() => onPrintMemberCard(member)}
              className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition border border-white/10"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>{t.printMemberCard || 'بطاقة المنخرط / الوصل'}</span>
            </button>

            <button
              onClick={onLogout}
              className="py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs sm:text-sm flex items-center gap-2 transition border border-rose-500/30"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.logoutMember || 'تسجيل الخروج'}</span>
            </button>
          </div>
        </div>

        {/* Quick Membership Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
            <span className="text-[11px] text-slate-400 block">{t.joinDate || 'تاريخ الانخراط'}</span>
            <span className="font-bold text-sm text-white">{member.joinDate}</span>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
            <span className="text-[11px] text-slate-400 block">مبلغ الإشتراك والمساهمات</span>
            <span className="font-bold text-sm text-emerald-400">{effectivePaidFee.toLocaleString()} {t.currencyShort || 'د.م'}</span>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
            <span className="text-[11px] text-slate-400 block">طريقة أداء الانخراط</span>
            <span className="font-bold text-sm text-cyan-300">
              {member.membershipPaymentMethod === 'bank_transfer'
                ? 'الحساب البنكي'
                : member.membershipPaymentMethod === 'cash'
                ? 'نقدًا'
                : member.membershipPaymentMethod === 'check'
                ? 'شيك بنكي'
                : 'الحساب البنكي'}
            </span>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
            <span className="text-[11px] text-slate-400 block">{t.renewalDate || 'تاريخ التجديد'}</span>
            <span className="font-bold text-sm text-amber-300">{member.renewalDate}</span>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
            <span className="text-[11px] text-slate-400 block">إجمالي المساهمات والاشتراكات</span>
            <span className="font-bold text-sm text-teal-300">
              {(totalContributionsAmount > 0 ? totalContributionsAmount : totalMemberPayments).toLocaleString()} {t.currencyShort || 'د.م'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NEW SECTION: إضافة مساهمة جديدة (انخراط جديد) - Prominently Above Account Edit */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-emerald-200/90 relative overflow-hidden space-y-6">
        {/* Top Accent Strip */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-700/10 flex-shrink-0">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-lg sm:text-xl">
                  {t.addNewContributionSectionTitle || 'إضافة مساهمة جديدة (انخراط جديد)'}
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  خدمة فورية
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {t.addNewContributionSectionDesc || 'سجل مساهمة مالية أو تجديد انخراط سنوي جديد لحسابك بشكل فوري وموثق'}
              </p>
            </div>
          </div>

          {memberContributionsList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowContributionsHistory(!showContributionsHistory)}
              className="py-2 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 text-slate-700 hover:text-emerald-800 text-xs font-bold flex items-center gap-2 transition"
            >
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>
                {showContributionsHistory ? 'إخفاء الأرشيف' : `سجل مساهماتي (${memberContributionsList.length})`}
              </span>
            </button>
          )}
        </div>

        {/* Success or Error Feedback Banner */}
        {contributionMessage && (
          <div
            className={`p-4 sm:p-5 rounded-2xl text-xs sm:text-sm border flex items-start sm:items-center justify-between gap-3 animate-fadeIn ${
              contributionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {contributionMessage.type === 'success' ? (
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
              )}
              <div>
                <h4 className="font-black text-sm">
                  {contributionMessage.type === 'success' ? 'تمت العملية بنجاح' : 'تنبيه في الإدخال'}
                </h4>
                <p className="font-medium text-xs mt-0.5">{contributionMessage.text}</p>
              </div>
            </div>

            {contributionMessage.type === 'success' && (
              <button
                type="button"
                onClick={() => onPrintMemberCard(member)}
                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الوصل</span>
              </button>
            )}
          </div>
        )}

        {/* Main Contribution Form */}
        <form onSubmit={handleAddContributionSubmit} className="space-y-6">
          {/* 1. Preset Amounts Selection Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-800">
                {t.presetAmountsLabel || 'اختر مبلغ المساهمة المقترح:'} <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                انقر على المبلغ المطلوب أو اختر «مبلغ آخر»
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
              {getStoredDonationPresets().map((amount) => {
                const isSelected = selectedPreset === amount;
                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setSelectedPreset(amount)}
                    className={`py-3 px-2 rounded-xl text-center transition-all duration-200 border flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400/40 scale-[1.02]'
                        : 'bg-slate-50 hover:bg-emerald-50/70 text-slate-800 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <span className="font-mono font-black text-sm sm:text-base leading-tight">
                      {amount.toLocaleString()}
                    </span>
                    <span className={`text-[10px] font-bold ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {t.currencyShort || 'د.م'}
                    </span>
                  </button>
                );
              })}

              {/* "Other Amount" Button */}
              <button
                type="button"
                onClick={() => setSelectedPreset('other')}
                className={`py-3 px-2 rounded-xl text-center transition-all duration-200 border-2 flex flex-col items-center justify-center gap-0.5 ${
                  selectedPreset === 'other'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-md ring-2 ring-teal-400/40 scale-[1.02]'
                    : 'bg-slate-50 hover:bg-teal-50/60 text-slate-800 border-dashed border-slate-300 hover:border-teal-400'
                }`}
              >
                <PenTool className="w-4 h-4 mb-0.5" />
                <span className="font-bold text-xs leading-tight">
                  {t.otherAmountOption || 'مبلغ آخر'}
                </span>
                <span className={`text-[9px] ${selectedPreset === 'other' ? 'text-teal-100' : 'text-slate-500'}`}>
                  يدوي
                </span>
              </button>
            </div>
          </div>

          {/* 2. Custom Amount Input (Revealed only when "Other Amount" is selected) */}
          {selectedPreset === 'other' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-teal-50/70 p-4 sm:p-5 rounded-2xl border border-teal-200 space-y-2"
            >
              <label className="block text-xs font-bold text-teal-950">
                {t.customAmountInputLabel || 'أدخل المبلغ المخصص (بالدرهم المغربي)'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={t.customAmountPlaceholder || 'مثال: 750 أو 12000'}
                  className="w-full pl-16 pr-10 py-3 rounded-xl border border-teal-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 text-base font-mono font-black outline-none bg-white text-slate-900"
                  autoFocus
                />
                <Coins className="w-4 h-4 text-teal-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-teal-700">
                  {t.currencyShort || 'د.م'}
                </span>
              </div>
              <p className="text-[11px] text-teal-800">
                * يرجى إدخال قيمة رقمية وموجبة فقط.
              </p>
            </motion.div>
          )}

          {/* 3. Category, Payment Method & Notes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Contribution Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {t.contributionCategoryLabel || 'تحديد نوع المساهمة'} <span className="text-rose-500">*</span>
              </label>
              <select
                value={contributionCategory}
                onChange={(e) => setContributionCategory(e.target.value as ContributionCategory)}
                className="w-full px-3.5 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs sm:text-sm outline-none transition bg-slate-50/50 focus:bg-white text-slate-900 font-semibold"
              >
                <option value="membership_fee">{t.catAnnualRenewal || 'تجديد الانخراط السنوي'}</option>
                <option value="donation">{t.catDonationSupport || 'تبرع ومساهمة مالية'}</option>
                <option value="project_support">{t.catInitiativeWithContribution || 'اقترح عمل مبادرة خاصة بمساهمتي'}</option>
                <option value="other">{t.catCharityAndZakat || 'صدقة، زكاة'}</option>
                <option value="initiative_idea">{t.catInitiativeIdea || 'اقتراح مبادرة'}</option>
              </select>
            </div>

            {/* Payment / Transfer Method */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {t.paymentMethodLabel || 'طريقة التحويل أو الدفع'} <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                className="w-full px-3.5 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs sm:text-sm outline-none transition bg-slate-50/50 focus:bg-white text-slate-900"
              >
                <option value="bank_transfer">{t.methodBankTransfer || 'تحويل بنكي مباشر (RIB)'}</option>
                <option value="cash">{t.methodCash || 'دفع نقدي مباشر مع وصل'}</option>
                <option value="check">{t.methodCheck || 'شيك بنكي'}</option>
                <option value="online">{t.methodOnline || 'تطبيق بنكي / دفع إلكتروني'}</option>
                <option value="other">{t.methodOther || 'طريقة أخرى'}</option>
              </select>
            </div>

            {/* Additional Notes */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-bold text-slate-700">
                {t.contributionNotesLabel || 'ملاحظات أو بيان إضافي (اختياري)'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.contributionNotesPlaceholder || 'مثال: مساهمة خاصة بالموسم الحالي...'}
                className="w-full px-3.5 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs sm:text-sm outline-none transition bg-slate-50/50 focus:bg-white text-slate-900"
              />
            </div>
          </div>

          {/* 4. Live Summary Card & Confirmation Button */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg border border-emerald-900/40">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] text-emerald-300/90 font-bold block">
                  {t.contributionSummary || 'ملخص المساهمة الجديدة للمنخرط'}
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-mono text-2xl sm:text-3xl font-black text-white">
                    {effectiveAmount > 0 ? effectiveAmount.toLocaleString() : '0'}
                  </span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {t.currencyShort || 'د.م'}
                  </span>
                  <span className="text-slate-400 text-xs mr-2">
                    ({member.fullName} - {member.memberCode})
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingContribution || effectiveAmount <= 0}
              className="py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isSubmittingContribution ? (
                <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.confirmContributionBtn || 'تأكيد وإرسال المساهمة'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 2.5 ALL CONTRIBUTIONS RECORD (سجل جميع المساهمات الشامل للمنخرط) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black shadow-xs border border-emerald-100">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-black text-slate-900 text-lg sm:text-xl">
                  {t.allContributionsLedgerTitle || 'سجل جميع المساهمات'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                  {memberContributionsList.length} {t.contributionsCount || 'مساهمة'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {t.allContributionsLedgerSubtitle || 'سجل شامل لجميع المساهمات والانخراطات والتبرعات والمبادرات المسجلة منذ تاريخ الانضمام'}
              </p>
            </div>
          </div>

          {/* Quick Print Member Card / Statement Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrintMemberCard(member)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition shadow-xs"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>{t.printMemberCard || 'طباعة بطاقة الانخراط والوصل'}</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Metric Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-bold">{t.totalContributions || 'إجمالي المساهمات المالية'}</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                {totalContributionsAmount.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-600">{t.currencyShort || 'د.م'}</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-bold">{t.contributionsCount || 'عدد العمليات والمبادرات'}</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {memberContributionsList.length}
              </span>
              <span className="text-xs font-bold text-slate-500">عملية</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-bold">{t.lastContributionDate || 'تاريخ آخر مساهمة'}</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-black text-slate-800 font-mono">
                {sortedMemberContributions[0]?.date || member.joinDate || '—'}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-bold">{t.memberIdCode || 'رمز العضوية والتسجيل'}</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-black text-emerald-800 font-mono">
                {member.memberCode}
              </span>
            </div>
          </div>
        </div>

        {/* Filters & Search Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={ledgerSearchQuery}
              onChange={(e) => setLedgerSearchQuery(e.target.value)}
              placeholder="البحث في السجل (رقم، بيان، مبلغ)..."
              className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs bg-white text-slate-900 outline-none"
            />
            <FolderOpen className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={ledgerCategoryFilter}
              onChange={(e) => setLedgerCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs bg-white text-slate-900 outline-none font-medium"
            >
              <option value="all">جميع أنواع المساهمات (الكل)</option>
              <option value="membership_fee">تجديد الانخراط السنوي</option>
              <option value="donation">تبرع ومساهمة مالية</option>
              <option value="project_support">اقترح عمل مبادرة خاصة بمساهمتي</option>
              <option value="charity_zakat">صدقة، زكاة</option>
              <option value="initiative_idea">اقتراح مبادرة</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={ledgerStatusFilter}
              onChange={(e) => setLedgerStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-xs bg-white text-slate-900 outline-none font-medium"
            >
              <option value="all">جميع الحالات (الكل)</option>
              <option value="completed">🟢 مكتملة وموثقة</option>
              <option value="approved">🔴 لم يتم الدفع</option>
              <option value="pending">⏳ قيد المعالجة والمراجعة</option>
              <option value="rejected">❌ ملغاة</option>
            </select>
          </div>
        </div>

        {/* Contributions Ledger Table / Cards */}
        {filteredMemberContributions.length === 0 ? (
          <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
            <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">لا توجد مساهمات مطابقة</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              لم يتم العثور على أي مساهمة مسجلة تطابق شروط التصفية والبحث الحالية.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-4 whitespace-nowrap">{t.ledgerColMemberName || 'اسم المنخرط'}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.ledgerColType || 'نوع المساهمة'}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.ledgerColAmount || 'المبلغ المسجل'}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.ledgerColDateTime || 'تاريخ ووقت المساهمة'}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.ledgerColOperationId || 'معرف العملية'}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.ledgerColStatus || 'حالة المساهمة'}</th>
                  <th className="py-3 px-4">{t.ledgerColNotes || 'البيان والملاحظات'}</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">{t.ledgerColReceipt || 'الوصل'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredMemberContributions.map((contrib) => {
                  const catInfo = getCategoryDetails(contrib.category);
                  const isCompleted = contrib.status === 'completed';
                  const isUnpaid = contrib.status === 'approved' || contrib.status === 'unpaid';
                  return (
                    <tr key={contrib.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Member Full Name */}
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span>{member.fullName}</span>
                        </div>
                      </td>

                      {/* Contribution Type / Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${catInfo.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${catInfo.dotClass}`} />
                          {catInfo.label}
                        </span>
                      </td>

                      {/* Amount in MAD */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-sm font-black text-emerald-800">
                          {Number(contrib.amount) > 0 ? `${contrib.amount.toLocaleString()} ${t.currencyShort || 'د.م'}` : 'مبادرة معنوية'}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-700">
                        <div className="flex flex-col">
                          <span className="font-bold">{contrib.date}</span>
                          {contrib.time && (
                            <span className="text-[10px] text-slate-400">الساعة: {contrib.time}</span>
                          )}
                        </div>
                      </td>

                      {/* Operation / Reference ID */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {contrib.financialOperationId || contrib.id}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isUnpaid || contrib.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {isCompleted ? '🟢 مكتملة وموثقة' : isUnpaid ? '🔴 لم يتم الدفع' : contrib.status === 'rejected' ? '❌ ملغاة' : '⏳ قيد المعالجة'}
                        </span>
                      </td>

                      {/* Notes / Description */}
                      <td className="py-3 px-4 text-slate-600 max-w-xs text-xs">
                        {contrib.notes || '—'}
                      </td>

                      {/* Print / View Receipt Action */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onPrintMemberCard(member)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold transition border border-emerald-200"
                          title="عرض وطباعة الوصل والبطاقة"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>الوصل</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Column 1: Edit Personal Information */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {t.editMyInfo || 'تعديل معلومات الحساب'}
                </h3>
                <p className="text-xs text-slate-500">تحديث الاسم الكامل ورقم الهاتف والصورة</p>
              </div>
            </div>
          </div>

          {profileMessage && (
            <div
              className={`p-4 rounded-xl text-xs sm:text-sm border flex items-center gap-3 ${
                profileMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {profileMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              )}
              <p className="font-semibold">{profileMessage.text}</p>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {t.fullName || 'الاسم الكامل'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition bg-slate-50/50 focus:bg-white text-slate-900"
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {t.phone || 'رقم الهاتف'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition bg-slate-50/50 focus:bg-white text-slate-900"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* National ID / CIN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {t.nationalIdCin || 'رقم البطاقة الوطنية (CIN)'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={cin}
                  onChange={(e) => setCin(e.target.value)}
                  placeholder="مثال: AB123456"
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition bg-slate-50/50 focus:bg-white text-slate-900 uppercase"
                />
                <CreditCard className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {t.email || 'البريد الإلكتروني (اختياري)'}
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition bg-slate-50/50 focus:bg-white text-slate-900"
                  dir="ltr"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Photo upload from phone button */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                الصورة الشخصية
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-3 px-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>📷 اختيار صورة جديدة من الهاتف</span>
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl('');
                      onUpdateProfile({ avatarUrl: undefined });
                    }}
                    className="p-3 rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50 transition"
                    title="حذف الصورة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingProfile ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{t.saveChanges || 'حفظ التعديلات'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Column 2: Change Password & Security */}
        <div className="space-y-8">
          {/* Password Change Form */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {t.changePassword || 'تغيير وتحديث كلمة المرور'}
                  </h3>
                  <p className="text-xs text-slate-500">تأمين حسابك بكلمة مرور جديدة</p>
                </div>
              </div>
            </div>

            {passwordMessage && (
              <div
                className={`p-4 rounded-xl text-xs sm:text-sm border flex items-center gap-3 ${
                  passwordMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {passwordMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                )}
                <p className="font-semibold">{passwordMessage.text}</p>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {t.currentPassword || 'كلمة المرور الحالية'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="كلمة المرور الحالية (أو الافتراضية 123456)"
                    className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 text-sm outline-none transition bg-slate-50/50 focus:bg-white text-slate-900"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {t.newPassword || 'كلمة المرور الجديدة'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6 أحرف أو أرقام على الأقل"
                    className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 text-sm outline-none transition bg-slate-50/50 focus:bg-white text-slate-900"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {t.confirmNewPassword || 'تأكيد كلمة المرور الجديدة'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 text-sm outline-none transition bg-slate-50/50 focus:bg-white text-slate-900"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Submit Password */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full py-3.5 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isChangingPassword ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t.updatePasswordButton || 'تحديث كلمة المرور'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Quick Shortcuts: Member Polls & History */}
          {activePolls.length > 0 && (
            <div className="bg-emerald-50/60 rounded-3xl p-6 border border-emerald-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <Vote className="w-5 h-5 text-emerald-600" />
                  <span>استطلاعات وتصويتات الجمعية المفتوحة ({activePolls.length})</span>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('home');
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  className="text-xs text-emerald-700 font-bold hover:underline"
                >
                  عرض في الرئيسية
                </button>
              </div>

              <div className="space-y-2">
                {activePolls.slice(0, 2).map((poll) => {
                  const hasVoted = poll.votes.some((v) => v.memberId === member.id);
                  const userVote = poll.votes.find((v) => v.memberId === member.id);
                  return (
                    <div key={poll.id} className="bg-white p-3.5 rounded-xl border border-emerald-100 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{poll.title}</h4>
                        <span className="text-[11px] text-slate-500">{poll.votes.length} صوت مسجل</span>
                      </div>
                      {hasVoted ? (
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold">
                          تم التصويت ({userVote?.choice === 'for' ? 'مع' : 'ضد'})
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-bold">
                          بانتظار تصويتك
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
