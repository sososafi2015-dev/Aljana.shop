import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Lock, 
  KeyRound, 
  X, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Shield,
  User as UserIcon
} from 'lucide-react';
import { Language, SubAdmin, CurrentAdminSession } from '../types';
import { translations } from '../translations';
import { authenticateUnifiedAdmin } from '../security';
import { getStoredSubAdmins } from '../storage';

import { firestoreSyncService } from '../services/firestoreSyncService';
import { BOOTSTRAP_ADMIN_EMAIL, auth } from '../firebase';
import { User, onAuthStateChanged } from 'firebase/auth';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: CurrentAdminSession) => void;
  adminPin: string;
  subAdmins?: SubAdmin[];
  lang: Language;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  adminPin,
  subAdmins = [],
  lang,
}) => {
  const [authMode, setAuthMode] = useState<'password' | 'firebase'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firebaseEmail, setFirebaseEmail] = useState(BOOTSTRAP_ADMIN_EMAIL);
  const [firebasePassword, setFirebasePassword] = useState('');
  const [firebaseDisplayName, setFirebaseDisplayName] = useState('');
  const [isRegisteringFirebase, setIsRegisteringFirebase] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);

  const t = translations[lang] as any;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAuthMode('password');
      setUsername('');
      setPassword('');
      setErrorMessage(null);
      setShowPassword(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFirebaseLogout = async () => {
    try {
      await firestoreSyncService.logout();
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage('تعذر تسجيل الخروج من Firebase: ' + (err?.message || ''));
    }
  };

  const handleFirebaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const emailTrimmed = firebaseEmail.trim();
    const passTrimmed = firebasePassword.trim();

    if (!emailTrimmed) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني لحساب Firebase.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setErrorMessage('صيغة البريد الإلكتروني غير صالحة. يرجى إدخال بريد إلكتروني صحيح (مثال: admin@gmail.com).');
      return;
    }

    if (!passTrimmed) {
      setErrorMessage('يرجى إدخال كلمة المرور.');
      return;
    }

    if (passTrimmed.length < 6) {
      setErrorMessage('كلمة المرور يجب أن تتكون من 6 أحرف أو أرقام على الأقل وفق معايير أمان Firebase.');
      return;
    }

    setIsSubmitting(true);
    try {
      let user: User;
      const effectiveDisplayName = firebaseDisplayName.trim() || (emailTrimmed === BOOTSTRAP_ADMIN_EMAIL ? 'المسؤول العام' : 'مسؤول الجمعية');

      if (isRegisteringFirebase) {
        user = await firestoreSyncService.registerWithEmail(
          emailTrimmed,
          passTrimmed,
          effectiveDisplayName
        );
      } else {
        try {
          user = await firestoreSyncService.loginWithEmail(emailTrimmed, passTrimmed);
        } catch (loginErr: any) {
          // If user doesn't exist yet and it's the bootstrapped admin, offer smooth auto-setup
          if (loginErr?.code === 'auth/user-not-found' || loginErr?.code === 'auth/invalid-credential') {
            try {
              user = await firestoreSyncService.registerWithEmail(
                emailTrimmed,
                passTrimmed,
                effectiveDisplayName
              );
            } catch (regErr: any) {
              throw loginErr;
            }
          } else {
            throw loginErr;
          }
        }
      }

      if (user) {
        const isSuper = user.email === BOOTSTRAP_ADMIN_EMAIL;
        const session: CurrentAdminSession = {
          id: user.uid,
          phone: '',
          fullName: user.displayName || effectiveDisplayName || user.email || 'مسؤول النظام',
          role: isSuper ? 'main_admin' : 'secondary_admin',
          type: isSuper ? 'super_admin' : 'sub_admin',
          isMasterPlatformAdmin: isSuper,
        };

        setFirebasePassword('');
        setErrorMessage(null);
        onSuccess(session);
      }
    } catch (err: any) {
      console.error('Firebase Auth error:', err);
      const code = err?.code || '';
      if (code === 'auth/wrong-password') {
        setErrorMessage('كلمة المرور غير صحيحة. يرجى التأكد وإعادة المحاولة.');
      } else if (code === 'auth/invalid-credential') {
        setErrorMessage('بيانات الاعتماد غير صالحة. يرجى التأكد من صحة البريد الإلكتروني وكلمة المرور.');
      } else if (code === 'auth/user-not-found') {
        setErrorMessage('لم يتم العثور على حساب مسجل بهذا البريد. يمكنك التبديل إلى «إنشاء حساب جديد في Firebase».');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMessage('هذا البريد الإلكتروني مسجل بالفعل. يرجى التبديل إلى تسجيل الدخول.');
      } else if (code === 'auth/weak-password') {
        setErrorMessage('كلمة المرور ضعيفة جداً. يجب أن تحتوي على 6 أحرف على الأقل.');
      } else if (code === 'auth/invalid-email') {
        setErrorMessage('صيغة البريد الإلكتروني غير صالحة.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('تم حظر المحاولات مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار دقيقة ثم إعادة المحاولة.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('فشل الاتصال بالإنترنت أو بخوادم Firebase. يرجى التحقق من الشبكة.');
      } else {
        setErrorMessage(err?.message || 'تعذر إتمام عملية المصادقة عبر Firebase.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'firebase') {
      return handleFirebaseSubmit(e);
    }
    setErrorMessage(null);

    const cleanPass = password.trim();
    if (!cleanPass) {
      setErrorMessage(
        lang === 'ar' 
          ? 'يرجى إدخال كلمة المرور للوصول إلى لوحة التحكم.' 
          : lang === 'fr' 
            ? 'Veuillez saisir le mot de passe.' 
            : 'Please enter the password.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const storedList = getStoredSubAdmins();
      const mergedMap = new Map<string, SubAdmin>();
      for (const item of [...storedList, ...(subAdmins || [])]) {
        if (item && item.id) {
          mergedMap.set(item.id, { ...(mergedMap.get(item.id) || {}), ...item });
        }
      }
      const effectiveSubAdmins = Array.from(mergedMap.values());
      const result = await authenticateUnifiedAdmin(cleanPass, adminPin, effectiveSubAdmins, username.trim());
      if (result.success && result.session) {
        setUsername('');
        setPassword('');
        setErrorMessage(null);
        onSuccess(result.session);
      } else {
        setErrorMessage(result.error || (lang === 'ar' ? 'بيانات الدخول غير صحيحة.' : 'Incorrect credentials.'));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ غير متوقع أثناء التحقق.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 rtl:left-auto rtl:right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Lock className="w-7 h-7 text-emerald-200" />
          </div>
          
          <h3 className="text-xl font-bold tracking-tight">بوابة دخول الإدارة</h3>
          <p className="text-emerald-200/90 text-xs mt-1">
            أدخل اسم المستخدم وكلمة المرور المخصصة للوصول إلى لوحة التحكم
          </p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setAuthMode('password'); setErrorMessage(null); }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'password'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>كلمة المرور الإدارية</span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('firebase'); setErrorMessage(null); }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'firebase'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            <span>حساب Firebase السحابي</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {authMode === 'password' ? (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المستخدم
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 rtl:left-auto rtl:right-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="أدخل اسم المستخدم"
                    autoFocus
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 rounded-xl py-3 px-10 text-slate-800 text-sm font-medium transition-all outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 rtl:left-auto rtl:right-3.5 pointer-events-none" />
                  
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 rounded-xl py-3 px-10 text-slate-800 text-sm font-medium transition-all outline-hidden"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute top-3.5 right-3.5 rtl:right-auto rtl:left-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-2.5 text-xs text-emerald-800 flex items-center justify-between">
                <span>قاعدة بيانات Cloud Firestore: <strong>نشطة</strong></span>
                <span className="text-[10px] bg-emerald-200/70 text-emerald-900 font-bold px-2 py-0.5 rounded-full">us-west2</span>
              </div>

              {currentUser && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between">
                  <div>
                    <span className="font-bold block">متصل حالياً بحساب Firebase:</span>
                    <span className="text-blue-700 font-mono text-[11px]">{currentUser.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFirebaseLogout}
                    className="px-2.5 py-1 bg-white border border-blue-300 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    تسجيل الخروج
                  </button>
                </div>
              )}

              {isRegisteringFirebase && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الاسم الكامل أو صفة المسؤول
                  </label>
                  <input
                    type="text"
                    value={firebaseDisplayName}
                    onChange={(e) => setFirebaseDisplayName(e.target.value)}
                    placeholder="مثال: ذ. محمد العلوي (رئيس الجمعية)"
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 rounded-xl py-2.5 px-3.5 text-slate-800 text-sm font-medium transition-all outline-hidden text-right"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  البريد الإلكتروني لحساب Firebase
                </label>
                <input
                  type="email"
                  value={firebaseEmail}
                  onChange={(e) => {
                    setFirebaseEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="example@gmail.com"
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 rounded-xl py-2.5 px-3.5 text-slate-800 text-sm font-medium transition-all outline-hidden text-left dir-ltr"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    كلمة المرور
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {isRegisteringFirebase ? '(6 خانات على الأقل)' : ''}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={firebasePassword}
                    onChange={(e) => {
                      setFirebasePassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 rounded-xl py-2.5 px-3.5 text-slate-800 text-sm font-medium transition-all outline-hidden text-left dir-ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisteringFirebase(!isRegisteringFirebase);
                    setErrorMessage(null);
                  }}
                  className="text-emerald-700 hover:underline font-semibold cursor-pointer"
                >
                  {isRegisteringFirebase ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'إنشاء حساب جديد في Firebase'}
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 transition-colors"
            >
              {t.cancel || 'إلغاء'}
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-800/20 flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              <span>
                {isSubmitting 
                  ? 'جاري التحقق...' 
                  : authMode === 'firebase'
                    ? (isRegisteringFirebase ? 'إنشاء الحساب والدخول' : 'دخول بحساب Firebase')
                    : 'دخول إلى لوحة التحكم'}
              </span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
