import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FinancialOperation, Member, OperationType, ExpenseCategory, PaymentMethodType } from '../types';
import {
  X,
  Save,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  FileText,
  Calendar,
  AlertCircle,
  Loader2,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Paperclip,
  User,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Eye,
  FileCheck,
  ExternalLink,
} from 'lucide-react';
import { processInvoiceDocument, formatFileSize, OptimizedProofFile } from '../utils/documentOptimizer';

interface EditOperationModalProps {
  operation: FinancialOperation | null;
  members?: Member[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedFields: Partial<FinancialOperation>) => Promise<any>;
  canEdit: boolean;
  lang?: 'ar' | 'fr' | 'en';
}

const expenseCategories: { key: ExpenseCategory; label: string }[] = [
  { key: 'tree_planting', label: 'حملات التشجير والمساحات الخضراء' },
  { key: 'social_aid', label: 'المساعدات الاجتماعية والقفف' },
  { key: 'equipment', label: 'شراء وتجهيز المعدات والأدوات' },
  { key: 'education', label: 'دعم التعليم والأنشطة المدرسية' },
  { key: 'health_caravan', label: 'القوافل الصحية والطبية' },
  { key: 'maintenance', label: 'الصيانة والبنية التحتية' },
  { key: 'ramadan_aid', label: 'مبادرات قفة رمضان' },
  { key: 'other', label: 'مصاريف أخرى متنوعة' },
];

const incomeCategories = [
  { key: 'membership_fee', label: 'واجبات انخراط واشتراكات الأعضاء' },
  { key: 'donation', label: 'تبرعات مالية عامة ومحسنين' },
  { key: 'sponsor', label: 'رعاية ودعم مشاريع الجمعية' },
  { key: 'other', label: 'مداخيل ومساهمات أخرى' },
];

const paymentMethods: { key: PaymentMethodType; label: string }[] = [
  { key: 'cash', label: 'نقداً (وفق وصل معتمد)' },
  { key: 'bank_transfer', label: 'تحويل بنكي / إيداع بحساب الجمعية' },
  { key: 'check', label: 'شيك بنكي' },
  { key: 'online', label: 'دفع إلكتروني / بطاقة بنكية' },
  { key: 'other', label: 'طريقة دفع أخرى' },
];

export const EditOperationModal: React.FC<EditOperationModalProps> = ({
  operation,
  members = [],
  isOpen,
  onClose,
  onSave,
  canEdit,
}) => {
  if (!isOpen || !operation) return null;

  const [type, setType] = useState<OperationType>(operation.type);
  const [title, setTitle] = useState<string>(operation.title);
  const [amount, setAmount] = useState<number | string>(operation.amount);
  const [date, setDate] = useState<string>(operation.date);
  const [category, setCategory] = useState<string>(operation.category);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(operation.paymentMethod || 'bank_transfer');
  const [description, setDescription] = useState<string>(operation.description || '');
  const [memberId, setMemberId] = useState<string>(operation.memberId || '');
  
  // Proof document upload state
  const [proofUrl, setProofUrl] = useState<string>(operation.proofUrls?.[0] || '');
  const [proofFile, setProofFile] = useState<OptimizedProofFile | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when operation changes
  useEffect(() => {
    if (operation) {
      setType(operation.type);
      setTitle(operation.title);
      setAmount(operation.amount);
      setDate(operation.date);
      setCategory(operation.category);
      setPaymentMethod(operation.paymentMethod || 'bank_transfer');
      setDescription(operation.description || '');
      setMemberId(operation.memberId || '');
      setProofUrl(operation.proofUrls?.[0] || '');
      setProofFile(null);
      setFileError(null);
      setErrorMessage(null);
    }
  }, [operation]);

  const handleFileSelect = async (file: File) => {
    setFileError(null);
    setIsProcessingFile(true);

    try {
      const optimized = await processInvoiceDocument(file);
      setProofFile(optimized);
      setProofUrl(optimized.dataUrl);
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
    setProofUrl('');
    setFileError(null);
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setErrorMessage('لا تملك صلاحية تعديل العمليات المالية.');
      return;
    }

    if (isSubmitting) return; // Prevent rapid multiple clicks

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMessage('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('يرجى إدخال بيان وعنوان العملية.');
      return;
    }

    if (!date) {
      setErrorMessage('يرجى تحديد تاريخ العملية.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const selectedMember = members.find((m) => m.id === memberId);

    const updatedFields: Partial<FinancialOperation> = {
      type,
      title: title.trim(),
      amount: numAmount,
      date,
      category: category as any,
      paymentMethod,
      description: description.trim(),
      memberId: memberId || undefined,
      memberName: selectedMember ? selectedMember.fullName : operation.memberName,
      proofUrls: proofUrl.trim() ? [proofUrl.trim()] : [],
    };

    try {
      const res = await onSave(updatedFields);
      if (res && res.success === false) {
        setErrorMessage(res.error || 'حدث خطأ أثناء حفظ التعديل.');
        setIsSubmitting(false);
        return;
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'تعذر حفظ التعديل.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="edit-operation-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="edit-operation-modal-card"
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  تعديل العملية المالية
                </h3>
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-900 text-white shadow-xs">
                  {operation.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                حفظ التعديلات في نفس السجل المالي الأصلي وإعادة احتساب الرصيد وتوثيق المراجعة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            title="إلغاء"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Notice & Integrity Assurance */}
        <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2 text-xs text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            <strong>ضمان سلامة السجلات:</strong> يتم تحديث هذا السجل في مكانه دون إنشاء سجل جديد، ويعاد ضبط رصيد الجمعية فورًا.
          </span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Operation Type Switcher */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              طبيعة المعاملة المالية:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setType('income');
                  if (!incomeCategories.some((c) => c.key === category)) {
                    setCategory('membership_fee');
                  }
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>مدخول / مساهمة (+)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType('expense');
                  if (!expenseCategories.some((c) => c.key === category)) {
                    setCategory('social_aid');
                  }
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all ${
                  type === 'expense'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                <span>مصروف عمل خيري (-)</span>
              </button>
            </div>
          </div>

          {/* Title & Amount Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                بيان وعنوان العملية <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: اقتناء أشجار زيتون لحملة التشجير"
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المبلغ (بالدرهم المغربي) <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full pl-12 pr-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all"
                />
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 font-mono">
                  د.م
                </span>
              </div>
            </div>
          </div>

          {/* Date, Category & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تاريخ العملية <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                التصنيف المعتمد:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all"
              >
                {type === 'income'
                  ? incomeCategories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))
                  : expenseCategories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                طريقة الدفع أو التحصيل:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all font-medium"
              >
                {paymentMethods.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Member Link (Optional, especially for membership fees or individual donations) */}
          {members.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ربط بالمنخرط أو العضو المساهم (اختياري):
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all"
              >
                <option value="">-- بدون ربط بعضو محدد (عملية عامة) --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.memberCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              وصف وتفاصيل العملية:
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="تفاصيل التكاليف، أرقام الفواتير، أسماء المستفيدين، أو بنود الصرف..."
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all"
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
              id="edit-operation-proof-file-input"
            />

            {/* File Error Notice */}
            {fileError && (
              <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Upload Zone (When no file or URL attached) */}
            {!proofUrl && !proofFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleTriggerFileInput}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/80 scale-[0.99]'
                    : 'border-slate-300 bg-slate-50/60 hover:bg-emerald-50/30 hover:border-emerald-400'
                }`}
              >
                {isProcessingFile ? (
                  <div className="py-3 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
                    <p className="text-xs font-bold text-slate-700">جاري معالجة وتحسين جودة الوثيقة...</p>
                    <span className="text-[11px] text-slate-500">الحفاظ على وضوح أرقام وتفاصيل الفاتورة</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800">
                        اضغط لرفع صورة الفاتورة أو الوصل من جهازك
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        يدعم صور الوصولات والفواتير ومستندات PDF الرسمية
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs font-bold text-emerald-800 mt-1">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>اختيار ملف جديد</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* File Preview Card (When file is present) */
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Thumbnail / Document icon */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {proofUrl.startsWith('data:application/pdf') || proofUrl.toLowerCase().includes('.pdf') ? (
                      <div
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="w-16 h-16 rounded-xl bg-rose-100 text-rose-700 flex flex-col items-center justify-center shrink-0 border border-rose-200 shadow-2xs cursor-pointer hover:bg-rose-200 transition-colors"
                        title="انقر للمعاينة الكاملة"
                      >
                        <FileText className="w-7 h-7" />
                        <span className="text-[10px] font-bold mt-0.5">PDF</span>
                      </div>
                    ) : (
                      <div
                        onClick={() => setIsPreviewModalOpen(true)}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 shadow-2xs cursor-pointer group"
                        title="انقر للمعاينة الكاملة"
                      >
                        <img
                          src={proofUrl}
                          alt="وصل العملية"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[280px]">
                          {proofFile ? proofFile.name : 'الوثيقة الحالية المرفقة بالعملية'}
                        </h5>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-full shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          {proofFile ? 'ملف جديد' : 'محفوظ'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                        {proofFile ? (
                          <>
                            <span className="font-mono font-medium">
                              {formatFileSize(proofFile.size)}
                            </span>
                            {proofFile.originalSize > proofFile.size && (
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded text-[10px] font-medium">
                                تم تحسين الحجم مع الحفاظ على الوضوح
                              </span>
                            )}
                          </>
                        ) : (
                          <span>وصل أو فاتورة إثبات معتمدة</span>
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
                      title="استبدال بملف آخر من الجهاز"
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

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              إلغاء التعديل
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !canEdit}
              id="save-operation-edit-btn"
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-xs transition-all ${
                !canEdit
                  ? 'bg-slate-400 cursor-not-allowed'
                  : isSubmitting
                  ? 'bg-emerald-400 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ وإعادة احتساب الرصيد...</span>
                </>
              ) : !canEdit ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>صلاحية العرض فقط (غير مصرح بالتعديل)</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات في نفس السجل</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Proof Lightbox Preview Modal */}
      <AnimatePresence>
        {isPreviewModalOpen && proofUrl && (
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
                      معاينة الوثيقة المرفقة بالعملية
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {proofFile
                        ? `${proofFile.name} (${formatFileSize(proofFile.size)})`
                        : 'الوثيقة الحالية المعتمدة'}
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
                {proofUrl.startsWith('data:application/pdf') || proofUrl.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={proofUrl}
                    title="وثيقة الفاتورة أو الوصل"
                    className="w-full h-[65vh] rounded-lg border-0 bg-white"
                  />
                ) : (
                  <img
                    src={proofUrl}
                    alt="وصل أو فاتورة العملية"
                    className="max-h-[65vh] w-auto object-contain rounded-lg shadow-xs"
                  />
                )}
              </div>

              {/* Bottom footer */}
              <div className="flex items-center justify-between pt-2">
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  download="document_recu"
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح أو تحميل الوثيقة بحجم كامل</span>
                </a>
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
