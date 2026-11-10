import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  KeyRound,
  Image as ImageIcon,
  Tag,
  Eye,
  EyeOff,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Lock,
  Sparkles,
  Building2,
  Info,
  ShieldAlert,
  MessageCircle,
  Phone,
  Headphones,
  RotateCcw,
} from 'lucide-react';
import type { MasterAdminSession, PlatformIdentitySettings } from '../types';
import {
  usePlatformIdentity,
  updatePlatformSecretPin,
  resetPlatformSecretPin,
  updatePlatformLogo,
  updatePlatformName,
  updatePlatformWhatsapp,
  updatePlatformAssociationsWhatsapp,
  fetchPlatformIdentity,
} from '../api/platformIdentityApi';
import { uploadImageToServer } from '../api/imageApi';

interface Props {
  currentSession: MasterAdminSession | null;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const PlatformIdentityAdminSettings: React.FC<Props> = ({
  currentSession,
  onShowToast,
}) => {
  const isSuperAdmin = currentSession?.role === 'super_admin' || currentSession?.isMaster === true;
  const { identity, isLoading, refetch } = usePlatformIdentity();

  // PIN Form State
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);
  const [pinErrorMsg, setPinErrorMsg] = useState<string | null>(null);

  // Logo Form State
  const [previewLogo, setPreviewLogo] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLogoModified, setIsLogoModified] = useState(false);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [logoSuccessMsg, setLogoSuccessMsg] = useState<string | null>(null);
  const [logoErrorMsg, setLogoErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Name Form State
  const [platformNameInput, setPlatformNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSuccessMsg, setNameSuccessMsg] = useState<string | null>(null);
  const [nameErrorMsg, setNameErrorMsg] = useState<string | null>(null);

  // WhatsApp Form State (الواجهة الرئيسية)
  const [whatsappInput, setWhatsappInput] = useState('');
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false);
  const [whatsappSuccessMsg, setWhatsappSuccessMsg] = useState<string | null>(null);
  const [whatsappErrorMsg, setWhatsappErrorMsg] = useState<string | null>(null);

  // Associations WhatsApp Form State (لوحات تحكم الجمعيات)
  const [assocWhatsappInput, setAssocWhatsappInput] = useState('');
  const [isSavingAssocWhatsapp, setIsSavingAssocWhatsapp] = useState(false);
  const [assocWhatsappSuccessMsg, setAssocWhatsappSuccessMsg] = useState<string | null>(null);
  const [assocWhatsappErrorMsg, setAssocWhatsappErrorMsg] = useState<string | null>(null);

  // Initialize values when identity is loaded
  useEffect(() => {
    if (identity) {
      setPlatformNameInput(identity.platformName || 'syoumax منصة العمل الجمعوي');
      setPreviewLogo(identity.platformLogo || '');
      setWhatsappInput(identity.whatsapp || '00212718861646');
      setAssocWhatsappInput(identity.associationsWhatsapp || identity.whatsapp || '00212718861646');
      setIsLogoModified(false);
    }
  }, [identity]);

  // Security check: strict Super Admin boundary
  if (!isSuperAdmin) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center max-w-2xl mx-auto my-12 text-rose-900 shadow-sm" dir="rtl">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black mb-2">منطقة محمية • غير مصرح بالوصول</h2>
        <p className="text-sm text-rose-700 leading-relaxed mb-4">
          قسم <strong>«تعديل بيانات المنصة»</strong> مخصص حصرياً لـ <strong>Super Admin</strong>. حسابك الحالي (أدمن مساعد) لا يمتلك الصلاحيات الكافية للوصول إلى هذه البيانات الأساسية أو تعديلها.
        </p>
        <span className="inline-block px-3 py-1 bg-rose-200/70 text-rose-800 text-xs font-bold rounded-full">
          حماية أمنية مشددة على مستوى النظام
        </span>
      </div>
    );
  }

  // ================= 1. HANDLE PIN UPDATE =================
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinSuccessMsg(null);
    setPinErrorMsg(null);

    if (!newPin.trim()) {
      setPinErrorMsg('يرجى إدخال الرمز السري الجديد');
      return;
    }

    if (newPin.trim().length < 4) {
      setPinErrorMsg('يجب أن يتكون الرمز السري من 4 خانات على الأقل');
      return;
    }

    if (newPin.trim() !== confirmPin.trim()) {
      setPinErrorMsg('تأكيد الرمز السري الجديد غير متطابق');
      return;
    }

    if (identity.hasCustomPin && !currentPin.trim()) {
      setPinErrorMsg('يرجى إدخال الرمز السري الحالي للتحقق الأمني');
      return;
    }

    setIsSavingPin(true);
    try {
      const res = await updatePlatformSecretPin(
        {
          currentPin: currentPin.trim(),
          newPin: newPin.trim(),
          confirmPin: confirmPin.trim(),
        },
        currentSession
      );

      if (!res.success) {
        setPinErrorMsg(res.error || 'تعذر حفظ كلمة المرور');
        onShowToast(res.error || 'فشل حفظ كلمة المرور', 'error');
      } else {
        setPinSuccessMsg('تم حفظ وتحديث كلمة المرور بنجاح ✅');
        onShowToast('تم تحديث كلمة المرور للوحة الإدارة الرئيسية بنجاح وإبطال السابقة فوراً ✅', 'success');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        await refetch();
      }
    } catch (err: any) {
      setPinErrorMsg(err.message || 'حدث خطأ غير متوقع');
      onShowToast('حدث خطأ أثناء حفظ كلمة المرور', 'error');
    } finally {
      setIsSavingPin(false);
    }
  };

  const [isResettingPin, setIsResettingPin] = useState(false);

  const handleResetPin = async () => {
    setIsResettingPin(true);
    try {
      const res = await resetPlatformSecretPin(currentSession);
      if (res.success) {
        onShowToast(res.message || 'تمت استعادة كلمة المرور المعتمدة بنجاح ✅', 'success');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        await refetch();
      } else {
        onShowToast(res.error || 'فشلت الاستعادة', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'حدث خطأ', 'error');
    } finally {
      setIsResettingPin(false);
    }
  };

  // ================= 2. HANDLE LOGO UPLOAD & SAVE =================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = allowedExtensions.some((ext) => lowerName.endsWith(ext));
    const isImageMime = file.type.startsWith('image/') || file.type === 'image/svg+xml';

    if (!isImageMime && !hasValidExt) {
      setLogoErrorMsg('يرجى اختيار ملف صورة صالح بصيغة مدعومة (PNG, JPG, JPEG, WebP, SVG)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setLogoErrorMsg('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 10 ميجابايت');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPreviewLogo(result);
        setIsLogoModified(true);
        setLogoErrorMsg(null);
        setLogoSuccessMsg(null);
      }
    };
    reader.onerror = () => {
      setLogoErrorMsg('فشل قراءة ملف الصورة من الجهاز');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setPreviewLogo('');
    setSelectedFile(null);
    setIsLogoModified(true);
    setLogoErrorMsg(null);
    setLogoSuccessMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveLogo = async () => {
    setLogoSuccessMsg(null);
    setLogoErrorMsg(null);
    setIsSavingLogo(true);

    try {
      let finalLogoUrl = previewLogo;

      // If a new file is selected, upload to permanent image storage first
      if (selectedFile) {
        try {
          finalLogoUrl = await uploadImageToServer(selectedFile);
        } catch (uploadErr) {
          console.warn('[PlatformIdentity] uploadImageToServer direct failed, falling back to base64 payload:', uploadErr);
          // finalLogoUrl remains previewLogo (base64) which backend saveBase64Logo handles cleanly
        }
      }

      const res = await updatePlatformLogo(finalLogoUrl, currentSession);
      if (!res.success) {
        const errorText = res.error || 'تعذر حفظ شعار المنصة، يرجى المحاولة مرة أخرى.';
        setLogoErrorMsg(errorText);
        onShowToast(errorText, 'error');
      } else {
        setLogoSuccessMsg('تم حفظ التعديل بنجاح ✅');
        onShowToast('تم حفظ وتحديث شعار المنصة بنجاح في قاعدة البيانات ✅', 'success');
        setIsLogoModified(false);
        setSelectedFile(null);
        if (res.logo) {
          setPreviewLogo(res.logo);
        }
        await refetch();
      }
    } catch (err: any) {
      console.error('[PlatformIdentity] Error saving platform logo:', err);
      const friendlyError = 'تعذر حفظ شعار المنصة، يرجى المحاولة مرة أخرى.';
      setLogoErrorMsg(friendlyError);
      onShowToast(friendlyError, 'error');
    } finally {
      setIsSavingLogo(false);
    }
  };

  // ================= 3. HANDLE NAME UPDATE =================
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameSuccessMsg(null);
    setNameErrorMsg(null);

    const trimmed = platformNameInput.trim();
    if (!trimmed || trimmed.length < 2) {
      setNameErrorMsg('يرجى إدخال اسم صحيح للمنصة يتكون من حرفين على الأقل');
      return;
    }

    setIsSavingName(true);
    try {
      const res = await updatePlatformName(trimmed, currentSession);
      if (!res.success) {
        setNameErrorMsg(res.error || 'فشل حفظ تعديل اسم المنصة');
        onShowToast(res.error || 'فشل حفظ اسم المنصة', 'error');
      } else {
        setNameSuccessMsg('تم حفظ التعديل بنجاح ✅');
        onShowToast(`تم حفظ اسم المنصة الجديد «${trimmed}» في قاعدة البيانات وتطبيقه بالكامل ✅`, 'success');
        await refetch();
      }
    } catch (err: any) {
      setNameErrorMsg(err.message || 'حدث خطأ أثناء حفظ الاسم');
      onShowToast('حدث خطأ في حفظ اسم المنصة', 'error');
    } finally {
      setIsSavingName(false);
    }
  };

  // ================= 4. HANDLE WHATSAPP UPDATE =================
  const handleSaveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhatsappSuccessMsg(null);
    setWhatsappErrorMsg(null);

    const raw = whatsappInput.trim();
    if (!raw) {
      setWhatsappErrorMsg('يرجى إدخال رقم واتساب الإدارة');
      return;
    }

    const cleaned = raw.replace(/[\s\-\(\)\.]/g, '');
    const digitsOnly = cleaned.replace(/^\+|^00/, '');

    if (!/^\+?[0-9]{7,18}$/.test(cleaned) || !/^[0-9]{7,18}$/.test(digitsOnly)) {
      setWhatsappErrorMsg('يرجى إدخال رقم هاتف دولي صحيح (مثال: 00212718861646 أو +212718861646)');
      return;
    }

    setIsSavingWhatsapp(true);
    try {
      const res = await updatePlatformWhatsapp(cleaned, currentSession);
      if (!res.success) {
        setWhatsappErrorMsg(res.error || 'فشل حفظ رقم واتساب');
        onShowToast(res.error || 'فشل حفظ رقم واتساب الإدارة', 'error');
      } else {
        setWhatsappSuccessMsg('تم حفظ وتحديث رقم واتساب بنجاح ✅');
        onShowToast(`تم حفظ رقم واتساب إدارة المنصة «${cleaned}» في قاعدة البيانات وتحديث زر التواصل فورياً ✅`, 'success');
        await refetch();
      }
    } catch (err: any) {
      setWhatsappErrorMsg(err.message || 'حدث خطأ أثناء حفظ رقم واتساب');
      onShowToast('حدث خطأ في الاتصال بالخادم لحفظ رقم واتساب', 'error');
    } finally {
      setIsSavingWhatsapp(false);
    }
  };

  const handleSaveAssocWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssocWhatsappSuccessMsg(null);
    setAssocWhatsappErrorMsg(null);

    const raw = assocWhatsappInput.trim();
    if (!raw) {
      setAssocWhatsappErrorMsg('يرجى إدخال رقم واتساب الجمعيات');
      return;
    }

    const cleaned = raw.replace(/[\s\-\(\)\.]/g, '');
    const digitsOnly = cleaned.replace(/^\+|^00/, '');

    if (!/^\+?[0-9]{7,18}$/.test(cleaned) || !/^[0-9]{7,18}$/.test(digitsOnly)) {
      setAssocWhatsappErrorMsg('يرجى إدخال رقم هاتف دولي صحيح للجمعيات (أرقام فقط مع الرمز الدولي، مثال: 00212718861646 أو +212718861646)');
      return;
    }

    setIsSavingAssocWhatsapp(true);
    try {
      const res = await updatePlatformAssociationsWhatsapp(cleaned, currentSession);
      if (!res.success) {
        setAssocWhatsappErrorMsg(res.error || 'فشل حفظ رقم واتساب الجمعيات');
        onShowToast(res.error || 'فشل حفظ رقم واتساب الجمعيات', 'error');
      } else {
        setAssocWhatsappSuccessMsg('تم حفظ وتحديث رقم واتساب الجمعيات بنجاح ✅');
        onShowToast(`تم حفظ «رقم واتساب الجمعيات » الجديد (${cleaned}) في قاعدة البيانات وتحديث زر «تواصل مع الإدارة» في جميع لوحات الجمعيات فورياً ✅`, 'success');
        await refetch();
      }
    } catch (err: any) {
      setAssocWhatsappErrorMsg(err.message || 'حدث خطأ أثناء حفظ رقم واتساب الجمعيات');
      onShowToast('حدث خطأ في الاتصال بالخادم لحفظ رقم واتساب الجمعيات', 'error');
    } finally {
      setIsSavingAssocWhatsapp(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">
      {/* Section Header */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black">
                <Shield className="w-5 h-5" />
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black rounded-full">
                Super Admin فقط • تحكم مركزي دائم
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              تعديل بيانات المنصة
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              تحكم كامل في هوية المنصة، الشعار المعتمد، اسم المنصة، والرمز السري للدخول. تُحفظ التعديلات في <strong>قاعدة البيانات بشكل دائم ومستمر</strong>، ولا تتأثر بتحديث الصفحة أو فتح الموقع من جهاز آخر.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
              <span>تحديث البيانات من السيرفر</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* ================= CARD 1: SECRET PIN ================= */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <KeyRound className="w-6 h-6" />
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border flex items-center gap-1.5 ${
                identity.hasCustomPin
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                <Lock className="w-3 h-3" />
                <span>{identity.hasCustomPin ? 'كلمة المرور مخصصة ومحمية' : 'كلمة المرور المعتمدة'}</span>
              </span>
            </div>

            <h2 className="text-lg font-black text-slate-900 mb-1.5 flex items-center gap-2">
              <span>تغيير كلمة المرور للوحة الإدارة الرئيسية</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              تحكم في كلمة المرور المعتمدة لدخول الأدمن الرئيسي (Super Admin). يتم تشفير وحفظ كلمة المرور بتقنية SHA-256 مع Salt بقاعدة البيانات، مع إبطال كلمات المرور السابقة فور التغيير.
            </p>

            <form onSubmit={handleSavePin} className="space-y-4">
              {/* If customized password exists, ask for current password */}
              {identity.hasCustomPin && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    كلمة المرور الحالية
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPin ? 'text' : 'password'}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      placeholder="أدخل كلمة المرور الحالية"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none font-mono text-left"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPin(!showCurrentPin)}
                      className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ملاحظة أمنية: كلمة المرور الحالية مخفية ومشفرة، أدخلها فقط للتحقق قبل الحفظ.
                  </span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    type={showNewPin ? 'text' : 'password'}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة (4 أحرف/أرقام فأكثر)"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none font-mono text-left"
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPin ? 'text' : 'password'}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور الجديدة للتأكيد"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all outline-none font-mono text-left"
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Success / Error Messages */}
              {pinSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-scale-in font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pinSuccessMsg}</span>
                </div>
              )}
              {pinErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-scale-in font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{pinErrorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingPin || !newPin.trim() || !confirmPin.trim()}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/20 hover:shadow-amber-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {isSavingPin ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ حفظ كلمة المرور...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>حفظ وتطبيق كلمة المرور الجديدة</span>
                  </>
                )}
              </button>

              {identity.hasCustomPin && (
                <button
                  type="button"
                  onClick={handleResetPin}
                  disabled={isResettingPin}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  {isResettingPin ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>استعادة كلمة المرور المعتمدة للمنصة</span>
                </button>
              )}
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span>عند الحفظ يطبق الرمز الجديد فورياً على شاشة الدخول للإدارة العامة.</span>
          </div>
        </div>

        {/* ================= CARD 2: PLATFORM LOGO ================= */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black border bg-indigo-50 text-indigo-800 border-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>هوية بصرية معتمدة</span>
              </span>
            </div>

            <h2 className="text-lg font-black text-slate-900 mb-1.5 flex items-center gap-2">
              <span>شعار المنصة</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              رفع وتعديل الشعار الرسمي للمنصة. يظهر تلقائياً في الواجهة العامة، شريط التنقل، شاشات الدخول، وبطاقات الترويسة.
            </p>

            {/* Logo Preview Box */}
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center mb-4">
              <label className="block text-xs font-bold text-slate-600 mb-2">معاينة الشعار الحالية</label>
              
              <div className="flex items-center justify-center gap-4 sm:gap-6 my-3">
                {/* Light preview */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center min-w-32 sm:min-w-40 min-h-28 sm:min-h-36">
                  {previewLogo ? (
                    <div className="w-20 h-20 rounded-full bg-white border-2 border-emerald-500/30 p-1 flex items-center justify-center overflow-hidden shadow-sm">
                      <img
                        src={previewLogo}
                        alt="معاينة شعار المنصة"
                        className="w-full h-full object-contain rounded-full select-none"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md">
                      <Building2 className="w-8 h-8" />
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 font-bold mt-2">خلفية فاتحة</span>
                </div>

                {/* Dark preview */}
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-sm flex flex-col items-center justify-center min-w-32 sm:min-w-40 min-h-28 sm:min-h-36">
                  {previewLogo ? (
                    <div className="w-20 h-20 rounded-full bg-white border-2 border-emerald-500/30 p-1 flex items-center justify-center overflow-hidden shadow-sm">
                      <img
                        src={previewLogo}
                        alt="معاينة شعار المنصة"
                        className="w-full h-full object-contain rounded-full select-none"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md">
                      <Building2 className="w-8 h-8" />
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 font-bold mt-2">خلفية داكنة</span>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp, image/svg+xml"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex items-center justify-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{previewLogo ? 'تعديل الشعار' : 'إضافة شعار'}</span>
                </button>

                {previewLogo && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title="إزالة الشعار والعودة للرمز الافتراضي"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إزالة</span>
                  </button>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block mt-2">
                يدعم PNG، JPG، SVG، WebP من الهاتف أو الكمبيوتر أو التابلت
              </span>
            </div>

            {/* Success / Error */}
            {logoSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-scale-in font-bold mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{logoSuccessMsg}</span>
              </div>
            )}
            {logoErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-scale-in font-bold mb-3">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{logoErrorMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveLogo}
              disabled={isSavingLogo || (!isLogoModified && previewLogo === identity.platformLogo)}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSavingLogo ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ حفظ الشعار في قاعدة البيانات...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ التعديل</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
            <span>يتم ضبط الأبعاد تلقائياً لتناسب شريط الترويسة وواجهات النظام.</span>
          </div>
        </div>

        {/* ================= CARD 3: PLATFORM NAME ================= */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <Tag className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black border bg-emerald-50 text-emerald-800 border-emerald-200 flex items-center gap-1.5">
                <Building2 className="w-3 h-3" />
                <span>اسم المنصة الرسمي</span>
              </span>
            </div>

            <h2 className="text-lg font-black text-slate-900 mb-1.5 flex items-center gap-2">
              <span>اسم المنصة</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              تحديد أو تعديل الاسم المعتمد للمنصة. يتم تحديثه تلقائياً في عنوان المتصفح، الواجهة الرئيسية، الترويسة، ولوحات التحكم.
            </p>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المنصة الحالي / الجديد
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={platformNameInput}
                    onChange={(e) => {
                      setPlatformNameInput(e.target.value);
                      setNameSuccessMsg(null);
                      setNameErrorMsg(null);
                    }}
                    placeholder="مثال: syoumax منصة العمل الجمعوي"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none font-bold text-slate-900"
                    required
                    minLength={2}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  الاسم المسجل حالياً: <strong className="text-slate-700">{identity.platformName || 'syoumax منصة العمل الجمعوي'}</strong>
                </span>
              </div>

              {/* Preview preview bar */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <span className="text-[11px] font-bold text-slate-500 block mb-1">معاينة حية للمظهر:</span>
                <div className="flex items-center gap-2 font-black text-slate-900">
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">
                    {previewLogo ? (
                      <img src={previewLogo} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span>{platformNameInput.trim() || 'اسم المنصة'}</span>
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-black">
                    PRO
                  </span>
                </div>
              </div>

              {/* Success / Error Messages */}
              {nameSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-scale-in font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{nameSuccessMsg}</span>
                </div>
              )}
              {nameErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-scale-in font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{nameErrorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingName || !platformNameInput.trim()}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {isSavingName ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ حفظ الاسم في قاعدة البيانات...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>حفظ التعديل</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span>يتم حفظ الاسم في قاعدة البيانات وتحديثه فورياً في جميع صفحات وزوايا المنصة.</span>
          </div>
        </div>

        {/* ================= CARD 4: WHATSAPP SETTINGS (إعدادات التواصل عبر واتساب) ================= */}
        <div id="section-whatsapp-admin-settings" className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black border bg-emerald-50 text-emerald-800 border-emerald-200 flex items-center gap-1.5">
                <Phone className="w-3 h-3" />
                <span>إعدادات التواصل عبر واتساب</span>
              </span>
            </div>

            <h2 className="text-lg font-black text-slate-900 mb-1.5 flex items-center gap-2">
              <span>رقم واتساب الإدارة</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              تحديد أو تعديل رقم واتساب إدارة المنصة للتواصل المباشر. يتم ربطه تلقائياً بزر <strong>«تواصل معنا»</strong> في أعلى الواجهة الرئيسية للمنصة ويُحفظ بشكل دائم.
            </p>

            <form onSubmit={handleSaveWhatsapp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم واتساب الإدارة (مع الرمز الدولي)
                </label>
                <div className="relative" dir="ltr">
                  <input
                    type="text"
                    value={whatsappInput}
                    onChange={(e) => {
                      setWhatsappInput(e.target.value);
                      setWhatsappSuccessMsg(null);
                      setWhatsappErrorMsg(null);
                    }}
                    placeholder="مثال: 00212718861646 أو +212718861646"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none font-bold text-slate-900 font-mono text-left"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block" dir="rtl">
                  الرقم المسجل حالياً: <strong className="text-slate-700 font-mono">{identity.whatsapp || '00212718861646'}</strong>
                </span>
              </div>

              {/* Live Preview card */}
              <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/70 text-xs">
                <span className="text-[11px] font-bold text-emerald-800 block mb-1.5">معاينة زر التواصل بالواجهة:</span>
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-xs">
                    <MessageCircle className="w-4 h-4 fill-white/20" />
                    <span>تواصل معنا</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-bold font-mono dir-ltr">
                    {whatsappInput.trim() || '00212718861646'}
                  </span>
                </div>
              </div>

              {/* Success / Error Messages */}
              {whatsappSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-scale-in font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{whatsappSuccessMsg}</span>
                </div>
              )}
              {whatsappErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-scale-in font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{whatsappErrorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                id="btn-save-whatsapp-settings"
                disabled={isSavingWhatsapp || !whatsappInput.trim()}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {isSavingWhatsapp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ حفظ رقم واتساب في قاعدة البيانات...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>حفظ التغييرات</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span>يتم تحديث زر «تواصل معنا» تلقائياً على كافة الأجهزة فور حفظ الرقم دون الحاجة لتعديل الكود.</span>
          </div>
        </div>

        {/* ================= CARD 5: ASSOCIATIONS WHATSAPP (رقم واتساب الجمعيات ) ================= */}
        <div id="section-associations-whatsapp-admin-settings" className="bg-white rounded-3xl border border-emerald-200/90 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <Headphones className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black border bg-emerald-100/70 text-emerald-900 border-emerald-300 flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-emerald-600" />
                <span>لوحات تحكم الجمعيات • دعم وتواصل فوري</span>
              </span>
            </div>

            <h2 className="text-lg font-black text-slate-900 mb-1.5 flex items-center gap-2">
              <span>رقم واتساب الجمعيات </span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              إدارة وتعديل رقم واتساب المعتمد لتواصل ودعم الجمعيات. عند تعديل هذا الرقم وحفظه، يتم فورياً وبشكل تلقائي تحديث الرقم المعتمد في زر <strong>«تواصل مع الإدارة»</strong> بجميع لوحات تحكم الجمعيات دون الحاجة لتعديل كل جمعية بشكل منفصل.
            </p>

            <form onSubmit={handleSaveAssocWhatsapp} className="space-y-4">
              <div>
                <label htmlFor="input-associations-whatsapp" className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم واتساب الجمعيات  (مع الرمز الدولي)
                </label>
                <div className="relative" dir="ltr">
                  <input
                    type="text"
                    id="input-associations-whatsapp"
                    value={assocWhatsappInput}
                    onChange={(e) => {
                      setAssocWhatsappInput(e.target.value);
                      setAssocWhatsappSuccessMsg(null);
                      setAssocWhatsappErrorMsg(null);
                    }}
                    placeholder="مثال: 00212718861646 أو +212718861646"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none font-bold text-slate-900 font-mono text-left"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block" dir="rtl">
                  الرقم المعتمد حالياً في لوحات الجمعيات: <strong className="text-slate-700 font-mono">{identity.associationsWhatsapp || identity.whatsapp || '00212718861646'}</strong>
                </span>
              </div>

              {/* Live Preview card: Association Dashboard Button */}
              <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 text-xs">
                <span className="text-[11px] font-bold text-emerald-900 block mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>معاينة زر «تواصل مع الإدارة» في لوحات الجمعيات:</span>
                </span>
                <div className="flex items-center justify-between gap-2 flex-wrap bg-white p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-xs">
                    <MessageCircle className="w-4 h-4 fill-white/20" />
                    <span>تواصل مع الإدارة</span>
                  </div>
                  <span className="text-[11px] text-emerald-800 font-bold font-mono dir-ltr">
                    {assocWhatsappInput.trim() || identity.associationsWhatsapp || identity.whatsapp || '00212718861646'}
                  </span>
                </div>
              </div>

              {/* Success / Error Messages */}
              {assocWhatsappSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-scale-in font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{assocWhatsappSuccessMsg}</span>
                </div>
              )}
              {assocWhatsappErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-scale-in font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{assocWhatsappErrorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                id="btn-save-associations-whatsapp"
                disabled={isSavingAssocWhatsapp || !assocWhatsappInput.trim()}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {isSavingAssocWhatsapp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ حفظ رقم واتساب الجمعيات في قاعدة البيانات...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>حفظ رقم واتساب الجمعيات</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span>يتم تحديث زر «تواصل مع الإدارة» تلقائياً في كافة لوحات الجمعيات فور الحفظ وبشكل دائم.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
