import React, { useState } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Heart,
  DollarSign,
  Phone,
  Calendar,
  Layers,
  Copy,
  Check,
  ShieldCheck,
  Download
} from 'lucide-react';
import { SupportDonationRecord } from '../types';

interface SupportDonationsTableProps {
  donations: SupportDonationRecord[];
  isLoading: boolean;
  onRefresh: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SupportDonationsTable: React.FC<SupportDonationsTableProps> = ({
  donations,
  isLoading,
  onRefresh,
  onShowToast,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'failed' | 'pending'>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'sandbox' | 'live'>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<SupportDonationRecord | null>(null);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    onShowToast('تم نسخ المعرّف إلى الحافظة', 'info');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filter donations
  const filtered = donations.filter((d) => {
    const matchesSearch =
      !search ||
      (d.donorName && d.donorName.toLowerCase().includes(search.toLowerCase())) ||
      (d.donorPhone && d.donorPhone.includes(search)) ||
      (d.paypalOrderId && d.paypalOrderId.toLowerCase().includes(search.toLowerCase())) ||
      (d.transactionId && d.transactionId.toLowerCase().includes(search.toLowerCase())) ||
      (d.paymentMethod && d.paymentMethod.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'confirmed' && (d.status === 'confirmed' || (d as any).status === 'completed')) ||
      (statusFilter === 'failed' && d.status === 'failed') ||
      (statusFilter === 'pending' && (d.status === 'pending' || !d.status));

    const matchesMode =
      modeFilter === 'all' ||
      (modeFilter === 'live' && d.mode === 'live') ||
      (modeFilter === 'sandbox' && (d.mode === 'sandbox' || !d.mode));

    return matchesSearch && matchesStatus && matchesMode;
  });

  // Calculate statistics
  const totalCompletedAmount = donations
    .filter((d) => d.status === 'confirmed' || (d as any).status === 'completed')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const totalCompletedCount = donations.filter(
    (d) => d.status === 'confirmed' || (d as any).status === 'completed'
  ).length;

  const totalFailedCount = donations.filter((d) => d.status === 'failed').length;

  return (
    <div className="space-y-6 animate-fade-in text-slate-800" dir="rtl">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            <Heart className="w-6 h-6 fill-orange-500" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">إجمالي عمليات الدعم</span>
            <span className="text-2xl font-black text-slate-900 font-mono">{donations.length}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">العمليات الناجحة والمحققة</span>
            <span className="text-2xl font-black text-emerald-600 font-mono">{totalCompletedCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">إجمالي مبالغ الدعم المحصلة</span>
            <span className="text-xl font-black text-blue-900 font-mono">
              {totalCompletedAmount.toLocaleString()} <span className="text-xs font-bold">د.م / USD</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">العمليات الملغاة / غير المكتملة</span>
            <span className="text-2xl font-black text-rose-600 font-mono">{totalFailedCount}</span>
          </div>
        </div>
      </div>

      {/* Filters & Search Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="البحث بالاسم، الهاتف، PayPal Order ID، أو Transaction ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-700"
            >
              <option value="all">كافة الحالات</option>
              <option value="confirmed">ناجحة ومؤكدة</option>
              <option value="pending">في انتظار المراجعة</option>
              <option value="failed">غير مكتملة / فاشلة</option>
            </select>

            {/* Mode Filter */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as any)}
              className="py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-700"
            >
              <option value="all">كافة البيئات</option>
              <option value="live">الوضع المباشر (Live)</option>
              <option value="sandbox">الوضع التجريبي (Sandbox)</option>
            </select>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-orange-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-right text-xs text-slate-700 border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-800 border-b border-slate-200 font-bold">
                <th className="py-3 px-4">اسم / معرّف الداعم</th>
                <th className="py-3 px-4">رقم الهاتف / واتساب</th>
                <th className="py-3 px-4">مبلغ الدعم</th>
                <th className="py-3 px-4">طريقة الدفع</th>
                <th className="py-3 px-4">PayPal Order ID</th>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">تاريخ العملية</th>
                <th className="py-3 px-4">حالة الدفع</th>
                <th className="py-3 px-4 text-center">البيئة</th>
                <th className="py-3 px-4 text-center">تفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Heart className="w-8 h-8 text-slate-300" />
                      <span className="font-bold">لا توجد عمليات دعم مسجلة تطابق معايير البحث</span>
                      <span className="text-[11px] text-slate-400">ستظهر هنا جميع عمليات الدعم التي تتم عبر PayPal والبطاقات وطرق الدفع المعتمدة.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((record) => {
                  const isConfirmed = record.status === 'confirmed' || (record as any).status === 'completed';
                  const isFailed = record.status === 'failed';
                  const isLive = record.mode === 'live';

                  return (
                    <tr key={record.id} className="hover:bg-orange-50/40 transition-colors">
                      {/* 1. اسم الداعم */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-black shrink-0">
                            {record.donorName ? record.donorName.charAt(0) : 'م'}
                          </div>
                          <span className="truncate max-w-[140px]">{record.donorName || 'مساهم كريم'}</span>
                        </div>
                      </td>

                      {/* 2. رقم الهاتف */}
                      <td className="py-3 px-4 font-mono text-slate-600" dir="ltr">
                        {record.donorPhone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{record.donorPhone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 3. المبلغ */}
                      <td className="py-3 px-4 font-bold font-mono">
                        <span className="text-orange-600 text-sm">{record.amount}</span>{' '}
                        <span className="text-[10px] text-slate-500 font-sans">{record.currency || 'د.م'}</span>
                        {record.paidAmount && record.paidCurrency && record.paidCurrency !== record.currency && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            ({record.paidAmount} {record.paidCurrency})
                          </span>
                        )}
                      </td>

                      {/* 4. طريقة الدفع */}
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 font-bold text-[11px] text-slate-800 inline-block border border-slate-200">
                          {record.paymentMethod || 'PayPal'}
                        </span>
                      </td>

                      {/* 5. PayPal Order ID */}
                      <td className="py-3 px-4 font-mono text-[11px]" dir="ltr">
                        {record.paypalOrderId ? (
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[110px]" title={record.paypalOrderId}>
                              {record.paypalOrderId}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(record.paypalOrderId!, `order_${record.id}`)}
                              className="text-slate-400 hover:text-orange-600 p-0.5 cursor-pointer"
                              title="نسخ رقم الطلب"
                            >
                              {copiedField === `order_${record.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 6. Transaction ID */}
                      <td className="py-3 px-4 font-mono text-[11px]" dir="ltr">
                        {record.transactionId ? (
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[110px] text-emerald-700 font-bold" title={record.transactionId}>
                              {record.transactionId}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(record.transactionId!, `tx_${record.id}`)}
                              className="text-slate-400 hover:text-emerald-600 p-0.5 cursor-pointer"
                              title="نسخ معرّف المعاملة"
                            >
                              {copiedField === `tx_${record.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 7. تاريخ العملية */}
                      <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                        {record.createdAt ? (
                          <span>{new Date(record.createdAt).toLocaleString('ar-MA', {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}</span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      {/* 8. حالة الدفع */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ناجحة ومؤكدة</span>
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>غير مكتملة / ملغاة</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>قيد التحقق</span>
                          </span>
                        )}
                      </td>

                      {/* 9. البيئة Sandbox / Live */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                          isLive
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {isLive ? 'Live' : 'Sandbox'}
                        </span>
                      </td>

                      {/* 10. زر التفاصيل */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(record)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          معاينة
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
            <div className="p-5 bg-gradient-to-r from-orange-600 to-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Heart className="w-5 h-5 fill-white" />
                <span>تفاصيل عملية دعم المنصة</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">اسم الداعم:</span>
                  <span className="font-bold text-slate-900">{selectedRecord.donorName || 'مساهم كريم'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم الهاتف / واتساب:</span>
                  <span className="font-mono font-bold text-slate-900" dir="ltr">{selectedRecord.donorPhone || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">المبلغ:</span>
                  <span className="font-mono font-bold text-orange-600 text-sm">
                    {selectedRecord.amount} {selectedRecord.currency}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">طريقة الدفع:</span>
                  <span className="font-bold text-slate-800">{selectedRecord.paymentMethod}</span>
                </div>
              </div>

              <div className="space-y-2 p-4 bg-white rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">PayPal Order ID:</span>
                  <span className="font-mono text-slate-900 font-bold" dir="ltr">{selectedRecord.paypalOrderId || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Transaction ID:</span>
                  <span className="font-mono text-emerald-700 font-bold" dir="ltr">{selectedRecord.transactionId || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">البيئة المعتمدة:</span>
                  <span className="font-bold font-mono text-purple-700">{selectedRecord.mode || 'sandbox'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">تاريخ ووقت التحصيل:</span>
                  <span className="font-mono text-slate-700">
                    {selectedRecord.createdAt ? new Date(selectedRecord.createdAt).toLocaleString('ar-MA') : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">حالة العملية:</span>
                  <span className="font-bold text-emerald-700">
                    {selectedRecord.status === 'confirmed' || (selectedRecord as any).status === 'completed' ? 'مؤكدة وناجحة' : selectedRecord.status}
                  </span>
                </div>
                {selectedRecord.donorNote && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-500 block mb-1">ملاحظة الداعم:</span>
                    <p className="p-2.5 bg-slate-50 rounded-xl text-slate-800 leading-relaxed font-sans">
                      {selectedRecord.donorNote}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
