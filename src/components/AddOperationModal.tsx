import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  PlusCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  RefreshCw, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileCheck
} from 'lucide-react';
import { FinancialOperation, ExpenseCategory, OperationType, Language, Member, PaymentMethodType } from '../types';
import { translations } from '../translations';
import { processInvoiceDocument, formatFileSize, OptimizedProofFile } from '../utils/documentOptimizer';

interface AddOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (operation: Omit<FinancialOperation, 'id' | 'balanceAfter' | 'createdAt'>) => void;
  members: Member[];
  lang: Language;
}

export const AddOperationModal: React.FC<AddOperationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  members,
  lang,
}) => {
  const t = translations[lang];

  const [type, setType] = useState<OperationType>('expense');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('tree_planting');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('bank_transfer');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memberId, setMemberId] = useState('');
  const [addedBy, setAddedBy] = useState('إدارة الجمعية');

  // File Upload State for Invoices / Receipts
  const [proofFile, setProofFile] = useState<OptimizedProofFile | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    setFileError(null);
    setIsProcessingFile(true);

    try {
      const optimized = await processInvoiceDocument(file);
      setProofFile(optimized);
    } catch (err: any) {
      setFileError(err?.message || 'تعذر معالجة الملف المرفوع. يرجى تجربة ملف آخر.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // reset input value so re-selecting the same file triggers change
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveProof = () => {
    setProofFile(null);
    setFileError(null);
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || Number(amount) <= 0) return;

    const opCode = type === 'income' 
      ? `REC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
      : `DEP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const selectedMember = members.find((m) => m.id === memberId);

    onSave({
      code: opCode,
      title,
      description,
      type,
      category: category as any,
      paymentMethod,
      amount: Number(amount),
      date,
      memberId: memberId || undefined,
      memberName: selectedMember ? selectedMember.fullName : undefined,
      proofUrls: proofFile ? [proofFile.dataUrl] : [],
      addedBy: addedBy || 'إدارة الجمعية',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="flex items-center gap-2.5">
            <PlusCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">
              {type === 'expense' ? t.addExpense : t.addIncome}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Operation Type Toggle */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                if (category === 'membership_fee' || category === 'donation') {
                  setCategory('tree_planting');
                }
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>{t.expenseType}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setCategory('membership_fee');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{t.incomeType}</span>
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
              {t.operationTitle} *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'expense' ? 'مثال: عملية تشجير وغرس 150 شجرة زيتون' : 'مثال: استخلاص واجب انخراط سنوي'}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                {t.amount} *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="2500"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono font-bold focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
                />
                <span className="absolute top-3 left-3 rtl:left-auto rtl:right-3 text-xs font-semibold text-slate-400 pointer-events-none">
                  {t.currencyShort}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                {t.date} *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
              {t.selectCategory} *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            >
              {type === 'expense' ? (
                <>
                  <option value="tree_planting">{t.cat_tree_planting}</option>
                  <option value="social_aid">{t.cat_social_aid}</option>
                  <option value="equipment">{t.cat_equipment}</option>
                  <option value="education">{t.cat_education}</option>
                  <option value="health_caravan">{t.cat_health_caravan}</option>
                  <option value="maintenance">{t.cat_maintenance}</option>
                  <option value="ramadan_aid">{t.cat_ramadan_aid}</option>
                  <option value="other">{t.cat_other}</option>
                </>
              ) : (
                <>
                  <option value="membership_fee">{t.cat_membership_fee}</option>
                  <option value="donation">{t.cat_donation}</option>
                  <option value="sponsor">{t.cat_sponsor}</option>
                  <option value="other">{t.cat_other}</option>
                </>
              )}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
              طريقة الدفع / الاستخلاص *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            >
              <option value="bank_transfer">تحويل بنكي (Virement)</option>
              <option value="cash">نقداً (Espèces)</option>
              <option value="check">شيك بنكي (Chèque)</option>
              <option value="online">دفع إلكتروني (En ligne)</option>
              <option value="other">طريقة أخرى</option>
            </select>
          </div>

          {/* Link to Member (if income) */}
          {type === 'income' && (
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                ربط بالمنخرط (اختياري)
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
              >
                <option value="">-- بدون تحديد منخرط --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.memberCode}) - {m.annualFee} {t.currencyShort}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
              وصف العملية والتفاصيل
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب تفاصيل التكلفة ومبرر الصرف أو مصدر المساهمة..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:border-emerald-600 focus:bg-white outline-hidden transition-all"
            />
          </div>

          {/* Proof Document / Invoice Direct Upload (بدل رابط الصورة / الوصل) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>وثائق وفواتير الإثبات (رفع من الهاتف أو الحاسوب)</span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                اختياري
              </span>
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={onFileInputChange}
              className="hidden"
              id="operation-proof-file-input"
            />

            {/* File Error Notice */}
            {fileError && (
              <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Upload Zone (When no file uploaded) */}
            {!proofFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleTriggerFileInput}
                className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/80 scale-[0.99]'
                    : 'border-slate-300 bg-slate-50/60 hover:bg-emerald-50/30 hover:border-emerald-400'
                }`}
              >
                {isProcessingFile ? (
                  <div className="py-4 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                    <p className="text-xs font-bold text-slate-700">جاري معالجة وتحسين جودة الوثيقة...</p>
                    <span className="text-[11px] text-slate-500">الحفاظ على وضوح أرقام وتفاصيل الفاتورة</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800">
                        اضغط لاختيار صورة الفاتورة أو الوصل من جهازك
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                        يدعم صور الوصولات والفواتير (JPG, PNG, WebP) ومستندات PDF الرسمية
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs font-bold text-emerald-800 mt-1">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>اختيار ملف من الهاتف أو الحاسوب</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* File Preview Card (When file is selected) */
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Preview Icon / Thumbnail */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {proofFile.type === 'image' ? (
                      <div 
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 shadow-2xs cursor-pointer group"
                        title="انقر للمعاينة الكاملة"
                      >
                        <img
                          src={proofFile.dataUrl}
                          alt={proofFile.name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="w-16 h-16 rounded-xl bg-rose-100 text-rose-700 flex flex-col items-center justify-center shrink-0 border border-rose-200 shadow-2xs cursor-pointer hover:bg-rose-200 transition-colors"
                        title="انقر للمعاينة الكاملة"
                      >
                        <FileText className="w-7 h-7" />
                        <span className="text-[10px] font-bold mt-0.5">PDF</span>
                      </div>
                    )}

                    {/* File Meta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[280px]">
                          {proofFile.name}
                        </h5>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-full shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          جاهز
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                        <span className="font-mono font-medium">
                          {formatFileSize(proofFile.size)}
                        </span>
                        {proofFile.originalSize > proofFile.size && (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded text-[10px] font-medium">
                            تم تحسين الحجم مع الحفاظ على الوضوح
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Preview, Replace, Delete */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsPreviewModalOpen(true)}
                      className="p-2 rounded-xl text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1"
                      title="معاينة الوثيقة"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">معاينة</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTriggerFileInput}
                      className="p-2 rounded-xl text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1"
                      title="استبدال بملف آخر"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                      <span>استبدال</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveProof}
                      className="p-2 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1"
                      title="حذف الوثيقة"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className={`px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-md transition-colors ${
                type === 'expense'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              {t.save}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Proof Lightbox Preview Modal before saving */}
      <AnimatePresence>
        {isPreviewModalOpen && proofFile && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs"
            onClick={() => setIsPreviewModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      معاينة الوثيقة المرفقة: {proofFile.name}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      الحجم: {formatFileSize(proofFile.size)} • النوع:{' '}
                      {proofFile.type === 'image' ? 'صورة' : 'مستند PDF'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Viewer body */}
              <div className="rounded-xl overflow-hidden max-h-[70vh] flex items-center justify-center bg-slate-100 p-2">
                {proofFile.type === 'image' ? (
                  <img
                    src={proofFile.dataUrl}
                    alt={proofFile.name}
                    className="max-h-[65vh] w-auto object-contain rounded-lg shadow-xs"
                  />
                ) : (
                  <iframe
                    src={proofFile.dataUrl}
                    title={proofFile.name}
                    className="w-full h-[65vh] rounded-lg border-0 bg-white"
                  />
                )}
              </div>

              {/* Bottom footer */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-500">
                  سيتم حفظ هذه الوثيقة وإرفاقها تلقائيًا بالعملية المالية.
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors"
                >
                  إغلاق المعاينة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
