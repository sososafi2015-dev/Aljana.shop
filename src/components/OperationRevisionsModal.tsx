import React from 'react';
import { FinancialOperation, OperationRevision } from '../types';
import { X, History, User, Calendar, Clock, ArrowRight, Shield, FileText } from 'lucide-react';

interface OperationRevisionsModalProps {
  operation: FinancialOperation;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'ar' | 'fr' | 'en';
}

export const OperationRevisionsModal: React.FC<OperationRevisionsModalProps> = ({
  operation,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const revisions: OperationRevision[] = operation.revisions || [];

  const getMethodLabel = (method?: string) => {
    switch (method) {
      case 'cash':
        return 'نقداً';
      case 'bank_transfer':
        return 'تحويل بنكي';
      case 'check':
        return 'شيك بنكي';
      case 'online':
        return 'دفع إلكتروني';
      case 'other':
        return 'طريقة أخرى';
      default:
        return method || 'غير محدد';
    }
  };

  return (
    <div
      id="operation-revisions-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="operation-revisions-modal-card"
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                سجل تعديلات ومراجعة العملية
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                  {operation.code}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                توثيق كامل لجميع التغييرات التي طرأت على هذا السجل المالي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Operation Summary */}
        <div className="px-5 py-3 bg-emerald-50/70 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-semibold">البيان الحالي:</span>
            <span className="font-bold text-slate-900">{operation.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-600 font-semibold">المبلغ الحالي:</span>
            <span className="font-bold text-emerald-800 font-mono text-sm">
              {Number(operation.amount).toLocaleString()} د.م
            </span>
            <span className="text-slate-600 font-semibold">تاريخ الإنشاء:</span>
            <span className="text-slate-700 font-mono">{operation.date}</span>
          </div>
        </div>

        {/* Revisions List */}
        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
          {revisions.length === 0 ? (
            <div className="text-center py-10">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">لم يتم تعديل هذه العملية بعد</p>
              <p className="text-xs text-slate-500 mt-1">
                هذه العملية مسجلة بحالتها الأصلية منذ إنشائها في{' '}
                <span className="font-mono">{new Date(operation.createdAt).toLocaleDateString('ar-MA')}</span>
              </p>
            </div>
          ) : (
            revisions.map((rev, idx) => (
              <div
                key={rev.id || idx}
                className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
              >
                {/* Revision Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                      {revisions.length - idx}
                    </span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <User className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{rev.performedBy}</span>
                      {rev.adminType && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                          {rev.adminType === 'super_admin' ? 'الأدمن الرئيسي' : 'أدمن فرعي'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {new Date(rev.timestamp).toLocaleDateString('ar-MA')} -{' '}
                      {new Date(rev.timestamp).toLocaleTimeString('ar-MA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Change Summary Bullets */}
                {rev.changeSummary && rev.changeSummary.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600 block">ملخص التغييرات المعتمدة:</span>
                    <ul className="space-y-1">
                      {rev.changeSummary.map((change, cIdx) => (
                        <li
                          key={cIdx}
                          className="flex items-start gap-1.5 text-xs text-slate-800 bg-amber-50/80 px-2 py-1 rounded border border-amber-200/60"
                        >
                          <span className="text-amber-700 font-bold">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Detailed Comparison Table */}
                <div className="border border-slate-100 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-right">
                    <thead className="bg-slate-50 text-[11px] text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="p-2">الحقل</th>
                        <th className="p-2 text-rose-700">القيمة السابقة</th>
                        <th className="p-2 text-emerald-700">القيمة الجديدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {rev.previousData.amount !== rev.newData.amount && (
                        <tr className="bg-slate-50/40">
                          <td className="p-2 text-slate-500">المبلغ</td>
                          <td className="p-2 font-mono text-rose-700 line-through">
                            {Number(rev.previousData.amount).toLocaleString()} د.م
                          </td>
                          <td className="p-2 font-mono text-emerald-700 font-bold">
                            {Number(rev.newData.amount).toLocaleString()} د.م
                          </td>
                        </tr>
                      )}

                      {rev.previousData.title !== rev.newData.title && (
                        <tr>
                          <td className="p-2 text-slate-500">البيان</td>
                          <td className="p-2 text-rose-800 line-through">{rev.previousData.title}</td>
                          <td className="p-2 text-emerald-800 font-semibold">{rev.newData.title}</td>
                        </tr>
                      )}

                      {rev.previousData.type !== rev.newData.type && (
                        <tr className="bg-slate-50/40">
                          <td className="p-2 text-slate-500">النوع</td>
                          <td className="p-2 text-rose-700">
                            {rev.previousData.type === 'income' ? 'مدخول (+)' : 'مصروف (-)'}
                          </td>
                          <td className="p-2 text-emerald-700 font-bold">
                            {rev.newData.type === 'income' ? 'مدخول (+)' : 'مصروف (-)'}
                          </td>
                        </tr>
                      )}

                      {rev.previousData.paymentMethod !== rev.newData.paymentMethod && (
                        <tr>
                          <td className="p-2 text-slate-500">طريقة الدفع</td>
                          <td className="p-2 text-slate-500 line-through">
                            {getMethodLabel(rev.previousData.paymentMethod)}
                          </td>
                          <td className="p-2 text-emerald-700 font-bold">
                            {getMethodLabel(rev.newData.paymentMethod)}
                          </td>
                        </tr>
                      )}

                      {rev.previousData.date !== rev.newData.date && (
                        <tr className="bg-slate-50/40">
                          <td className="p-2 text-slate-500">التاريخ</td>
                          <td className="p-2 font-mono text-slate-500 line-through">{rev.previousData.date}</td>
                          <td className="p-2 font-mono text-emerald-700 font-bold">{rev.newData.date}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>نظام التدقيق الرقمي غير القابل للتلاعب</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all text-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
