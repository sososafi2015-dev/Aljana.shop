import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRight, 
  X 
} from 'lucide-react';
import { apiUnifiedMasterAdminLogin, usePlatformIdentity } from '../api/platformIdentityApi';
import { setMasterAdminSession } from '../tenantStorage';

interface MasterAdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const MasterAdminAuthModal: React.FC<MasterAdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const { identity: platformIdentity } = usePlatformIdentity();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Reset and focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      setIsLoading(false);

      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  // Unified Single Password Login Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = password.trim();

    if (!trimmed) {
      setError('كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiUnifiedMasterAdminLogin(trimmed);
      if (res.success && res.session) {
        setMasterAdminSession(res.session);
        const welcomeMsg = res.role === 'secondary_admin'
          ? (res.message || `مرحباً بك يا ${res.session.fullName || 'أدمن مساعد'}، تم تسجيل الدخول بنجاح`)
          : 'تم تسجيل الدخول إلى الإدارة العامة للمنصة بنجاح';
        onShowToast?.(welcomeMsg, 'success');
        onSuccess();
      } else {
        setError(res.error || 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
        passwordInputRef.current?.select();
      }
    } catch {
      setError('كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
      passwordInputRef.current?.select();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div 
        id="master-admin-auth-modal-content"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 relative overflow-hidden animate-scale-in"
      >
        {/* Subtle decorative top border */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          id="btn-close-master-auth-modal"
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 left-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          title="إغلاق النافذة"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          {platformIdentity?.platformLogo ? (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border-2 border-emerald-500/30 shadow-lg p-1.5 mx-auto mb-3.5 flex items-center justify-center overflow-hidden">
              <img
                src={platformIdentity.platformLogo}
                alt={platformIdentity.platformName}
                className="w-full h-full object-contain rounded-full select-none"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-600/25">
              <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-black text-emerald-800 mb-2">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>منطقة آمنة ومحمية</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            دخول إلى الإدارة العامة للمنصة
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
            يرجى إدخال كلمة المرور المعتمدة للتحقق من الصلاحيات والمتابعة
          </p>
        </div>

        {/* Error Notification Alert */}
        {error && (
          <div 
            id="master-auth-error-box"
            className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-xs"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Unified Login Form: Single Password Field */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label 
                htmlFor="master-admin-password-input" 
                className="block text-xs font-bold text-slate-700"
              >
                كلمة المرور
              </label>
              <span className="text-[11px] text-slate-400 font-medium">مطلوبة للدخول</span>
            </div>

            <div className="relative">
              {/* Right Icon (Lock) */}
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>

              {/* Password Input */}
              <input
                id="master-admin-password-input"
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                disabled={isLoading}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="أدخل كلمة المرور الخاصة بحسابك"
                className={`w-full pr-11 pl-11 py-3 text-sm bg-slate-50 border rounded-xl focus:bg-white transition-all outline-none text-left font-mono ${
                  error
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                    : 'border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                }`}
              />

              {/* Left Toggle Button (Show/Hide Password) */}
              <button
                id="btn-toggle-master-password-visibility"
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isLoading}
                className="absolute inset-y-0 left-0 pl-3.5 pr-2 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>تسجيل دخول موحد • يتعرف النظام تلقائياً على نوع الحساب والصلاحيات المخصصة</span>
            </div>
          </div>

          {/* Submit Action */}
          <button
            id="btn-submit-master-admin-auth"
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جارٍ التحقق من كلمة المرور والصلاحيات...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>دخول إلى الإدارة العامة للمنصة</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </>
            )}
          </button>
        </form>

        {/* Footer cancel / back */}
        <div className="mt-5 pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-bold cursor-pointer"
          >
            إلغاء والعودة للمنصة
          </button>
        </div>
      </div>
    </div>
  );
};
