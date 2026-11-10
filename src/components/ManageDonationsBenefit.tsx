import React, { useState, useEffect, useMemo } from 'react';
import { 
  HeartHandshake, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Save, 
  Globe, 
  Users, 
  Building2, 
  HelpCircle, 
  ShieldCheck, 
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';
import { AssociationSettings, Language, AssociationTenant } from '../types';
import { getTenantById, updateTenantDetails, getAllTenants } from '../tenantStorage';
import { apiSyncSettings } from '../api/settingsApi';
import { useAssociationSectionsConfig } from '../associationSectionsStorage';
import { getStoredSettings, saveSettings } from '../storage';

interface ManageDonationsBenefitProps {
  settings?: AssociationSettings;
  onUpdateSettings?: (settings: AssociationSettings) => void;
  activeTenantId?: string;
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  lang?: Language;
  onLogAudit?: (action: 'create' | 'update' | 'delete', description: string) => void;
  currentAdminSession?: any;
}

export const ManageDonationsBenefit: React.FC<ManageDonationsBenefitProps> = ({
  settings: propSettings,
  onUpdateSettings,
  activeTenantId,
  addToast,
  lang = 'ar',
  onLogAudit,
  currentAdminSession,
}) => {
  const currentTenantId = activeTenantId || 'tenant_nour';
  const tenant = getTenantById(currentTenantId);
  const { config: sectionsConfig } = useAssociationSectionsConfig();
  const rawBrandName = sectionsConfig.sectionBrandNames?.donationsBenefit || 'syoumax';
  const brandName = rawBrandName.toLowerCase() === 'youx' || rawBrandName.toLowerCase() === 'aljana' ? 'syoumax' : rawBrandName;
  const settings = useMemo(() => propSettings || getStoredSettings(currentTenantId), [propSettings, currentTenantId]);

  // Initialize toggle state from settings or tenant
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (settings.enablePublicDonations !== undefined) {
      return settings.enablePublicDonations;
    }
    if (tenant && tenant.enablePublicDonations !== undefined) {
      return tenant.enablePublicDonations;
    }
    return true; // Default is enabled
  });

  const [initialValue, setInitialValue] = useState<boolean>(() => {
    if (settings.enablePublicDonations !== undefined) {
      return settings.enablePublicDonations;
    }
    if (tenant && tenant.enablePublicDonations !== undefined) {
      return tenant.enablePublicDonations;
    }
    return true;
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Synchronize when settings or tenant change
  useEffect(() => {
    const currentVal = settings.enablePublicDonations !== undefined 
      ? settings.enablePublicDonations 
      : (tenant?.enablePublicDonations !== undefined ? tenant.enablePublicDonations : true);
    setIsEnabled(currentVal);
    setInitialValue(currentVal);
  }, [settings.enablePublicDonations, tenant?.enablePublicDonations, currentTenantId]);

  const hasUnsavedChanges = isEnabled !== initialValue;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      // 1. Update Association Settings
      const updatedSettings: AssociationSettings = {
        ...settings,
        enablePublicDonations: isEnabled,
      };

      // 2. Update Tenant storage and local state
      updateTenantDetails(currentTenantId, {
        enablePublicDonations: isEnabled,
      });

      // 3. Update global App settings
      saveSettings(updatedSettings, true, currentTenantId);
      onUpdateSettings?.(updatedSettings);

      // 4. Sync settings with server database
      const settingsSyncRes = await apiSyncSettings(updatedSettings, currentAdminSession, currentTenantId);

      // 5. Update tenant in server database
      let tenantSyncOk = true;
      try {
        const tenantRes = await fetch(`/api/tenants/${encodeURIComponent(currentTenantId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enablePublicDonations: isEnabled,
          }),
        });
        if (!tenantRes.ok) {
          tenantSyncOk = false;
        }
      } catch (err) {
        console.warn('[ManageDonationsBenefit] Could not sync tenant PUT endpoint:', err);
      }

      // 6. Dispatch custom event for UI updates in real-time
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chayef-tenants-changed', {
          detail: { tenantId: currentTenantId, enablePublicDonations: isEnabled }
        }));
      }

      // 7. Audit log
      const assocName = settings.name || tenant?.name || 'الجمعية';
      const actionDesc = isEnabled
        ? `تفعيل قسم «اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية» والظهور في قسم «تبرع وشارك في مشاريع التنمية» للجمعية (${assocName})`
        : `تعطيل قسم «اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية» وإخفاء الجمعية من قسم «تبرع وشارك في مشاريع التنمية» (${assocName})`;
      
      onLogAudit?.('update', actionDesc);

      setInitialValue(isEnabled);
      const successMessage = isEnabled
        ? 'تم تفعيل الظهور في واجهة المنصة واستقبال التبرعات وحفظ الإعدادات في قاعدة البيانات بنجاح!'
        : 'تم تعطيل الظهور وإخفاء الجمعية من قسم التبرعات بالواجهة العامة وحفظ التغييرات بنجاح!';
      
      setSaveSuccessMsg(successMessage);
      addToast?.('success', successMessage);

    } catch (error: any) {
      console.error('[ManageDonationsBenefit] Save error:', error);
      const errorMsg = 'حدث خطأ أثناء حفظ التغييرات في قاعدة البيانات. يرجى المحاولة مرة أخرى.';
      setSaveErrorMsg(errorMsg);
      addToast?.('error', errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl" id="manage-donations-benefit-section">
      {/* ================= HEADER HERO CARD ================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 text-white p-6 sm:p-8 shadow-xl border border-emerald-800/30">
        <div className="absolute top-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>بوابة جمع التبرعات والمشاريع التنموية</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              اجعل منصتك ظاهرة للعموم للحصول على التبرعات المالية
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              تحكم في ظهور جمعيتكم بواجهة {brandName} منصة العمل الجمعوي لاستقبال مساهمات وتبرعات المحسنين، الشركاء، والجالية بالخارج.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex items-center gap-4 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] text-slate-300 font-medium">الجمعية المستهدفة</div>
              <div className="text-sm font-black text-white truncate max-w-[200px]">
                {settings.name || tenant?.name || 'جمعية النور للتنمية والتضامن'}
              </div>
              <div className="text-[10px] text-emerald-300 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{tenant?.city || 'المغرب'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ALERTS & STATUS MESSAGES ================= */}
      {saveSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm font-bold leading-relaxed">{saveSuccessMsg}</div>
        </div>
      )}

      {saveErrorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 shadow-xs animate-in fade-in duration-300">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm font-bold leading-relaxed">{saveErrorMsg}</div>
        </div>
      )}

      {/* ================= MAIN TOGGLE CONTROL CARD ================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shrink-0 transition-colors ${
                isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {isEnabled ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ظهور بواجهة المنصة من أجل تلقي التبرعات
                </h3>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold mt-1 ${
                  isEnabled 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {isEnabled ? 'مفعل ويظهر للعموم' : 'معطل ومخفي حالياً'}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1 pr-13">
              سوف تتمكن من تلقي التبرعات من طرف المحسنين والقطاع الخاص والجالية المقيمة بالخارج والحصول على منخرطين جدد.
            </p>
          </div>

          {/* Toggle Switch Button */}
          <div className="flex items-center gap-3 self-start sm:self-center pr-13 sm:pr-0 shrink-0">
            <button
              type="button"
              id="btn-toggle-public-donations"
              role="switch"
              aria-checked={isEnabled}
              onClick={() => {
                setIsEnabled(!isEnabled);
                setSaveSuccessMsg(null);
                setSaveErrorMsg(null);
              }}
              className={`relative inline-flex h-8 w-16 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
                isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span className="sr-only">ظهور بواجهة المنصة من أجل تلقي التبرعات</span>
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? '-translate-x-8' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* ================= APPEARANCE MECHANISM EXPLANATION ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            isEnabled 
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 shadow-xs' 
              : 'bg-slate-50 border-slate-200 text-slate-600 opacity-60'
          }`}>
            <div className="flex items-center gap-2.5 font-bold text-sm mb-2 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>عند التفعيل (الحالة الحالية: {isEnabled ? 'نشطة' : 'غير نشطة'})</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-700">
              تظهر الجمعية تلقائياً في واجهة <strong className="text-emerald-900">{brandName} منصة العمل الجمعوي</strong> داخل قسم:
              <span className="block mt-1 p-2 rounded-xl bg-white border border-emerald-200 font-black text-emerald-800 text-center">
                «تبرع وشارك في مشاريع التنمية»
              </span>
              تُعرض بطاقة الجمعية، مشاريعها التنموية، وحملات التبرع للزوار والمتبرعين.
            </p>
          </div>

          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            !isEnabled 
              ? 'bg-amber-50/70 border-amber-200 text-amber-950 shadow-xs' 
              : 'bg-slate-50 border-slate-200 text-slate-600 opacity-60'
          }`}>
            <div className="flex items-center gap-2.5 font-bold text-sm mb-2 text-amber-900">
              <XCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>عند التعطيل (الحالة الحالية: {!isEnabled ? 'نشطة' : 'غير نشطة'})</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-700">
              تختفي الجمعية مباشرة من قسم <strong className="text-slate-900">«تبرع وشارك في مشاريع التنمية»</strong> في الواجهة العامة للمنصة.
              <span className="block mt-1 p-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-center font-bold">
                تبقى جميع بياناتكم، حملاتكم، وأنشطتكم محفوظة بالكامل دون أي حذف.
              </span>
            </p>
          </div>
        </div>

        {/* ================= KEY BENEFITS GRID ================= */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
            المزايا المكتسبة عند تفعيل الظهور للعموم:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-slate-900">تلقي التبرعات المباشرة</div>
                <div className="text-slate-500 text-[11px] leading-relaxed">
                  استقبال دعم مالي موجه لمشاريع الجمعية وحملاتها الخيرية.
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-slate-900">استقطاب منخرطين جدد</div>
                <div className="text-slate-500 text-[11px] leading-relaxed">
                  إتاحة الانخراط للجمهور والجالية بالخارج بسهولة.
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-slate-900">إدارة مستقلة ومحمية</div>
                <div className="text-slate-500 text-[11px] leading-relaxed">
                  إعداد مستقل لكل جمعية ومحفوظ بشكل دائم بقاعدة البيانات.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= SAVE CHANGES ACTION BAR ================= */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                توجد تغييرات غير محفوظة! اضغط على زر حفظ التغييرات لاعتمادها.
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                الحالة الحالية محفوظة ومتزامنة بقاعدة البيانات
              </span>
            )}
          </div>

          <button
            type="button"
            id="btn-save-donations-benefit"
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2.5 shadow-md active:scale-95 cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/40'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            } ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>جاري الحفظ في قاعدة البيانات...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التغييرات</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
export default ManageDonationsBenefit;
