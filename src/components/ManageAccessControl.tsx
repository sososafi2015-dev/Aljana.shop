import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  MousePointerClick, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  Smartphone, 
  Laptop, 
  Info,
  Sparkles,
  KeyRound,
  ShieldAlert
} from 'lucide-react';
import { AssociationSettings, CurrentAdminSession, AuditLog } from '../types';

interface ManageAccessControlProps {
  settings: AssociationSettings;
  onUpdateSettings: (newSettings: AssociationSettings) => void;
  onLogAudit?: (
    action: AuditLog['action'],
    targetType: AuditLog['targetType'],
    description: string
  ) => void;
  currentAdminSession?: CurrentAdminSession | null;
  onRequestAdmin?: () => void;
}

export const ManageAccessControl: React.FC<ManageAccessControlProps> = ({
  settings,
  onUpdateSettings,
  onLogAudit,
  currentAdminSession,
}) => {
  const [showAdminLoginButton, setShowAdminLoginButton] = useState<boolean>(
    settings.showAdminLoginButton ?? false
  );
  const [enableTripleClickLogoLogin, setEnableTripleClickLogoLogin] = useState<boolean>(
    settings.enableTripleClickLogoLogin ?? true
  );

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [testClicks, setTestClicks] = useState<number>(0);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);
  const testTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const isSuperAdmin = currentAdminSession
    ? currentAdminSession.type === 'super_admin' || currentAdminSession.role === 'main_admin'
    : true;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const updated: AssociationSettings = {
      ...settings,
      showAdminLoginButton,
      enableTripleClickLogoLogin,
    };

    onUpdateSettings(updated);

    if (onLogAudit) {
      onLogAudit(
        'update',
        'settings',
        `تحديث إعدادات الدخول إلى لوحة التحكم: إظهار زر الدخول العام (${
          showAdminLoginButton ? 'مفعل' : 'معطل'
        })، الدخول عبر النقر 3 مرات على الشعار (${
          enableTripleClickLogoLogin ? 'مفعل' : 'معطل'
        })`
      );
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  // Interactive Live Tester for the Logo Triple-Click
  const handleTestLogoClick = () => {
    if (!enableTripleClickLogoLogin) {
      setTestSuccessMessage('⚠️ ميزة الدخول عبر الشعار معطلة حاليًا. لن يفتح حقل كلمة المرور عند النقر.');
      setTimeout(() => setTestSuccessMessage(null), 3000);
      return;
    }

    const nextClicks = testClicks + 1;
    setTestClicks(nextClicks);

    if (testTimerRef.current) {
      clearTimeout(testTimerRef.current);
    }

    if (nextClicks >= 3) {
      setTestClicks(0);
      setTestSuccessMessage('🎯 ممتاز! تم استشعار 3 ضغطات متتالية بنجاح، وسيظهر حقل إدخال كلمة المرور للأدمن فورًا.');
      setTimeout(() => setTestSuccessMessage(null), 4000);
    } else {
      testTimerRef.current = setTimeout(() => {
        setTestClicks(0);
      }, 900);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-7 rounded-3xl border border-emerald-800/30 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  تحكم في الدخول إلى لوحة التحكم
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  إعدادات الأمان
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                تحكم كامل ومستقل في إظهار أو إخفاء بوابة الدخول الإدارية عن عموم زوار المتجر، مع تفعيل طريقة الدخول المخفية عبر النقر 3 مرات على شعار المتجر.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notice */}
      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-xs transition-all">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>تم حفظ وتطبيق إعدادات الدخول إلى لوحة التحكم بنجاح في كامل النظام!</span>
        </div>
      )}

      {/* Current State Indicator Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">بوابة الإدارة للعموم</span>
          <div className="flex items-center gap-2 mt-1.5">
            {showAdminLoginButton ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span className="text-xs font-bold text-slate-900">زر الدخول ظاهر للزوار</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold text-emerald-800">مخفي عن العموم (آمن)</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">الدخول السري عبر الشعار</span>
          <div className="flex items-center gap-2 mt-1.5">
            {enableTripleClickLogoLogin ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold text-emerald-800">مفعل (3 ضغطات على الشعار)</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                <span className="text-xs font-bold text-slate-600">معطل حالياً</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">نظام الحماية والمصادقة</span>
          <div className="flex items-center gap-2 mt-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-900">مشفر ومحمي بكلمة المرور</span>
          </div>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <KeyRound className="w-5 h-5 text-emerald-700" />
          <span>إعدادات طرق الدخول والتحكم المستقل</span>
        </h3>

        {/* Setting 1: إظهار زر الدخول إلى لوحة التحكم */}
        <div className="p-5 rounded-2xl border transition-all bg-slate-50/70 hover:bg-slate-50 border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  showAdminLoginButton ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {showAdminLoginButton ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </div>
                <h4 className="font-black text-sm sm:text-base text-slate-900">
                  إظهار زر الدخول إلى لوحة التحكم
                </h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  showAdminLoginButton ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {showAdminLoginButton ? 'مفعل' : 'معطل'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed pr-10">
                عند تفعيله: يظهر زر <strong>«دخول إلى لوحة التحكم»</strong> في الشريط العلوي وتذييل واجهة المتجر.
                <br />
                عند تعطيله: <strong>يختفي زر الدخول ورابط الإدارة تمامًا</strong> من واجهة المتجر ولا يظهر للزوار أو المستخدمين العاديين.
              </p>
            </div>

            {/* Switch button */}
            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center pr-10 sm:pr-0">
              <button
                type="button"
                onClick={() => setShowAdminLoginButton(!showAdminLoginButton)}
                id="toggle-show-admin-button"
                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  showAdminLoginButton ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={showAdminLoginButton}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    showAdminLoginButton ? '-translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Setting 2: الدخول عبر الضغط 3 مرات على شعار المتجر */}
        <div className="p-5 rounded-2xl border transition-all bg-slate-50/70 hover:bg-slate-50 border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  enableTripleClickLogoLogin ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  <MousePointerClick className="w-4 h-4" />
                </div>
                <h4 className="font-black text-sm sm:text-base text-slate-900">
                  الدخول عبر الضغط 3 مرات على شعار المتجر
                </h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  enableTripleClickLogoLogin ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {enableTripleClickLogoLogin ? 'مفعل' : 'معطل'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed pr-10">
                عند تفعيله: يمكن للأدمن فتح نافذة إدخال كلمة مرور الإدارة من خلال <strong>الضغط 3 مرات متتالية</strong> على صورة الشعار في أعلى المتجر.
                <br />
                عند تعطيله: لا يتم تفعيل طريقة الدخول المخفية عبر الشعار، وتعمل نقرة الشعار فقط للانتقال إلى الصفحة الرئيسية.
              </p>
            </div>

            {/* Switch button */}
            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center pr-10 sm:pr-0">
              <button
                type="button"
                onClick={() => setEnableTripleClickLogoLogin(!enableTripleClickLogoLogin)}
                id="toggle-triple-click-logo"
                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  enableTripleClickLogoLogin ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={enableTripleClickLogoLogin}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    enableTripleClickLogoLogin ? '-translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Independence & Example Info Box */}
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-blue-950">
            <Info className="w-4 h-4 text-blue-700 shrink-0" />
            <span>التحكم المستقل والمرن بين الخيارين:</span>
          </div>
          <p className="leading-relaxed text-blue-800">
            يمكنك تفعيل أو تعطيل أيٍّ من الخيارين بشكل مستقل تمامًا.
            <br />
            <strong>الوضع الموصى به:</strong> زر الدخول ❌ معطل + الدخول عبر الشعار 3 مرات ✅ مفعل
            <br />
            ← في هذه الحالة، تكون واجهة المتجر خالية تمامًا من أي زر أو رابط إداري للعموم، بينما يستطيع الأدمن الدخول في أي وقت بالنقر 3 مرات متتالية على الشعار.
          </p>
        </div>

        {/* Warning if both are turned off */}
        {!showAdminLoginButton && !enableTripleClickLogoLogin && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold">تنبيه: لقد قمت بتعطيل كلا خياري الدخول معًا!</strong>
              <p className="leading-relaxed text-amber-800">
                في هذه الحالة لن يظهر زر الإدارة للعموم ولن تعمل طريقة النقر 3 مرات على الشعار. ننصح بالإبقاء على خيار الدخول عبر الشعار مفعلًا حتى يتمكن المشرفون من الدخول.
              </p>
            </div>
          </div>
        )}

        {/* Security and Protection Standards Box */}
        <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/90 space-y-3">
          <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs sm:text-sm">
            <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>معايير الأمان وحماية النظام الإداري (Security & Integrity)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-emerald-900">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>حماية أصيلة بالمصادقة:</strong> إخفاء الزر ليس وسيلة الحماية الوحيدة؛ لوحة التحكم محمية بنظام التحقق من الحساب وكلمة المرور المشفرة.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>الضغط الثلاثي لا يسجل الدخول تلقائياً:</strong> بل يقتصر دوره على إظهار نموذج إدخال كلمة المرور بأمان دون كشف أي أسرار.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>حسابات وصلاحيات محفوظة:</strong> لم يتم تغيير أو مساس بأي من حسابات الأدمن الرئيسي أو أدمن الدرجة الثانية.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>توافق كامل مع الهاتف والكمبيوتر:</strong> تعمل الميزة بدقة عبر لمس شاشة الهاتف ونقر فأرة الحاسوب.
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Live Simulator / Tester */}
        <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h4 className="font-bold text-xs sm:text-sm text-white">
                تجربة حية لطريقة النقر 3 مرات على الشعار
              </h4>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Smartphone className="w-3.5 h-3.5" />
              <span>الهاتف</span>
              <span>•</span>
              <Laptop className="w-3.5 h-3.5" />
              <span>الكمبيوتر</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            اضغط على الشعار أدناه 3 مرات متتالية وسريعة لاختبار استجابة العداد وكيفية فتح حقل كلمة المرور:
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            {/* Interactive Logo Button */}
            <div 
              onClick={handleTestLogoClick}
              className="flex items-center gap-3 bg-slate-900 hover:bg-slate-950 p-2.5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all active:scale-95 select-none"
              title="انقر هنا 3 مرات متتالية"
            >
              <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden shrink-0 border border-slate-700">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <ShieldCheck className="w-7 h-7 text-emerald-700" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">{settings.name || 'الجمعية'}</span>
                <span className="text-[10px] text-emerald-400 font-medium">اضغط هنا للتجربة</span>
              </div>
            </div>

            {/* Visual Click Counter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      testClicks >= step
                        ? 'bg-emerald-500 text-slate-950 scale-110 shadow-md shadow-emerald-500/30'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {testClicks}/3 نقرات
              </span>
            </div>
          </div>

          {testSuccessMessage && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{testSuccessMessage}</span>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
          <span className="text-xs text-slate-500">
            يتم تطبيق التعديلات فورًا على واجهة المتجر عند الحفظ.
          </span>
          <button
            type="button"
            onClick={handleSave}
            id="save-access-control-btn"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>حفظ تعديلات الدخول</span>
          </button>
        </div>
      </div>
    </div>
  );
};
