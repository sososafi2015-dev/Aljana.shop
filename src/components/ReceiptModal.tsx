import React from 'react';
import { motion } from 'motion/react';
import { X, Printer, CheckCircle2, Building2, Phone, Mail, FileCheck, Shield, QrCode, UserCheck } from 'lucide-react';
import { Member, FinancialOperation, AssociationSettings, Language, MemberCardSettings, MemberCardField, MemberContribution } from '../types';
import { translations } from '../translations';
import { initialMemberCardSettings } from '../initialData';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'member_card' | 'operation_receipt' | 'financial_statement';
  member?: Member;
  operation?: FinancialOperation;
  operations?: FinancialOperation[];
  members?: Member[];
  contributions?: MemberContribution[];
  settings: AssociationSettings;
  cardSettings?: MemberCardSettings;
  lang: Language;
  canViewBalance?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  type,
  member,
  operation,
  operations = [],
  members = [],
  contributions = [],
  settings,
  cardSettings = initialMemberCardSettings,
  lang,
  canViewBalance = false,
}) => {
  const t = translations[lang] as any;

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalIncomes = operations
    .filter((op) => op.type === 'income')
    .reduce((sum, op) => sum + Number(op.amount), 0);
  const totalExpenses = operations
    .filter((op) => op.type === 'expense')
    .reduce((sum, op) => sum + Number(op.amount), 0);
  const balance = totalIncomes - totalExpenses;

  // Theme styling helpers
  const getThemeClasses = (theme?: string) => {
    switch (theme) {
      case 'navy':
        return {
          border: 'border-blue-900',
          accentBg: 'bg-blue-50/80',
          accentBorder: 'border-blue-200',
          badgeBg: 'bg-blue-200 text-blue-950',
          headerText: 'text-blue-900',
          primary: 'text-blue-800',
          avatarBg: 'bg-blue-800',
        };
      case 'slate':
        return {
          border: 'border-slate-800',
          accentBg: 'bg-slate-50',
          accentBorder: 'border-slate-300',
          badgeBg: 'bg-slate-200 text-slate-900',
          headerText: 'text-slate-900',
          primary: 'text-slate-800',
          avatarBg: 'bg-slate-800',
        };
      case 'gold':
        return {
          border: 'border-amber-700',
          accentBg: 'bg-amber-50/70',
          accentBorder: 'border-amber-200',
          badgeBg: 'bg-amber-200 text-amber-950',
          headerText: 'text-amber-900',
          primary: 'text-amber-800',
          avatarBg: 'bg-amber-800',
        };
      case 'rose':
        return {
          border: 'border-rose-700',
          accentBg: 'bg-rose-50/70',
          accentBorder: 'border-rose-200',
          badgeBg: 'bg-rose-200 text-rose-950',
          headerText: 'text-rose-900',
          primary: 'text-rose-800',
          avatarBg: 'bg-rose-700',
        };
      case 'indigo':
        return {
          border: 'border-indigo-800',
          accentBg: 'bg-indigo-50/70',
          accentBorder: 'border-indigo-200',
          badgeBg: 'bg-indigo-200 text-indigo-950',
          headerText: 'text-indigo-900',
          primary: 'text-indigo-800',
          avatarBg: 'bg-indigo-800',
        };
      case 'emerald':
      default:
        return {
          border: 'border-emerald-700',
          accentBg: 'bg-emerald-50/70',
          accentBorder: 'border-emerald-200',
          badgeBg: 'bg-emerald-200 text-emerald-950',
          headerText: 'text-emerald-800',
          primary: 'text-emerald-800',
          avatarBg: 'bg-emerald-700',
        };
    }
  };

  const themeStyle = getThemeClasses(cardSettings.cardTheme);

  // Helper to compute member's total completed contributions (confirmed/paid)
  const getMemberTotalPaidContributions = (m: Member) => {
    const memberPaidContribs = contributions.filter((c) => {
      const isMember =
        c.memberId === m.id ||
        (c.memberCode && c.memberCode === m.memberCode) ||
        (c.memberName && c.memberName.trim().toLowerCase() === m.fullName.trim().toLowerCase());
      
      const isPaid = c.status === 'completed' || !c.status;
      return isMember && isPaid;
    });

    if (memberPaidContribs.length > 0) {
      return memberPaidContribs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    }

    return Number(m.annualFee) || 0;
  };

  // Field value resolver
  const resolveFieldValue = (field: MemberCardField, m: Member) => {
    if (field.type === 'static_text' && field.staticContentAr) {
      return field.staticContentAr;
    }

    const key = field.key;
    if (key === 'fullName') return m.fullName;
    if (key === 'memberCode') return m.memberCode;
    if (key === 'phone') return m.phone;
    if (key === 'email') return m.email || 'غير مسجل';
    if (key === 'cin') return m.cin || '---';
    if (key === 'joinDate') return m.joinDate;
    if (key === 'renewalDate') return m.renewalDate;
    if (key === 'annualFee') {
      const totalPaid = getMemberTotalPaidContributions(m);
      return `${totalPaid.toLocaleString()} ${settings.currency || 'د.م'}`;
    }
    if (key === 'status') return m.status === 'active' ? (t.statusActive || 'نشط ومؤدى') : (t.statusPending || 'قيد التجديد');
    if (key === 'membershipPaymentMethod' || key === 'paymentMethod') {
      const p = m.membershipPaymentMethod || 'bank_transfer';
      return p === 'bank_transfer' ? 'الحساب البنكي (تحويل)' : p === 'cash' ? 'نقدًا' : p === 'check' ? 'شيك بنكي' : p;
    }
    if (key === 'transparencyPledge') {
      return field.staticContentAr || t.transparencyPledge || `تؤكد إدارة ${settings.name || 'الجمعية'} أن جميع مساهمات واشتراكات المنخرطين مسجلة وموثقة في السجل المالي العام وموجهة بشفافية تامة لدعم الأعمال الخيرية والمشاريع التنموية.`;
    }

    if (m.customFields && m.customFields[key] !== undefined) {
      return String(m.customFields[key]);
    }

    return field.staticContentAr || '---';
  };

  const activeCardFields = cardSettings.fields || initialMemberCardSettings.fields;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-auto"
      >
        {/* Modal Controls (Not printed) */}
        <div className="flex items-center justify-between p-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm sm:text-base">
              {type === 'member_card' && (lang === 'ar' ? (cardSettings.titleAr || 'وصل وبطاقة انخراط رسمية') : (cardSettings.titleFr || 'Official Member Certificate'))}
              {type === 'operation_receipt' && (lang === 'ar' ? 'وصل معاملة مالية معتمد' : 'Transaction Receipt')}
              {type === 'financial_statement' && (lang === 'ar' ? 'الكشف المالي والتقرير العام' : 'Financial Statement Report')}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>{t.print || 'طباعة'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 bg-white text-slate-900 printable-area font-sans">
          {/* Header of the Official Document */}
          <div className={`border-b-2 ${type === 'member_card' ? themeStyle.border : 'border-emerald-700'} pb-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
            <div className="flex items-center gap-3 text-center sm:text-start rtl:sm:text-right">
              {cardSettings.showLogo && settings.logoUrl && (
                <div className="w-14 h-14 rounded-xl border border-slate-200 p-1 flex items-center justify-center overflow-hidden flex-shrink-0 bg-white">
                  <img src={settings.logoUrl} alt={settings.name} className="w-full h-full object-contain" />
                </div>
              )}
              <div>
                {cardSettings.showHeaderKingdom && (
                  <span className={`text-xs font-bold uppercase tracking-widest ${type === 'member_card' ? themeStyle.headerText : 'text-emerald-800'}`}>
                    {cardSettings.subtitleAr || 'المملكة المغربية • ROYAUME DU MAROC'}
                  </span>
                )}
                <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">{settings.name}</h1>
                <p className="text-xs text-slate-600">{settings.nameFr} | {settings.nameEn}</p>
                <p className="text-xs font-medium text-emerald-700 mt-0.5">{settings.tagline}</p>
              </div>
            </div>
            {cardSettings.showLicenseInfo && (
              <div className="text-center sm:text-end rtl:sm:text-left text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-semibold text-slate-800">وصل ترخيص: {settings.licenseNumber}</p>
                <p>سنة التأسيس: {settings.foundingYear}</p>
                <p>تاريخ الإصدار: {new Date().toLocaleDateString('ar-MA')}</p>
              </div>
            )}
          </div>

          {/* Type 1: Member Card / Subscription Receipt (DYNAMIC CUSTOMIZED) */}
          {type === 'member_card' && member && (
            <div className="space-y-6">
              {/* Hero Section */}
              {activeCardFields.some((f) => f.section === 'hero' && f.enabled) && (
                <div className={`${themeStyle.accentBg} border ${themeStyle.accentBorder} rounded-2xl p-5 relative overflow-hidden`}>
                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    {/* Photo / Avatar */}
                    {activeCardFields.find((f) => f.key === 'avatarUrl' && f.enabled) && (
                      <div className={`w-20 h-20 rounded-2xl ${themeStyle.avatarBg} text-white flex items-center justify-center font-bold text-2xl shadow-md overflow-hidden flex-shrink-0`}>
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.fullName} className="w-full h-full object-cover" />
                        ) : (
                          member.fullName.charAt(0)
                        )}
                      </div>
                    )}
                    
                    <div className="flex-1 text-center sm:text-start rtl:sm:text-right">
                      {/* Status Badge */}
                      {activeCardFields.find((f) => f.key === 'status' && f.enabled) && (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${themeStyle.badgeBg} mb-1`}>
                          {resolveFieldValue(activeCardFields.find((f) => f.key === 'status')!, member)}
                        </span>
                      )}

                      {/* Full Name */}
                      {activeCardFields.find((f) => f.key === 'fullName' && f.enabled) && (
                        <h2 className="text-xl font-black text-slate-900">{member.fullName}</h2>
                      )}

                      {/* Member Code & CIN */}
                      <div className="text-xs font-mono text-slate-600 mt-0.5 flex flex-wrap items-center gap-2 justify-center sm:justify-start rtl:sm:justify-start">
                        {activeCardFields.find((f) => f.key === 'memberCode' && f.enabled) && (
                          <span>رقم العضوية: {member.memberCode}</span>
                        )}
                        {activeCardFields.find((f) => f.key === 'cin' && f.enabled) && (
                          <span>| بطاقة الهوية: {member.cin || '---'}</span>
                        )}
                      </div>
                    </div>

                    {/* Annual Fee Box */}
                    {activeCardFields.find((f) => f.key === 'annualFee' && f.enabled) && (
                      <div className="text-center sm:text-end rtl:sm:text-left bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                        <span className="text-xs text-slate-500 block">
                          {activeCardFields.find((f) => f.key === 'annualFee')?.labelAr || 'مبلغ الإشتراك والمساهمات'}
                        </span>
                        <span className={`text-xl font-extrabold ${themeStyle.primary} font-mono`}>
                          {getMemberTotalPaidContributions(member).toLocaleString()} {settings.currency || 'د.م'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Main Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                {activeCardFields
                  .filter((f) => f.section === 'body_grid' && f.enabled)
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <div
                      key={field.id}
                      className={`p-3.5 bg-slate-50 rounded-xl border border-slate-200 ${
                        field.gridWidth === 'full' ? 'sm:col-span-2' : ''
                      }`}
                    >
                      <span className="text-slate-500 block text-xs mb-1 font-medium">
                        {lang === 'fr' ? (field.labelFr || field.labelAr) : lang === 'en' ? (field.labelEn || field.labelAr) : field.labelAr}:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {resolveFieldValue(field, member)}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Member Contributions Ledger */}
              {(() => {
                const memberContribs = contributions
                  .filter((c) => c.memberId === member.id || (c.memberName && c.memberName.trim().toLowerCase() === member.fullName.trim().toLowerCase()))
                  .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

                const getCatLabel = (cat: string) => {
                  switch (cat) {
                    case 'membership_fee': return lang === 'fr' ? 'Cotisation annuelle' : lang === 'en' ? 'Annual Membership Fee' : 'تجديد / واجب الانخراط السنوي';
                    case 'donation': return lang === 'fr' ? 'Don & Contribution' : lang === 'en' ? 'Donation & Contribution' : 'تبرع ومساهمة مالية';
                    case 'project_support':
                    case 'initiative_proposal':
                      return lang === 'fr' ? 'Initiative spéciale' : lang === 'en' ? 'Special Initiative' : 'اقترح عمل مبادرة خاصة بمساهمتي';
                    case 'initiative_idea':
                      return lang === 'fr' ? 'Proposition d\'initiative' : lang === 'en' ? 'Initiative Proposal' : 'اقتراح مبادرة';
                    case 'charity_zakat':
                    case 'other':
                    default:
                      return lang === 'fr' ? 'Sadaqa, Zakat' : lang === 'en' ? 'Sadaqah, Zakat' : 'صدقة، زكاة';
                  }
                };

                return (
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className={`text-xs font-bold ${themeStyle.headerText} flex items-center gap-1.5`}>
                        <FileCheck className="w-4 h-4" />
                        <span>{lang === 'fr' ? 'سجل المساهمات والاشتراكات :' : lang === 'en' ? 'Contributions & Subscriptions Ledger:' : 'سجل المساهمات والاشتراكات المسجلة:'}</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-500">
                        {memberContribs.length > 0 ? `${memberContribs.length} مساهمات مسجلة` : 'مساهمة الانخراط التأسيسي'}
                      </span>
                    </div>

                    {memberContribs.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
                        <table className="w-full text-xs text-start rtl:text-right">
                          <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                            <tr>
                              <th className="py-2 px-3">{lang === 'fr' ? 'Type' : lang === 'en' ? 'Type' : 'نوع المساهمة'}</th>
                              <th className="py-2 px-3">{lang === 'fr' ? 'Date' : lang === 'en' ? 'Date' : 'تاريخ المساهمة'}</th>
                              <th className="py-2 px-3">{lang === 'fr' ? 'Montant' : lang === 'en' ? 'Amount' : 'المبلغ'}</th>
                              <th className="py-2 px-3 text-center">{lang === 'fr' ? 'Statut' : lang === 'en' ? 'Status' : 'الحالة'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60 bg-white">
                            {memberContribs.slice(0, 6).map((c) => (
                              <tr key={c.id}>
                                <td className="py-2 px-3 font-medium text-slate-800">
                                  {getCatLabel(c.category)}
                                  <span className="block text-[10px] text-slate-500">
                                    طريقة الأداء: {c.paymentMethod === 'bank_transfer' ? 'الحساب البنكي' : c.paymentMethod === 'cash' ? 'نقدًا' : c.paymentMethod === 'check' ? 'شيك بنكي' : c.paymentMethod}
                                    {c.notes && ` • ${c.notes}`}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                                  {c.date}
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-emerald-800 whitespace-nowrap">
                                  {c.amount.toLocaleString()} {settings.currency || 'د.م'}
                                </td>
                                <td className="py-2 px-3 text-center whitespace-nowrap">
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    {c.status === 'completed' || c.status === 'approved' ? 'مكتملة وموثقة' : 'قيد المعالجة'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                        <span>مبلغ الإشتراك والمساهمات:</span>
                        <span className="font-mono font-bold text-emerald-800">{getMemberTotalPaidContributions(member).toLocaleString()} {settings.currency || 'د.م'} (تاريخ الانضمام: {member.joinDate})</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Notice / Transparency Section */}
              {activeCardFields
                .filter((f) => f.section === 'notice' && f.enabled)
                .map((field) => (
                  <div
                    key={field.id}
                    className={`p-4 ${themeStyle.accentBg} rounded-xl border ${themeStyle.accentBorder} text-xs text-slate-700`}
                  >
                    <p className={`font-semibold ${themeStyle.headerText} mb-1 flex items-center gap-1.5`}>
                      <Shield className="w-4 h-4" />
                      <span>{lang === 'fr' ? (field.labelFr || field.labelAr) : lang === 'en' ? (field.labelEn || field.labelAr) : field.labelAr}:</span>
                    </p>
                    <p>{resolveFieldValue(field, member)}</p>
                  </div>
                ))}
            </div>
          )}

          {/* Type 2: Operation Receipt */}
          {type === 'operation_receipt' && operation && (
            <div className="space-y-6">
              <div className={`p-5 rounded-2xl border ${
                operation.type === 'income'
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-rose-50/70 border-rose-200'
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-mono text-slate-600">رقم الوصل: {operation.code}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    operation.type === 'income'
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-rose-200 text-rose-900'
                  }`}>
                    {operation.type === 'income' ? t.incomeType : t.expenseType}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900">{operation.title}</h2>
                <p className="text-xs text-slate-600 mt-1">{operation.description}</p>
                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-sm text-slate-600">المبلغ المالي المؤدى:</span>
                  <span className={`text-2xl font-black font-mono ${
                    operation.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {operation.type === 'income' ? '+' : '-'}{operation.amount.toLocaleString()} {t.currencyShort || 'د.م'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-xs mb-1">تاريخ المعاملة:</span>
                  <span className="font-semibold text-slate-800">{operation.date}</span>
                </div>
                {canViewBalance && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-xs mb-1">الرصيد بعد المعاملة:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {operation.balanceAfter?.toLocaleString() || '---'} {t.currencyShort || 'د.م'}
                    </span>
                  </div>
                )}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-xs mb-1">المسؤول عن التسجيل:</span>
                  <span className="font-semibold text-slate-800">{operation.addedBy}</span>
                </div>
                <div className={`p-3.5 bg-slate-50 rounded-xl border border-slate-200 ${!canViewBalance ? 'col-span-2' : ''}`}>
                  <span className="text-slate-500 block text-xs mb-1">حالة التوثيق:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> موثق ومطابق للسجلات
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Type 3: Comprehensive Financial Statement */}
          {type === 'financial_statement' && (
            <div className="space-y-6">
              <div className="text-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">الكشف المالي والبيان التراكمي للجمعية</h2>
                <p className="text-xs text-slate-500">سجل الشفافية المالية وتوزيع الاعتمادات</p>
              </div>

              {/* Stats Summary */}
              <div className={`grid ${canViewBalance ? 'grid-cols-3' : 'grid-cols-2'} gap-3 text-center`}>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs text-emerald-800 block font-medium">مجموع المداخيل</span>
                  <span className="text-lg font-black text-emerald-900 font-mono">+{totalIncomes.toLocaleString()} د.م</span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-xs text-rose-800 block font-medium">مجموع المصاريف</span>
                  <span className="text-lg font-black text-rose-900 font-mono">-{totalExpenses.toLocaleString()} د.م</span>
                </div>
                {canViewBalance && (
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                    <span className="text-xs text-sky-800 block font-medium">الرصيد الصافي المتبقي</span>
                    <span className="text-lg font-black text-sky-900 font-mono">{balance.toLocaleString()} د.م</span>
                  </div>
                )}
              </div>

              {/* Transactions Mini-table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-start rtl:text-right">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2">التاريخ</th>
                      <th className="p-2">البيان</th>
                      <th className="p-2">النوع</th>
                      <th className="p-2">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {operations.map((op) => (
                      <tr key={op.id} className="hover:bg-slate-50">
                        <td className="p-2 text-slate-600 whitespace-nowrap">{op.date}</td>
                        <td className="p-2 font-medium text-slate-800">{op.title}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            op.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {op.type === 'income' ? 'مدخول' : 'مصروف'}
                          </span>
                        </td>
                        <td className="p-2 font-mono font-bold whitespace-nowrap">
                          {op.type === 'income' ? '+' : '-'}{op.amount.toLocaleString()} د.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer & Official Signatures */}
          <div className="mt-8 pt-6 border-t border-slate-300 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-slate-600">
            {cardSettings.showFooterBank && (
              <div className="space-y-1 w-full sm:w-auto">
                <p className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>{settings.address}</span>
                </p>
                <p className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    الهاتف: {settings.phone}
                    {settings.whatsapp && settings.whatsapp !== settings.phone ? ` | واتساب: ${settings.whatsapp}` : (settings.whatsapp ? ` (واتساب: ${settings.whatsapp})` : '')}
                  </span>
                </p>
                <p className="font-mono text-slate-500">
                  RIB: {settings.ribBank} ({settings.bankName})
                </p>
              </div>
            )}

            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              {/* QR Code */}
              {type === 'member_card' && member && activeCardFields.find((f) => f.key === 'qrCode' && f.enabled) && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs text-center flex flex-col items-center">
                  <div className="w-14 h-14 bg-slate-900 text-white rounded-lg flex items-center justify-center p-1 font-mono text-[9px] text-center">
                    <QrCode className="w-10 h-10 text-white" />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 mt-1">
                    {member.memberCode}
                  </span>
                </div>
              )}

              {/* Stamp & Official Signature Section */}
              {activeCardFields.find((f) => f.key === 'stamp' && f.enabled) && (cardSettings.showStamp || cardSettings.showSignature) && (
                <div className="relative border border-dashed border-slate-300 rounded-xl p-3 bg-white/80 min-w-[220px] max-w-[340px] text-center shadow-2xs print:border-slate-400">
                  <div className="flex items-center justify-center gap-4 min-h-[68px]">
                    {/* Official Stamp (Independent Setting) */}
                    {cardSettings.showStamp && (
                      <div className="flex flex-col items-center justify-center">
                        {cardSettings.stampImageUrl ? (
                          <img
                            src={cardSettings.stampImageUrl}
                            alt="الخاتم الرسمي"
                            className="w-16 h-16 object-contain drop-shadow-xs print:w-16 print:h-16"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full border-2 border-dashed border-blue-600/70 flex items-center justify-center text-[9px] font-bold text-blue-700 text-center p-1">
                            {cardSettings.stampTitleAr || 'الخاتم الرسمي'}
                          </div>
                        )}
                        <span className="text-[10px] font-bold text-slate-700 mt-1 block">
                          {cardSettings.stampTitleAr || 'خاتم إدارة الجمعية'}
                        </span>
                      </div>
                    )}

                    {/* Official Signature (Independent Setting - المطلوب) */}
                    {cardSettings.showSignature && (
                      <div className="flex flex-col items-center justify-center">
                        {cardSettings.signatureImageUrl ? (
                          <img
                            src={cardSettings.signatureImageUrl}
                            alt="التوقيع الرسمي للجمعية"
                            className="h-14 max-w-[140px] object-contain drop-shadow-xs print:h-14"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-14 w-28 border-b-2 border-dashed border-slate-400 flex items-end justify-center pb-1">
                            <span className="text-[9px] text-slate-400">مكان التوقيع</span>
                          </div>
                        )}
                        <span className="text-[10px] font-bold text-slate-700 mt-1 block">
                          {cardSettings.signatureTitleAr || 'توقيع رئيس الجمعية'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1 pt-1 border-t border-slate-200/60 font-medium">
                    وثيقة إلكترونية رسمية صادرة من المنصة
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

