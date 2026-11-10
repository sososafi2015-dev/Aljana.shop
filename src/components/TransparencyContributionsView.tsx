import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  Download,
  Printer,
  Receipt,
  User,
  ShieldCheck,
  Calendar,
  CreditCard,
  Building2,
  HeartHandshake,
  Landmark,
  Coins,
  ArrowUpRight,
  ChevronDown,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  UnifiedTransparencyContribution,
  getPaymentMethodArabicLabel,
} from '../utils/transparencyUtils';
import { Language, PaymentMethodType } from '../types';

interface TransparencyContributionsViewProps {
  contributions: UnifiedTransparencyContribution[];
  lang: Language;
  onOpenReceipt: (contribution: UnifiedTransparencyContribution) => void;
  onExportCSV?: (items: UnifiedTransparencyContribution[]) => void;
  currency?: string;
}

export const TransparencyContributionsView: React.FC<TransparencyContributionsViewProps> = ({
  contributions,
  lang,
  onOpenReceipt,
  onExportCSV,
  currency = 'د.م',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'unpaid' | 'rejected'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'campaign' | 'membership' | 'general'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethodType>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount_desc' | 'amount_asc' | 'donor'>('date');

  // Filter and sort contributions
  const filteredContributions = useMemo(() => {
    return contributions
      .filter((item) => {
        // Search filter
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !term ||
          item.donorName.toLowerCase().includes(term) ||
          item.typeNameAr.toLowerCase().includes(term) ||
          (item.campaignTitle && item.campaignTitle.toLowerCase().includes(term)) ||
          (item.notes && item.notes.toLowerCase().includes(term)) ||
          (item.receiptNumber && item.receiptNumber.toLowerCase().includes(term)) ||
          item.id.toLowerCase().includes(term);

        // Status filter
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'approved' && (item.status === 'approved' || item.status === 'completed')) ||
          (statusFilter === 'pending' && item.status === 'pending') ||
          (statusFilter === 'unpaid' && item.status === 'unpaid') ||
          (statusFilter === 'rejected' && item.status === 'rejected');

        // Source filter
        const matchesSource = sourceFilter === 'all' || item.sourceType === sourceFilter;

        // Payment method filter
        const matchesPayment = paymentFilter === 'all' || item.paymentMethod === paymentFilter;

        return matchesSearch && matchesStatus && matchesSource && matchesPayment;
      })
      .sort((a, b) => {
        if (sortBy === 'amount_desc') return b.amount - a.amount;
        if (sortBy === 'amount_asc') return a.amount - b.amount;
        if (sortBy === 'donor') return a.donorName.localeCompare(b.donorName, 'ar');
        // Default: date descending
        const timeA = new Date(a.createdAt || a.date).getTime() || 0;
        const timeB = new Date(b.createdAt || b.date).getTime() || 0;
        return timeB - timeA;
      });
  }, [contributions, searchTerm, statusFilter, sourceFilter, paymentFilter, sortBy]);

  // Counts for pills
  const counts = useMemo(() => {
    const total = contributions.length;
    const approved = contributions.filter((c) => c.status === 'approved' || c.status === 'completed').length;
    const pending = contributions.filter((c) => c.status === 'pending').length;
    const unpaid = contributions.filter((c) => c.status === 'unpaid').length;
    const rejected = contributions.filter((c) => c.status === 'rejected').length;
    return { total, approved, pending, unpaid, rejected };
  }, [contributions]);

  // CSV Export handler
  const handleExportCSV = () => {
    if (onExportCSV) {
      onExportCSV(filteredContributions);
      return;
    }
    const headers = [
      'المرجع',
      'المساهم / المتبرع',
      'نوع المساهمة',
      'المصدر / الحملة',
      'المبلغ (د.م)',
      'التاريخ',
      'طريقة الأداء',
      'الحالة',
      'ملاحظات',
    ];
    const rows = filteredContributions.map((c) => {
      const isNegative = c.status === 'unpaid' || c.status === 'rejected' || c.isNegative || c.amountSign === '-';
      const signedAmount = isNegative ? `-${Math.abs(c.amount)}` : `+${Math.abs(c.amount)}`;
      const statusText =
        c.status === 'approved' || c.status === 'completed'
          ? 'معتمدة ومكتملة'
          : c.status === 'unpaid'
          ? 'لم يتم الدفع'
          : c.status === 'pending'
          ? 'قيد المراجعة'
          : 'ملغاة / مرفوضة';
      return [
        c.receiptNumber || c.id,
        c.isAnonymous ? 'فاعل خير (معفى من الظهور)' : c.donorName,
        c.typeNameAr,
        c.campaignTitle || 'مساهمة عامة',
        signedAmount,
        `${c.date} ${c.time || ''}`.trim(),
        getPaymentMethodArabicLabel(c.paymentMethod),
        statusText,
        c.notes || '',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `سجل_الشفافية_المساهمات_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Controls: Search, Filters & Export */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute top-3.5 left-3 rtl:left-auto rtl:right-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث باسم المساهم، نوع المساهمة، اسم الحملة، رقم الوصل..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-9 text-xs sm:text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all text-slate-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute top-2.5 right-3 rtl:right-auto rtl:left-3 text-xs text-slate-400 hover:text-slate-600 bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Tools: Export CSV & Count */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-bold transition-colors border border-slate-200 cursor-pointer"
              title="تصدير كشف المساهمات بتنسيق CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>تصدير CSV</span>
            </button>
            <div className="text-xs text-slate-500 font-mono bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-800">{filteredContributions.length}</span> / {contributions.length} عملية
            </div>
          </div>
        </div>

        {/* Filter Pills & Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({counts.total})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>المعتمدة والمكتملة ({counts.approved})</span>
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>قيد المراجعة ({counts.pending})</span>
            </button>
            <button
              onClick={() => setStatusFilter('unpaid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                statusFilter === 'unpaid'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-800 hover:bg-rose-50'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>لم يتم الدفع ({counts.unpaid})</span>
            </button>
            {counts.rejected > 0 && (
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  statusFilter === 'rejected'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-800 hover:bg-rose-50'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>ملغاة ({counts.rejected})</span>
              </button>
            )}
          </div>

          {/* Secondary Dropdown Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Source selector */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-700 font-medium focus:border-emerald-600 outline-hidden"
            >
              <option value="all">جميع مصادر المساهمات</option>
              <option value="campaign">مرتبطة بحملات التبرع</option>
              <option value="membership">واجبات الانخراط السنوي</option>
              <option value="general">مساهمات وتبرعات عامة</option>
            </select>

            {/* Payment method selector */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-700 font-medium focus:border-emerald-600 outline-hidden"
            >
              <option value="all">جميع طرق الأداء</option>
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="cash">أداء نقدي (كاش)</option>
              <option value="check">شيك بنكي</option>
              <option value="online">دفع إلكتروني</option>
            </select>

            {/* Sort selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-700 font-medium focus:border-emerald-600 outline-hidden"
            >
              <option value="date">الأحدث تاريخاً</option>
              <option value="amount_desc">الأعلى مبلغاً</option>
              <option value="amount_asc">الأقل مبلغاً</option>
              <option value="donor">اسم المساهم (أبجدياً)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contributions Table / Cards */}
      {filteredContributions.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start rtl:text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 whitespace-nowrap">المرجع</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">المساهم / المتبرع</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">نوع المساهمة</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">المصدر / الغرض</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">المبلغ</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">التاريخ والتوقيت</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">طريقة الأداء</th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-center">الحالة الرسمية</th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-center">الوصل الرسمي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContributions.map((item) => {
                  const isApproved = item.status === 'approved' || item.status === 'completed';
                  const isPending = item.status === 'pending';
                  const isUnpaid = item.status === 'unpaid';
                  const isRejected = item.status === 'rejected';
                  const isNegative = isUnpaid || isRejected || item.isNegative || item.amountSign === '-';
                  const displaySign = isNegative ? '-' : '+';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isUnpaid ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Reference Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-1 rounded-md text-[11px] text-slate-700 border border-slate-200/80">
                          {item.receiptNumber || item.id}
                        </span>
                      </td>

                      {/* Donor Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {item.isAnonymous ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                              <div>
                                <span className="font-bold text-slate-800">فاعل خير</span>
                                <span className="block text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded mt-0.5 inline-block font-medium">
                                  معفى من الظهور العلني
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                                {item.donorName.charAt(0)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 line-clamp-1">
                                  {item.donorName}
                                </span>
                                {item.sourceType === 'membership' && (
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    منخرط رسمي
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Contribution Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          <Coins className="w-3 h-3 text-emerald-600" />
                          <span>{item.typeNameAr}</span>
                        </span>
                      </td>

                      {/* Source / Purpose */}
                      <td className="py-3.5 px-4">
                        {item.campaignTitle ? (
                          <div className="max-w-xs">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 line-clamp-1 transition-colors">
                              <HeartHandshake className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                              <span className="truncate">{item.campaignTitle}</span>
                            </span>
                            {item.notes && (
                              <p className="text-[10px] text-slate-500 mt-1 line-clamp-1" title={item.notes}>
                                {item.notes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-xs text-slate-600 font-medium">
                              {item.sourceType === 'membership'
                                ? 'واجب الانخراط السنوي'
                                : 'مساهمة عامة في أنشطة الجمعية'}
                            </span>
                            {item.notes && (
                              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1" title={item.notes}>
                                {item.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-baseline gap-1" dir="ltr">
                          <span
                            className={`font-black font-mono text-sm sm:text-base ${
                              isApproved
                                ? 'text-emerald-700'
                                : isNegative
                                ? 'text-rose-700'
                                : isPending
                                ? 'text-amber-700'
                                : 'text-slate-400 line-through'
                            }`}
                          >
                            {displaySign}{Math.abs(item.amount).toLocaleString()}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">{currency}</span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-600">
                        <div className="flex flex-col">
                          <span>{item.date}</span>
                          {item.time && (
                            <span className="text-[10px] text-slate-400">{item.time}</span>
                          )}
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-slate-400" />
                          <span>{getPaymentMethodArabicLabel(item.paymentMethod)}</span>
                        </span>
                      </td>

                      {/* Official Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>معتمدة وموثقة</span>
                          </span>
                        ) : isUnpaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-700" />
                            <span>لم يتم الدفع</span>
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>قيد المراجعة</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-700" />
                            <span>ملغاة / مرفوضة</span>
                          </span>
                        )}
                      </td>

                      {/* Receipt Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => onOpenReceipt(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 text-xs font-bold transition-colors cursor-pointer border border-slate-200/80"
                          title="معاينة وطباعة الوصل المعتمد للمساهمة"
                        >
                          <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                          <span>معاينة الوصل</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-800">لا توجد مساهمات مطابقة لشروط البحث والفرز</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            يمكنك مسح كلمات البحث أو إزالة المرشحات للاطلاع على كامل سجل المساهمات المسجلة.
          </p>
          {(searchTerm || statusFilter !== 'all' || sourceFilter !== 'all' || paymentFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setSourceFilter('all');
                setPaymentFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer inline-block mt-2"
            >
              إعادة ضبط عوامل التصفية
            </button>
          )}
        </div>
      )}
    </div>
  );
};
