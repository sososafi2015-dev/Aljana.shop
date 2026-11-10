import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  LogIn,
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Building2,
  KeyRound,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  Smartphone
} from 'lucide-react';
import { AssociationTenant, CurrentAdminSession, UserRole, AssociationOwner, Member } from '../types';
import { 
  authenticatePlatformAccount, 
  lookupPlatformAccount, 
  resetPlatformOwnerPassword,
  getAllTenants 
} from '../tenantStorage';

interface AssociationLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (tenant: AssociationTenant, session: CurrentAdminSession | null, role: UserRole, member?: Member) => void;
  onOpenCreateWizard: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const AssociationLoginModal: React.FC<AssociationLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenCreateWizard,
  onShowToast,
}) => {
  // Mode: 'login' | 'forgot_password'
  const [mode, setMode] = useState<'login' | 'forgot_password'>('login');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password form state
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [isSearchingAccount, setIsSearchingAccount] = useState(false);
  const [accountFoundInfo, setAccountFoundInfo] = useState<{
    associationName: string;
    ownerName: string;
    tenantId: string;
    city?: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIdentifier('');
      setPassword('');
      setShowPassword(false);
      setErrorMessage(null);
      setIsLoading(false);
      setMode('login');
      setResetIdentifier('');
      setAccountFoundInfo(null);
      setNewPassword('');
      setConfirmPassword('');
      setResetErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId) {
      setErrorMessage('يرجى إدخال اسم المستخدم الخاص بحسابك.');
      return;
    }

    if (!cleanPass) {
      setErrorMessage('يرجى إدخال كلمة المرور.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authenticatePlatformAccount(cleanId, cleanPass);

      if (result.success && result.tenant) {
        if (result.role === 'member' && result.member) {
          onLoginSuccess(result.tenant, null, 'member', result.member);
          onClose();
          return;
        }
        if (result.session) {
          onShowToast(`تم تسجيل الدخول بنجاح! جاري تحويلك لمنصة «${result.tenant.name}»`, 'success');
          onLoginSuccess(result.tenant, result.session, result.role || 'admin');
          onClose();
          return;
        }
      }
      setErrorMessage(result.error || 'فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.');
    } catch (err) {
      console.error('[AssociationLoginModal] login error:', err);
      setErrorMessage('حدث خطأ أثناء الاتصال بالخادم. يرجى إعادة المحاولة.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLookupAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetErrorMessage(null);
    setAccountFoundInfo(null);

    const cleanId = resetIdentifier.trim();
    if (!cleanId) {
      setResetErrorMessage('يرجى إدخال رقم الهاتف أو الاسم للبحث.');
      return;
    }

    setIsSearchingAccount(true);
    try {
      const res = await lookupPlatformAccount(cleanId);
      if (res.found && res.associationName && res.ownerName && res.tenantId) {
        setAccountFoundInfo({
          associationName: res.associationName,
          ownerName: res.ownerName,
          tenantId: res.tenantId,
          city: res.city,
        });
      } else {
        setResetErrorMessage(res.error || 'لم يتم العثور على أي جمعية مسجلة بهذه البيانات.');
      }
    } catch (err) {
      setResetErrorMessage('حدث خطأ أثناء البحث. يرجى المحاولة لاحقاً.');
    } finally {
      setIsSearchingAccount(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetErrorMessage(null);

    if (!newPassword || newPassword.length < 4) {
      setResetErrorMessage('يجب أن تتكون كلمة المرور الجديدة من 4 خانات على الأقل.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetErrorMessage('كلمتا المرور غير متطابقتين.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetPlatformOwnerPassword(resetIdentifier, newPassword);
      if (res.success) {
        onShowToast('تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.', 'success');
        // Pre-fill login with updated credentials
        setIdentifier(resetIdentifier);
        setPassword(newPassword);
        setMode('login');
      } else {
        setResetErrorMessage(res.error || 'تعذر تحديث كلمة المرور.');
      }
    } catch (err) {
      setResetErrorMessage('حدث خطأ أثناء تحديث كلمة المرور.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8"
        dir="rtl"
      >
        {/* Modal Top Header with Brand Decoration */}
        <div className="relative bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-6 sm:p-7 text-white overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-emerald-300 to-teal-200" />
          <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-white/5 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -right-10 -top-10 w-36 h-36 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                {mode === 'login' ? (
                  <LogIn className="w-6 h-6 text-amber-300" />
                ) : (
                  <KeyRound className="w-6 h-6 text-amber-300" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 uppercase">
                    syoumax منصة العمل الجمعوي
                  </span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                  {mode === 'login' ? 'تسجيل الدخول إلى منصتك' : 'استعادة كلمة المرور'}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs sm:text-sm text-emerald-100/90 mt-3 leading-relaxed relative z-10">
            {mode === 'login'
              ? 'أدخل اسم المستخدم وكلمة المرور اللذين حددتهما أثناء إنشاء المنصة للدخول مباشرة إلى حساب مدير الجمعية الخاص بك (أو بيانات المنخرط).'
              : 'أدخل اسم المستخدم أو رقم الهاتف أو الاسم المسجل لجمعيتك لاسترجاع الحساب وتعيين كلمة مرور جديدة.'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7">
          {mode === 'login' ? (
            /* ==================== LOGIN FORM ==================== */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm"
                >
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="leading-relaxed flex-1">{errorMessage}</div>
                </motion.div>
              )}

              {/* Identifier Input (Strictly Username) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    إدخال اسم المستخدم
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    (مدير الجمعية أو المنخرط)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="أدخل اسم المستخدم الخاص بحسابك"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-500 pr-10"
                    disabled={isLoading}
                    autoFocus
                  />
                  <div className="absolute top-3.5 right-3 text-slate-500 pointer-events-none">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    كلمة المرور
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setResetIdentifier(identifier);
                      setErrorMessage(null);
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer transition-colors"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-500 pr-10 pl-11"
                    disabled={isLoading}
                  />
                  <div className="absolute top-3.5 right-3 text-slate-500 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-3 left-3 text-slate-500 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm sm:text-base rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>جاري التحقق والتعرف على منصتك...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-white" />
                    <span>دخول إلى منصتي</span>
                    <ArrowLeft className="w-4 h-4 text-emerald-200" />
                  </>
                )}
              </button>

              {/* Data Isolation Guarantee Badge */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-600 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>نظام عزل مشدد: دخولك ينقلك حصرياً إلى قاعدة بيانات جمعيتك المستقلة</span>
              </div>

              {/* Divider & Option to Create New Association */}
              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-500 font-semibold">أو</span>
                </div>
              </div>

              {/* Create New Association CTA Card */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-300 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      لا تملك منصة لجمعيتك بعد؟
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      احصل على منصة إلكترونية مستقلة لجمعيتك في دقيقة واحدة
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateWizard();
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>إنشاء منصة</span>
                </button>
              </div>
            </form>
          ) : (
            /* ==================== FORGOT PASSWORD VIEW ==================== */
            <div className="space-y-4">
              {resetErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs sm:text-sm">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>{resetErrorMessage}</div>
                </div>
              )}

              {!accountFoundInfo ? (
                /* Step 1: Find Account */
                <form onSubmit={handleLookupAccount} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      رقم الهاتف أو الإسم المسجل للجمعية
                    </label>
                    <input
                      type="text"
                      value={resetIdentifier}
                      onChange={(e) => setResetIdentifier(e.target.value)}
                      placeholder="مثال: 0612458765 أو أحمد المنصوري"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-500"
                      disabled={isSearchingAccount}
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSearchingAccount}
                    className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSearchingAccount ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>جاري البحث عن الجمعية...</span>
                      </>
                    ) : (
                      <>
                        <span>التحقق والبحث عن المنصة</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Account Identified! Set New Password */
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  {/* Visual confirmation of found association */}
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-800">
                      <div className="font-bold text-emerald-900 text-sm">
                        تم العثور على منصة جمعيتك بنجاح!
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-600">
                        <span>الجمعية: <strong>{accountFoundInfo.associationName}</strong></span>
                        <span>المسؤول: <strong>{accountFoundInfo.ownerName}</strong></span>
                        {accountFoundInfo.city && <span>المدينة: <strong>{accountFoundInfo.city}</strong></span>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      كلمة المرور الجديدة
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        disabled={isResetting}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute top-3 left-3 text-slate-500 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      تأكيد كلمة المرور الجديدة
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      disabled={isResetting}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isResetting}
                    className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isResetting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>جاري حفظ كلمة المرور...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>حفظ كلمة المرور والعودة للدخول</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Back to Login button */}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setResetErrorMessage(null);
                }}
                className="w-full py-2.5 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة إلى تسجيل الدخول</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
