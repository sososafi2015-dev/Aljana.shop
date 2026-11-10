import React from 'react';
import { ShieldAlert, ArrowRight, ShieldCheck, Lock, Building2, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { AssociationTenant } from '../types';

interface SuspendedAssociationScreenProps {
  tenant: AssociationTenant;
  onBackToPortal: () => void;
  onOpenMasterAdmin: () => void;
}

export const SuspendedAssociationScreen: React.FC<SuspendedAssociationScreenProps> = ({
  tenant,
  onBackToPortal,
  onOpenMasterAdmin,
}) => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between" dir="rtl">
      {/* Top Banner */}
      <header className="bg-slate-950/80 border-b border-slate-800 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black shadow-lg shadow-rose-600/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-300">منصة إدارة الجمعيات</div>
              <div className="text-[11px] text-rose-400 font-semibold">حالة الجمعية: 🔴 معطلة</div>
            </div>
          </div>

          <button
            onClick={onBackToPortal}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>بوابة المنصة الرئيسية</span>
          </button>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="max-w-xl w-full bg-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/20 text-center relative overflow-hidden backdrop-blur-sm animate-scale-in">
          {/* Subtle glow accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Status Icon & Association Branding */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-500 shadow-xl shadow-rose-950/50">
              <Lock className="w-10 h-10" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>🔴 الجمعية غير مفعّلة حاليًا</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              {tenant.name}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {tenant.city}، {tenant.country}
            </p>
          </div>

          {/* Explanation Box */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 text-right space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 leading-relaxed">
                تم إيقاف وصول المستخدمين إلى واجهة هذه الجمعية ومتجرها الإلكتروني مؤقتاً بقرار من <strong className="text-white">الإدارة العامة للمنصة</strong>، ولا يستطيع أعضاء الجمعية أو الزوار استخدام وظائفها أثناء فترة التعطيل.
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3 border-t border-slate-800/80">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-300/90 leading-relaxed">
                <strong>كافة البيانات محفوظة بأمان:</strong> نؤكد أنه لم ولن يتم حذف الجمعية أو أعضائها أو منتجاتها أو أنشطتها أو مساهماتها أو إعداداتها. تبقى جميع البيانات محفوظة بشكل دائم في قاعدة البيانات دون أي تعديل.
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3 border-t border-slate-800/80">
              <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 leading-relaxed">
                بمجرد قيام الإدارة العامة بإعادة تفعيل الجمعية، ستعود واجهة الجمعية ومتجرها الإلكتروني وكافة خدماتها للعمل بشكل طبيعي فوراً، ويتمكن المستخدمون من الدخول حسب صلاحياتهم.
              </div>
            </div>
          </div>

          {/* Contact / Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onBackToPortal}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة إلى بوابة المنصة الرئيسية</span>
            </button>

            <button
              onClick={onOpenMasterAdmin}
              className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs rounded-xl border border-slate-700/80 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>دخول الإدارة العامة للمنصة (Super Admin) لإعادة التفعيل</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-slate-500 border-t border-slate-950">
        نظام إدارة الجمعيات المتعددة (Multi-Tenant SaaS) • عزل كامل للبيانات وتأمين مستمر
      </footer>
    </div>
  );
};
