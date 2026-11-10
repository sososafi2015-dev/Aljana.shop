import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  LogIn, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  CheckCircle2, 
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  UserPlus
} from 'lucide-react';
import { Member, Language, AssociationTenant, SubAdmin, CurrentAdminSession } from '../types';
import { translations } from '../translations';
import { authenticateMember, authenticateSubAdmin, AuthResult } from '../security';
import { authenticatePlatformAccount } from '../tenantStorage';
import { getStoredSubAdmins } from '../storage';

interface MemberAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (member: Member, targetTenant?: AssociationTenant) => void;
  onAdminLoginSuccess?: (session: CurrentAdminSession, targetTenant?: AssociationTenant) => void;
  members: Member[];
  subAdmins?: SubAdmin[];
  lang: Language;
  onOpenRegisterModal?: () => void;
}

export const MemberAuthModal: React.FC<MemberAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onAdminLoginSuccess,
  members,
  subAdmins = [],
  lang,
  onOpenRegisterModal,
}) => {
  const t = translations[lang] as any;
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickNames, setShowQuickNames] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFullName('');
      setPassword('');
      setErrorMessage(null);
      setErrorCode(null);
      setShowPassword(false);
      setIsLoading(false);
      setShowQuickNames(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorCode(null);

    const cleanIdentifier = fullName.trim();
    const cleanPass = password.trim();

    if (!cleanIdentifier) {
      setErrorMessage('يرجى إدخال اسم المستخدم الخاص بحسابك.');
      return;
    }

    if (!cleanPass) {
      setErrorMessage(t.enterPassword || 'يرجى إدخال كلمة المرور.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Check if the entered username belongs to a Secondary Admin (أدمن من الدرجة الثانية) in this association
      const storedSubs = getStoredSubAdmins();
      const subMap = new Map<string, SubAdmin>();
      for (const item of [...storedSubs, ...(subAdmins || [])]) {
        if (item && item.id) {
          subMap.set(item.id, { ...(subMap.get(item.id) || {}), ...item });
        }
      }
      const effectiveSubAdmins = Array.from(subMap.values());
      const subRes = await authenticateSubAdmin(cleanIdentifier, cleanPass, effectiveSubAdmins);

      if (subRes.success && subRes.subAdmin && onAdminLoginSuccess) {
        const session: CurrentAdminSession = {
          type: 'sub_admin',
          role: 'secondary_admin',
          id: subRes.subAdmin.id,
          username: subRes.subAdmin.username || cleanIdentifier,
          fullName: subRes.subAdmin.fullName,
          phone: subRes.subAdmin.phone,
          isMasterPlatformAdmin: false,
          subAdmin: subRes.subAdmin,
        };
        onAdminLoginSuccess(session);
        onClose();
        return;
      }

      if (subRes.errorCode === 'INACTIVE' || subRes.errorCode === 'WRONG_PASSWORD') {
        setErrorMessage(subRes.error || 'فشل تسجيل الدخول.');
        setErrorCode(subRes.errorCode);
        return;
      }

      // 2. Authenticate as an Association Member (منخرط)
      const result: AuthResult = await authenticateMember(cleanIdentifier, cleanPass, members);

      if (result.success && result.member) {
        onLoginSuccess(result.member);
        onClose();
        return;
      }

      // 3. If not found in current association's local members, check across the platform (members & admins)
      if (result.errorCode === 'NOT_FOUND') {
        const platformRes = await authenticatePlatformAccount(cleanIdentifier, cleanPass);
        if (platformRes.success && platformRes.role === 'member' && platformRes.member && platformRes.tenant) {
          onLoginSuccess(platformRes.member, platformRes.tenant);
          onClose();
          return;
        }
        if (platformRes.success && platformRes.role === 'admin' && platformRes.session && onAdminLoginSuccess) {
          onAdminLoginSuccess(platformRes.session, platformRes.tenant);
          onClose();
          return;
        }
        if (platformRes.errorCode === 'INACTIVE' || platformRes.errorCode === 'WRONG_PASSWORD') {
          setErrorMessage(platformRes.error || result.error || 'فشل تسجيل الدخول.');
          setErrorCode(platformRes.errorCode);
          return;
        }
      }

      setErrorMessage(result.error || 'فشل تسجيل الدخول. يرجى التحقق من صحة اسم المستخدم وكلمة المرور.');
      setErrorCode(result.errorCode || 'UNKNOWN');
    } catch (err) {
      setErrorMessage('حدث خطأ غير متوقع أثناء التحقق. يرجى المحاولة لاحقًا.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter matching members for convenient quick select helper if user is typing
  const filteredSuggestions = fullName.trim().length >= 2
    ? members.filter((m) => {
        const q = fullName.trim().toLowerCase();
        return m.fullName.toLowerCase().includes(q) || (m.username && m.username.toLowerCase().includes(q));
      }).slice(0, 4)
    : [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 p-6 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-4 left-4 sm:left-4 rtl:left-auto rtl:right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pr-2">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner flex-shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {t.memberLoginTitle || 'تسجيل دخول المنخرطين'}
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  {t.memberLoginDesc || 'فضاء المنخرط لإدارة الحساب ومتابعة الانخراط'}
                </p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Error Notification */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl text-xs sm:text-sm border flex items-start gap-3 ${
                  errorCode === 'INACTIVE'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <ShieldAlert className={`w-5 h-5 flex-shrink-0 mt-0.5 ${errorCode === 'INACTIVE' ? 'text-rose-600' : 'text-amber-600'}`} />
                <div className="space-y-1">
                  <p className="font-bold">
                    {errorCode === 'INACTIVE' ? 'الحساب غير مفعّل' : 'تنبيه تسجيل الدخول'}
                  </p>
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
              </motion.div>
            )}

            {/* Username Field */}
            <div className="space-y-1.5 relative">
              <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-600" />
                  <span>إدخال اسم المستخدم</span>
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (الخاص بحساب المنخرط)
                </span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="أدخل اسم المستخدم الخاص بحسابك"
                  className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition bg-slate-50/60 focus:bg-white text-slate-900"
                  autoComplete="username"
                  autoFocus
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
              </div>

              {/* Instant Name Suggestions Helper */}
              {filteredSuggestions.length > 0 && fullName !== filteredSuggestions[0].fullName && fullName !== filteredSuggestions[0].username && (
                <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-sm p-1.5 space-y-1">
                  <p className="text-[10px] text-slate-400 px-2 font-medium">اختر حسابك من المسجلين:</p>
                  {filteredSuggestions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFullName(m.username || m.fullName)}
                      className="w-full text-right px-2.5 py-1.5 text-xs rounded hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold">
                        {m.fullName}
                        {m.username && (
                          <span className="text-[10px] text-emerald-700 font-mono mr-1.5" dir="ltr">
                            (@{m.username})
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {m.memberCode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>{t.enterPassword || 'كلمة المرور'}</span>
                  <span className="text-rose-500">*</span>
                </label>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-sm outline-none transition bg-slate-50/60 focus:bg-white text-slate-900"
                  autoComplete="current-password"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Security and Credentials Guidance */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] text-emerald-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>دخول آمن للمنخرطين (الاسم + كلمة المرور فقط)</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {t.defaultPasswordHint || 'للمنخرطين الحاليين: كلمة المرور الافتراضية الأولية هي 123456 أو رقم الهاتف، ويمكنك تغييرها فور الدخول.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{t.loginButton || 'تسجيل الدخول'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto py-3 px-5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>

            {/* Switch to Registration for new visitors */}
            {onOpenRegisterModal && (
              <div className="pt-2 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-600">
                  لست منخرطاً بعد؟{' '}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRegisterModal();
                    }}
                    className="font-bold text-emerald-700 hover:text-emerald-800 underline transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>تسجيل منخرط جديد الآن</span>
                  </button>
                </p>
              </div>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
